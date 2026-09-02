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

/**
 * Hz das vozes.
 *
 * `[02/09]` A primeira versão usava 55, 82,5 e 110 Hz — e o dono relatou que
 * **não tocava nada**. A causa é física, não de código: alto-falante de celular
 * e de notebook tem centímetros de diâmetro e não reproduz abaixo de ~200 Hz.
 * O sinal existia e ninguém conseguia ouvir.
 *
 * A faixa agora começa em 220 Hz (o lá abaixo do dó central) e sobe em
 * intervalos consonantes. Continua grave o bastante para soar ambiente, e
 * dentro do que qualquer alto-falante entrega.
 *
 * As duas últimas estão levemente desafinadas de propósito: a diferença faz as
 * ondas entrarem e saírem de fase num ciclo de minutos, e é isso que dá a
 * sensação de "respirar" sem laço nenhum.
 */
const FREQUENCIAS = [220, 329.8, 440.6];

/**
 * Fade mais longo para quando o som entra SOZINHO, depois da intro.
 *
 * 2,5 s é bom para um clique — a pessoa acabou de pedir e espera resposta.
 * Para som que aparece sem ninguém pedir, a mesma subida assusta: o certo é
 * ele emergir do silêncio devagar, junto com a página assentando.
 */
const SUBIDA_SOZINHO_S = 5;

/** Os três desfechos de tentar tocar. Mapa fechado — quem chama trata os três. */
export const TOCANDO = 'tocando';
export const BLOQUEADO = 'bloqueado';
export const INDISPONIVEL = 'indisponivel';

/**
 * Tenta tocar e diz O QUE ACONTECEU — inclusive quando o navegador barra.
 *
 * ── Por que isto precisa existir separado do `ligarSom()` ───────────────────
 *
 * Navegador nenhum avisa que bloqueou áudio: ele **suspende o contexto em
 * silêncio** e seguem todos felizes. Sem perguntar o estado depois de
 * `resume()`, o site marcaria o botão como "ligado" com nada tocando — a tela
 * mentindo, que é o §1.5 na forma mais direta.
 *
 * `resume()` devolve promessa, e é por isso que esta função é `async` enquanto
 * a `ligarSom()` continua síncrona: no caminho do clique o gesto já autoriza, e
 * transformar o clique em `await` só adicionaria um quadro de atraso.
 *
 * @param {{sozinho?: boolean}} [opcoes] `sozinho` = ninguém clicou (pós-intro)
 * @returns {Promise<'tocando'|'bloqueado'|'indisponivel'>}
 */
export async function tentarTocar({ sozinho = false } = {}) {
  try {
    if (!montar()) return INDISPONIVEL;

    if (contexto.state === 'suspended') {
      // `catch` e não `throw`: o Chrome REJEITA esta promessa quando não há
      // gesto, e essa rejeição é justamente a resposta que queremos ler.
      try { await contexto.resume(); } catch { /* barrado */ }
    }
    // A pergunta que desmascara o bloqueio. `running` é a única prova de que
    // sai som; qualquer outro estado é silêncio com cara de sucesso.
    if (contexto.state !== 'running') return BLOQUEADO;

    subir(sozinho ? SUBIDA_SOZINHO_S : SUBIDA_S);
    return TOCANDO;
  } catch {
    return INDISPONIVEL;
  }
}

/** Sobe o ganho até o volume ambiente, sem estalo. */
function subir(segundos) {
  ganho.gain.cancelScheduledValues(contexto.currentTime);
  ganho.gain.setValueAtTime(ganho.gain.value, contexto.currentTime);
  ganho.gain.linearRampToValueAtTime(VOLUME_ALVO, contexto.currentTime + segundos);
}

/** Cria o contexto e as vozes se ainda não existirem. `false` = sem Web Audio. */
function montar() {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) return false;
  if (contexto) return true;
  criar(Contexto);
  return true;
}

/**
 * Liga o som. Precisa ser chamado a partir de um gesto da pessoa — é a regra
 * do navegador, não uma escolha nossa.
 *
 * Devolve `false` se o navegador não tiver Web Audio; quem chama decide o que
 * mostrar. Nunca lança: som é enfeite, e enfeite não derruba página.
 */
export function ligarSom() {
  try {
    if (!montar()) return false;
    // Aba que volta do segundo plano deixa o contexto suspenso. Aqui não se
    // espera a promessa: veio de um gesto, então o navegador autoriza — e um
    // `await` só adicionaria atraso entre o clique e o som.
    if (contexto.state === 'suspended') contexto.resume();
    subir(SUBIDA_S);
    return true;
  } catch {
    return false;
  }
}

/**
 * Monta o grafo de áudio. Chamado uma única vez por contexto — é o `montar()`
 * que garante isso, e é o que impede duas instâncias tocando ao mesmo tempo.
 */
function criar(Contexto) {
  contexto = new Contexto();
  ganho = contexto.createGain();
  ganho.gain.value = 0;

  // Filtro passa-baixa: corta o agudo e deixa só o corpo grave. Sem ele o
  // acorde fica com aquele zumbido de sintetizador barato.
  const filtro = contexto.createBiquadFilter();
  filtro.type = 'lowpass';
  // `[02/09]` Subiu de 420 para 900 Hz junto com as vozes. Cortando em 420
  // o filtro atenuaria justamente a voz de 440 Hz — o acorde ficaria com
  // uma nota faltando, e a correção das frequências não teria adiantado.
  filtro.frequency.value = 900;
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
