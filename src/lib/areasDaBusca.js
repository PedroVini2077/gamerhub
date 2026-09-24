/**
 * `[24/09]` As áreas da busca — a lista que permite a expansão sem reescrita.
 *
 * ── Por que uma lista, com UMA área dentro ────────────────────────────────
 *
 * O pedido do dono é que a arquitetura permita crescer para notícias, lives e
 * jogos. A forma barata de garantir isso não é construir as cinco agora: é a
 * tela não saber quantas existem. Enquanto ela percorrer esta lista, somar a
 * próxima é somar uma linha aqui — não é mexer no desenho.
 *
 * Hoje são duas de verdade (posts e pessoas) mais a visão "Tudo", que não é
 * uma área: é o conjunto delas.
 *
 * ── O que NÃO está aqui, e é deliberado ───────────────────────────────────
 *
 * `noticias`, `lives` e `jogos`. Aba que não busca nada é pior do que aba
 * ausente — ela promete uma área que não existe e devolve vazio, que quem usa
 * lê como "não achei nada" (§1.5). Elas entram junto com o que buscam.
 */
export const AREAS_DA_BUSCA = [
  { id: 'posts',   rotulo: 'Posts' },
  { id: 'pessoas', rotulo: 'Pessoas' },
];

/** As abas da tela: "Tudo" na frente, depois cada área. */
export const ABAS_DA_BUSCA = [{ id: 'tudo', rotulo: 'Tudo' }, ...AREAS_DA_BUSCA];

/** A aba pedida é conhecida? Query string é entrada de usuário. */
export function abaValida(id) {
  return ABAS_DA_BUSCA.some((a) => a.id === id);
}
