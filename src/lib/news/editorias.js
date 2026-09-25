/**
 * `[25/09]` AS EDITORIAS DO NEWS — vocabulário fechado, espelhado do banco.
 *
 * ── Por que isto é um mapa e não uma lista de strings soltas ──────────────
 *
 * `news_articles.editoria` tem um `CHECK` com nove valores. Se a tela inventar
 * um décimo, o `INSERT` é recusado pelo banco — isso é bom. O problema é o
 * contrário: se o banco ganhar um valor e a tela não souber dele, o artigo
 * aparece **sem rótulo** e ninguém estoura. É a deriva da FASE 4 do §6, e o
 * sintoma é sempre o mesmo — nada quebra, a informação só some.
 *
 * Por isso a lista daqui é conferida contra o `CHECK` da migration por uma
 * trava (`editoriasNaoDerivam.test.js`), nos DOIS sentidos.
 *
 * ── Rótulo e cor moram aqui, não no componente ────────────────────────────
 *
 * Duas telas vão mostrar editoria (a lista e o artigo), e talvez o painel. Cor
 * escrita em cada uma divergiria — foi o que aconteceu com ícone de log, com
 * rótulo de cargo e com cor de cargo, três vezes (§4, fonte única).
 */

/** slug no banco → como aparece na tela. A ordem é a da navegação. */
export const EDITORIAS = {
  gaming:          { rotulo: 'Games',        cor: 'text-neon-green' },
  hardware:        { rotulo: 'Hardware',     cor: 'text-neon-cyan' },
  tecnologia:      { rotulo: 'Tecnologia',   cor: 'text-neon-cyan' },
  ia:              { rotulo: 'IA',           cor: 'text-neon-purple' },
  internet:        { rotulo: 'Internet',     cor: 'text-neon-purple' },
  geek:            { rotulo: 'Geek',         cor: 'text-neon-pink' },
  'cultura-pop':   { rotulo: 'Cultura pop',  cor: 'text-neon-pink' },
  'filmes-series': { rotulo: 'Filmes e séries', cor: 'text-neon-pink' },
  industria:       { rotulo: 'Indústria',    cor: 'text-gray-400' },
};

/** A ordem em que as abas aparecem. Derivada do mapa — não é segunda lista. */
export const EDITORIAS_EM_ORDEM = Object.keys(EDITORIAS);

/**
 * O rótulo de uma editoria.
 *
 * Valor desconhecido devolve o **próprio slug**, não um palpite e não vazio:
 * quem estiver olhando vê `qualquer-coisa` na tela e sabe que algo derivou.
 * Escolher um rótulo por ele seria o fallback silencioso que o §4 proíbe.
 */
export const rotuloDaEditoria = (slug) => EDITORIAS[slug]?.rotulo ?? slug;

/** A cor. Desconhecida fica neutra — cor é enfeite, não informação. */
export const corDaEditoria = (slug) => EDITORIAS[slug]?.cor ?? 'text-gray-400';

/** A editoria existe? Usado pela tela de filtro e pela trava. */
export const editoriaValida = (slug) => Object.hasOwn(EDITORIAS, slug);
