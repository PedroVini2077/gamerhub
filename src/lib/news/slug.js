/**
 * `[25/09]` O SLUG de um artigo — e ele tem um `CHECK` no banco.
 *
 *   news_articles_slug_formato   CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
 *
 * Ou seja: minúsculas, números e hífen ÚNICO entre grupos. Sem acento, sem
 * espaço, sem hífen no começo nem no fim, sem hífen duplo.
 *
 * ── Por que isto é uma função e não um `replace` na tela ──────────────────
 *
 * Se a tela montar o slug errado, o `INSERT` é recusado por uma constraint — e
 * a mensagem que chega é `violates check constraint "news_articles_slug_formato"`,
 * que não diz a quem escreveu o que fazer. O editor digitou um título com
 * acento e recebeu jargão de Postgres.
 *
 * Aqui o formato é garantido ANTES de sair da tela, e a trava
 * (`slugRespeitaOBanco.test.js`) confere a regra daqui contra a do banco.
 */

/** O `CHECK` do banco, escrito uma vez. A trava compara com a migration. */
export const FORMATO_DO_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Título → slug.
 *
 * Devolve `''` quando não sobra caractere nenhum (título só de emoji, só de
 * pontuação). **Vazio não é slug válido** — quem chama tem de tratar, e é de
 * propósito que esta função não invente um: slug gerado por acaso é link
 * permanente que ninguém escolheu.
 */
export function slugificar(titulo) {
  if (typeof titulo !== 'string') return '';
  return titulo
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')  // "notícia" -> "noticia"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')   // tudo que não serve vira separador
    .replace(/^-+|-+$/g, '');      // sem hífen solto nas pontas
}

/** O slug está no formato que o banco aceita? */
export const slugValido = (slug) => typeof slug === 'string' && FORMATO_DO_SLUG.test(slug);
