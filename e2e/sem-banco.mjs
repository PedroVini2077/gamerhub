/**
 * Trava do bug de 01/09: com o banco fora, o site inteiro ficava inacessível.
 *
 * ── O que estava errado ─────────────────────────────────────────────────────
 *
 * `if (semBanco) return <OfflineGate />` ficava ACIMA do `<Routes>`. Sem o
 * router montado, `/sobre` e `/login` viravam inalcançáveis — e nenhuma das
 * duas precisa do banco (conferido: elas não importam o cliente Supabase).
 * Clicar mudava a URL e nada acontecia.
 *
 * A regra que ficou: **fora do ar bloqueia só o que depende do banco.**
 *
 * ── Como o teste simula a queda ────────────────────────────────────────────
 *
 * Aborta toda requisição para o host do Supabase. É o que o navegador vê
 * quando o projeto está pausado ou a rede morreu no meio: o `fetch` estoura, e
 * é exatamente a condição que o `lib/dbHealth.js` conta como falha de
 * infraestrutura.
 *
 * Não mexe em nada de produção — o bloqueio existe só dentro deste navegador.
 */
import { abrirNavegador, exigirServidor, salvarEvidencia } from './util.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';
const SUPABASE = process.env.VITE_SUPABASE_URL;

if (!SUPABASE) {
  console.error('\n  VITE_SUPABASE_URL e obrigatorio: sem ele o teste nao sabe');
  console.error('  QUAL host derrubar, e passaria sem ter simulado queda nenhuma.\n');
  process.exit(2);
}

const navegador = await abrirNavegador();
const page = await navegador.newPage({ viewport: { width: 412, height: 830 } });
let passo = 0;
const ok = (m) => console.log(`  ${String(++passo).padStart(2)}. OK   ${m}`);

try {
  await exigirServidor(BASE);
  const host = new URL(SUPABASE).host;
  await page.route(`**://${host}/**`, (rota) => rota.abort());
  console.log(`\n  Banco fora do ar (bloqueando ${host})\n`);

  const texto = () => page.locator('body').innerText();

  // ── 1. A landing continua de pé ──────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);   // dbHealth precisa de 3 falhas + sondagem

  if (!/gamerhub/i.test(await texto())) {
    throw new Error('a landing nao renderizou com o banco fora — e ela nao '
      + 'depende do banco para nada.');
  }
  ok('landing de pé sem banco');

  // ── 2. FORÇAR o estado "sem banco" de verdade ──────────────────────────
  //
  // Este passo existe porque a primeira versão deste teste era DECORAÇÃO, e eu
  // só descobri porque injetei o bug de volta e ele passou mesmo assim.
  //
  // O motivo: medido em 01/09, um visitante na landing faz **ZERO** requisições
  // ao Supabase — a página é estática e, sem sessão salva, nem a resolução de
  // auth vai à rede. Sem falha nenhuma para contar, o `dbHealth` nunca declara
  // queda, e o teste passava sem jamais ter entrado no estado que diz testar.
  //
  // Para alcançar o estado de verdade é preciso FAZER o site falar com o banco.
  // A tentativa de login é o caminho de visitante que faz isso: cada envio é
  // uma chamada de auth que estoura com o host bloqueado. O `dbHealth` exige
  // três falhas seguidas mais uma sondagem independente.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await page.locator('#email').waitFor({ state: 'visible', timeout: 20000 });
  } catch {
    // O timeout cru diria so "nao achei #email". Esta e a causa provavel, e
    // dize-la aqui poupa a proxima pessoa de investigar o seletor.
    throw new Error(
      'o formulario de login nao apareceu com o banco fora.\n'
      + `  O que estava na tela: "${(await texto()).slice(0, 120).replace(/\s+/g, ' ')}"\n`
      + '  Causa quase certa: algo voltou a SEQUESTRAR o app inteiro quando o\n'
      + '  banco cai, como o antigo OfflineGate fazia com um `return` acima do\n'
      + '  <Routes>. A /login precisa aparecer e explicar — nao sumir.');
  }

  // O `try` envolve o LAÇO, e não só a espera inicial: numa carga nova o
  // estado começa "com banco", o formulário aparece normalmente, e o app só
  // seria sequestrado DEPOIS das falhas se acumularem. Foi assim que a
  // primeira versão desta trava deu um timeout cru em vez de explicar.
  try {
    for (let i = 0; i < 4; i++) {
      await page.locator('#email').fill(`sem-banco-${i}@example.com`);
      await page.locator('#password').fill('naoImportaSenhaNenhuma1');
      await page.getByRole('button', { name: '// ENTRAR' }).click();
      await page.waitForTimeout(1800);
    }
  } catch {
    throw new Error(
      'o formulário de login DESAPARECEU no meio das tentativas.\n'
      + `  O que ficou na tela: "${(await texto()).slice(0, 120).replace(/\s+/g, ' ')}"\n`
      + '  Causa quase certa: algo voltou a SEQUESTRAR o app quando o banco\n'
      + '  cai, como o antigo OfflineGate fazia com um `return` acima do\n'
      + '  <Routes>. A /login precisa continuar na tela e explicar — nao sumir.');
  }
  await page.waitForTimeout(4000);   // margem para a sondagem de confirmação

  const avisou = /sem conex[aã]o com o banco/i.test(await texto());
  if (!avisou) {
    throw new Error(
      'quatro tentativas de login com o banco inalcançável e NENHUM aviso.\n'
      + '  Ou o dbHealth parou de contar falha de infraestrutura, ou o\n'
      + '  AvisoSemBanco saiu do App.jsx. Falha muda e o pior caso (§1.5):\n'
      + '  a pessoa tenta, falha, e nao entende por que.');
  }
  ok('4 logins falhos -> o aviso de banco fora aparece');

  // ── `[03/09]` A faixa não pode COBRIR o que está fixo no topo ─────────────
  //
  // O dono relatou, com print: *"não consigo acessar a side bar, pq a msg lá em
  // cima tá tampando"*. Medido no celular dele: faixa `sticky top-0` de 65 px,
  // botão de menu em `top: 14`.
  //
  // `sticky` empurra irmãos no FLUXO — mas os cabeçalhos da landing e do site
  // logado são `fixed`, e `fixed` é posicionado pela JANELA. Ficavam debaixo
  // dela. O elemento existia no DOM e não dava para tocar.
  //
  // A pergunta aqui é a REGRA, não um botão específico: **enquanto a faixa
  // estiver na tela, nenhum elemento fixo no topo pode ser coberto por ela.**
  // Assim a trava continua valendo quando surgir um cabeçalho novo.
  // Para a faixa E um cabecalho fixo coexistirem, e preciso estar na LANDING —
  // e a landing so fala com o Supabase quando ha sessao (um visitante puro faz
  // ZERO requisicoes, o que este proprio arquivo ja documenta). Entao a sessao
  // e forjada aqui: e a condicao do print do dono, e sem ela o teste passaria
  // no vazio, sobre uma pagina que nao tem cabecalho fixo nenhum.
  const ref = new URL(SUPABASE).host.split('.')[0];
  await page.addInitScript((r) => {
    localStorage.setItem(`sb-${r}-auth-token`, JSON.stringify({
      access_token: 'e2e', refresh_token: 'e2e',
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'e2e' },
    }));
  }, ref);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const cobertos = await page.evaluate(() => {
    const faixa = document.querySelector('[role=status]');
    if (!faixa) return { semFaixa: true };
    const rf = faixa.getBoundingClientRect();

    const presos = [...document.querySelectorAll('header, nav')]
      .filter((e) => getComputedStyle(e).position === 'fixed')
      .filter((e) => e !== faixa && !faixa.contains(e));

    return {
      semFaixa: false,
      alturaDaFaixa: Math.round(rf.height),
      fixosNoTopo: presos.length,
      sobrepostos: presos
        .map((e) => ({ tag: e.tagName, top: Math.round(e.getBoundingClientRect().top) }))
        .filter((x) => x.top < rf.bottom - 1),
    };
  });

  if (cobertos.semFaixa) {
    throw new Error(
      'a faixa de "sem banco" NAO esta na tela depois das tentativas de login.\n'
      + '    Sem ela, quem esta com o site aberto nao tem como saber por que\n'
      + '    entrar e publicar pararam de funcionar.');
  }
  if (cobertos.sobrepostos.length > 0) {
    throw new Error(
      'a faixa de "sem banco" esta COBRINDO cabecalho fixo.\n'
      + `    faixa: ${cobertos.alturaDaFaixa}px · cobertos: `
      + `${JSON.stringify(cobertos.sobrepostos)}\n`
      + '    Foi o bug de 03/09: a faixa era `sticky` e os cabecalhos sao\n'
      + '    `fixed`, entao ela ficava POR CIMA. O menu existia no DOM e nao\n'
      + '    dava para tocar — nenhum teste de "o link existe?" pega isso.\n'
      + '    O contrato e a variavel `--altura-do-aviso`, publicada pelo\n'
      + '    AvisoSemBanco e lida no `top` de cada cabecalho fixo.');
  }
  // A guarda contra passar no VAZIO: sem cabecalho fixo na tela, a checagem
  // acima nao verifica nada e daria verde para sempre. Ja aconteceu nesta
  // mesma sessao — a primeira versao rodava no /login, que nao tem cabecalho
  // fixo, e dizia "0 cabecalhos fixos" com ar de aprovada.
  if (cobertos.fixosNoTopo === 0) {
    throw new Error(
      'nenhum cabecalho FIXO na tela — esta checagem nao verificou nada.\n'
      + '    Ela precisa rodar onde a faixa E um cabecalho fixo coexistem (a\n'
      + '    landing com sessao). Se o layout mudou e o cabecalho deixou de ser\n'
      + '    `fixed`, atualize o seletor; nao deixe a trava passar no vazio.');
  }
  ok(`faixa de ${cobertos.alturaDaFaixa}px nao cobre nenhum dos ${cobertos.fixosNoTopo} cabecalhos fixos`);

  // ── 3. /sobre CONTINUA alcançável — o coração do bug ─────────────────────
  await page.goto(`${BASE}/sobre`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  if (!/o gamerhub/i.test(await texto())) {
    throw new Error(
      'a /sobre NAO abriu com o banco fora.\n'
      + '  Ela e estatica e nao faz uma consulta sequer — ficar inacessivel\n'
      + '  significa que algo voltou a sequestrar o <Routes> inteiro, como o\n'
      + '  antigo OfflineGate fazia. Confira o AppRoutes em src/App.jsx.');
  }
  ok('/sobre continua alcançável sem banco');

  // ── 4. /login renderiza (falhar ao entrar é outra história) ──────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  if (!/entrar|senha/i.test(await texto())) {
    throw new Error('a /login nao renderizou com o banco fora. Ela PRECISA do '
      + 'banco para autenticar, mas tem que aparecer e explicar — nao sumir.');
  }
  ok('/login renderiza e pode explicar, em vez de sumir');

} catch (e) {
  console.error(`\n  FALHOU no passo ${passo + 1}: ${e.message}\n`);
  await salvarEvidencia(page);
  await navegador.close();
  process.exit(1);
}

await navegador.close();
console.log(`\n  ${passo}/4 comportamentos corretos com o banco fora.\n`);
