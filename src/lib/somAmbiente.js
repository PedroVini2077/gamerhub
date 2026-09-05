import { carregarTrilha, criarFonteEmLaco, esquecerTrilha } from './trilhaAmbiente';
import { criarVozes } from './vozesSintetizadas';

/**
 * O som ambiente da landing — quem manda no ciclo de vida do áudio.
 *
 * Este arquivo NÃO sabe que som é. Ele cuida do contexto, do volume, do fade e
 * de garantir que existe **uma instância só**. Que som toca é decidido em duas
 * peças com um trabalho cada:
 *
 *   `trilhaAmbiente.js` ...... o arquivo real (Universe, AiTechEye, CC BY 4.0)
 *   `vozesSintetizadas.js` ... o plano B, quando o arquivo não chega
 *
 * ── Por que NÃO tenta tocar antes de alguém pedir ──────────────────────────
 *
 * Chrome, Safari e Firefox bloqueiam áudio antes de um gesto, e ninguém quer
 * um site que começa a tocar sozinho. O `AudioContext` só nasce quando alguém
 * clica **ou** quando a tentativa pós-intro acontece — antes disso este módulo
 * não aloca absolutamente nada, e o arquivo de 296 KB não é nem pedido.
 *
 * ── A ordem importa, e é a parte fácil de errar ─────────────────────────────
 *
 * Criar o contexto e chamar `resume()` precisa acontecer **de forma síncrona
 * dentro do gesto**. A autorização do clique expira: se a gente esperasse o
 * download do arquivo antes de chamar `resume()`, o navegador já teria
 * esquecido que houve um clique e barraria. Por isso `ligarSom()` é síncrona
 * na parte que importa e só depois dispara o carregamento.
 */

const VOLUME_ALVO = 0.2;   // ambiente, não trilha — ver a nota de nível abaixo
const SUBIDA_S = 2.5;      // fade in/out no clique
/**
 * Fade mais longo para quando o som entra SOZINHO, depois da intro.
 *
 * 2,5 s é bom para um clique — a pessoa acabou de pedir e espera resposta.
 * Para som que aparece sem ninguém pedir, a mesma subida assusta: o certo é
 * ele emergir do silêncio devagar, junto com a página assentando.
 */
const SUBIDA_SOZINHO_S = 5;

/**
 * Por que `0.2` e não o `0.055` de antes.
 *
 * O sintetizado nascia em silêncio e subia; o arquivo já vem masterizado a
 * **−14,1 LUFS** (medido), que é nível de streaming. Multiplicar por 0,2 põe a
 * trilha por volta de −28 LUFS — camada de fundo, abaixo da fala, que é onde
 * ambiente tem que ficar. Manter 0,055 aqui a deixaria inaudível de novo, que
 * foi exatamente a reclamação de 02/09.
 */

/** Os três desfechos de tentar tocar. Mapa fechado — quem chama trata os três. */
export const TOCANDO = 'tocando';
export const BLOQUEADO = 'bloqueado';
export const INDISPONIVEL = 'indisponivel';

let contexto = null;
let ganho = null;
/** A fonte tocando agora: a do arquivo OU os osciladores. Nunca as duas. */
let fonte = null;
let vozes = [];
/** Uma montagem em curso (o arquivo baixando). Ver `iniciarFonte`. */
let montando = false;
/** Invalida montagens atrasadas quando o som é desligado no meio. */
let geracao = 0;

/** Cria o contexto e o nó de ganho, se ainda não existirem. */
function montar() {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) return false;
  if (contexto) return true;
  contexto = new Contexto();
  ganho = contexto.createGain();
  ganho.gain.value = 0;
  ganho.connect(contexto.destination);
  return true;
}

/** Sobe o ganho até o volume ambiente, sem estalo. */
function subir(segundos) {
  ganho.gain.cancelScheduledValues(contexto.currentTime);
  ganho.gain.setValueAtTime(ganho.gain.value, contexto.currentTime);
  ganho.gain.linearRampToValueAtTime(VOLUME_ALVO, contexto.currentTime + segundos);
}

/**
 * Começa a tocar alguma coisa: o arquivo se ele vier, as vozes se não vier.
 *
 * A guarda `fonte || vozes.length` é o que impede DUAS instâncias tocando
 * juntas — o caso clássico deste tipo de recurso, e um pedido explícito do
 * dono. Dois cliques rápidos, ou um clique logo depois da tentativa
 * automática, passam por aqui e o segundo não monta nada.
 */
function iniciarFonte(segundos) {
  // `montando` é a metade que faltava na primeira versão deste arquivo, e a
  // ausência dela era um bug real: entre o clique e o arquivo terminar de
  // baixar, `fonte` e `vozes` continuam vazios. Sem esta flag, um segundo
  // clique nesse intervalo passava pela guarda e montava uma SEGUNDA fonte
  // por cima da primeira — as duas tocando juntas, que é exatamente o que o
  // dono pediu para nunca acontecer.
  if (fonte || vozes.length || montando) { subir(segundos); return; }

  montando = true;
  // O token que diz "esta montagem ainda vale". `desligarSom` incrementa a
  // geração, então uma montagem que estava no meio do download quando alguém
  // desligou chega atrasada, vê que a geração mudou, e desiste em silêncio.
  const minhaGeracao = ++geracao;
  const meuContexto = contexto;

  carregarTrilha(contexto).then((buffer) => {
    // A ordem destas duas linhas é o conserto de um buraco achado ao PROVAR a
    // trava (02/09). A versão anterior fazia `montando = false` incondicional,
    // no topo. Numa sequência ligar -> desligar -> ligar, o callback ATRASADO
    // da primeira montagem chegava e zerava a flag da SEGUNDA, que ainda
    // estava baixando — e aí um terceiro clique montava uma fonte a mais.
    //
    // A geração diz de quem é a flag: só o dono dela a solta.
    const aindaEMinha = minhaGeracao === geracao;
    if (aindaEMinha) montando = false;
    if (!aindaEMinha || !contexto || contexto !== meuContexto) return;
    if (buffer) {
      fonte = criarFonteEmLaco(contexto, ganho, buffer);
    } else {
      // Sem arquivo, o plano B. Ficar em silêncio aqui daria um botão
      // marcado como ligado sem som nenhum (§1.5).
      vozes = criarVozes(contexto, ganho);
    }
    subir(segundos);
  });

  // O ganho já começa a subir: quando a fonte entrar, ela entra dentro de um
  // fade que já está em curso, e não com um degrau.
  subir(segundos);
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
    // Sem `await` antes daqui, de propósito: a autorização do clique expira,
    // e esperar o download antes do `resume()` faria o navegador barrar.
    if (contexto.state === 'suspended') contexto.resume();
    iniciarFonte(SUBIDA_S);
    return true;
  } catch {
    return false;
  }
}

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

    iniciarFonte(sozinho ? SUBIDA_SOZINHO_S : SUBIDA_S);
    return TOCANDO;
  } catch {
    return INDISPONIVEL;
  }
}

/**
 * Desliga com fade e SOLTA o áudio.
 *
 * ── Duas coisas diferentes precisam ser soltas ──────────────────────────────
 *
 * O `close()` devolve a thread de áudio ao sistema. Sem ele a trilha
 * continuaria rodando em silêncio para sempre, gastando CPU e bateria de quem
 * desligou justamente para não gastar.
 *
 * **Mas o `close()` NÃO solta o buffer decodificado**, e eu escrevi o
 * contrário aqui antes de conferir. Ele vive num módulo à parte
 * (`trilhaAmbiente.js`), guardado de propósito para não rebaixar o arquivo a
 * cada clique — e um `AudioBuffer` não pertence a contexto nenhum, então
 * fechar o contexto não o alcança. Ficavam ~13,8 MB retidos pelo resto da
 * sessão de alguém que tinha acabado de pedir silêncio.
 *
 * `esquecerTrilha()` fecha isso. O custo é rebaixar ao religar — 300 KB que
 * vêm do cache do navegador, e um decode. Barato perto de segurar 13,8 MB de
 * quem não quer o som.
 */
export function desligarSom() {
  if (!contexto || !ganho) return;
  try {
    // Invalida qualquer montagem que ainda esteja baixando o arquivo: sem
    // isto ela chegaria depois e ligaria o som que a pessoa acabou de desligar.
    geracao += 1;
    montando = false;

    const fim = contexto.currentTime + SUBIDA_S;
    ganho.gain.cancelScheduledValues(contexto.currentTime);
    ganho.gain.setValueAtTime(ganho.gain.value, contexto.currentTime);
    ganho.gain.linearRampToValueAtTime(0, fim);

    const paraFechar = contexto;
    const paraParar = [...vozes, fonte].filter(Boolean);
    contexto = null; ganho = null; vozes = []; fonte = null;
    esquecerTrilha();

    setTimeout(() => {
      try {
        paraParar.forEach(o => o.stop());
        paraFechar.close();
      } catch { /* já fechado */ }
    }, SUBIDA_S * 1000 + 100);
  } catch { /* som é enfeite: nunca derruba a página */ }
}
