/**
 * O COFRE do painel do Fundador — a lógica, separada da tela.
 *
 * ══ LEIA ISTO ANTES DE CONFIAR NELE ═════════════════════════════════════════
 *
 * **Este cofre NÃO é um controle de segurança.** Ele é uma tranca de tela: para
 * quem está de pé na frente do computador do dono com a sessão aberta.
 *
 * O que ele NÃO faz, e é importante estar escrito aqui e não só no
 * `SEGURANCA.md`, porque é aqui que alguém vai ler antes de mexer:
 *
 * | Ameaça | O cofre protege? |
 * | --- | --- |
 * | alguém sentado no computador do dono, clicando | **sim**, é para isso que ele existe |
 * | alguém com a sessão roubada chamando a RPC pela API | **não**, e nada no navegador protegeria |
 * | alguém que abre o DevTools e apaga o `localStorage` | **não** — apaga e define um código novo |
 *
 * **A proteção de verdade está no BANCO**, e sempre esteve: `is_super()`, a
 * hierarquia de cargos e as policies. É isso que impede um `admin` de mexer em
 * cargo — não esta tela. Se um dia alguém apagar este arquivo inteiro, nenhuma
 * permissão do site muda.
 *
 * Escolha do dono em 05/09, com essa tabela na mesa: *"pode começar a fazer o
 * que você recomendou"* — o cenográfico, dito com todas as letras que é
 * cenográfico. A versão de verdade (RPC + hash no banco + tabela de desbloqueio
 * + toda RPC de owner exigindo desbloqueio ativo) está em VISAO-DE-FUTURO.md,
 * com o risco que ela traz junto: ficar trancado para fora.
 *
 * ── Por que o código é POR NAVEGADOR ────────────────────────────────────────
 *
 * Porque a ameaça é física — o computador dele. Guardar no banco não deixaria o
 * cofre mais forte (a `anon key` é pública, a checagem continuaria no
 * navegador) e criaria uma senha a mais para perder. Guardando local, cada
 * aparelho tem o seu, e perder um não tranca nenhum outro.
 *
 * ── O código não é guardado; o RESUMO dele é ────────────────────────────────
 *
 * SHA-256 com sal aleatório por aparelho. Não é para resistir a força bruta de
 * verdade — é para o código não ficar em texto puro num lugar que a própria
 * pessoa pode abrir sem querer numa gravação de tela.
 */

/** Onde mora o resumo do código, por aparelho. */
const CHAVE_RESUMO = 'gh_cofre_resumo';
/** O sal, gerado uma vez por aparelho. */
const CHAVE_SAL = 'gh_cofre_sal';
/** O desbloqueio, que morre ao fechar a aba — decisão de 04/09. */
const CHAVE_ABERTO = 'gh_cofre_aberto';

/** Mínimo do código. Curto demais tira o pouco de valor que ele tem. */
export const MINIMO_DO_CODIGO = 4;

/**
 * Todo acesso a armazenamento em `try`.
 *
 * Em aba anônima e com cookies de site bloqueados, `localStorage` **lança** ao
 * ser acessado — não devolve `null`. O pior caso aqui tem que ser o cofre não
 * conseguir se armar, nunca o dono não conseguir abrir o painel.
 */
function ler(chave) {
  try { return localStorage.getItem(chave); } catch { return null; }
}

function escrever(chave, valor) {
  try { localStorage.setItem(chave, valor); return true; } catch { return false; }
}

/** Sal do aparelho, criado na primeira vez. */
function salDoAparelho() {
  const existente = ler(CHAVE_SAL);
  if (existente) return existente;

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const novo = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  escrever(CHAVE_SAL, novo);
  return novo;
}

/**
 * O resumo do código.
 *
 * `crypto.subtle` só existe em contexto seguro (https ou localhost). Se não
 * existir, devolve `null` — e quem chama trata isso como "não dá para armar o
 * cofre", em vez de guardar o código em texto puro como consolo.
 */
export async function resumoDoCodigo(codigo, sal) {
  if (!globalThis.crypto?.subtle) return null;
  const dados = new TextEncoder().encode(`${sal}:${codigo}`);
  const bruto = await crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(bruto)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Este aparelho já tem um código definido? */
export function cofreArmado() {
  return Boolean(ler(CHAVE_RESUMO));
}

/**
 * Define o código deste aparelho.
 *
 * Devolve `{ ok }` ou `{ erro }` — nunca lança, e nunca fica em silêncio: se o
 * armazenamento ou o `crypto.subtle` não estiverem disponíveis, quem chama
 * precisa poder dizer isso na tela (§1.5).
 */
export async function definirCodigo(codigo) {
  if (!codigo || codigo.length < MINIMO_DO_CODIGO) {
    return { erro: `O código precisa ter pelo menos ${MINIMO_DO_CODIGO} caracteres.` };
  }
  const resumo = await resumoDoCodigo(codigo, salDoAparelho());
  if (!resumo) {
    return { erro: 'Este navegador não oferece a criptografia necessária (o site precisa estar em https).' };
  }
  if (!escrever(CHAVE_RESUMO, resumo)) {
    return { erro: 'Não foi possível guardar o código neste navegador (armazenamento bloqueado).' };
  }
  return { ok: true };
}

/** O código bate com o deste aparelho? */
export async function conferirCodigo(codigo) {
  const guardado = ler(CHAVE_RESUMO);
  if (!guardado) return false;
  const resumo = await resumoDoCodigo(codigo, salDoAparelho());
  return Boolean(resumo) && resumo === guardado;
}

/**
 * O cofre está aberto NESTA aba?
 *
 * `sessionStorage` e não tempo fixo, e a razão é de uso: um cofre que fecha aos
 * 30 minutos tranca no meio de uma moderação. Fechou a aba, fecha o cofre.
 */
export function cofreAberto() {
  try { return sessionStorage.getItem(CHAVE_ABERTO) === '1'; } catch { return false; }
}

export function abrirCofre() {
  try { sessionStorage.setItem(CHAVE_ABERTO, '1'); } catch { /* sem armazenamento: reabre a cada visita */ }
}

export function fecharCofre() {
  try { sessionStorage.removeItem(CHAVE_ABERTO); } catch { /* nada a fechar */ }
}

/**
 * Esquece o código deste aparelho.
 *
 * Existe porque **tem que existir** (§5, toda ação de estado precisa da
 * inversa): sem isto, esquecer o código deixaria o painel inacessível neste
 * navegador até alguém saber ir no DevTools. Como o cofre é cenográfico, apagar
 * daqui não abre porta nenhuma que já não estivesse aberta.
 */
export function esquecerCodigo() {
  try {
    localStorage.removeItem(CHAVE_RESUMO);
    localStorage.removeItem(CHAVE_SAL);
  } catch { /* já não havia o que apagar */ }
  fecharCofre();
}
