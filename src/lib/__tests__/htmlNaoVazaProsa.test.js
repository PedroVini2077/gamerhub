import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[24/09]` Comentário de HTML é o único comentário deste projeto que CHEGA
 * ao navegador de quem usa.
 *
 * ── O número que originou esta trava ──────────────────────────────────────
 *
 * Medido na Fase 0 da reorganização de documentação, não suposto:
 *
 *   comentario JSX (chaves + barra-estrela)   227 blocos no fonte -> ZERO no build
 *   comentário de HTML            7 no `index.html`   ->  os 7 no `dist/`
 *
 * O compilador remove o primeiro e não toca no segundo. Os sete eram prosa de
 * implementação — por que o canonical é estático, por que o cartão é JPEG e
 * não WebP, o que sumiu junto com as fontes do Google — e qualquer pessoa os
 * lia em "ver código-fonte".
 *
 * Não é falha de segurança: nada ali é segredo. É **superfície entregue sem
 * motivo**, e é a única parte da documentação interna do projeto que o
 * visitante baixa junto com a página.
 *
 * ── Por que a prosa não foi apagada ───────────────────────────────────────
 *
 * Apagar explicação é o oposto de organizar (ordem do dono: *"Organizar não
 * significa apagar"*). Os sete blocos foram COPIADOS inteiros para a seção
 * "O `index.html` — o que cada linha faz, e por quê" do `docs/ARQUITETURA.md`.
 *
 * Por isso esta trava confere as DUAS pontas. Só exigir "nenhum comentário"
 * aprovaria alguém que deleta a prosa em vez de mudá-la de lugar — e o teste
 * ficaria verde justamente no caso que ele existe para impedir.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . um `<!-- ... -->` de volta no index.html  -> falhou citando o trecho
 *   . a seção removida do ARQUITETURA.md        -> falhou apontando o destino
 */

const HTMLS = ['index.html'];

// `public/` pode ganhar HTML solto (uma página de erro, um teste). Varrer a
// pasta em vez de listar arquivo é o que evita a trava nascer desatualizada.
const PUBLIC = 'public';
for (const nome of readdirSync(PUBLIC)) {
  if (nome.endsWith('.html')) HTMLS.push(join(PUBLIC, nome));
}

const DESTINO = 'docs/ARQUITETURA.md';
const TITULO_DA_SECAO = 'O `index.html` — o que cada linha faz, e por quê';

describe('HTML servido ao visitante não carrega prosa de implementação', () => {
  it.each(HTMLS)('%s não tem comentário de HTML', (arquivo) => {
    const fonte = readFileSync(arquivo, 'utf8');
    const achados = fonte.match(/<!--[\s\S]*?-->/g) || [];

    expect(achados, [
      `${arquivo} voltou a ter ${achados.length} comentário(s) de HTML.`,
      '',
      ...achados.map((c) => `    ${c.slice(0, 120).replace(/\s+/g, ' ')}…`),
      '',
      'Diferente do comentário JSX, este NÃO é removido pelo build: ele vai',
      'inteiro para o `dist/` e qualquer visitante o lê em "ver código-fonte".',
      '',
      `A explicação mora em ${DESTINO}, na seção`,
      `"${TITULO_DA_SECAO}". Escreva lá e deixe o HTML só com o que faz alguma`,
      'coisa.',
    ].join('\n')).toHaveLength(0);
  });

  it('a prosa tem um destino de verdade, e ele continua lá', () => {
    const doc = readFileSync(DESTINO, 'utf8');

    expect(doc, [
      `A seção "${TITULO_DA_SECAO}" sumiu de ${DESTINO}.`,
      '',
      'Ela é o destino da prosa que saiu do `index.html`. Sem ela, a metade de',
      'cima desta trava passa a premiar quem APAGA a explicação em vez de',
      'mudá-la de lugar — que é exatamente o contrário do que ela existe para',
      'fazer.',
      '',
      'Se a seção mudou de nome ou de arquivo, atualize as constantes aqui.',
    ].join('\n')).toContain(TITULO_DA_SECAO);

    // O título sozinho seria uma casca: alguém pode manter o cabeçalho e
    // esvaziar o corpo. Estes são os quatro porquês que não existem em mais
    // lugar nenhum — se um sumir, a informação morreu de verdade.
    for (const [trecho, oQueEle] of [
      ['SearchAction', 'por que o dado estruturado não declara busca'],
      ['WebP', 'por que o cartão é JPEG'],
      ['preconnect', 'o que sumiu quando as fontes saíram do Google'],
      ['utm_source', 'por que existe um canonical estático'],
    ]) {
      expect(doc, [
        `A seção perdeu "${trecho}" — ${oQueEle}.`,
        '',
        'Manter o cabeçalho e esvaziar o corpo deixaria esta trava verde com a',
        'informação perdida. O `index.html` não a tem mais: ela só existe aqui.',
      ].join('\n')).toContain(trecho);
    }
  });
});
