// Rótulos da fila de moderação, num lugar só — o card, a prévia e o painel
// precisam concordar, e cópias divergem (foi assim com os ícones de log).
export const CONTENT_LABEL = { post: 'Post', comment: 'Comentário', mural: 'Mural', chat: 'Chat' };

// De onde a prévia da fila lê cada tipo. Cada um tem tabela E colunas próprias.
// O `else → community_posts` que existia antes mandava item de `chat` para a
// tabela errada: a linha nunca existia lá, o erro era descartado e o card ficava
// em "Carregando..." para sempre.
export const FONTE_DO_CONTEUDO = {
  post:    { tabela: 'posts',           cols: 'id, title, content, user_id, profiles(username)' },
  comment: { tabela: 'comments',        cols: 'id, content, user_id, profiles(username)' },
  mural:   { tabela: 'community_posts', cols: 'id, message, user_id, profiles(username)' },
  chat:    { tabela: 'live_chat',       cols: 'id, message, user_id, profiles(username)' },
};

// Onde mora o autor de cada tipo — usado pra registrar a violação e pra abrir
// o modal de banimento com a pessoa certa.
export const TABELA_DO_AUTOR = {
  post: 'posts', comment: 'comments', mural: 'community_posts', chat: 'live_chat',
};

export const TRIGGER_LABEL = {
  report: 'Denúncias', wordlist: 'Palavrão', ai: 'IA',
  escalation: 'Escalação', links: 'Link perigoso',
};

export const TRIGGER_COLOR = {
  report: 'text-orange-400', wordlist: 'text-yellow-400', ai: 'text-purple-400',
  escalation: 'text-red-400', links: 'text-red-500',
};

// Pontos por ação escolhida pelo moderador. Alimentam a escalação automática
// (`trigger_violation_escalation`): 8 pontos suspendem, 15 banem.
export const ACTION_POINTS = { warn: 1, hide: 2, suspend_1d: 5, suspend_7d: 10 };

// Chat não tem coluna `hidden_at` — ocultar não existe lá. Confirmar um item de
// chat significa APAGAR a mensagem, então o botão precisa dizer isso.
export const podeSerOcultado = tipo => tipo !== 'chat';
