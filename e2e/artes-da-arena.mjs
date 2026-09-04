/**
 * As artes do login e do cadastro não podem carregar pedaço do adversário.
 *
 * ── O bug que esta trava impede ─────────────────────────────────────────────
 *
 * As duas artes chegam como UMA imagem com os dois lutadores. Para virarem fundo
 * de tela, cada uma é recortada em duas. Na primeira versão eu cortei na metade
 * da imagem — número redondo, escolhido por simetria aparente e não por medição.
 *
 * O dono viu o resultado antes de mim: *"o fogo tá aparecendo um pouco na parte
 * de gelo, não ficou um corte muito limpo"*. Ele estava certo nas duas metades
 * da frase, e a medição explicou as duas: na arte do login o fogo do golpe vai
 * até a coluna 808 e o gelo já começa na 734, então **os dois se sobrepõem por
 * 75 colunas**. Qualquer reta vertical ali corta um e leva um pedaço do outro.
 *
 * ── Por que a fronteira passou a ser COR, e não uma reta ────────────────────
 *
 * Na faixa disputada, o que decide é a cor do pixel: o lado do fogo descarta o
 * que é nitidamente frio, o do gelo descarta o que é nitidamente quente, e o
 * alfa vai a zero por rampa nos últimos 30 px — sem a rampa, o halo residual
 * termina numa reta, que era a segunda metade da queixa.
 *
 * ── O que este teste mede, e por que num NAVEGADOR ──────────────────────────
 *
 * Ele conta pixels da cor errada na borda que encosta na fenda: no lutador de
 * fogo, a borda DIREITA; no de gelo, a ESQUERDA. Zero é o esperado.
 *
 * É num navegador porque WebP não se decodifica em Node sem dependência nova, e
 * porque assim o teste mede **a imagem que o site serve de verdade** — a que o
 * `srcset` escolheu, no caminho que o Vite gerou. Um teste que lesse o arquivo
 * da pasta não perceberia se o componente passasse a apontar para outra arte.
 *
 * ── Provada reinjetando o bug (§2) ──────────────────────────────────────────
 *
 * Com os recortes antigos (reta em x=768), a contagem dá **868** pixels quentes
 * na borda esquerda do gelo e **220** frios na borda direita do fogo. Com os
 * novos, dá 0 e 0. A tolerância de 30 fica entre as duas coisas de longe.
 */
import { abrirNavegador, exigirServidor, salvarEvidencia } from './util.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';

/** Ruído de croma do WebP com perdas. Os valores reais são 0; o bug real, 220+. */
const TOLERANCIA = 30;
/** A borda que encosta na fenda, em fração da largura da arte. */
const BORDA = 0.12;
/** Diferença entre os canais para o pixel ser "nitidamente" de um dos dois. */
const DIFERENCA = 40;

const navegador = await abrirNavegador();
const contexto = await navegador.newContext();
const page = await contexto.newPage();
let passo = 0;
const ok = (m) => console.log(`  ${String(++passo).padStart(2)}. OK   ${m}`);

/**
 * Desenha cada lutador num canvas e conta os pixels da cor do adversário na
 * borda voltada para a fenda. Roda dentro da página: o canvas é da mesma
 * origem, então `getImageData` não é bloqueado.
 */
const medir = () => page.evaluate(({ BORDA, DIFERENCA }) => {
  const saida = [];
  for (const img of document.querySelectorAll('img.arena-figura')) {
    const lado = img.closest('.arena-lutador-fogo') ? 'fogo'
      : img.closest('.arena-lutador-gelo') ? 'gelo' : 'desconhecido';
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) { saida.push({ lado, erro: 'imagem não carregou' }); continue; }

    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0);
    const d = c.getContext('2d').getImageData(0, 0, w, h).data;

    const faixa = Math.round(w * BORDA);
    let invasores = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 40) continue;
        const R = d[i], B = d[i + 2];
        // fogo: a borda que encosta na fenda é a DIREITA; gelo: a ESQUERDA.
        if (lado === 'fogo' && x >= w - faixa && B > R + DIFERENCA) invasores++;
        if (lado === 'gelo' && x < faixa && R > B + DIFERENCA) invasores++;
      }
    }
    saida.push({ lado, arquivo: img.currentSrc.split('/').pop(), w, h, invasores });
  }
  return saida;
}, { BORDA, DIFERENCA });

/**
 * Tira uma foto do MEIO da troca de aba: quantas artes existem de cada lado, e
 * se a faixa das partículas está no mesmo lugar que a fenda.
 *
 * As duas coisas são o mesmo defeito visto de dois ângulos — metade da cena
 * mudando de estalo enquanto a outra metade leva 900 ms.
 */
const noMeioDaTroca = () => page.evaluate(() => {
  const artes = (lado) =>
    document.querySelectorAll(`.arena-lutador-${lado} .arena-troca`).length;
  const borda = (sel) => getComputedStyle(document.querySelector(sel)).left;
  return {
    artesFogo: artes('fogo'),
    artesGelo: artes('gelo'),
    fenda: borda('.arena-fenda'),
    particulas: borda('.arena-particulas-gelo'),
  };
});

/** O que a moldura da borda DIREITA está mostrando, pelo estilo computado. */
const molduraDaDireita = () => page.evaluate(() => {
  const el = document.querySelector('.arena-moldura-gelo');
  if (!el) return 'elemento .arena-moldura-gelo nao existe';
  const e = getComputedStyle(el);
  return e.display === 'none' ? 'oculta' : e.backgroundImage;
});

/**
 * Espera a cena ASSENTAR: o fade cruzado terminou e as duas artes que ficaram
 * estão carregadas.
 *
 * A condição de "terminou" é haver **uma** `.arena-troca` por lado. Durante o
 * cruzamento existem duas de cada — e foi isso que reprovou a contagem quando o
 * cruzamento entrou: o teste media no meio da troca sem querer. Esperar um
 * tempo fixo seria adivinhação; esperar o número certo de artes é o fato.
 */
const esperarArtes = async () => {
  await page.waitForSelector('.arena-troca', { timeout: 15000 });
  await page.waitForFunction(() => {
    const trocas = document.querySelectorAll('.arena-troca');
    if (trocas.length !== 2) return false;
    const imgs = [...document.querySelectorAll('img.arena-figura')];
    return imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 15000 });
};

const conferir = async (rota) => {
  const medidas = await medir();

  if (medidas.length !== 2) {
    throw new Error(
      `${rota} tem ${medidas.length} lutador(es), esperava 2.\n`
      + '  A arena monta um de cada lado — se sumiu um, o fundo perdeu metade\n'
      + '  do sentido (ver src/components/auth/ArenaDeEntrada.jsx).');
  }
  for (const m of medidas) {
    if (m.erro) throw new Error(`${rota}: o lutador de ${m.lado} ${m.erro}`);
    if (m.lado === 'desconhecido') {
      throw new Error(
        `${rota}: achei uma arte fora de .arena-lutador-fogo/-gelo.\n`
        + '  Sem saber de que lado ela está, não dá para saber qual borda\n'
        + '  encosta na fenda — e o teste passaria a não verificar nada.');
    }
    if (m.invasores > TOLERANCIA) {
      throw new Error(
        `${rota}: a arte de ${m.lado} (${m.arquivo}) tem ${m.invasores} pixels da\n`
        + `  cor do adversário na borda que encosta na fenda (limite ${TOLERANCIA}).\n`
        + '  É o defeito de 04/09: o recorte foi feito numa reta vertical, e os\n'
        + '  dois lutadores se sobrepõem em ~75 colunas na arte original.\n'
        + '  O recorte tem que separar por COR na faixa disputada — a receita\n'
        + '  está no cabeçalho deste arquivo e em docs/DESEMPENHO.md.');
    }
  }
  ok(`${rota}: ${medidas.map((m) => `${m.lado} ${m.invasores}`).join(' · ')} pixels invasores`);
  return medidas.map((m) => m.arquivo).sort().join('|');
};

try {
  await exigirServidor(BASE);
  console.log(`\n  Artes da arena em ${BASE}\n`);

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await esperarArtes();
  const noLogin = await conferir('login');
  const molduraNoLogin = await molduraDaDireita();

  // O cadastro é ABA, não rota: `mode` é estado do Login.jsx. Ir por URL não
  // alcançaria a segunda composição, e o teste passaria medindo duas vezes a
  // mesma coisa — o tipo de cobertura que não cobre (§1.5).
  await page.getByRole('button', { name: /^Registrar$/i }).click();
  await esperarArtes();
  const noCadastro = await conferir('cadastro');
  const molduraNoCadastro = await molduraDaDireita();

  // As duas telas precisam de artes DIFERENTES: no login eles se encaram, no
  // cadastro o fogo vira de frente e o gelo dá as costas. Se um dia o `modo`
  // parar de chegar no componente, as duas telas passariam a mostrar o mesmo
  // par — e nenhuma das contagens acima notaria.
  if (noLogin === noCadastro) {
    throw new Error(
      'login e cadastro estão servindo as MESMAS artes.\n'
      + `  Os dois carregaram: ${noLogin}\n`
      + '  O `modo` não está chegando na ArenaDeEntrada — no cadastro o fogo\n'
      + '  tem que estar de frente e o gelo de costas.');
  }
  ok('login e cadastro servem pares de artes diferentes');

  // A moldura da borda DIREITA muda de arte entre as duas telas, e isso é
  // pedido explícito do dono: *"a do cadastro pode ser só a de fogo, pq o
  // personagem de fogo é oq tá mais a mostra"*. Sem esta conferência, alguém
  // apagando a regra `.arena-selecionado .arena-moldura-gelo` traria a borda de
  // gelo de volta para uma tela onde o gelo está de costas — e nada acusaria.
  if (!/moldura-gelo/.test(molduraNoLogin)) {
    throw new Error(
      `no /login a borda direita deveria ser a de GELO, e é: ${molduraNoLogin}`);
  }
  if (/moldura-gelo/.test(molduraNoCadastro)) {
    throw new Error(
      `no cadastro a borda direita voltou a ser a de GELO: ${molduraNoCadastro}\n`
      + '  A regra `.arena-selecionado .arena-moldura-gelo` sumiu do\n'
      + '  src/estilos/arena.css. Ali o gelo está de costas e recuado — o pedido\n'
      + '  do dono foi moldura SÓ de fogo, e a borda direita fica limpa.');
  }
  ok(`a moldura do cadastro não tem gelo (direita: ${molduraNoCadastro})`);

  // ── A troca de aba, medida NO MEIO dela ──────────────────────────────────
  //
  // Dois achados do dono em 04/09, e a mesma raiz: metade da cena mudava em
  // 900 ms e a outra metade de estalo.
  //
  // Sobre o instante da amostra: 220 ms cai dentro do cruzamento (550 ms) e da
  // viagem da fenda (900 ms), com folga dos dois lados. E a segunda asserção
  // não depende de instante nenhum — as duas se movem pela MESMA transição,
  // então são iguais em todo momento, não só neste.
  await page.getByRole('button', { name: /^Entrar$/i }).click();
  await page.waitForTimeout(220);
  const meio = await noMeioDaTroca();

  for (const [lado, quantas] of [['fogo', meio.artesFogo], ['gelo', meio.artesGelo]]) {
    if (quantas !== 2) {
      throw new Error(
        `no meio da troca de aba existe ${quantas} arte(s) do lado do ${lado}, esperava 2.\n`
        + '  Com uma só, não há fade cruzado: a arte nova SUBSTITUI a velha no\n'
        + '  quadro em que chega. Foi o que o dono relatou — *"os personagens\n'
        + '  simplesmente aparecem, sem nenhum fade in ou fade out"*.\n'
        + '  Ver o componente `Lutador` em ArenaDeEntrada.jsx.');
    }
  }

  const distancia = Math.abs(parseFloat(meio.fenda) - parseFloat(meio.particulas));
  if (!(distancia <= 1)) {
    throw new Error(
      `no meio da troca, a fenda está em ${meio.fenda} e a faixa das partículas\n`
      + `  em ${meio.particulas} — ${distancia.toFixed(1)} px de diferença.\n`
      + '  Elas têm que andar JUNTAS. Quando a faixa pula para a posição final e\n'
      + '  a fenda ainda está viajando, sobra floco de gelo em cima do lado do\n'
      + '  fogo pelo tempo da viagem — foi o que o dono viu voltando do cadastro.\n'
      + '  Confira se `.arena-particulas` ainda tem a MESMA `transition` de\n'
      + '  `.arena-lado` e `.arena-fenda` (900ms, mesma curva).');
  }
  ok(`no meio da troca: 2 artes por lado, e a faixa a ${distancia.toFixed(1)}px da fenda`);
} catch (e) {
  console.error(`\n  FALHOU no passo ${passo + 1}: ${e.message}\n`);
  await salvarEvidencia(page);
  await navegador.close();
  process.exit(1);
}

await navegador.close();
console.log(`\n  ${passo}/${passo} conferências das artes da arena OK.\n`);
