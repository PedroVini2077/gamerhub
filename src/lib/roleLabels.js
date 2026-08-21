// Fonte única de tudo que a UI mostra sobre um cargo: nome e cor.
//
// Antes isto estava espalhado em ONZE mapas soltos — cinco de nome
// (`ROLE_LABEL` / `roleLabels`) e seis de cor (`roleColors` / `ROLE_COLOR` /
// `ROLE_TAG`) — cada um escrito à mão no arquivo que precisava.
//
// Eles já tinham divergido, sempre do mesmo jeito: os mapas escritos antes de
// o cargo `owner` existir nunca ganharam a chave. No chat da live isso deixava
// o Fundador com o badge VAZIO (lookup de nome sem fallback) e SEM COR
// (`class="tag undefined"`); no painel de moderação ele virava "Player" com a
// cor de usuário comum; no próprio perfil dele, cor de usuário comum.
//
// São dois vocabulários de propósito — painel administrativo diz "Usuário", UI
// social diz "Player" — mas derivam da MESMA tabela, então um cargo novo não
// pode mais entrar em um lugar e faltar no outro.

/** Papéis do sistema, do menor para o maior privilégio. */
export const ROLES = ['user', 'admin', 'super_admin', 'owner'];

const DISPLAY = {
  user:        { admin: 'Usuário',     casual: 'Player',      tag: 'tag-cyan',   dot: '#6b7280' },
  admin:       { admin: 'Admin',       casual: 'Admin',       tag: 'tag-purple', dot: '#a855f7' },
  super_admin: { admin: 'Super Admin', casual: 'Super Admin', tag: 'tag-green',  dot: '#39ff14' },
  owner:       { admin: 'Fundador',    casual: 'Fundador',    tag: 'tag-orange', dot: '#f97316' },
};

/** Nome do cargo no vocabulário dos painéis de administração. */
export function roleLabel(role) {
  return DISPLAY[role]?.admin ?? role ?? 'Usuário';
}

/** Nome do cargo no vocabulário social (chat, popup de avatar). */
export function roleLabelCasual(role) {
  return DISPLAY[role]?.casual ?? 'Player';
}

/** Classe CSS do badge do cargo (ver `.tag-*` em index.css). */
export function roleTag(role) {
  return DISPLAY[role]?.tag ?? 'tag-cyan';
}

/** Cor sólida do cargo, para bolinhas e bordas fora do sistema de `.tag-*`. */
export function roleDotColor(role) {
  return DISPLAY[role]?.dot ?? '#6b7280';
}

export { DISPLAY as ROLE_DISPLAY };
