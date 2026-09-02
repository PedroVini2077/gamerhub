import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { BLOCOS, ATUALIZADO_EM } from '../conteudoDaPrivacidade';
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
    const arquivos = [];
    const varrer = (dir) => {
      for (const nome of readdirSync(dir)) {
        const caminho = `${dir}/${nome}`;
        if (statSync(caminho).isDirectory()) {
          if (nome !== '__tests__') varrer(caminho);
        } else if (/\.(js|jsx)$/.test(nome)) arquivos.push(caminho);
      }
    };
    varrer('src');

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
