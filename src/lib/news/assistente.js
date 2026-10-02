import { analisarFormatacao } from '../formatacao/analisar';
import { EDITORIAS } from './editorias';
import { sugerirEditoria } from './editoriaProvavel';

/**
 * `[02/10]` O VOCABULÁRIO E O PLACAR SAÍRAM DAQUI.
 *
 * `sugerirEditoria` continua sendo exportada por este módulo — quem importa
 * dela não muda uma linha. O que mudou é onde ela mora: a decisão de editoria
 * virou um modelo de duas camadas (`definem` × `acompanham`) com vocabulário
 * próprio, e isso é outra responsabilidade (§4). O motivo inteiro, e o bug que
 * o produziu, estão no cabeçalho de `editoriaProvavel.js`.
 */
export { sugerirEditoria };

/**
 * `[25/09]` O ASSISTENTE DA MATÉRIA — sugere, nunca decide.
 *
 * ── O que ele é, e o que ele NÃO é ────────────────────────────────────────
 *
 * O dono perguntou se valia pôr recomendação por IA no painel, porque *"ali no
 * painel dá pra colocar só o título e tipo de notícias"*. A resposta que ficou
 * combinada tem uma linha dura no meio:
 *
 *   **cabe** sugerir a partir do que a pessoa JÁ escreveu
 *   **não cabe** escrever a matéria a partir do título
 *
 * O motivo não é técnico, é o que a landing promete: *"apurado pela equipe, sem
 * caça-clique e sem repost sem fonte"*. Texto gerado a partir de um título
 * inventa fato, data e número — e sai com a marca do GamerHub assinando.
 *
 * ── Por que NADA aqui chama modelo nenhum (hoje) ──────────────────────────
 *
 * Tudo neste arquivo é **derivado do texto que já existe**. Isso não é
 * limitação disfarçada de virtude — é que as três sugestões que o painel
 * precisa não exigem modelo:
 *
 *   resumo    são as primeiras frases do corpo, sem marcação
 *   editoria  é casamento contra um vocabulário FECHADO de nove valores
 *   avisos    são perguntas de conferência, e a resposta está no próprio dado
 *
 * Custo zero, resposta instantânea, e **zero chance de alucinar** — que numa
 * seção de notícia é a propriedade que mais importa.
 *
 * O que um modelo acrescentaria (reescrever o resumo com outra voz, propor
 * título alternativo) é melhoria de redação, não de correção — e é chamada
 * PAGA, decisão de custo do dono. O seam existe: quem chamar `sugestoesPara`
 * recebe o mesmo formato, venha de onde vier.
 */

/** O texto puro de um bloco da árvore — sem asterisco, sem marcação. */
const textoDoBloco = (bloco) => {
  const nos = bloco.tipo === 'paragrafo' ? bloco.filhos
    : bloco.tipo === 'citacao' ? bloco.linhas.flat()
      : (bloco.itens ?? []).flat();
  const junta = (lista) => lista.map((no) => (
    no.tipo === 'texto' ? no.valor
      : no.tipo === 'link' ? no.texto
        : junta(no.filhos ?? [])
  )).join('');
  return junta(nos).trim();
};

/** O teto do resumo. `news_articles.resumo` não tem limite de banco; a tela sim. */
export const TETO_DO_RESUMO = 280;

/**
 * Um resumo a partir do CORPO — as primeiras frases, sem marcação.
 *
 * Passa pelo mesmo analisador do post, e não por um `replace` de asterisco: uma
 * segunda forma de tirar marcação divergiria da primeira no dia em que um
 * recurso novo entrasse (§4).
 *
 * Corta em fronteira de FRASE quando dá, e só em fronteira de palavra quando
 * não dá. Resumo cortado no meio de uma palavra parece defeito do site.
 */
export function resumoAutomatico(conteudo) {
  const blocos = analisarFormatacao(conteudo);
  if (!blocos.length) return '';

  const corrido = blocos.map(textoDoBloco).filter(Boolean).join(' ');
  if (!corrido) return '';
  if (corrido.length <= TETO_DO_RESUMO) return corrido;

  const recorte = corrido.slice(0, TETO_DO_RESUMO);
  const fimDeFrase = Math.max(recorte.lastIndexOf('. '), recorte.lastIndexOf('! '), recorte.lastIndexOf('? '));
  if (fimDeFrase > TETO_DO_RESUMO * 0.5) return recorte.slice(0, fimDeFrase + 1).trim();

  const fimDePalavra = recorte.lastIndexOf(' ');
  return `${recorte.slice(0, fimDePalavra > 0 ? fimDePalavra : TETO_DO_RESUMO).trim()}…`;
}

/**
 * O que ainda falta nesta matéria, em português.
 *
 * Não são erros — são **perguntas de conferência**, do tipo que um editor faria
 * antes de mandar para revisão. A tela mostra e não impede nada: transformar
 * isto em bloqueio faria a ferramenta discutir com quem escreve.
 *
 * A ordem é deliberada: falta de fonte vem primeiro porque é a única que
 * contradiz o que a landing promete.
 */
export function avisosDaMateria({ conteudo, resumo, fonte_url: fonte, capa_url: capa, titulo } = {}) {
  const avisos = [];
  const corpo = (conteudo ?? '').trim();

  if (!fonte?.trim()) {
    avisos.push('Sem link de fonte. O News promete "sem repost sem fonte" — se a apuração é própria, tudo bem ignorar.');
  }
  if (!resumo?.trim()) {
    avisos.push('Sem resumo. É o texto que aparece no cartão da lista; sem ele o cartão fica só com o título.');
  }
  if (corpo.length < 280) {
    avisos.push(`O corpo tem ${corpo.length} caracteres. Curto para uma matéria — confira se não ficou faltando o final.`);
  }
  if (!capa?.trim()) {
    avisos.push('Sem capa. O cartão encolhe e funciona, mas a matéria aparece menor na lista.');
  }
  if ((titulo ?? '').length > 90) {
    avisos.push(`O título tem ${titulo.length} caracteres. Acima de ~90 ele corta no cartão em telas pequenas.`);
  }
  return avisos;
}

/**
 * Tudo de uma vez, no formato que a tela consome.
 *
 * Este é o SEAM: se um dia entrar um modelo, ele preenche os mesmos campos e a
 * tela não muda. O que não muda nunca é a regra — sugestão é oferta, e quem
 * aceita é quem assina a matéria.
 */
export function sugestoesPara(artigo = {}) {
  return {
    // `[02/10]` O resumo e o corpo entram como APOIO. Eles já estavam aqui —
    // só o título era olhado, e era desperdício: uma matéria sobre um jogo
    // dificilmente passa dois parágrafos sem dizer "jogo". O título continua
    // pesando mais (ver PESOS em `editoriaProvavel.js`).
    editoria: sugerirEditoria(artigo.titulo, `${artigo.resumo ?? ''} ${artigo.conteudo ?? ''}`),
    resumo: artigo.resumo?.trim() ? null : resumoAutomatico(artigo.conteudo),
    avisos: avisosDaMateria(artigo),
  };
}

/** Os rótulos das editorias, para a tela mostrar a sugestão por extenso. */
export const rotuloSugerido = (slug) => EDITORIAS[slug]?.rotulo ?? null;
