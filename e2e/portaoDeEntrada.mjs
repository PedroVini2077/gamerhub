/**
 * O PORTÃO DE BOAS-VINDAS — as duas conferências da entrada.
 *
 * ── Por que em arquivo próprio ──────────────────────────────────────────────
 *
 * `[11/09]` `e2e/fluxos.mjs` passou de 300 linhas e o §4 manda dividir o que eu
 * toquei. O corte é por responsabilidade, não por tamanho: aqui mora **a
 * entrada** — a tela de boas-vindas e a geometria da porta —, e no roteiro fica
 * o percurso de quem já entrou.
 *
 * O corte foi mecânico: nenhuma asserção mudou, só o endereço delas.
 *
 * ── O que estas duas conferências guardam ───────────────────────────────────
 *
 * A primeira é o único canal que prova que a tela de boas-vindas funciona: se
 * ela parar de aparecer, nada quebra, nada loga, e o site continua entrando
 * normalmente — as três respostas do §1.5 seriam "nada".
 *
 * A segunda é geometria, e nasceu de uma exigência do dono em 05/09: *"a porta
 * é pra ser a tela inteira, entendeu? A TELA INTEIRA! não uma imagem abrindo, é
 * pra ter imersão"*. Ele recusou quatro versões, e a quarta falhou justamente
 * por ser um desenho BONITO dentro de uma tela com fundo em volta. Isso não se
 * verifica por byte nem por unidade — só em tela de verdade.
 *
 * @param {import('playwright').Page} page
 * @param {(msg: string) => void} ok  registra um passo aprovado no roteiro
 */
export async function conferirPortaoDeEntrada(page, ok) {
  // ── O PORTÃO DE BOAS-VINDAS ─────────────────────────────────────────────
  //
  // Ele é o único canal que prova que a tela de boas-vindas funciona: se ela
  // parar de aparecer, nada quebra, nada loga, e o site continua entrando
  // normalmente (§1.5 — as três respostas seriam "nada").
  //
  // A espera é por SELETOR, não por tempo: ele fica na tela entre 700 ms e
  // 2,5 s dependendo de quanto o perfil demora, e cravar um número aqui seria
  // adivinhar o tempo do banco.
  //
  // Se ele NÃO aparecer, a mensagem tem que dizer o que investigar — a marca
  // de "acabou de entrar" é `sessionStorage`, e ela é o elo que mais some.
  try {
    await page.locator('.portao').waitFor({ state: 'visible', timeout: 4000 });
    ok('o portão de boas-vindas cobriu a entrada');
  } catch {
    throw new Error(
      'o portão de boas-vindas NAO apareceu depois do login.\n'
      + '  Ele deveria cobrir a tela entre 700 ms e 2,5 s enquanto o perfil\n'
      + '  carrega. Confira, nesta ordem:\n'
      + '   1. `marcarEntradaAgora()` ainda é chamado ANTES do\n'
      + '      `signInWithPassword` (src/hooks/useAuth.jsx) — e nenhum\n'
      + '      `cancelarEntradaAgora()` novo esta apagando a marca no caminho\n'
      + '      feliz;\n'
      + '   2. `<PortaoDeBoasVindas />` continua montado no App.jsx, FORA do\n'
      + '      <Routes> — dentro de uma rota ele desmonta com a tela de login;\n'
      + '   3. o navegador nao esta bloqueando `sessionStorage`.\n'
      + '  Nada disso quebra o login: some so a tela.');
  }

  // ── A porta é A TELA INTEIRA ────────────────────────────────────────────
  //
  // `[05/09]` Exigência do dono, na letra: *"a porta é pra ser a tela inteira,
  // entendeu? A TELA INTEIRA! não uma imagem abrindo, é pra ter imersão"*. Ele
  // recusou quatro versões, e a quarta falhou justamente por ser um desenho
  // BONITO dentro de uma tela com fundo em volta.
  //
  // Isso não se verifica por byte nem por unidade: é geometria em tela de
  // verdade. As duas folhas somadas têm que cobrir a janela inteira — se um dia
  // alguém puser `max-height` de volta, aqui quebra.
  const cobertura = await page.evaluate(() => {
    const folhas = [...document.querySelectorAll('.porta-folha')];
    if (folhas.length !== 2) return { folhas: folhas.length };
    const caixas = folhas.map((f) => f.getBoundingClientRect());
    return {
      folhas: 2,
      esquerda: Math.round(Math.min(...caixas.map((c) => c.left))),
      direita: Math.round(Math.max(...caixas.map((c) => c.right))),
      topo: Math.round(Math.min(...caixas.map((c) => c.top))),
      base: Math.round(Math.max(...caixas.map((c) => c.bottom))),
      janela: { largura: innerWidth, altura: innerHeight },
    };
  });

  const cobreTudo = cobertura.folhas === 2
    && cobertura.esquerda <= 0 && cobertura.topo <= 0
    && cobertura.direita >= cobertura.janela.largura
    && cobertura.base >= cobertura.janela.altura;

  if (!cobreTudo) {
    throw new Error(
      'o portão NAO cobre a tela inteira.\n'
      + `  medido: ${JSON.stringify(cobertura)}\n`
      + '  As duas .porta-folha somadas precisam ir de (0,0) ate\n'
      + '  (innerWidth, innerHeight). Sobrar fundo em volta transforma a porta\n'
      + '  num DESENHO de porta, que foi a versao recusada em 05/09.\n'
      + '  Suspeitos: `max-height`/`width` em .porta-svg ou .porta-folha,\n'
      + '  um `padding` no .portao, ou o texto empurrando as folhas.');
  }
  ok('a porta ocupa a tela inteira');
}
