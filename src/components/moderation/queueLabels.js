// Rótulos da fila de moderação, num lugar só — o card, a prévia e o painel
// precisam concordar, e cópias divergem (foi assim com os ícones de log).
export const CONTENT_LABEL = { post: 'Post', comment: 'Comentário', mural: 'Mural', chat: 'Chat' };

// De onde a prévia da fila lê cada tipo. Cada um tem tabela E colunas próprias.
// O `else → community_posts` que existia antes mandava item de `chat` para a
// tabela errada: a linha nunca existia lá, o erro era descartado e o card ficava
// em "Carregando..." para sempre.
//
// `[29/08]` Cada fonte ganhou duas coisas: de onde vem a MÍDIA (a fila mostrava
// só texto, então imagem e vídeo denunciados eram julgados às cegas) e a coluna
// que permite montar o LINK para o conteúdo.
export const FONTE_DO_CONTEUDO = {
  post: {
    tabela: 'posts',
    cols: 'id, title, content, user_id, media_url, media_type, embed_url, profiles(username)',
    midia: { tabela: 'post_media', fk: 'post_id' },
  },
  comment: {
    // `post_id` entra para o link: um comentário só faz sentido dentro do post
    // em que foi escrito.
    tabela: 'comments',
    cols: 'id, content, user_id, post_id, profiles(username)',
  },
  mural: {
    tabela: 'community_posts',
    cols: 'id, message, user_id, profiles(username)',
    midia: { tabela: 'community_post_media', fk: 'post_id' },
  },
  chat: {
    tabela: 'live_chat',
    cols: 'id, message, user_id, post_id, profiles(username)',
  },
};

/**
 * Para onde o moderador é levado ao clicar em "ver no site".
 *
 * ── Por que um mapa, e por que ele devolve `null` de propósito ──────────────
 *
 * Nem todo tipo de conteúdo tem endereço próprio, e inventar um link que leva
 * ao lugar errado é pior do que não ter link: o moderador julga o conteúdo
 * errado. Então o desconhecido devolve `null` e a interface simplesmente não
 * mostra o botão (§4 — nada de escolher um destino por chute).
 *
 * | Tipo | Destino | Por quê |
 * | --- | --- | --- |
 * | post | `/post/:id` | página própria, criada junto com isto |
 * | comment | `/post/:post_id` | comentário só existe dentro do post |
 * | mural | `/mural/:id` | ganhou página própria em 29/08 |
 * | chat | `/lives/:post_id` | a live onde a mensagem foi escrita |
 *
 * @param {string} tipo
 * @param {object} dados a linha carregada pela prévia
 * @returns {string|null} caminho, ou `null` quando não há destino honesto
 */
export function linkDoConteudo(tipo, dados) {
  if (!dados) return null;
  switch (tipo) {
    case 'post':    return `/post/${dados.id}`;
    case 'comment': return dados.post_id ? `/post/${dados.post_id}` : null;
    case 'mural':   return `/mural/${dados.id}`;
    case 'chat':    return dados.post_id ? `/lives/${dados.post_id}` : null;
    default:        return null;
  }
}

// Onde mora o autor de cada tipo — usado pra registrar a violação e pra abrir
// o modal de banimento com a pessoa certa.
export const TABELA_DO_AUTOR = {
  post: 'posts', comment: 'comments', mural: 'community_posts', chat: 'live_chat',
};

// `sem_analise` é o único que NÃO significa "alguma checagem apontou isto".
// Ele significa o oposto: nenhuma checagem conseguiu olhar. O rótulo precisa
// dizer isso, senão o moderador julga pelo critério errado (§1.5).
export const TRIGGER_LABEL = {
  report: 'Denúncias', wordlist: 'Palavrão', ai: 'IA',
  escalation: 'Escalação', links: 'Link perigoso',
  sem_analise: 'Não analisado',
};

export const TRIGGER_COLOR = {
  report: 'text-orange-400', wordlist: 'text-yellow-400', ai: 'text-purple-400',
  escalation: 'text-red-400', links: 'text-red-500',
  // Cinza de propósito: não é acusação, é ausência de informação. Pintá-lo de
  // vermelho sugeriria gravidade que ninguém mediu.
  sem_analise: 'text-gray-400',
};

/**
 * Os tipos que o banco aceita em `moderation_queue.trigger_type`.
 *
 * Fonte única para o teste de contrato: o `CHECK` do banco e os mapas acima
 * precisam concordar. Se divergirem, o INSERT é recusado pelo Postgres (item
 * que nunca chega na fila) ou o painel mostra `undefined` no lugar do rótulo —
 * nos dois casos sem ninguém entender por quê.
 */
export const TIPOS_DE_GATILHO = [
  'report', 'wordlist', 'ai', 'escalation', 'links', 'sem_analise',
];

// Pontos por ação escolhida pelo moderador. Alimentam a escalação automática
// (`trigger_violation_escalation`): 8 pontos suspendem, 15 banem.
export const ACTION_POINTS = { none: 0, warn: 1, hide: 2, suspend_1d: 5, suspend_7d: 10 };

// Ação que NÃO gera registro de infração. Existe para que "não punir" seja uma
// escolha explícita do moderador, e não o que acontece quando ele esquece de
// marcar alguma coisa.
export const SEM_PUNICAO = 'none';

// Chat não tem coluna `hidden_at` — ocultar não existe lá. Confirmar um item de
// chat significa APAGAR a mensagem, então o botão precisa dizer isso.
export const podeSerOcultado = tipo => tipo !== 'chat';
