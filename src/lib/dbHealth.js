// ---------------------------------------------------------------------------
// Detecção de "o banco caiu"
//
// Para que serve: quando o projeto Supabase é pausado (por egress, por
// restrição de serviço, ou de propósito), o site inteiro vira uma sequência de
// erros sem explicação. Antes, a saída era editar o código e escrever "projeto
// pausado" na landing à mão. Agora o próprio site percebe e se explica.
//
// O RISCO desta funcionalidade é o falso positivo: derrubar o site inteiro para
// a tela de fora do ar porque o wi-fi de alguém piscou seria muito pior do que
// o problema original. Por isso a detecção é conservadora — ver as três regras
// abaixo.
// ---------------------------------------------------------------------------

// 1. Só conta como queda o que é falha de INFRAESTRUTURA:
//    - o `fetch` estourou (sem rede, DNS, projeto pausado sem responder)
//    - o servidor respondeu 5xx (o gateway da Supabase devolve 5xx com o
//      projeto pausado)
//    Um 401/403/404/409 significa que o banco está VIVO e respondeu — é erro de
//    aplicação ou de RLS, e não pode derrubar nada.
const ehFalhaDeInfra = (status) => status === 0 || status >= 500;

// 2. Uma falha isolada não vale. Só depois de N seguidas o site COGITA estar
//    fora do ar. Qualquer resposta boa no meio zera a contagem.
const FALHAS_PARA_DECLARAR = 3;

// 2b. E nem N falhas bastam: antes de declarar, o módulo faz uma sondagem
//     INDEPENDENTE no endpoint mais barato do Supabase. Se alguém atender, foi
//     instabilidade — não queda. Sem esta confirmação, três requisições
//     lentas ou canceladas na hora errada jogariam o site inteiro na tela de
//     fora do ar.

// 3. Já fora do ar, tenta voltar sozinho. Sem isso, quem estivesse com a aba
//    aberta na hora da pausa ficaria preso na tela mesmo depois do site voltar.
const INTERVALO_DE_RECUPERACAO_MS = 20000;

let falhasSeguidas = 0;
let foraDoAr = false;
let timerRecuperacao = null;
const ouvintes = new Set();

function avisarOuvintes() {
  // Um ouvinte que estoura não pode derrubar os outros nem a requisição que
  // originou a notificação.
  for (const fn of ouvintes) {
    try { fn(foraDoAr); } catch { /* ignora */ }
  }
}

function definirEstado(novoForaDoAr) {
  if (foraDoAr === novoForaDoAr) return;
  foraDoAr = novoForaDoAr;

  clearInterval(timerRecuperacao);
  timerRecuperacao = null;
  if (foraDoAr) timerRecuperacao = setInterval(sondarRecuperacao, INTERVALO_DE_RECUPERACAO_MS);

  avisarOuvintes();
}

/**
 * Bate no endpoint mais barato possível só para saber se alguém atende.
 * Devolve `true` se o banco respondeu.
 *
 * Não usa o cliente Supabase de propósito: ele passaria de novo pelo `fetch`
 * instrumentado, e a própria sonda contaria como falha — um laço.
 */
async function sondar() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const resp = await fetch(`${url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: key },
      signal: AbortSignal.timeout(8000),
    });
    return !ehFalhaDeInfra(resp.status);
  } catch {
    return false;
  }
}

async function sondarRecuperacao() {
  if (await sondar()) {
    falhasSeguidas = 0;
    definirEstado(false);
  }
}

// Uma confirmação por vez: sem isto, um lote de requisições falhando junto
// dispararia várias sondagens simultâneas.
let confirmacaoEmAndamento = null;

async function confirmarQueda() {
  if (await sondar()) {
    // Alguém atendeu — foi instabilidade, não queda. Zera e segue a vida.
    falhasSeguidas = 0;
    return;
  }
  definirEstado(true);
}

/** Devolve a promessa da confirmação quando dispara uma — os testes aguardam. */
function registrarResultado(status) {
  if (!ehFalhaDeInfra(status)) {
    falhasSeguidas = 0;
    if (foraDoAr) definirEstado(false);
    return undefined;
  }
  falhasSeguidas += 1;
  if (falhasSeguidas >= FALHAS_PARA_DECLARAR && !foraDoAr && !confirmacaoEmAndamento) {
    confirmacaoEmAndamento = confirmarQueda().finally(() => { confirmacaoEmAndamento = null; });
  }
  return confirmacaoEmAndamento ?? undefined;
}

/**
 * `fetch` instrumentado que o cliente Supabase usa.
 *
 * REGRA DE OURO deste wrapper: ele não pode alterar nada do comportamento do
 * `fetch`. Toda a contabilidade vai dentro de `try/catch` — um defeito aqui
 * derrubaria TODAS as requisições do site, e este é o arquivo de maior risco
 * depois do `useAuth` (§7).
 */
export function fetchComSaude(input, init) {
  return fetch(input, init).then(
    (resp) => {
      try { registrarResultado(resp.status); } catch { /* nunca atrapalha */ }
      return resp;
    },
    (err) => {
      try {
        // Requisição cancelada pelo próprio app (troca de tela, guarda de
        // corrida) não é queda de banco. Contar isso geraria falso positivo em
        // navegação rápida.
        const abortada = err?.name === 'AbortError' || init?.signal?.aborted;
        if (!abortada) registrarResultado(0);
      } catch { /* nunca atrapalha */ }
      throw err;
    },
  );
}

/** Estado atual. `true` = o site perdeu o banco. */
export const bancoForaDoAr = () => foraDoAr;

/** Inscreve um ouvinte. Devolve a função de cancelar. */
export function observarSaudeDoBanco(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/** Só para teste: devolve o módulo ao estado inicial. */
export function _resetarParaTeste() {
  falhasSeguidas = 0;
  foraDoAr = false;
  confirmacaoEmAndamento = null;
  clearInterval(timerRecuperacao);
  timerRecuperacao = null;
  ouvintes.clear();
}

/** Só para teste: simula o resultado de uma requisição. */
export const _registrarResultadoParaTeste = registrarResultado;
