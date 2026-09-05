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

  // O laço PARA quando o estado é alcançado, e essa saída não é economia de
  // tempo — é a única forma correta desde 03/09. Enquanto o `dbHealth` não
  // declarou queda, a tela mostra o formulário; assim que declara, ela troca
  // pelo `LoginSemBanco` e o campo de email deixa de existir. Um laço que
  // insistisse no campo falharia no próprio sucesso.
  //
  // O que continua sendo erro é o formulário sumir SEM a explicação no lugar:
  // isso é o app sendo sequestrado de novo, como o antigo OfflineGate fazia
  // com um `return` acima do `<Routes>`.
  const jaExplicou = async () => /entrar est[aá] indispon[ií]vel/i.test(await texto());

  for (let i = 0; i < 5; i++) {
    if (await jaExplicou()) break;
    if ((await page.locator('#email').count()) === 0) {
      throw new Error(
        'o formulário de login sumiu e NADA explicou o motivo.\n'
        + `  O que ficou na tela: "${(await texto()).slice(0, 120).replace(/\s+/g, ' ')}"\n`
        + `  Endereço: "${new URL(page.url()).pathname}" (esperado "/login")\n`
        + '  Causa quase certa: algo voltou a SEQUESTRAR o app quando o banco\n'
        + '  cai. A /login precisa continuar na tela e explicar — nao sumir.');
    }
    await page.locator('#email').fill(`sem-banco-${i}@example.com`);
    await page.locator('#password').fill('naoImportaSenhaNenhuma1');
    await page.getByRole('button', { name: '// ENTRAR' }).click();
    await page.waitForTimeout(1800);
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
  //
  // `[03/09]` O TOKEN PRECISA SER UM JWT BEM FORMADO, e isto não é capricho.
  //
  // A primeira versão gravava `access_token: 'e2e'`. O cliente Supabase decodifica
  // o token ao restaurar a sessão; uma string qualquer é descartada, `user` fica
  // NULO, e o teste passava a rodar como visitante puro — que é justamente o
  // caso que ele não queria testar. Foi assim que o defeito do `GuestOnly`
  // (passo 4) sobreviveu a esta trava.
  //
  // A assinatura é falsa de propósito: o cliente não verifica assinatura, e o
  // servidor está bloqueado neste teste. O que importa é o FORMATO.
  const ref = new URL(SUPABASE).host.split('.')[0];
  await page.addInitScript((r) => {
    const b64 = (o) => btoa(JSON.stringify(o))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const agora = Math.floor(Date.now() / 1000);
    const id = '00000000-0000-0000-0000-0000000000e2';
    const jwt = [
      b64({ alg: 'HS256', typ: 'JWT' }),
      b64({ sub: id, aud: 'authenticated', role: 'authenticated',
            email: 'e2e@example.com', iat: agora, exp: agora + 3600 }),
      'assinatura_falsa',
    ].join('.');
    localStorage.setItem(`sb-${r}-auth-token`, JSON.stringify({
      access_token: jwt, refresh_token: 'e2e', token_type: 'bearer',
      expires_in: 3600, expires_at: agora + 3600,
      user: { id, aud: 'authenticated', role: 'authenticated',
              email: 'e2e@example.com', app_metadata: {}, user_metadata: {},
              created_at: new Date().toISOString() },
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

  // ── 4. `[03/09]` /login É ALCANÇÁVEL MESMO COM SESSÃO SALVA ──────────────
  //
  // ESTA CHECAGEM APROVAVA O BUG, e vale registrar como, porque a forma se
  // repete. Ela era `if (!/entrar|senha/i.test(texto))`. Com sessão salva o
  // `GuestOnly` mandava `/login` de volta para `/`, a landing aparecia — e a
  // landing tem um botão escrito **ENTRAR**. A expressão casava, o teste dava
  // verde, e o dono não conseguia entrar no site. Um teste de "a palavra existe
  // na tela" não distingue a página certa da página errada.
  //
  // O que substituiu: o CAMINHO de quem usa (clicar no botão da landing) e uma
  // pergunta que só a página certa responde (o endereço mudou? o conteúdo é o
  // da tela de login?).
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.locator('a[href="/login"]').first().click();
  await page.waitForTimeout(3000);

  const noLogin = await page.evaluate(() => ({
    caminho: location.pathname,
    ehTelaDeLogin: !!document.querySelector('input[type=password]')
      || /entrar est[aá] indispon[ií]vel/i.test(document.body.innerText),
  }));

  if (noLogin.caminho !== '/login' || !noLogin.ehTelaDeLogin) {
    throw new Error(
      'clicar em "Entrar" com sessao salva NAO leva a tela de login.\n'
      + `    endereco depois do clique: "${noLogin.caminho}" (esperado "/login")\n`
      + '    Foi o bug de 03/09, relatado com o projeto PAUSADO: a sessao fica\n'
      + '    no localStorage e `getSession()` a restaura SEM rede, entao o\n'
      + '    `GuestOnly` via `user` e mandava de volta para `/` — onde a landing\n'
      + '    oferece "Entrar" de novo. Laco sem saida, e do lado de quem usa\n'
      + '    parece que o site recarregou sozinho.\n'
      + '    A regra: os TRES portoes concordam — HomeOrLanding, RequireAuth e\n'
      + '    GuestOnly. Sem banco, o site trata todo mundo como visitante.');
  }
  ok('com sessão salva, "Entrar" leva à tela de login em vez de voltar para /');

  // ── 5. E essa tela DIZ A VERDADE em vez de deixar tentar contra o vazio ───
  if (!/entrar est[aá] indispon[ií]vel/i.test(await texto())) {
    throw new Error(
      'a /login com o banco fora nao explica por que nao da para entrar.\n'
      + '    Sem isso ela oferece um botao que nao pode funcionar, e o erro de\n'
      + '    um fetch que nao completa nao distingue "senha errada" de "site\n'
      + '    fora do ar" — a mensagem falsa que o §1.5 proibe.');
  }
  ok('a tela explica que entrar está indisponível, em vez de culpar a senha');

} catch (e) {
  console.error(`\n  FALHOU no passo ${passo + 1}: ${e.message}\n`);
  await salvarEvidencia(page);
  await navegador.close();
  process.exit(1);
}

await navegador.close();
console.log(`\n  ${passo}/6 comportamentos corretos com o banco fora.\n`);
