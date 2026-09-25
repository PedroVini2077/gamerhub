import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[24/09]` O botão de curtir não pode SUMIR ao mudar de dono.
 *
 * ── O pedido, e o desenho que ele produziu ────────────────────────────────
 *
 * O dono testou a paginação e reclamou de uma coisa: *"os posts com o ícone do
 * coração acima do comentário, prefiro do lado mesmo"*. Eram duas faixas
 * empilhadas, cada uma com a própria borda — coração numa, "Comentar" na de
 * baixo.
 *
 * O conserto foi entregar o botão à `CommentSection` como `acoes`: ela já
 * desenha a linha do "Comentar", então as duas ações passam a dividir uma
 * faixa só.
 *
 * ── Por que isso PRECISA de trava ─────────────────────────────────────────
 *
 * Porque o botão deixou de morar onde é usado. Se alguém mexer na
 * `CommentSection` e parar de renderizar `{acoes}`, ou se o `PostCard` parar
 * de passá-lo, **o curtir some da tela** — sem erro, sem log, sem teste
 * quebrando. O post continua publicando, comentando e abrindo normalmente.
 *
 * É a forma mais pura do §1.5: as três respostas em "nada". E some justamente
 * a interação mais usada do feed.
 *
 * ── Por que teste de FONTE, e não de render ───────────────────────────────
 *
 * Renderizar o `PostCard` de verdade exigiria montar auth, papel, engajamento,
 * avatar, modais e mídia — mocks que testariam os mocks. O contrato aqui é uma
 * ligação entre dois arquivos, e ler os dois responde exatamente a pergunta.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . `acoes` removido da chamada no PostCard      -> falhou apontando a ponte
 *   . `{acoes}` removido da CommentSection         -> falhou apontando o outro lado
 *   . o `<Heart>` tirado do PostCard               -> falhou dizendo que sumiu
 */

const CARD = 'src/components/feed/PostCard.jsx';
const CARD_DE_COMENTARIO = 'src/components/feed/CommentCard.jsx';
const SECAO = 'src/components/feed/CommentSection.jsx';

const card = readFileSync(CARD, 'utf8');
const secao = readFileSync(SECAO, 'utf8');
const cardDeComentario = readFileSync(CARD_DE_COMENTARIO, 'utf8');

/** Sem comentário: a prosa dos dois arquivos explica a ponte e a citaria. */
const semProsa = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

describe('o curtir fica na linha do comentar, e não some', () => {
  it('o PostCard ainda desenha o botão de curtir', () => {
    expect(semProsa(card), [
      `O botão de curtir sumiu do ${CARD}.`,
      '',
      'Ele é a interação mais usada do feed, e nada quebra quando ele some:',
      'o post continua publicando, comentando e abrindo.',
    ].join('\n')).toMatch(/aria-label=\{`\$\{liked \? 'Descurtir' : 'Curtir'\}/);
  });

  it('o PostCard ENTREGA o botão para a seção de comentários', () => {
    expect(semProsa(card), [
      `${CARD} parou de passar \`acoes\` para a \`CommentSection\`.`,
      '',
      'É essa ponte que põe curtir e comentar na mesma linha. Sem ela o botão',
      'não é renderizado por ninguém — e o coração desaparece da tela sem',
      'nenhum erro.',
      '',
      'Se o layout mudar de propósito, o botão precisa voltar a ser desenhado',
      'em algum lugar ANTES de esta linha sair.',
    ].join('\n')).toMatch(/acoes=\{botaoDeCurtir\}/);
  });

  it('a CommentSection RECEBE e desenha as ações', () => {
    const limpa = semProsa(secao);
    expect(limpa, `${SECAO} parou de aceitar a prop \`acoes\`.`)
      .toMatch(/\bacoes\b[^)]*\)\s*\{/);
    expect(limpa, [
      `${SECAO} aceita \`acoes\` e não renderiza.`,
      '',
      'Prop recebida e ignorada é pior do que prop ausente: o `PostCard`',
      'continua passando, o lint não reclama, e o botão simplesmente não',
      'aparece.',
    ].join('\n')).toContain('{acoes}');
  });

  it('a live também desenha o curtir — lá não há seção para hospedá-lo', () => {
    // No ramo da live o `CommentSection` não é montado. Se o botão só existisse
    // dentro dela, o post ao vivo ficaria sem curtir.
    expect(semProsa(card), [
      'O ramo da LIVE parou de desenhar o botão de curtir.',
      '',
      'Naquele ramo a `CommentSection` não é montada (o comentário acontece no',
      'chat da live), então ninguém mais renderiza o botão — e o post ao vivo,',
      'que é o mais visível do feed, fica sem curtir.',
    ].join('\n')).toMatch(/\{botaoDeCurtir\}/);
  });
});

describe('o bloco de um comentário se identifica para o roteiro', () => {
  it('o CommentCard marca sua raiz com `data-comentario`', () => {
    expect(semProsa(cardDeComentario), [
      `${CARD_DE_COMENTARIO} perdeu o atributo \`data-comentario\`.`,
      '',
      'Ele é a âncora que o `e2e/comentar.mjs` usa para provar que uma resposta',
      'está DENTRO do bloco do comentário pai — e não virou comentário solto,',
      'que é uma falha muda (o texto aparece, só a estrutura está errada).',
      '',
      'Sem ele o roteiro volta a depender de contar níveis de DOM, e isso já',
      'reprovou DUAS respostas corretas: uma por medir posição X, outra quando',
      'o `TextoFormatado` acrescentou um nível à árvore.',
      '',
      'Contrato explícito sobrevive a mudança de aparência; contagem de níveis',
      'não. Se o atributo precisar mudar de nome, mude nos DOIS lugares.',
    ].join('\n')).toMatch(/data-comentario=\{comment\.id\}/);
  });
});
