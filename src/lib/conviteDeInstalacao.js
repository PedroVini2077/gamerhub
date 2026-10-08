/**
 * `[08/10]` O CONVITE PARA INSTALAR o GamerHub — e as armadilhas dele.
 *
 * ── O problema que ele resolve ──────────────────────────────────────────────
 *
 * O site **já é instalável** desde que o `manifest.webmanifest` existe: tem
 * `display: standalone`, `start_url` e os três ícones. E ninguém sabe disso,
 * porque o navegador esconde a opção num menu de três pontinhos que quase
 * ninguém abre.
 *
 * ── A armadilha nº 1: o evento dispara UMA vez, e CEDO ─────────────────────
 *
 * `beforeinstallprompt` é disparado pelo navegador quando ele decide que o site
 * é instalável — normalmente **antes do React montar**. Um ouvinte registrado
 * dentro de um componente chega tarde e nunca vê o evento, e o convite
 * simplesmente nunca aparece. Sem erro, sem log: o clássico §1.5.
 *
 * Por isso a captura é chamada do `main.jsx`, junto do service worker, e o que
 * ela guarda fica aqui esperando quem quiser perguntar.
 *
 * ── A armadilha nº 2: o evento NÃO pode ser guardado para depois ───────────
 *
 * `prompt()` só pode ser chamado **uma vez** por evento, e só a partir de um
 * gesto da pessoa. Chamar duas vezes, ou chamar sem clique, é recusado pelo
 * navegador. Por isso o evento é descartado assim que usado.
 *
 * ── Os TRÊS estados, e por que não são dois ────────────────────────────────
 *
 * É a mesma lição do som ambiente (`preferenciaDeSom.js`), e vale aqui pelo
 * mesmo motivo: *"dispensei o convite"* e *"nunca vi o convite"* são coisas
 * diferentes. Colapsar as duas na ausência de chave faria o convite voltar para
 * quem já disse não — e site que insiste no que você recusou é site que não te
 * escuta.
 *
 * ── Onde ele NÃO vai aparecer, e isso não é defeito ────────────────────────
 *
 * **No iPhone.** O Safari não implementa `beforeinstallprompt`: lá a instalação
 * é manual, pelo menu de compartilhar. O convite simplesmente não aparece, e
 * **não há nada a consertar em código** — inventar um passo a passo de iOS aqui
 * seria uma segunda tela para manter, sem nenhum teste possível do nosso lado.
 * Fica anotado no `BACKLOG.md`.
 *
 * **E em quem já instalou.** Um app aberto da gaveta roda em `standalone`, e
 * convidar alguém a instalar o que ela já instalou é ruído.
 */

const CHAVE = 'gh_convite_de_instalacao';

/** O evento que o navegador entregou, ou `null`. Vive só na memória. */
let convite = null;

/** Quem quer saber quando o convite aparece — a tela se inscreve aqui. */
const ouvintes = new Set();

function avisarOuvintes() {
  for (const f of ouvintes) f(Boolean(convite));
}

/**
 * Chamada do `main.jsx`, antes do React montar.
 *
 * O `preventDefault` impede a barra automática do navegador, que aparece onde
 * ela quer e com o texto dela. Trocamos isso por um convite nosso, no nosso
 * lugar e com a nossa voz — e com a possibilidade de respeitar um "não".
 */
export function capturarConviteDeInstalacao() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    convite = evento;
    avisarOuvintes();
  });
  // Quando a instalação acontece, o convite perde o sentido na hora — inclusive
  // se ela veio pelo menu do navegador, sem passar pelo nosso botão.
  window.addEventListener('appinstalled', () => {
    convite = null;
    guardarDecisao('instalou');
    avisarOuvintes();
  });
}

/** O site está rodando como app instalado? */
export function estaInstalado() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  } catch {
    return false;
  }
}

/** `null` = nunca decidiu. Senão, `'dispensou'` ou `'instalou'`. */
export function decisaoGuardada() {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    // Aba anônima e armazenamento bloqueado chegam aqui. Tratar como "nunca
    // decidiu" é o certo: o convite aparece e some com a aba, que é o
    // comportamento esperado de uma janela que não guarda nada.
    return null;
  }
}

export function guardarDecisao(valor) {
  try {
    localStorage.setItem(CHAVE, valor);
  } catch {
    // Não poder guardar não impede nada: o convite some desta sessão porque o
    // estado em memória já mudou. Ele volta na próxima, e isso é melhor do que
    // quebrar a tela por causa de uma preferência.
  }
}

/** O convite deve aparecer agora? */
export function devoConvidar() {
  return Boolean(convite) && !estaInstalado() && decisaoGuardada() === null;
}

/**
 * Abre o convite do navegador. Só a partir de um clique.
 *
 * @returns {Promise<'accepted'|'dismissed'|'indisponivel'>}
 */
export async function abrirConvite() {
  if (!convite) return 'indisponivel';
  const evento = convite;
  // Descartado ANTES de usar: `prompt()` não pode ser chamado duas vezes no
  // mesmo evento, e um clique duplo faria exatamente isso.
  convite = null;
  avisarOuvintes();

  evento.prompt();
  const { outcome } = await evento.userChoice;
  guardarDecisao(outcome === 'accepted' ? 'instalou' : 'dispensou');
  return outcome;
}

/** A pessoa fechou o convite sem instalar. */
export function dispensarConvite() {
  convite = null;
  guardarDecisao('dispensou');
  avisarOuvintes();
}

/** A tela se inscreve para saber quando o convite aparece. */
export function aoMudarConvite(callback) {
  ouvintes.add(callback);
  return () => ouvintes.delete(callback);
}
