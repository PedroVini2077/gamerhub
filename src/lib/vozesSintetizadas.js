/**
 * O som ambiente SINTETIZADO — hoje o plano B, não mais o principal.
 *
 * ── Por que ele continua existindo ──────────────────────────────────────────
 *
 * Desde 02/09 o som normal é um arquivo real (`trilhaAmbiente.js`). Estas
 * vozes ficaram como reserva para quando o arquivo não chega: rede fora, CDN
 * fora do ar, navegador sem o codec, aba aberta há muito tempo com a conexão
 * caída.
 *
 * Não é código morto, e a distinção importa (§6.1): ele roda sempre que o
 * download falhar, e falhar é o caso mais provável justamente para quem está
 * numa rede ruim — que é quem mais nota um site quebrado.
 *
 * O contrário — deixar em silêncio quando o arquivo não vem — daria um botão
 * marcado como ligado sem som nenhum. A tela mentindo (§1.5).
 *
 * ── O som ──────────────────────────────────────────────────────────────────
 *
 * Um acorde grave e sustentado, filtrado, com as vozes levemente desafinadas
 * entre si. A desafinação faz o som "respirar" sozinho, sem laço nenhum: as
 * ondas entram e saem de fase num ciclo de minutos. É o truque clássico de
 * ambiente — soa vivo sem nunca chamar atenção.
 */

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
 */
const FREQUENCIAS = [220, 329.8, 440.6];

/**
 * Monta as vozes e conecta ao destino. Devolve os osciladores para quem chamou
 * poder pará-los — quem cria é quem sabe o que precisa ser solto depois.
 */
export function criarVozes(contexto, destino) {
  // Filtro passa-baixa: corta o agudo e deixa só o corpo grave. Sem ele o
  // acorde fica com aquele zumbido de sintetizador barato.
  const filtro = contexto.createBiquadFilter();
  filtro.type = 'lowpass';
  // `[02/09]` Subiu de 420 para 900 Hz junto com as vozes. Cortando em 420 o
  // filtro atenuaria justamente a voz de 440 Hz — o acorde ficaria com uma
  // nota faltando, e a correção das frequências não teria adiantado.
  filtro.frequency.value = 900;
  filtro.Q.value = 0.7;
  filtro.connect(destino);

  return FREQUENCIAS.map((hz) => {
    const osc = contexto.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = hz;
    osc.connect(filtro);
    osc.start();
    return osc;
  });
}
