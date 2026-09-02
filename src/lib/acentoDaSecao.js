/**
 * A cor de acento do fundo animado, por seção do site logado.
 *
 * ── A decisão que isto executa ──────────────────────────────────────────────
 *
 * Do dono, em 02/09: *"pode fazer o mesmo fundo pra todas as rotas então"*. O
 * raciocínio inteiro está em `docs/DECISOES.md`; o resumo é que cinco fundos
 * diferentes seriam cinco fontes de verdade que divergem — já divergiram neste
 * projeto com ícones de log, rótulos e cores de cargo (§4).
 *
 * O que varia é **só a cor**. O componente é um só: `FluxoDeDados`, o mesmo da
 * landing, com `parallax={false}` porque o site logado é onde mais se rola.
 *
 * ── Por que mapa explícito, e o que acontece com rota desconhecida ──────────
 *
 * `acentoDaSecao` devolve `undefined` para caminho que não está aqui, e quem
 * chama trata isso como "sem fundo". **Não existe cor padrão**, e a ausência é
 * deliberada: um `?? verde` faria toda tela nova nascer com fundo sem ninguém
 * ter escolhido — e ninguém descobriria que faltou decidir. É o fallback
 * silencioso do §4.
 */

/** Prefixo da rota → cor. A ordem importa: o primeiro que casar vence. */
const ACENTOS = [
  ['/community', '#a855f7'],  // mural — roxo
  ['/lives',     '#f87171'],  // lives — vermelho
  ['/keys',      '#22d3ee'],  // keys — ciano
  ['/ranks',     '#facc15'],  // ranks — amarelo
  ['/profile',   '#22d3ee'],
  ['/u/',        '#22d3ee'],
  ['/settings',  '#6b7280'],  // configurações — cinza, é tela de ajuste
  ['/post/',     '#39ff14'],
  ['/mural/',    '#a855f7'],
  // O feed é a raiz do site logado, e fica por último porque `/` casaria com
  // tudo se viesse antes.
  ['/',          '#39ff14'],  // feed — verde, a cor da marca
];

/**
 * As áreas de equipe NÃO recebem fundo.
 *
 * Painel é ferramenta de trabalho: quem está ali está lendo log, conferindo
 * denúncia e decidindo punição. Movimento atrás desse texto atrapalha em vez
 * de ambientar — e é a mesma razão pela qual o site logado é mais quieto que a
 * landing.
 */
const SEM_FUNDO = ['/admin', '/owner'];

/**
 * @param {string} caminho `location.pathname`
 * @returns {string|undefined} a cor, ou `undefined` quando a seção não tem
 *   fundo. Quem chama não desenha nada nesse caso.
 */
export function acentoDaSecao(caminho) {
  if (typeof caminho !== 'string') return undefined;
  if (SEM_FUNDO.some(p => caminho.startsWith(p))) return undefined;
  return ACENTOS.find(([prefixo]) => caminho.startsWith(prefixo))?.[1];
}

/** Exportado para o teste conferir que toda rota do App foi considerada. */
export const PREFIXOS_COM_ACENTO = ACENTOS.map(([p]) => p);
export const PREFIXOS_SEM_FUNDO = SEM_FUNDO;
