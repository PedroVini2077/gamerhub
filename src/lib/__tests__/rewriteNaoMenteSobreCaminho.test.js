import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[01/10]` O rewrite de SPA NÃO pode responder por `/.well-known/`.
 *
 * ── O defeito, e ele foi MEDIDO com o Lighthouse de verdade ────────────────
 *
 * O `rewrites: "/(.*)" -> "/"` fazia **toda** URL devolver `HTTP 200` com o
 * `index.html`. Para rota de app isso é o comportamento certo — é assim que o
 * router desenha a própria tela de 404. Para `/.well-known/`, que é namespace
 * de máquina (RFC 8615), é mentira pura: nenhuma pessoa navega até lá, e a
 * ferramenta que sonda conclui que o arquivo existe.
 *
 * O Lighthouse 13.5 trouxe a auditoria `ard-schema`, que busca o catálogo de
 * agentes em `/.well-known/ai-catalog.json` quando não há outro ponteiro.
 * Rodado sobre o nosso `dist`:
 *
 *     200 com HTML  ->  score=0     · binary          "schema is invalid"
 *                       Malformed JSON: Unexpected token '<', "<!doctype "...
 *     404           ->  score=null  · notApplicable
 *
 * Mesma página, mesmo build, UMA variável trocada. Catálogo ausente não
 * reprova; catálogo que não carrega, sim. **Não faltava recurso — nós é que
 * dizíamos que o arquivo existia.**
 *
 * ── É a mesma classe do `robots.txt` de 17/09 ──────────────────────────────
 *
 * A trava daquele dia já tinha escrito a frase: *"é pior do que 404: o 404 diz
 * 'não existe'; o 200 com HTML diz 'existe' e entrega lixo"*. Medidos na
 * produção, todos 200 com `text/html`: `security.txt`, `change-password`,
 * `apple-app-site-association`, `assetlinks.json`, `openid-configuration`,
 * `host-meta`.
 *
 * ── Por que esta trava reprova nos DOIS sentidos ───────────────────────────
 *
 * Fechar o `/.well-known/` é fácil; fechar o site junto é o acidente. Se
 * alguém trocar a expressão por algo mais amplo, rota de app passa a dar 404 e
 * o site inteiro quebra — foi o que aconteceu três vezes com as portas do
 * banco (`e2e/portas-do-banco.mjs` existe por isso). Então aqui se exige as
 * duas coisas: o que TEM de cair no SPA, e o que NÃO pode.
 */

const CONFIG = JSON.parse(readFileSync('vercel.json', 'utf8'));

/** O `source` do Vercel é path-to-regexp; para estes casos, regex basta. */
function caiNoSpa(caminho) {
  const [regra] = CONFIG.rewrites;
  return new RegExp(`^${regra.source}$`).test(caminho);
}

describe('o rewrite de SPA não responde por caminho de máquina', () => {
  it('existe exatamente uma regra, e ela aponta para a raiz', () => {
    // Mais de uma regra muda a ordem de precedência e invalida o raciocínio
    // desta trava inteira — ela lê a primeira.
    expect(CONFIG.rewrites).toHaveLength(1);
    expect(CONFIG.rewrites[0].destination).toBe('/');
  });

  it('NENHUM caminho sob `/.well-known/` cai no SPA', () => {
    const sondados = [
      '/.well-known/ai-catalog.json',      // o do Lighthouse
      '/.well-known/ard.json',             // o sucessor dele no spec v0.91
      '/.well-known/security.txt',
      '/.well-known/change-password',
      '/.well-known/apple-app-site-association',
      '/.well-known/assetlinks.json',
      '/.well-known/openid-configuration',
      '/.well-known/host-meta',
      '/.well-known/qualquer-coisa-que-ainda-nao-existe',
    ];
    const vazando = sondados.filter(caiNoSpa);

    expect(vazando, 'estes caminhos de MÁQUINA voltaram a receber o HTML do site '
      + 'com HTTP 200:\n  ' + vazando.join('\n  ') + '\n\n'
      + '  Ferramenta que sonda o caminho conclui que o arquivo EXISTE e tenta\n'
      + '  interpretar o `<!doctype html>` — foi assim que o Lighthouse passou a\n'
      + '  reprovar `ard-schema` com "Malformed JSON". Devolver 404 faz a mesma\n'
      + '  auditoria virar `notApplicable`, que e a verdade.\n'
      + '  Conserto: manter o `(?!\\.well-known/)` no `source` do vercel.json.')
      .toEqual([]);
  });

  it('TODA rota de app continua caindo no SPA', () => {
    // O acidente oposto, e o mais caro: fechar demais derruba o site. O router
    // precisa receber ate o caminho errado, porque e ele quem desenha o 404.
    const doApp = [
      '/', '/publicar', '/profile', '/settings', '/news', '/lives',
      '/post/123', '/u/alguem', '/mural/abc', '/admin', '/owner',
      '/caminho-que-nao-existe', '/busca?q=x'.split('?')[0],
      '/.well-knownx/nao-e-o-namespace',   // parecido, mas NAO e o namespace
    ];
    const quebrados = doApp.filter((c) => !caiNoSpa(c));

    expect(quebrados, 'estas rotas DEIXARAM de cair no SPA e passariam a dar 404:\n  '
      + quebrados.join('\n  ') + '\n\n'
      + '  Isso derruba a navegacao do site inteiro, inclusive a propria tela de\n'
      + '  404 do router. Fechar o /.well-known/ nao pode fechar o resto junto.')
      .toEqual([]);
  });
});
