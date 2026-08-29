/**
 * A intro do raio toca UMA VEZ por sessão do navegador.
 *
 * ── O que motivou ───────────────────────────────────────────────────────────
 *
 * Relato do dono: *"quando recarrego a página, vem a animação, mudo de aba, de
 * novo, saio do login, novamente"*. A intro é bonita na primeira vez e vira
 * pedágio na terceira — e ela segura o conteúdo do Hero enquanto roda, então
 * cada repetição é ~1,3 s de espera para ver a mesma coisa.
 *
 * ── Por que `sessionStorage`, e não `localStorage` ──────────────────────────
 *
 * | | O que aconteceria |
 * | --- | --- |
 * | `localStorage` | a pessoa veria a intro **uma vez na vida**. Quem volta uma semana depois nunca mais vê a abertura do site |
 * | `sessionStorage` | uma vez por sessão do navegador: sobrevive a recarregar, a navegar pelo site e a voltar do login, e reaparece numa visita futura |
 *
 * `sessionStorage` é o que casa com "1 vez por sessão", que foi o pedido — e
 * ainda resolve os três casos que ele citou, porque os três acontecem dentro da
 * mesma aba.
 *
 * ── Por que isto não fica dentro do componente ──────────────────────────────
 *
 * Porque `sessionStorage` **lança** em modo privado, com cookies bloqueados ou
 * com o armazenamento cheio. Enterrado num `useState`, esse `throw` derrubaria
 * a landing inteira — a primeira página do site — por causa de um enfeite. Aqui
 * o erro é contido e tem um padrão declarado: na dúvida, **mostra** a intro.
 * Ver `naoConsigoLembrar` abaixo.
 */

const CHAVE = 'gh_intro_vista';

/**
 * O padrão quando não dá para lembrar.
 *
 * Mostrar a intro é o comportamento de antes, e o erro menos grave dos dois:
 * quem não pode ter a preferência guardada vê a abertura de novo. O contrário —
 * esconder por não conseguir ler — tiraria a intro de todo mundo em modo
 * privado, e ninguém entenderia por quê.
 */
const NAO_CONSIGO_LEMBRAR = false;

/** @returns {boolean} se a intro já rodou nesta sessão do navegador. */
export function introJaVista() {
  try {
    return window.sessionStorage.getItem(CHAVE) === 'sim';
  } catch {
    return NAO_CONSIGO_LEMBRAR;
  }
}

/** Marca que a intro rodou. Falhar aqui só faz ela tocar de novo. */
export function marcarIntroVista() {
  try {
    window.sessionStorage.setItem(CHAVE, 'sim');
    return true;
  } catch {
    return false;
  }
}

/**
 * Se a intro deve tocar agora.
 *
 * `prefers-reduced-motion` entra aqui porque a intro é o movimento mais
 * agressivo do site: tela inteira, flash e clarão. Quem pediu menos movimento
 * ao sistema pediu justamente por causa de coisas assim.
 *
 * @param {{jaVista?: boolean, prefereMenosMovimento?: boolean}} estado
 */
export function deveTocarIntro({ jaVista, prefereMenosMovimento } = {}) {
  if (prefereMenosMovimento) return false;
  return !jaVista;
}

/** Lê o estado real do navegador e decide. */
export function deveTocarIntroAgora() {
  let prefereMenosMovimento = false;
  try {
    prefereMenosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { /* navegador sem matchMedia: segue o padrão */ }
  return deveTocarIntro({ jaVista: introJaVista(), prefereMenosMovimento });
}
