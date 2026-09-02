/**
 * O som ambiente da landing — GERADO no navegador, sem arquivo nenhum.
 *
 * ── Por que sintetizar em vez de tocar um arquivo ───────────────────────────
 *
 * O dono perguntou se precisava baixar uma música. A resposta é não, e a
 * escolha resolve quatro problemas de uma vez:
 *
 * | Com arquivo | Sintetizado |
 * | --- | --- |
 * | 200–400 KB para baixar | **0 KB** |
 * | precisa hospedar, e egress é a cota mais apertada | nada trafega |
 * | música tem dono — licença é problema real | nada de terceiro |
 * | loop de 30 s fica óbvio na terceira volta | não repete: os osciladores derivam |
 *
 * O custo é de CPU, e é pequeno: três osciladores e dois filtros. O navegador
 * processa isso numa thread de áudio própria, fora da que desenha a página.
 *
 * ── Por que NÃO tenta tocar sozinho ────────────────────────────────────────
 *
 * Chrome, Safari e Firefox bloqueiam áudio antes de um gesto da pessoa, e
 * ninguém quer um site que começa a tocar sozinho. O `AudioContext` só nasce
 * quando alguém clica — antes disso este módulo não aloca absolutamente nada.
 *
 * ── O som ──────────────────────────────────────────────────────────────────
 *
 * Um acorde grave e sustentado, filtrado, com as vozes levemente desafinadas
 * entre si. A desafinação faz o som "respirar" sozinho, sem laço nenhum: as
 * ondas entram e saem de fase num ciclo de minutos. É o truque clássico de
 * ambiente — soa vivo sem nunca chamar atenção.
 */

const VOLUME_ALVO = 0.055;   // bem baixo: é ambiente, não trilha
const SUBIDA_S = 2.5;        // fade in/out longo, para nunca "estalar"

let contexto = null;
let ganho = null;
let vozes = [];

/** Hz das três vozes: uma fundamental grave e duas quintas desafinadas. */
const FREQUENCIAS = [55, 82.5, 110.3];

/**
 * Liga o som. Precisa ser chamado a partir de um gesto da pessoa — é a regra
 * do navegador, não uma escolha nossa.
 *
 * Devolve `false` se o navegador não tiver Web Audio; quem chama decide o que
 * mostrar. Nunca lança: som é enfeite, e enfeite não derruba página.
 */
export function ligarSom() {
  try {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return false;

    if (!contexto) {
      contexto = new Contexto();
      ganho = contexto.createGain();
      ganho.gain.value = 0;

      // Filtro passa-baixa: corta o agudo e deixa só o corpo grave. Sem ele o
      // acorde fica com aquele zumbido de sintetizador barato.
      const filtro = contexto.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 420;
      filtro.Q.value = 0.7;

      ganho.connect(filtro);
      filtro.connect(contexto.destination);

      vozes = FREQUENCIAS.map((hz) => {
        const osc = contexto.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = hz;
        osc.connect(ganho);
        osc.start();
        return osc;
      });
    }

    // Aba que volta do segundo plano deixa o contexto suspenso.
    if (contexto.state === 'suspended') contexto.resume();

    ganho.gain.cancelScheduledValues(contexto.currentTime);
    ganho.gain.setValueAtTime(ganho.gain.value, contexto.currentTime);
    ganho.gain.linearRampToValueAtTime(VOLUME_ALVO, contexto.currentTime + SUBIDA_S);
    return true;
  } catch {
    return false;
  }
}

/**
 * Desliga com fade e SOLTA o áudio.
 *
 * O `close()` é o que devolve a thread de áudio ao sistema — sem ele, os
 * osciladores continuam rodando em silêncio para sempre, gastando CPU e
 * bateria de quem desligou justamente para não gastar.
 */
export function desligarSom() {
  if (!contexto || !ganho) return;
  try {
    const fim = contexto.currentTime + SUBIDA_S;
    ganho.gain.cancelScheduledValues(contexto.currentTime);
    ganho.gain.setValueAtTime(ganho.gain.value, contexto.currentTime);
    ganho.gain.linearRampToValueAtTime(0, fim);

    const paraFechar = contexto;
    const paraParar = vozes;
    contexto = null; ganho = null; vozes = [];

    setTimeout(() => {
      try {
        paraParar.forEach(o => o.stop());
        paraFechar.close();
      } catch { /* já fechado */ }
    }, SUBIDA_S * 1000 + 100);
  } catch { /* som é enfeite: nunca derruba a página */ }
}
