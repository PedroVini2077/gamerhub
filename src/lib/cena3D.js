/**
 * Quem recebe a cena 3D da landing, e como o visitante pode mudar isso.
 *
 * ── Por que a decisão mora aqui, e não no componente ────────────────────────
 *
 * Dois lugares precisam dela: a `Scene3D`, para saber o que montar, e o
 * `BotaoCena3D`, para saber se oferece a troca e com qual rótulo. Regra
 * duplicada diverge (CLAUDE.md §4) — e divergir aqui significaria um botão
 * "ativar 3D" numa tela que já está em 3D.
 *
 * ── A ordem das decisões ────────────────────────────────────────────────────
 *
 * 1. Escolha explícita do visitante, se houver. Ela vence TUDO, inclusive os
 *    portões de aparelho fraco: quem clicou sabe o que pediu, e o aviso do
 *    modal disse o que ia acontecer. Palpite nosso não passa por cima de
 *    decisão de quem está usando.
 * 2. Não havendo escolha, o padrão do aparelho (`padraoDoAparelho`).
 */

// Fica no navegador de propósito, e não no perfil: é preferência de aparelho,
// não de pessoa. O mesmo usuário quer 3D no PC e não quer no celular, e a
// landing é vista por quem nem tem conta.
export const CHAVE_PREFERENCIA = 'gh_landing_3d';

// Abaixo disto a cena vira enfeite caro: pouco espaço para apreciar e, quase
// sempre, CPU móvel. 1024px é o `lg` do Tailwind, o mesmo ponto onde a landing
// troca para coluna única.
export const LARGURA_MINIMA_3D = 1024;

// Portão deliberadamente FROUXO, e o motivo é uma medição: a primeira versão
// cortava em `<= 4` núcleos e derrubou para o modo leve um desktop de 1440px
// com 8 GB. O raciocínio estava errado nos dois sentidos — celular barato
// reporta 8 núcleos (big.LITTLE), e notebook honesto de 4 núcleos parseia os
// 887 KB sem sofrer. Quem separa celular de PC aqui é a LARGURA; este portão
// só pega máquina de 1 ou 2 núcleos.
export const NUCLEOS_MINIMOS_3D = 2;

/** @returns {'sim'|'nao'|null} `null` = nunca escolheu; vale o padrão do aparelho. */
export function lerPreferencia() {
  try {
    const valor = window.localStorage.getItem(CHAVE_PREFERENCIA);
    return valor === 'sim' || valor === 'nao' ? valor : null;
  } catch {
    // Modo privado, cookies bloqueados, storage cheio. Sem preferência é um
    // estado válido — não é erro e não deve estourar na cara de ninguém.
    return null;
  }
}

/** Grava a escolha. `null` apaga e devolve o controle ao padrão do aparelho. */
export function gravarPreferencia(valor) {
  try {
    if (valor === null) window.localStorage.removeItem(CHAVE_PREFERENCIA);
    else window.localStorage.setItem(CHAVE_PREFERENCIA, valor);
    return true;
  } catch {
    // Não dá para persistir. Quem chama precisa saber, senão a tela promete
    // uma escolha que não sobrevive ao reload (CLAUDE.md §1.5).
    return false;
  }
}

/**
 * O que ESTE aparelho recebe quando ninguém escolheu nada.
 *
 * Todas as APIs consultadas são opcionais e só existem em parte dos
 * navegadores. Quando uma não existe, ela não opina. O `catch` devolve
 * `'leve'` porque essa é a escolha segura: enfeite mais simples nunca quebra a
 * página, enquanto 887 KB num aparelho fraco quebram a experiência inteira.
 *
 * @returns {'completo'|'leve'}
 */
export function padraoDoAparelho() {
  try {
    // Pedido explícito de menos movimento, economia de dados ou rede ruim:
    // baixar 887 KB de enfeite antes do conteúdo é ruim de verdade.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'leve';

    const conexao = navigator.connection;
    if (conexao?.saveData) return 'leve';
    if (conexao?.effectiveType && /(^|-)(2g|3g)$/.test(conexao.effectiveType)) return 'leve';

    if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 1) return 'leve';
    if (typeof navigator.hardwareConcurrency === 'number'
      && navigator.hardwareConcurrency <= NUCLEOS_MINIMOS_3D) return 'leve';

    if (window.matchMedia(`(max-width: ${LARGURA_MINIMA_3D - 1}px)`).matches) return 'leve';

    return 'completo';
  } catch {
    return 'leve';
  }
}

/** O modo que vale agora: escolha do visitante, ou o padrão do aparelho. */
export function modoDaCena() {
  const escolha = lerPreferencia();
  if (escolha === 'sim') return 'completo';
  if (escolha === 'nao') return 'leve';
  return padraoDoAparelho();
}

/**
 * Se vale a pena oferecer o botão de troca.
 *
 * Some no caso em que não há nada a desfazer — desktop rodando o padrão, que
 * já é 3D — para não poluir a landing com um controle sem propósito. Mas
 * aparece para quem tem uma escolha guardada, em qualquer aparelho: toda ação
 * de estado precisa da inversa acessível a quem a executou (CLAUDE.md §5).
 */
export function podeEscolher() {
  return padraoDoAparelho() === 'leve' || lerPreferencia() !== null;
}
