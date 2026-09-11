/**
 * As artes do login e do cadastro não podem carregar pedaço do adversário.
 *
 * ── O bug que esta trava impede ─────────────────────────────────────────────
 *
 * As artes chegam como UMA imagem com os dois lutadores. Para virarem fundo de
 * tela, cada uma é recortada em duas — e a primeira versão cortou na metade da
 * imagem, número redondo escolhido por simetria aparente e não por medição.
 *
 * O dono viu o resultado antes de mim: *"o de um lado tá aparecendo um pouco na
 * parte do outro, não ficou um corte muito limpo"*. A medição explicou: naquela
 * arte os dois se sobrepunham por **75 colunas**, e qualquer reta vertical ali
 * cortava um e levava um pedaço do outro.
 *
 * ── Por que a fronteira é COR, e não uma reta ───────────────────────────────
 *
 * Na faixa disputada quem decide é a cor do pixel: o lado verde descarta o que
 * é nitidamente roxo, o roxo descarta o que é nitidamente verde, e o alfa vai a
 * zero por rampa nas últimas colunas — sem a rampa, o halo residual termina
 * numa reta, que era a segunda metade da queixa.
 *
 * Nas artes de hoje existe folga de verdade (6 colunas no login, 120 no
 * cadastro), então a regra quase não precisa opinar. **Ela fica mesmo assim**:
 * a próxima arte pode não ter folga nenhuma, e foi exatamente esse o caso que
 * produziu o defeito.
 *
 * ── O que este teste mede, e por que num NAVEGADOR ──────────────────────────
 *
 * Conta pixels da cor errada na borda que encosta na fenda: no lutador verde, a
 * borda DIREITA; no roxo, a ESQUERDA. Zero é o esperado.
 *
 * É num navegador porque WebP não se decodifica em Node sem dependência nova, e
 * porque assim o teste mede **a imagem que o site serve de verdade** — a que o
 * `srcset` escolheu, no caminho que o Vite gerou. Um teste que lesse o arquivo
 * da pasta não perceberia se o componente passasse a apontar para outra arte.
 *
 * O eixo de cor é G contra B. Ele mudou junto com a paleta: era R contra B
 * quando a cena era fogo × gelo.
 */
import { abrirNavegador, exigirServidor, salvarEvidencia } from './util.mjs';
import { medidasDaArena } from './arena/medidas.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';

const navegador = await abrirNavegador();
const contexto = await navegador.newContext();
const page = await contexto.newPage();
let passo = 0;
const ok = (m) => console.log(`  ${String(++passo).padStart(2)}. OK   ${m}`);

const {
  TOLERANCIA, BORDA, DIFERENCA,
  medir, noMeioDaTroca, molduraDaDireita, esperarArtes, artesNaTela,
} = medidasDaArena(page);

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
        `${rota}: achei uma arte fora de .arena-lutador-verde/-roxo.\n`
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
  const artesDoLogin = await artesNaTela();
  await page.getByRole('button', { name: /^Registrar$/i }).click();
  await esperarArtes(artesDoLogin);
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
  // apagando a regra `.arena-selecionado .arena-moldura-roxo` traria a borda de
  // gelo de volta para uma tela onde o gelo está de costas — e nada acusaria.
  if (!/moldura-roxo/.test(molduraNoLogin)) {
    throw new Error(
      `no /login a borda direita deveria ser a ROXA, e é: ${molduraNoLogin}\n`
      + '  No login os dois se encaram, entao as DUAS bordas acendem. Se veio\n'
      + '  "oculta", a moldura existe e nao aparece — procure em\n'
      + '  src/estilos/arena/efeitos.css por: `opacity` zerada fora da regra\n'
      + '  `.arena-selecionado`, `display: none`, ou a classe `arena-selecionado`\n'
      + '  aplicada na tela errada pelo ArenaDeEntrada.jsx.\n'
      + '  (Este passo espera a animacao de entrada TERMINAR antes de medir, via\n'
      + '   getAnimations() — entao "oculta" aqui e o estado final, nao um quadro\n'
      + '   do meio da animacao.)');
  }
  if (/moldura-roxo/.test(molduraNoCadastro)) {
    throw new Error(
      `no cadastro a borda direita voltou a ser a ROXA E VISIVEL: ${molduraNoCadastro}\n`
      + '  A regra `.arena-selecionado .arena-moldura-roxo` sumiu do\n'
      + '  src/estilos/arena/efeitos.css, ou parou de zerar a opacidade. Ali o\n'
      + '  roxo esta de costas e recuado — o pedido do dono foi moldura SO do\n'
      + '  vencedor, e a direita fica limpa.\n'
      + '  (Sumir por `opacity: 0` conta como limpa; por `display: none` tambem.\n'
      + '   O que NAO conta e o elemento estar visivel.)');
  }
  ok(`a moldura do cadastro não tem roxo (direita: ${molduraNoCadastro})`);

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

  for (const [lado, quantas] of [['verde', meio.artesVerde], ['roxo', meio.artesRoxo]]) {
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

  // ── O BURACO da PRIMEIRA troca de aba ─────────────────────────────────────
  //
  // `[11/09]` Relato do dono: *"ao entrar no login e clicar na aba cadastro,
  // aquele problema da transição aparece... é apenas quando o usuário entra
  // pela primeira vez"*.
  //
  // A causa não era a moldura (medi: a `opacity` dela rampa liso em 17 quadros).
  // Era que `roxo-costas` e `verde-frente` só começam a ser baixados NO CLIQUE,
  // e a arte velha saía na hora enquanto a nova esperava o `load`. Resultado
  // filmado a 1,5 Mbps: o lado roxo ficava VAZIO por ~1 s.
  //
  // Duas coisas que este passo faz de propósito, e sem as duas ele não pega
  // nada:
  //
  //   CONTEXTO NOVO  cache frio. No contexto de cima as artes já foram
  //                  baixadas pelos passos anteriores, e a primeira troca —
  //                  que é a única que quebra — não existe mais.
  //   REDE FREADA    em localhost a arte chega em ~50 ms e o buraco não cabe
  //                  num quadro. O defeito é de TEMPO; sem freio, o teste
  //                  passaria sempre e não vigiaria coisa nenhuma.
  const frio = await navegador.newContext();
  const pagFria = await frio.newPage();
  const cdp = await frio.newCDPSession(pagFria);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150,
    downloadThroughput: (1.5 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });

  await pagFria.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 30000 });

  // Espera a cena de LOGIN existir de verdade antes de clicar, e isso não é
  // zelo: na primeira versão deste passo eu esperava 1.800 ms fixos e o teste
  // reprovava um site consertado. A medição mostrou por quê — no clique a arte
  // do PRÓPRIO login ainda estava baixando (`complete: false`, opacidade 0), e
  // o passo media um buraco que ele mesmo tinha criado.
  //
  // `waitUntil: 'load'` não cobre isso: o React monta DEPOIS do evento `load`,
  // então as artes só começam a ser buscadas quando ele já passou. Perguntar
  // pelo fato — a arte está carregada e visível? — é o que separa "a cena ainda
  // está entrando" de "a cena perdeu a figura".
  await pagFria.waitForFunction(() =>
    [...document.querySelectorAll('.arena-lutador-roxo .arena-troca')].some((env) => {
      const img = env.querySelector('img');
      return img?.complete && img.naturalWidth > 0
        && Number(getComputedStyle(env).opacity) > 0.9;
    }), null, { timeout: 30000 });

  const vazios = await pagFria.evaluate(async () => {
    // Um quadro conta como VAZIO quando nenhuma arte do lado roxo está ao mesmo
    // tempo carregada e visível. Exigir as duas coisas é o ponto: `<img>` que
    // ainda não chegou tem caixa, mas não tem figura.
    const ladoOcupado = () => [...document.querySelectorAll('.arena-lutador-roxo .arena-troca')]
      .some((env) => {
        const img = env.querySelector('img');
        return img?.complete && img.naturalWidth > 0
          && Number(getComputedStyle(env).opacity) > 0.05;
      });

    [...document.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === 'Registrar')?.click();

    let semArte = 0;
    let total = 0;
    await new Promise((resolve) => {
      const fim = performance.now() + 1500;
      const laco = () => {
        total += 1;
        if (!ladoOcupado()) semArte += 1;
        if (performance.now() < fim) requestAnimationFrame(laco); else resolve();
      };
      requestAnimationFrame(laco);
    });
    return { semArte, total };
  });

  await frio.close();

  if (vazios.semArte > 0) {
    throw new Error(
      `na PRIMEIRA troca de aba o lado roxo ficou SEM ARTE em ${vazios.semArte}\n`
      + `  de ${vazios.total} quadros (rede a 1,5 Mbps, cache frio).\n`
      + '  A arte do cadastro só é baixada no clique, então soltar a arte VELHA\n'
      + '  antes de a nova estar pronta abre um buraco de ~1 s onde não há\n'
      + '  lutador nenhum — e some sozinho na segunda troca, porque aí o cache\n'
      + '  já tem tudo. Foi exatamente o que o dono relatou em 11/09.\n'
      + '  Confira se o `Lutador` (ArenaDeEntrada.jsx) ainda SEGURA a arte\n'
      + '  exibida até a nova terminar o `decode()`.');
  }
  ok(`primeira troca em rede freada: ${vazios.total} quadros, nenhum sem arte`);
} catch (e) {
  console.error(`\n  FALHOU no passo ${passo + 1}: ${e.message}\n`);
  await salvarEvidencia(page);
  await navegador.close();
  process.exit(1);
}

await navegador.close();
console.log(`\n  ${passo}/${passo} conferências das artes da arena OK.\n`);
