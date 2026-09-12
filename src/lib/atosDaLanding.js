/**
 * O ROTEIRO do prólogo da landing — só dados, nenhum pixel.
 *
 * ── Por que o roteiro é um arquivo, e não números soltos no componente ──────
 *
 * `[12/09]` O pedido do dono é uma **narrativa controlada pela rolagem**:
 * *"ARTE → TRANSFORMAÇÃO → CONVERGÊNCIA → MARCA → GAMERHUB"*, com ritmo de
 * *"IMPACTO → RESPIRO → IMPACTO"*. Isso é uma linha do tempo, e linha do tempo
 * escrita direto dentro do JSX vira exatamente o que ele proibiu na regra 20:
 * *"não transforme a página numa timeline gigante impossível de manter"*.
 *
 * Aqui ficam **as janelas** — de onde até onde, na barra de rolagem do prólogo,
 * cada camada entra e sai. O componente lê daqui e não decide nada de ritmo; o
 * ritmo se ajusta neste arquivo, com uma linha, sem abrir JSX nenhum.
 *
 * ── Como ler uma janela ─────────────────────────────────────────────────────
 *
 * O progresso vai de **0** (o prólogo acabou de encostar no topo da tela) a
 * **1** (ele terminou e a página segue). Uma janela `[0.30, 0.42]` quer dizer
 * "isto acontece entre 30% e 42% da rolagem do prólogo".
 *
 * As janelas se SOBREPÕEM de propósito. Foi o outro pedido explícito dele —
 * *"transições contínuas, nunca cortes seco"*: enquanto a frase ainda sai, a
 * arte já começou a recuar. Cena que só começa quando a anterior terminou lê
 * como slide de apresentação, que é o que a landing era.
 */

/**
 * A frase do ATO 0, na letra do dono.
 *
 * Ela é **parte da composição**, não legenda: entra depois da arte já estar na
 * tela, respira sozinha, e sai antes de a transformação começar.
 */
export const FRASE_DO_ATO_ZERO = 'Tudo o que acontece entre gamers, em um só lugar.';

/**
 * Quanta rolagem o prólogo consome, em alturas de tela.
 *
 * `360vh` = a tela do ATO 0 mais ~2,6 telas de rolagem até o hero aparecer.
 *
 * **O número é um orçamento, não gosto.** Curto demais e cada ato vira um
 * susto — o dono pediu respiro entre eles. Longo demais e a pessoa rola achando
 * que a página travou, que é o defeito clássico de scroll preso. Cinco atos com
 * dois respiros couberam aqui; acrescentar ato pede acrescentar altura junto,
 * senão o ritmo aperta em silêncio.
 */
export const ALTURA_DO_PROLOGO = 360;

/**
 * As janelas de cada camada. **Mapa explícito** (§4): camada que ninguém
 * escreveu aqui devolve `undefined` e estoura na hora, em vez de virar um
 * `useTransform` com faixa `NaN` — que o navegador desenha como "nada aparece",
 * sem erro nenhum.
 */
export const JANELAS = {
  /** ATO 0 — a arte chega. Ela já está na tela em 0; o que a janela move é a escala. */
  arteEntra: [0.0, 0.16],
  /**
   * A frase SAI com a rolagem — mas ela **não entra** com ela, e a diferença é
   * o ATO 0 inteiro.
   *
   * Janela de entrada por rolagem significaria frase invisível em progresso 0,
   * que é onde a pessoa chega. Ela veria arte e mais nada, e precisaria rolar
   * para descobrir que havia uma frase — o oposto de "a frase é parte da
   * composição". Então a entrada é por TEMPO, logo depois da abertura
   * (`heroFade`, no componente), e só a saída é por rolagem.
   *
   * RESPIRO: nada se move entre o fim da entrada e 0,30.
   */
  fraseSai: [0.30, 0.44],
  /** TRANSFORMAÇÃO — a arte avança e se desfaz; o véu fecha por cima dela. */
  arteRecua: [0.32, 0.58],
  veuFecha: [0.26, 0.56],
  /** CONVERGÊNCIA — os trajetos chegam de fora e apontam para o centro vazio. */
  convergencia: [0.40, 0.60],
  /** RESPIRO — 0,60 a 0,64 sem movimento novo, antes do impacto da marca. */
  marca: [0.64, 0.84],
  /** GAMERHUB — o hero que já existe assume, e a partir daqui a página é a de sempre. */
  hero: [0.84, 1.0],
};

/**
 * A ordem dos atos, com o nome que o dono usou. Existe para a trava conferir
 * que o roteiro implementado é o roteiro pedido — e para quem ler o arquivo
 * daqui a seis meses entender o desenho sem reconstruir as janelas de cabeça.
 */
export const ATOS = [
  { id: 'arte', rotulo: 'ARTE', pico: 0.10 },
  { id: 'transformacao', rotulo: 'TRANSFORMAÇÃO', pico: 0.44 },
  { id: 'convergencia', rotulo: 'CONVERGÊNCIA', pico: 0.56 },
  { id: 'marca', rotulo: 'MARCA', pico: 0.74 },
  { id: 'gamerhub', rotulo: 'GAMERHUB', pico: 0.95 },
];
