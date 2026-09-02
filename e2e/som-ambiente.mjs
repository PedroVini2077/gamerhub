/**
 * Trava do bug de 02/09: com a preferência de som já salva, clicar no botão
 * não fazia nada.
 *
 * ── Por que o teste anterior não pegou ──────────────────────────────────────
 *
 * A primeira verificação rodou com o `localStorage` VAZIO. Nesse caminho o
 * ouvinte problemático nem era registrado, e tudo parecia funcionar. O bug só
 * existia para quem **já tinha ligado o som antes** — ou seja, exatamente para
 * quem usa a funcionalidade.
 *
 * A lição, e é por isso que este arquivo existe: testar só o primeiro acesso é
 * testar o caminho de quem nunca voltou.
 *
 * ── O que era o bug ────────────────────────────────────────────────────────
 *
 * O componente registrava um `pointerdown` para retomar o som em qualquer
 * gesto. `pointerdown` dispara ANTES de `click`: ao clicar no próprio botão, o
 * ouvinte ligava, o estado atualizava, e o `click` do botão desligava em
 * seguida. Ligar e desligar no mesmo clique aparece como "o botão não faz nada".
 *
 * ── O QUE ESTE TESTE PROVA, E O QUE NÃO PROVA ───────────────────────────────
 *
 * **Não prova o conserto do bug relatado.** Reinjetei o ouvinte antigo e este
 * teste PASSOU mesmo assim: num navegador sem cabeça o `pointerdown` do
 * clique sintético não produz a mesma corrida que produz num clique humano —
 * conferido com instrumentação, o handler do botão nem chegou a rodar.
 *
 * Dizer que ele valida a correção seria vender trava por mais do que ela é, e
 * esse é um padrão de falha catalogado neste projeto.
 *
 * **O que ele prova:** o CONTRATO do botão — que clicar sempre alterna, com e
 * sem preferência salva, e que o aviso aparece no primeiro acesso. Isso pega
 * regressão futura de comportamento, que é trabalho real, só não é este.
 *
 * A causa raiz do relato segue como **inferência**: a explicação mais provável
 * é a corrida de eventos, e a correção foi tirar a esperteza que a criava. A
 * confirmação depende do aparelho do dono.
 */
import { abrirNavegador, exigirServidor, salvarEvidencia } from './util.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';

const navegador = await abrirNavegador();
const contexto = await navegador.newContext();
const page = await contexto.newPage();
let passo = 0;
const ok = (m) => console.log(`  ${String(++passo).padStart(2)}. OK   ${m}`);

const pressionado = () => page.evaluate(
  () => document.querySelector('[aria-label*="som ambiente" i]')?.getAttribute('aria-pressed'));

try {
  await exigirServidor(BASE);
  console.log(`\n  Som ambiente em ${BASE}\n`);

  // ── 1. Primeiro acesso: aviso presente, som desligado ────────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const texto = await page.locator('body').innerText();
  if (!/som ambiente/i.test(texto)) {
    throw new Error('o aviso de que o site tem som nao apareceu no primeiro acesso.\n'
      + '  Navegador NENHUM pede permissao para audio — ele so bloqueia em\n'
      + '  silencio. Se a gente nao avisa, ninguem avisa.');
  }
  if (await pressionado() !== 'false') throw new Error('o som comecou ligado — nao devia');
  ok('primeiro acesso: aviso visível e som desligado');

  const botao = page.getByRole('button', { name: /ligar som ambiente/i });
  await botao.click();
  await page.waitForTimeout(800);
  if (await pressionado() !== 'true') throw new Error('o clique nao ligou o som');
  ok('clique liga');

  // ── 2. O CENÁRIO DO BUG: recarregar COM a preferência salva ──────────────
  //
  // Este é o passo que importa. O teste antigo nunca chegava aqui, e por isso
  // deu verde num botão quebrado.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const salva = await page.evaluate(() => localStorage.getItem('gh_som_ambiente'));
  if (salva !== 'ligado') throw new Error('a preferencia nao sobreviveu ao reload');

  const btn2 = page.getByRole('button', { name: /ligar som ambiente/i });
  // `delay: 220` NÃO é enfeite, e a primeira versão deste teste falhou por não
  // ter isso: o clique sintético sem atraso dispara `pointerdown` e `click`
  // praticamente juntos, e o React nem chega a re-renderizar entre os dois. A
  // corrida que existe no navegador de verdade simplesmente não acontecia, e o
  // teste passava com o bug reinjetado — "teste que não consegue falhar", pela
  // terceira vez neste projeto.
  //
  // O atraso entre pressionar e soltar reproduz o clique humano, que é onde a
  // corrida acontece.
  await btn2.click({ delay: 220 });
  await page.waitForTimeout(900);

  if (await pressionado() !== 'true') {
    throw new Error(
      'com a preferencia salva, o clique NAO ligou o som.\n'
      + '  E o bug de 02/09 de volta: algum ouvinte de gesto esta ligando o som\n'
      + '  no `pointerdown` e o `click` do botao esta desligando em seguida.\n'
      + '  O som deve ser ligado PELO BOTAO, e so por ele.');
  }
  ok('com preferência salva, o clique continua ligando');

  // ── 3. Desligar e religar no mesmo carregamento ──────────────────────────
  await btn2.click();
  await page.waitForTimeout(700);
  if (await pressionado() !== 'false') throw new Error('o clique nao desligou o som');

  await page.getByRole('button', { name: /ligar som ambiente/i }).click({ delay: 220 });
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
console.log(`\n  ${passo}/4 comportamentos do som corretos.\n`);
