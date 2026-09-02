import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrerFontes } from '../../../lib/__tests__/varrerFontes';
import {
  BLOCOS, ATUALIZADO_EM, CHAVES_DECLARADAS, TERCEIROS_DECLARADOS,
} from '../conteudoDaPrivacidade';
import { iconeDoBloco } from '../../sobre/iconesDoSobre';

/**
 * Trava da política de privacidade.
 *
 * ── O risco específico deste texto ──────────────────────────────────────────
 *
 * Uma política de privacidade não é conteúdo comum: ela **promete** coisas
 * sobre o sistema. Se o sistema mudar e o texto ficar, a página passa a
 * afirmar algo falso para quem confia nela — e, diferente de um bug, ninguém
 * vê pela tela que aconteceu.
 *
 * A afirmação mais frágil é a dos cookies. Hoje ela é verdadeira (medido: um
 * navegador limpo na landing não cria cookie nenhum). Basta alguém adicionar
 * um serviço que use cookie para esta página virar mentira — então o teste
 * varre o código atrás de escrita de cookie.
 */
describe('conteúdo da privacidade', () => {
  it('todo bloco está completo: título, ícone e conteúdo', () => {
    const quebrados = BLOCOS.filter(b => !b.titulo || !b.icone
      || (b.pendente ? !b.dica : !b.paragrafos?.length)).map(b => b.id || '(sem id)');
    expect(quebrados, `blocos incompletos: ${quebrados.join(', ')}. Bloco pendente `
      + 'precisa de `dica`; bloco normal precisa de `paragrafos`.').toEqual([]);
  });

  it('todo ícone declarado existe no mapa compartilhado', () => {
    const orfaos = BLOCOS.filter(b => !iconeDoBloco(b.icone)).map(b => `${b.id} -> ${b.icone}`);
    expect(orfaos, `ícone que o mapa não conhece: ${orfaos.join(', ')}. `
      + 'Registre em components/sobre/iconesDoSobre.js — o mapa é compartilhado '
      + 'entre a Sobre e a Privacidade de propósito, para não haver duas fontes.')
      .toEqual([]);
  });

  it('toda tabela tem o mesmo número de colunas em todas as linhas', () => {
    const tortas = [];
    for (const b of BLOCOS) {
      if (!b.tabela) continue;
      const n = b.tabela.colunas.length;
      b.tabela.linhas.forEach((l, i) => {
        if (l.length !== n) tortas.push(`${b.id} linha ${i + 1}: ${l.length} de ${n}`);
      });
    }
    expect(tortas, `tabela desalinhada: ${tortas.join(' · ')}`).toEqual([]);
  });

  it('a data de atualização tem formato de data', () => {
    expect(ATUALIZADO_EM).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

/**
 * A trava que realmente protege quem lê: a página afirma que o site não usa
 * cookies. Se alguém passar a usar, o texto vira promessa falsa.
 */
describe('a promessa sobre cookies continua verdadeira', () => {
  it('nenhum código do site escreve cookie', () => {
    // `varrerFontes` estoura se não achar arquivo: sem essa guarda, um caminho
    // errado deixaria a promessa sobre cookies "verificada" sem verificar nada.
    const arquivos = varrerFontes('src');

    const escrevem = arquivos.filter((f) => {
      const codigo = readFileSync(f, 'utf8')
        .split('\n')
        .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
        .join('\n');
      return /document\.cookie\s*=/.test(codigo) || /cookieStore\.set/.test(codigo);
    });

    expect(escrevem, escrevem.length === 0 ? '' : (
      `\n  ${escrevem.length} arquivo(s) passaram a escrever cookie:\n`
      + escrevem.map(f => `    ${f}`).join('\n')
      + '\n\n  A página /privacidade AFIRMA que o site não usa cookie nenhum, e\n'
      + '  essa afirmação foi medida num navegador limpo. Se isso mudou, o\n'
      + '  texto virou promessa falsa para quem confia nele.\n\n'
      + '  Atualize components/privacidade/conteudoDaPrivacidade.js ANTES de\n'
      + '  seguir — e reveja se o cookie novo exige consentimento.\n'
    )).toEqual([]);
  });
});

/**
 * ── A TRAVA DE CRESCIMENTO ──────────────────────────────────────────────────
 *
 * Pedido do dono em 02/09: a política precisa estar **sempre** atualizada,
 * porque o site vai crescer.
 *
 * Promessa não sustenta isso — a política de ontem descrevia o site de ontem.
 * Estes dois testes fazem a coleta NOVA reprovar o PR: quem acrescentar uma
 * chave no navegador ou uma dependência que manda dado para fora precisa
 * dizer, na página, o que passou a acontecer.
 *
 * É o mesmo desenho do `realtimeTables.js` e do `tabelasSemUpdate.js`: uma
 * lista declarada no código, cruzada com o que o código realmente faz.
 */
describe('a política acompanha o crescimento do site', () => {
  it('toda chave gravada no navegador está declarada na política', () => {
    // `varrerFontes` estoura se não achar arquivo: sem essa guarda, um caminho
    // errado deixaria a promessa sobre cookies "verificada" sem verificar nada.
    const arquivos = varrerFontes('src');

    // As chaves são constantes (`const CHAVE = 'gh_...'`), então o valor é o
    // que se procura — e o prefixo `gh_` é a convenção que as identifica.
    const usadas = new Set();
    for (const f of arquivos) {
      const codigo = readFileSync(f, 'utf8');
      if (!/(localStorage|sessionStorage)\./.test(codigo)) continue;
      for (const m of codigo.matchAll(/'(gh_[a-z0-9_]+)'/g)) usadas.add(m[1]);
    }

    const naoDeclaradas = [...usadas].filter(k => !CHAVES_DECLARADAS.includes(k));
    expect(naoDeclaradas, naoDeclaradas.length === 0 ? '' : (
      `\n  ${naoDeclaradas.length} chave(s) guardadas no navegador de quem usa o site,\n`
      + '  e que a política de privacidade NÃO menciona:\n'
      + naoDeclaradas.map(k => `    ${k}`).join('\n')
      + '\n\n  A página /privacidade lista o que o site guarda no navegador. Guardar\n'
      + '  algo que ela não menciona faz a página passar a mentir por omissão.\n\n'
      + '  Acrescente a chave na tabela do bloco "cookies" (para quem lê) E em\n'
      + '  CHAVES_DECLARADAS (para este teste conferir).\n'
    )).toEqual([]);
  });

  it('toda dependência que manda dado para fora está declarada na política', () => {
    const { dependencies = {} } = JSON.parse(readFileSync('package.json', 'utf8'));
    // Critério: manda alguma coisa para servidor de terceiro. Anima, formata ou
    // desenha não conta — o que conta é a pessoa aparecer no registro de outra
    // empresa.
    const MANDAM_DADO = /sentry|supabase|analytics|speed-insights|posthog|segment|mixpanel|amplitude|hotjar|clarity|datadog|logrocket|bugsnag|rollbar/i;

    const naoDeclarados = Object.keys(dependencies)
      .filter(d => MANDAM_DADO.test(d))
      .filter(d => !TERCEIROS_DECLARADOS.includes(d));

    expect(naoDeclarados, naoDeclarados.length === 0 ? '' : (
      `\n  ${naoDeclarados.length} dependência(s) que enviam dado para fora e que a\n`
      + '  política de privacidade NÃO menciona:\n'
      + naoDeclarados.map(d => `    ${d}`).join('\n')
      + '\n\n  A página /privacidade lista quem mais recebe alguma coisa. Ligar um\n'
      + '  serviço novo sem atualizá-la é fazer a pessoa aparecer no registro de\n'
      + '  outra empresa sem que a página diga isso.\n\n'
      + '  Antes de declarar: veja O QUE ele recebe, se dá para mandar menos, e\n'
      + '  se ele usa cookie — a página afirma que nao ha nenhum.\n'
    )).toEqual([]);
  });
});
