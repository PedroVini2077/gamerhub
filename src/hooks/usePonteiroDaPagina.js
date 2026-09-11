import { useEffect } from 'react';

/**
 * UM ouvinte de ponteiro para a página inteira, escrevendo em `:root`.
 *
 * ── Por que ele existe, e o que ele conserta ────────────────────────────────
 *
 * `[11/09]` O `FluxoDeDados` já reagia ao ponteiro, e o desenho dele era o
 * certo: um ouvinte, uma variável de CSS, coalescida por `requestAnimationFrame`,
 * deslocamento no compositor. Parado, custa zero.
 *
 * **O problema não era o custo, era o ALCANCE.** Ele escrevia `--desvio` em
 * `alvo.style`, onde `alvo` é o próprio contêiner dele — então só a subárvore
 * daquele elemento enxergava a variável. Quando o dono pediu que a marca do
 * hero também seguisse o ponteiro (*"queria algo nessa vibe"*), a marca não
 * tinha como ler: ela vive noutro ramo da árvore.
 *
 * As duas saídas, e a segunda cria o bug de amanhã:
 *
 * | | |
 * | --- | --- |
 * | **subir a variável** para `:root` e todo mundo ler dela | **um** ouvinte |
 * | dar um ouvinte próprio à marca | **dois** ouvintes na mesma página, e duas verdades sobre onde o ponteiro está (§4) |
 *
 * ── O que este hook NÃO faz, de propósito ───────────────────────────────────
 *
 * Ele não guarda estado do React. Escrever a posição do ponteiro em `useState`
 * re-renderizaria a árvore inteira a cada movimento — que é exatamente o custo
 * que encareceu a cena 3D. Aqui o JavaScript só informa "o ponteiro está aqui";
 * quem move alguma coisa é o CSS.
 *
 * ── Celular ─────────────────────────────────────────────────────────────────
 *
 * Sem ponteiro fino o ouvinte **nem é registrado** — não há para onde apontar,
 * e registrar para nunca usar é desperdício. Quem lê a variável precisa de
 * valor padrão (`var(--ponteiro-x, 0)`), senão o celular herda `unset` e a
 * conta do `calc` morre.
 */

/** −1 (esquerda) a 1 (direita). */
export const VAR_X = '--ponteiro-x';
/** −1 (topo) a 1 (base). */
export const VAR_Y = '--ponteiro-y';

/**
 * @param {boolean} [ativo] Desligar em telas onde o efeito não existe. O site
 *   logado não usa nenhum — e lá a pessoa está lendo conteúdo, não olhando
 *   enfeite (medido em 02/09: o parallax custava +296 ms durante movimento).
 */
export default function usePonteiroDaPagina(ativo = true) {
  useEffect(() => {
    if (!ativo) return undefined;
    // `matchMedia` não existe em ambiente de teste sem DOM completo, e cair
    // aqui derrubaria a landing inteira por causa de um enfeite.
    let temPonteiroFino = false;
    try {
      temPonteiroFino = window.matchMedia?.('(pointer: fine)').matches ?? false;
    } catch { /* sem matchMedia: trata como celular e não registra nada */ }
    if (!temPonteiroFino) return undefined;

    const raiz = document.documentElement;
    let agendado = false;
    let x = 0;
    let y = 0;

    const aplicar = () => {
      agendado = false;
      raiz.style.setProperty(VAR_X, String(x));
      raiz.style.setProperty(VAR_Y, String(y));
    };

    const aoMover = (e) => {
      x = (e.clientX / window.innerWidth) * 2 - 1;
      y = (e.clientY / window.innerHeight) * 2 - 1;
      // Coalescer é o ponto: o navegador dispara `pointermove` várias vezes por
      // quadro, e escrever a variável em todas é trabalho jogado fora.
      if (!agendado) { agendado = true; requestAnimationFrame(aplicar); }
    };

    window.addEventListener('pointermove', aoMover, { passive: true });
    return () => {
      window.removeEventListener('pointermove', aoMover);
      // Limpar ao sair: sem isto a última posição do ponteiro fica congelada em
      // `:root` e a próxima tela nasce com o enfeite torto, sem ninguém ter
      // movido nada.
      raiz.style.removeProperty(VAR_X);
      raiz.style.removeProperty(VAR_Y);
    };
  }, [ativo]);
}
