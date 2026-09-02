/**
 * O contrato do som ambiente da landing, num navegador de verdade.
 *
 * ── O QUE ESTE TESTE PROVA, E O QUE NÃO PROVA ───────────────────────────────
 *
 * **Não prova o conserto do bug de 02/09** (o `pointerdown` que competia com o
 * clique). Reinjetei o ouvinte antigo e este teste PASSOU mesmo assim: num
 * navegador sem cabeça o clique sintético não produz a mesma corrida de um
 * clique humano — conferido com instrumentação, o handler do botão nem chegou
 * a rodar. Dizer que ele valida aquela correção seria vender trava por mais do
 * que ela é, e esse é um padrão de falha catalogado neste projeto.
 *
 * **O que ele prova:** o contrato do botão — clicar sempre alterna, com e sem
 * preferência salva — e, desde 02/09, a regra nova que mais importa:
 * **desligar tem que sobreviver ao recarregamento**.
 *
 * ── Por que a regra do "desligado" ganhou trava ─────────────────────────────
 *
 * Até 02/09 o desligar fazia `removeItem`: "desliguei de propósito" e "nunca
 * escolhi" viravam a mesma ausência de chave. Enquanto nada tocava sozinho,
 * dava no mesmo. **No instante em que existe autoplay, isso vira o pior defeito
 * possível deste recurso** — a pessoa desliga o som, volta no dia seguinte, e
 * ele toca de novo. Um site que religa o que você desligou é um site que não
 * te escuta. O passo 4 é essa trava.
 *
 * ── Duas armadilhas de teste que este arquivo já pisou ──────────────────────
 *
 * 1. **Seletor ambíguo.** `/ligar som ambiente/i` casa "Ligar som ambiente" **e**
 *    "Desligar som ambiente" — a segunda contém a primeira. Enquanto o som
 *    nunca ligava sozinho, o botão estava sempre em "Ligar" e ninguém notou.
 *    Com autoplay, o mesmo seletor passou a clicar num botão já ligado e a
 *    DESLIGAR o som, e o teste reprovou um código correto. Daí os `^...$`.
 * 2. **Corrida com o autoplay.** A tentativa automática só resolve depois da
 *    intro do raio (~2,5 s medidos). Asserção antes disso lê um estado que
 *    ainda vai mudar. Daí o `assentar()`.
 */
import { abrirNavegador, exigirServidor, salvarEvidencia } from './util.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';

const navegador = await abrirNavegador();
const contexto = await navegador.newContext();
const page = await contexto.newPage();
let passo = 0;
const ok = (m) => console.log(`  ${String(++passo).padStart(2)}. OK   ${m}`);

const pressionado = () => page.evaluate(
  () => document.querySelector('[aria-label$="som ambiente"]')?.getAttribute('aria-pressed'));

const preferencia = () => page.evaluate(
  () => localStorage.getItem('gh_som_ambiente'));

/** Rótulos ANCORADOS — ver a armadilha 1 no cabeçalho. */
const botaoLigar = () => page.getByRole('button', { name: /^Ligar som ambiente$/ });
const botaoDesligar = () => page.getByRole('button', { name: /^Desligar som ambiente$/ });

/**
 * Espera a poeira do carregamento baixar: intro do raio + a tentativa
 * automática de tocar. Sem isto o teste corre contra o autoplay e lê um estado
 * intermediário.
 */
const assentar = () => page.waitForTimeout(3800);

try {
  await exigirServidor(BASE);
  console.log(`\n  Som ambiente em ${BASE}\n`);

  // ── 1. Primeiro acesso: o aviso existe ───────────────────────────────────
  //
  // O aviso é a única coisa que este site faz sobre autoplay que o navegador
  // não faz: ele NÃO pede permissão para áudio, ele bloqueia em silêncio.
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);
  const texto = await page.locator('body').innerText();
  if (!/som ambiente/i.test(texto)) {
    throw new Error('o aviso de que o site tem som nao apareceu no primeiro acesso.\n'
      + '  Navegador NENHUM pede permissao para audio — ele so bloqueia em\n'
      + '  silencio. Se a gente nao avisa, ninguem avisa.');
  }
  ok('primeiro acesso: o aviso de som aparece');

  // ── 2. Ligar pelo botão grava a preferência ──────────────────────────────
  //
  // Nada é afirmado sobre o estado ANTES daqui: a tentativa automática pode
  // ter ligado o som sozinha (é o que acontece neste navegador) ou ter sido
  // barrada (é o que acontece na maioria dos navegadores de verdade). As duas
  // são corretas, e um teste que exigisse uma delas estaria testando a política
  // de autoplay do Chromium, não o nosso código.
  await assentar();
  if (await pressionado() === 'true') {
    await botaoDesligar().click();
    await page.waitForTimeout(700);
  }
  await botaoLigar().click({ delay: 220 });
  await page.waitForTimeout(900);
  if (await pressionado() !== 'true') {
    throw new Error(
      'o clique NAO ligou o som.\n'
      + '  Suspeito historico: algum ouvinte de gesto ligando no `pointerdown`\n'
      + '  e o `click` do botao desligando em seguida. O som deve ser ligado\n'
      + '  PELO BOTAO, e so por ele.');
  }
  if (await preferencia() !== 'ligado') {
    throw new Error('ligou o som mas nao gravou `ligado` no localStorage.');
  }
  ok('clique liga e grava a preferência');

  // ── 3. Recarregar com `ligado` salvo ─────────────────────────────────────
  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar();
  if (await preferencia() !== 'ligado') {
    throw new Error('a preferencia `ligado` nao sobreviveu ao reload');
  }
  ok('preferência `ligado` sobrevive ao recarregamento');

  // ── 4. A TRAVA NOVA: desligar sobrevive ao recarregamento ────────────────
  //
  // Este passo é o que impede o defeito descrito no cabeçalho. Ele falha se
  // alguém voltar a fazer `removeItem` no desligar.
  if (await pressionado() !== 'true') {
    await botaoLigar().click({ delay: 220 });
    await page.waitForTimeout(700);
  }
  await botaoDesligar().click();
  await page.waitForTimeout(700);

  if (await pressionado() !== 'false') throw new Error('o clique nao desligou o som');
  if (await preferencia() !== 'desligado') {
    throw new Error(
      'desligar o som NAO gravou `desligado` — gravou ' + JSON.stringify(await preferencia()) + '.\n'
      + '  Se a chave for apagada em vez de gravada, "desliguei de proposito" e\n'
      + '  "nunca escolhi" viram a MESMA coisa, e o autoplay religa o som de\n'
      + '  quem pediu silencio. Ver src/lib/preferenciaDeSom.js.');
  }

  await page.reload({ waitUntil: 'domcontentloaded' });
  await assentar();
  if (await pressionado() !== 'false') {
    throw new Error(
      'o som VOLTOU sozinho depois de a pessoa ter desligado.\n'
      + '  E o defeito que o `preferenciaDeSom.js` existe para impedir:\n'
      + '  `podeTentarSozinho(DESLIGADO)` tem que ser false, sempre.');
  }
  ok('desligado sobrevive ao recarregamento — o som NÃO volta sozinho');

  // ── 5. Religar depois de desligar, no mesmo carregamento ─────────────────
  await botaoLigar().click({ delay: 220 });
  await page.waitForTimeout(900);
  if (await pressionado() !== 'true') {
    throw new Error('depois de desligar, religar nao funcionou — o caminho que o '
      + 'dono relatou como travado.');
  }
  ok('desliga e religa no mesmo carregamento');
} catch (e) {
  console.error(`\n  FALHOU no passo ${passo + 1}: ${e.message}\n`);
  await salvarEvidencia(page);
  await navegador.close();
  process.exit(1);
}

await navegador.close();
console.log(`\n  ${passo}/${passo} comportamentos do som corretos.\n`);
