/**
 * A resolução da cena 3D: começa no melhor que o aparelho pede, e só CAI.
 *
 * ── `[29/08]` A versão anterior fazia o contrário, e ficou horrível ─────────
 *
 * Relato do dono, testando no celular e no PC: *"a cena em 3d ela começa muito
 * pixelada, fica horrível, depois volta ao normal"* e *"o raio ao estourar, a
 * luz verde não fica tão forte quando a landing 3d está ativada"*.
 *
 * Os dois sintomas eram o mesmo defeito, e ele era meu: a cena começava em
 * `dpr` 0,5 e SUBIA. Ou seja, **a primeira coisa que todo visitante via era o
 * pior estado possível** — e o brilho dos `pointLight` do raio, que é o efeito
 * mais bonito da cena, era justamente o que mais sofria, porque queda de
 * resolução borra o degradê da luz.
 *
 * O raciocínio original não era absurdo: começar barato evita pagar a conta
 * cheia durante a amostragem, que cai no meio do carregamento. Mas ele otimizou
 * um número (o TBT do Lighthouse) contra a coisa que o número serve para medir
 * — a experiência de quem abre o site. O dono viu na hora; o Lighthouse nunca
 * veria.
 *
 * ── A regra agora ───────────────────────────────────────────────────────────
 *
 * Começa no que o aparelho pede (o `devicePixelRatio`, preso entre 1 e 1,5, que
 * era o comportamento original) e desce se os quadros atrasarem. **Nunca sobe.**
 *
 * | Antes | Agora |
 * | --- | --- |
 * | primeiro quadro no pior estado, melhora depois | primeiro quadro no melhor estado |
 * | aparelho fraco começa bonito? não | sim, e degrada em ~1/3 de segundo se precisar |
 * | aparelho bom passa por um estado feio | não passa por estado nenhum |
 *
 * **O que isso custa, dito sem maquiagem:** num renderizador por software (o
 * que o Lighthouse e o PageSpeed usam), os ~20 quadros de amostragem agora
 * rodam na resolução cheia antes de a cena cair. Isso devolve parte do TBT que
 * a versão anterior tinha economizado. É uma troca deliberada — decisão do
 * dono, e a certa: enfeite feio é um defeito que o visitante vê, e nota de
 * laboratório não é.
 *
 * A proteção que importa continua de pé: aparelho que não dá conta **desce**, e
 * é ali que os 8.066 ms de thread bloqueada de 29/08 apareciam.
 */

/** Degraus de resolução, do mais barato ao mais caro. */
const DEGRAUS = [0.5, 0.75, 1, 1.5];

/**
 * O teto que o aparelho pede, na mesma conta que o `<Canvas>` fazia com
 * `dpr={[1, 1.5]}`: o `devicePixelRatio` preso entre 1 e 1,5.
 *
 * Acima de 1,5 o ganho é imperceptível numa cena sem texto nem textura fina, e
 * o custo é por pixel — num celular com `devicePixelRatio` 3 isso seria 4×
 * mais pixel para desenhar exatamente a mesma coisa.
 */
export function degrauInicial(devicePixelRatio = 1) {
  const alvo = Math.min(1.5, Math.max(1, devicePixelRatio || 1));
  // O maior degrau que não passa do alvo.
  let indice = 0;
  for (let i = 0; i < DEGRAUS.length; i++) if (DEGRAUS[i] <= alvo) indice = i;
  return indice;
}

/**
 * Quantos quadros entram em cada veredito (~1/6 de segundo a 60 fps).
 *
 * Eram 20, e o número importa mais do que parece: **é o tempo em que um
 * aparelho fraco desenha na resolução cheia antes de a cena cair.** Medido sob
 * freio de CPU de 4×, cada quadro desses custa ~170 ms — então 20 quadros são
 * mais de 3 segundos de thread ocupada que ninguém precisava pagar.
 *
 * 10 corta isso pela metade sem custo visual nenhum: aparelho que aguenta nunca
 * chega a descer, e aparelho que não aguenta é protegido mais cedo.
 *
 * Não desce mais do que isso porque a amostra precisa sobreviver a um engasgo
 * isolado — com 3 ou 4 quadros, um soluço do próprio carregamento rebaixaria
 * para sempre a cena de uma máquina que estava bem.
 */
export const QUADROS_POR_AMOSTRA = 10;

/**
 * Acima disto estamos perdendo quadros de propósito (60 fps = 16,7 ms).
 *
 * Folgado de propósito: um engasgo de origem externa — outra aba, coleta de
 * lixo, o próprio carregamento do site — não pode rebaixar para sempre a cena
 * de um aparelho que estava indo bem.
 */
const LENTO_MS = 28;

/**
 * Um quadro acima disto não é "lento": é um aparelho que não tem como desenhar
 * esta cena nessa resolução. Aí a queda é IMEDIATA, sem esperar a amostra.
 *
 * ── O número que obrigou isto a existir ─────────────────────────────────────
 *
 * O CI mediu **1.938 ms de bloqueio numa janela de 2.000 ms** logo depois de a
 * cena começar a abrir na resolução cheia. A conta fecha exatamente: ~190 ms
 * por quadro no runner (que rasteriza por software) × 10 quadros de amostragem
 * = a janela inteira.
 *
 * Ou seja: começar bonito é certo, mas esperar 10 quadros para decidir custava
 * **dois segundos de tela travada** num aparelho fraco — pior do que a
 * pixelação que a mudança veio corrigir, só que menos visível, porque a tela
 * congela em vez de ficar feia.
 *
 * 100 ms é folgado de propósito: 60 fps são 16,7 ms e até um aparelho ruim fica
 * na casa dos 30–40. Passar de 100 num único quadro é sinal inequívoco, não
 * ruído — e por isso não precisa de amostra para ser levado a sério.
 */
const QUADRO_ABSURDO_MS = 100;

/**
 * Desce um degrau quando os quadros atrasam. **Nunca sobe.**
 *
 * Não subir é decisão, não esquecimento. Começando no melhor estado, subir não
 * teria para onde ir; e permitir voltar a subir depois de uma queda faria a
 * cena oscilar entre dois níveis numa máquina no limiar — e resolução piscando
 * incomoda mais do que resolução estável.
 *
 * @returns {number} o índice novo
 */
export function proximoDegrau({ degrau, mediana }) {
  if (mediana > LENTO_MS && degrau > 0) return degrau - 1;
  return degrau;
}

/**
 * A queda de emergência, decidida por UM quadro.
 *
 * Existe porque a amostra de 10 quadros é rápida para um aparelho normal e
 * lenta demais para um que está sofrendo: são 10 × o custo do quadro, e num
 * aparelho fraco isso vira segundos de tela travada.
 *
 * @returns {boolean} se este quadro sozinho já justifica descer
 */
export function quedaDeEmergencia(deltaMs) {
  return deltaMs > QUADRO_ABSURDO_MS;
}

export const DEGRAUS_DE_RESOLUCAO = DEGRAUS;
