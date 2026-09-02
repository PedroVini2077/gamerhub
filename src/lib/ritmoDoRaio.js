/**
 * O compasso dos arcos do raio — contado por DELTA, nunca pelo relógio da cena.
 *
 * ── O bug que originou este arquivo (01/09) ─────────────────────────────────
 *
 * O dono relatou: *"o raio some depois de sair da viewport e voltar"*.
 *
 * A causa está no `@react-three/fiber`, e é fato lido do fonte dele
 * (`setFrameloop`), não dedução:
 *
 *     clock.stop();
 *     clock.elapsedTime = 0;
 *     if (frameloop !== 'never') { clock.start(); clock.elapsedTime = 0; }
 *
 * Ou seja: **o relógio da cena ZERA toda vez que o `frameloop` muda** — e ele
 * muda a cada vez que a cena sai e volta para a tela, porque é exatamente assim
 * que o laço é desligado fora da viewport.
 *
 * Os arcos agendavam o disparo seguinte como `proximo = clock.elapsedTime +
 * intervalo`. Com o relógio zerado e o `proximo` guardando o valor antigo, a
 * condição `elapsedTime >= proximo` fica falsa por todo o tempo acumulado
 * antes: **quem olhou a cena por 40 s fica 40 s sem raio nenhum ao voltar**, e
 * piora quanto mais tempo a pessoa ficou.
 *
 * Nada estourava. A cena continuava desenhando (medido: 185 draws antes, 185
 * depois de voltar) — só o raio ficava mudo. Falha silenciosa clássica.
 *
 * ── A correção ─────────────────────────────────────────────────────────────
 *
 * Tempo acumulado a partir do `delta` de cada quadro. O `delta` é a distância
 * entre dois quadros: ele não sabe nada sobre relógio absoluto e não tem como
 * ser zerado por baixo. O agendamento passa a ser relativo ao próprio ritmo.
 */

/** Um ritmo novo. `atrasoInicial` desencontra o primeiro disparo de cada arco. */
export function criarRitmo(atrasoInicial = 0) {
  return { tempo: 0, proximo: atrasoInicial };
}

/**
 * Avança o ritmo em um quadro e diz se é hora de disparar.
 *
 * O `delta` é limitado a 1 s: quando a aba fica em segundo plano, o navegador
 * segura o `requestAnimationFrame` e o primeiro quadro de volta traz um salto
 * enorme. Sem o teto, esse salto queimaria vários disparos de uma vez e o raio
 * "estouraria" todo junto ao voltar — trocar um defeito por outro.
 */
export function avancar(ritmo, delta) {
  ritmo.tempo += Math.min(delta, 1);
  return ritmo.tempo >= ritmo.proximo;
}

/** Agenda o disparo seguinte para daqui a um intervalo entre `min` e `max`. */
export function agendarProximo(ritmo, min, max, sorteio = Math.random) {
  ritmo.proximo = ritmo.tempo + min + sorteio() * (max - min);
}
