// Hierarquia de cargos no cliente — espelha a função SQL `role_rank()` e o
// helper `can_moderate_content()` do banco. A segurança real está no RLS; aqui
// é só pra UI decidir quando mostrar o botão de moderação (esconder quando o
// banco vai recusar de qualquer forma), mantendo as duas pontas consistentes.
export const ROLE_RANK = { user: 1, admin: 2, super_admin: 3, owner: 4 };

export function roleRank(role) {
  return ROLE_RANK[role] || 0;
}

// Pode o `viewerRole` moderar conteúdo de quem tem `authorRole`? Só se seu rank
// for ESTRITAMENTE maior (mesma regra do can_moderate_content no Postgres).
export function canModerate(viewerRole, authorRole) {
  return roleRank(viewerRole) > roleRank(authorRole);
}

// Pode deletar este conteúdo: ou é o próprio autor, ou tem hierarquia pra moderar.
export function canDeleteContent(viewerId, viewerRole, authorId, authorRole) {
  if (!viewerId) return false;
  if (viewerId === authorId) return true;
  return canModerate(viewerRole, authorRole);
}
