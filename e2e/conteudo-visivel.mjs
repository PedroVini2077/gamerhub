/**
 * Trava contra a falha de 29/08: a página `/sobre` foi ao ar com os SETE
 * blocos em `opacity: 0` permanente. O texto estava no DOM, a rota carregava,
 * nenhum erro aparecia — e a tela era um cabeçalho seguido de 4.000px de nada.
 *
 * Por que nenhum teste que existia pegou:
 *
 * - `npm test` monta em jsdom, que não tem IntersectionObserver de verdade nem
 *   layout — `whileInView` nunca é exercitado ali;
 * - `smoke.mjs` procura TEXTO, e `innerText` devolve normalmente o texto de um
 *   elemento com `opacity: 0`. O smoke marcou "Sobre OK" com a página em
 *   branco;
 * - o teste de conteúdo (`conteudoDoSobre.test.js`) confere o que está escrito,
 *   não o que aparece.
 *
 * A causa raiz foi de CLASSE, não daquela página: `viewport={{ amount: 0.25 }}`
 * num container mais alto que 4× a janela. 25% de 3.902px são 975px, e a janela
 * do celular tinha 830 — o container jamais atingia o limiar, o `whileInView`
 * do pai nunca disparava, e os filhos ficavam escondidos PARA SEMPRE. Qualquer
 * seção futura que cresça o bastante cai no mesmo buraco, por isso a trava
 * varre as páginas públicas em vez de conferir a `/sobre`.
 *
 * O método: rolar a página inteira devagar, como uma pessoa faria, e então
 * exigir que nada com tamanho real tenha ficado invisível.
 */
import { ROTAS_VISITANTE } from './rotas.mjs';
import { abrirNavegador, exigirServidor, salvarEvidencia } from './util.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';

// Celular em pé — o caso mais apertado, e o aparelho em que o dono viu o bug.
// Numa janela de desktop alta o mesmo container PASSARIA, então testar só no
// tamanho grande deixaria a falha escapar exatamente como escapou.
const JANELA = { width: 412, height: 830 };

// Só as rotas que o visitante realmente VÊ. As outras redirecionam para `/`
// (já coberta) e o 404 não tem conteúdo animado.
const PAGINAS = ROTAS_VISITANTE.filter(r => r.destino === r.path);

/** Rola de ponta a ponta, dando tempo de cada reveal disparar. */
async function rolarAPaginaInteira(page) {
  await page.evaluate(async () => {
    const PASSO = 300;
    for (let y = 0; y < document.body.scrollHeight; y += PASSO) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 90));
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1200);
}

/**
 * Um elemento só é acusado se ocupa espaço de verdade. Sem o filtro de altura,
 * qualquer painel fechado ou tooltip escondido de propósito viraria alarme
 * falso — e alarme que grita à toa ensina a ignorar o canal (CLAUDE.md §0.2).
 */
async function invisiveisComTamanho(page) {
  return page.evaluate(() => {
    const ALTURA_MINIMA = 40;
    return [...document.querySelectorAll('section, article, a.card, div.card')]
      .filter(e => {
        const r = e.getBoundingClientRect();
        return r.height >= ALTURA_MINIMA && getComputedStyle(e).opacity === '0';
      })
      .map(e => `<${e.tagName.toLowerCase()}${e.id ? ` id="${e.id}"` : ''}> `
        + `${Math.round(e.getBoundingClientRect().height)}px: `
        + `"${(e.innerText || '').trim().slice(0, 60).replace(/\s+/g, ' ')}"`);
  });
}

const navegador = await abrirNavegador();
let falhas = 0;

try {
  await exigirServidor(BASE);
  console.log(`\n  Conteúdo visível depois de rolar — ${JANELA.width}x${JANELA.height}\n`);

  for (const rota of PAGINAS) {
    const page = await navegador.newPage({ viewport: JANELA });
    try {
      await page.goto(BASE + rota.path, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);
      await rolarAPaginaInteira(page);

      const presos = await invisiveisComTamanho(page);
      if (presos.length === 0) {
        console.log(`  OK     ${rota.nome.padEnd(16)} ${rota.path}`);
      } else {
        falhas++;
        console.error(`\n  FALHOU ${rota.nome.padEnd(16)} ${rota.path}`);
        console.error(`  ${presos.length} elemento(s) continuam INVISÍVEIS depois de rolar a página inteira.`);
        console.error('  O conteúdo existe no DOM e não aparece na tela — é o bug de 29/08 de volta.\n');
        presos.forEach(p => console.error(`    - ${p}`));
        console.error('\n  Causa quase certa: um container com `whileInView` + `viewport={VIEWPORT}`');
        console.error('  ficou mais alto que 4x a janela (VIEWPORT usa amount: 0.25, e 0.25 da');
        console.error('  altura do container precisa CABER na tela para o limiar ser atingido).');
        console.error('  Conserto: tirar o `whileInView` do container e dar um para cada seção,');
        console.error('  como está em src/pages/Sobre.jsx.\n');
        await salvarEvidencia(page);
      }
    } finally {
      await page.close();
    }
  }
} finally {
  await navegador.close();
}

if (falhas > 0) {
  console.error(`  ${falhas} página(s) com conteúdo invisível.\n`);
  process.exit(1);
}
console.log(`\n  ${PAGINAS.length}/${PAGINAS.length} páginas sem conteúdo invisível.\n`);
