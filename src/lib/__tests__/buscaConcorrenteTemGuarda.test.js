import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

/**
 * `[24/09]` Toda busca de lista que roda de DOIS gatilhos tem guarda de corrida.
 *
 * ── O bug ─────────────────────────────────────────────────────────────────
 *
 * Quando a mesma função de carregar lista é disparada por um efeito (abrir a
 * seção, trocar o filtro, um evento de realtime) E depois de uma escrita, as
 * duas podem estar em voo ao mesmo tempo. Se a PRIMEIRA responder por último,
 * ela devolve o estado de ANTES da escrita e apaga o que acabou de aparecer.
 *
 * Aconteceu de verdade: o comentário sumia da tela segundos depois de ser
 * publicado, vivo no banco, sem erro e sem log (§1.5 com as três respostas em
 * "nada"). A reprodução está em
 * `src/components/feed/__tests__/comentarioNaoSomeDepoisDeAparecer.test.jsx`.
 *
 * ── Por que uma lista escrita à mão, e não uma varredura ──────────────────
 *
 * Porque "esta função pode rodar concorrente consigo mesma" não é detectável
 * por regex sem chutar: metade das buscas do projeto roda de um gatilho só e
 * não precisa de guarda nenhuma. Um detector fuzzy acusaria as duas metades e
 * viraria ruído (§0.2, 4ª regra) — e ruído ensina a ignorar o canal.
 *
 * Então a lista é o inventário dos casos CONHECIDOS, e o valor dela é impedir
 * que a guarda seja removida de um deles em silêncio. Caso novo entra aqui a
 * mão, e a mensagem abaixo diz como.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . guarda removida do `CommentSection.jsx`  -> falhou nomeando o arquivo
 *   . lista esvaziada                          -> falhou apontando o zero
 */

const GUARDA = 'useApenasAUltimaResposta';

/** Os casos conhecidos: a mesma busca disparada por dois gatilhos diferentes. */
const BUSCAS_CONCORRENTES = [
  ['src/components/feed/CommentSection.jsx',
   'abrir a seção × publicar um comentário'],
  ['src/hooks/useMensagensDeContato.js',
   'trocar o filtro × marcar ou responder uma mensagem'],
  ['src/hooks/useXpDasLives.js',
   'evento de realtime × invalidar ou revalidar uma sessão'],
];

describe('busca que roda de dois gatilhos tem guarda de corrida', () => {
  it('a lista não foi esvaziada', () => {
    expect(BUSCAS_CONCORRENTES.length, [
      'A lista BUSCAS_CONCORRENTES ficou vazia.',
      '',
      'Uma trava que percorre lista vazia não falha nunca e continua dando',
      'verde — que é a falsa confiança do §6.3, não proteção.',
    ].join('\n')).toBeGreaterThanOrEqual(3);
  });

  it('o hook da guarda existe onde a lista aponta', () => {
    const caminho = `src/hooks/${GUARDA}.js`;
    expect(existsSync(caminho), [
      `O hook \`${GUARDA}\` sumiu de ${caminho}.`,
      '',
      'Sem ele, as checagens abaixo passariam a procurar um nome que não',
      'existe mais e falhariam todas de uma vez, apontando o lugar errado.',
    ].join('\n')).toBe(true);
  });

  it.each(BUSCAS_CONCORRENTES)('%s usa a guarda', (arquivo, gatilhos) => {
    expect(existsSync(arquivo), `${arquivo} não existe — renomeado? Atualize a lista aqui.`).toBe(true);
    const fonte = readFileSync(arquivo, 'utf8');

    const recado = [
      `${arquivo} carrega lista de DOIS gatilhos (${gatilhos}) e perdeu a`,
      `guarda \`${GUARDA}\`.`,
      '',
      'Sem ela, a resposta da busca mais VELHA chega por último e sobrescreve',
      'a mais nova. Não há erro, não há log, e o banco fica certo — a pessoa',
      'só vê o que acabou de fazer desaparecer da tela.',
      '',
      'O formato é:',
      '',
      '    const novoPedido = useApenasAUltimaResposta();',
      '    const carregar = useCallback(async () => {',
      '      const aindaVale = novoPedido();   // ANTES do await',
      '      const { data } = await buscar();',
      '      if (!aindaVale()) return;',
      '      setLista(data);',
      '    }, [novoPedido]);',
      '',
      'Se esta busca deixou de rodar de dois gatilhos, tire a linha da lista',
      'em vez de tirar a guarda — e escreva ao lado por que ela saiu.',
    ].join('\n');

    expect(fonte, recado).toContain(GUARDA);
    expect(fonte, recado).toContain('aindaVale()');

    // A ordem importa: `novoPedido()` chamado DEPOIS do `await` mediria o
    // instante errado e a guarda ficaria verde para sempre sem proteger nada.
    const marcou = fonte.indexOf('novoPedido()');
    const conferiu = fonte.indexOf('if (!aindaVale())');
    expect(marcou, `${arquivo}: não achei a chamada \`novoPedido()\`.`).toBeGreaterThan(-1);
    expect(marcou < conferiu, [
      `${arquivo}: \`novoPedido()\` aparece DEPOIS do \`if (!aindaVale())\`.`,
      '',
      'A marca tem de ser feita antes do `await` — é ela que registra a ordem',
      'dos pedidos. Marcar depois compara o pedido consigo mesmo e a guarda',
      'passa a aprovar tudo, inclusive a resposta velha.',
    ].join('\n')).toBe(true);
  });
});
