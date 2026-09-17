import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

/**
 * `[17/09]` `robots.txt`, `sitemap.xml` e `llms.txt` — Etapa 1 do Prompt 1.
 *
 * ── O defeito que os três não tinham, e é MUDO ──────────────────────────────
 *
 * Nenhum dos três existia. E a ausência não aparecia como ausência:
 *
 *     /robots.txt   ->  HTTP 200 · text/html
 *     /sitemap.xml  ->  HTTP 200 · text/html
 *     /llms.txt     ->  HTTP 200 · text/html
 *
 * O `vercel.json` reescreve `/(.*)` para `/`, então o rastreador pedia o
 * `robots.txt` e recebia **o HTML do site com status 200**. É pior do que 404:
 * o 404 diz *"não existe"*; o 200 com HTML diz *"existe"* e entrega lixo.
 *
 * Nada estoura, nada vai para log, nenhum teste falhava (§1.5).
 *
 * ── Por que pôr em `public/` resolve, e isso foi MEDIDO ─────────────────────
 *
 * A Vercel checa o sistema de arquivos **antes** de aplicar `rewrites`. Não
 * acreditei nisso de memória: conferi com um arquivo que já estava lá —
 * `/manifest.webmanifest` responde `application/manifest+json` em produção, e
 * não HTML. Logo, estático vence o rewrite.
 *
 * ── O que esta trava protege, e o que ela NÃO protege ───────────────────────
 *
 * Ela garante que os arquivos existem, que o sitemap só lista rota **que existe
 * no router**, e que nada atrás de login entra ali. Ela **não** garante que a
 * Vercel os sirva — isso é produção, e quem verifica é o `curl` depois do
 * deploy.
 */

const ROUTER = 'src/App.jsx';
const DOMINIO = 'https://gamerhub-nine.vercel.app';

/** As rotas do router, separadas por quem pode ver. */
function rotasDoRouter() {
  const fonte = readFileSync(ROUTER, 'utf8');
  const linhas = fonte.split('\n').filter((l) => /<Route\s+path=/.test(l));

  // A guarda do `varrerFontes`: se o router mudar de forma e o casamento parar
  // de achar rota, todas as asserções abaixo passariam por vacuidade.
  expect(
    linhas.length,
    `Nao achei rota nenhuma em ${ROUTER}.\n`
    + '  O router mudou de forma? Sem isto a trava aprova qualquer sitemap.',
  ).toBeGreaterThanOrEqual(10);

  const publicas = [];
  const protegidas = [];
  for (const l of linhas) {
    const path = l.match(/path="([^"]+)"/)?.[1];
    if (!path || path === '*') continue;
    if (/RequireAuth/.test(l)) protegidas.push(path);
    else publicas.push(path);
  }
  return { publicas, protegidas };
}

describe('robots.txt, sitemap.xml e llms.txt', () => {
  it('os três existem em `public/`', () => {
    for (const f of ['public/robots.txt', 'public/sitemap.xml', 'public/llms.txt']) {
      expect(
        existsSync(f),
        `${f} sumiu.\n`
        + '  Sem o arquivo, o `rewrites` do vercel.json entrega o HTML do site\n'
        + '  com status 200 para quem pedir — e 200 com HTML e pior do que 404,\n'
        + '  porque afirma que o arquivo existe.',
      ).toBe(true);
    }
  });

  it('o `robots.txt` aponta o sitemap com URL absoluta', () => {
    const txt = readFileSync('public/robots.txt', 'utf8');
    expect(
      /^Sitemap:\s*https:\/\/\S+\/sitemap\.xml\s*$/m.test(txt),
      'O `robots.txt` perdeu a linha `Sitemap:` com URL ABSOLUTA.\n'
      + '  Caminho relativo nao vale no robots: o rastreador precisa da URL\n'
      + '  inteira para achar o arquivo.',
    ).toBe(true);

    expect(
      /^User-agent:\s*\*/m.test(txt) && /^Allow:\s*\/\s*$/m.test(txt),
      'O `robots.txt` deixou de permitir o rastreamento das paginas publicas.\n'
      + '  Bloquear a landing e a `/sobre` tira o site inteiro da busca.',
    ).toBe(true);
  });

  it('o sitemap só lista rota que EXISTE no router', () => {
    const { publicas } = rotasDoRouter();
    const xml = readFileSync('public/sitemap.xml', 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    expect(locs.length, 'O sitemap ficou sem nenhuma URL.').toBeGreaterThan(0);

    const inventadas = locs
      .map((u) => u.replace(DOMINIO, '') || '/')
      .filter((p) => !publicas.includes(p));

    expect(
      inventadas,
      `O sitemap lista rota que NAO existe no router:\n  ${inventadas.join('\n  ')}\n\n`
      + '  "Nao invente URLs" foi pedido explicito. URL no sitemap que devolve a\n'
      + '  pagina de 404 do SPA e pior do que URL nenhuma: ela gasta a confianca\n'
      + '  do rastreador e nao entrega conteudo.',
    ).toEqual([]);
  });

  it('nada que exija login entra no sitemap', () => {
    const { protegidas } = rotasDoRouter();
    const xml = readFileSync('public/sitemap.xml', 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(DOMINIO, '') || '/');

    expect(
      protegidas.length,
      'Nao achei rota protegida nenhuma no router — a trava ficaria vazia.',
    ).toBeGreaterThan(5);

    // Compara pela RAIZ: `/post/:id` protege `/post/qualquer-coisa`.
    const vazadas = locs.filter((p) =>
      protegidas.some((r) => {
        const raiz = r.split('/:')[0];
        return p === raiz || p.startsWith(raiz + '/');
      }));

    expect(
      vazadas,
      `O sitemap lista rota que exige LOGIN:\n  ${vazadas.join('\n  ')}\n\n`
      + '  Quem rastreia recebe a casca do SPA e indexa uma pagina vazia — e o\n'
      + '  pedido foi explicito: nao expor area autenticada nem painel no\n'
      + '  sitemap. A protecao continua sendo a autenticacao, nao este arquivo.',
    ).toEqual([]);
  });

  it('o `llms.txt` só aponta para páginas públicas, e não inventa nenhuma', () => {
    const { publicas } = rotasDoRouter();
    const txt = readFileSync('public/llms.txt', 'utf8');

    expect(
      /^# GamerHub\s*$/m.test(txt),
      'O `llms.txt` perdeu o H1 com o nome do site — e ele e a primeira coisa\n'
      + '  que a convencao pede.',
    ).toBe(true);

    const links = [...txt.matchAll(/\]\((https?:\/\/[^)]+)\)/g)]
      .map((m) => m[1].replace(DOMINIO, '') || '/');

    expect(links.length, 'O `llms.txt` ficou sem link nenhum.').toBeGreaterThan(2);

    const erradas = links.filter((p) => !publicas.includes(p));
    expect(
      erradas,
      `O \`llms.txt\` aponta para rota que nao e publica (ou nao existe):\n  ${erradas.join('\n  ')}\n\n`
      + '  Ele resume o site para agentes de IA. Mandar um agente para uma\n'
      + '  pagina que exige login, ou para uma que nao existe, e pior do que\n'
      + '  nao ter o arquivo.',
    ).toEqual([]);
  });
});
