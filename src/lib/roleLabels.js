// Fonte única dos nomes de cargo exibidos na UI.
//
// Antes existiam CINCO mapas soltos: `ROLE_LABEL` copiado em Admin.jsx,
// CargosTab.jsx e UsuariosTab.jsx, e `roleLabels` em ChatPanel.jsx,
// ModPanel.jsx e AvatarPopup.jsx. Eles já tinham divergido: os dois das lives
// não tinham a chave `owner`, então o Fundador aparecia com o badge VAZIO no
// chat (sem fallback) e como "Player" no painel de moderação.
//
// São dois vocabulários de propósito — o painel administrativo fala "Usuário",
// a UI social fala "Player" — mas derivam da MESMA tabela, então um cargo novo
// não pode mais entrar em um e faltar no outro.

/** Papéis do sistema, do menor para o maior privilégio. */
export const ROLES = ['user', 'admin', 'super_admin', 'owner'];

const LABELS = {
  user:        { admin: 'Usuário',     casual: 'Player' },
  admin:       { admin: 'Admin',       casual: 'Admin' },
  super_admin: { admin: 'Super Admin', casual: 'Super Admin' },
  owner:       { admin: 'Fundador',    casual: 'Fundador' },
};

/** Nome do cargo no vocabulário dos painéis de administração. */
export function roleLabel(role) {
  return LABELS[role]?.admin ?? role ?? 'Usuário';
}

/** Nome do cargo no vocabulário social (chat, popup de avatar). */
export function roleLabelCasual(role) {
  return LABELS[role]?.casual ?? 'Player';
}

export { LABELS as ROLE_LABELS };
