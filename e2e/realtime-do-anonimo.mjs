/**
 * `[17/09]` A landing de quem NÃO tem conta não abre conexão de realtime.
 *
 * ── O que ele impede, e por que isso é custo e não estética ────────────────
 *
 * Até hoje **todo visitante anônimo** abria um WebSocket para o Supabase — o
 * `ProvedorDaConfigDoSite` assinava `site_config` para saber ao vivo se o site
 * entrou em manutenção, e ele envolve **todas** as rotas, inclusive a landing.
 *
 * Conexão de realtime é recurso contado por plano (`CLAUDE.md` §0.2), e este é
 * o pior formato de custo que o projeto pode ter: **cresce com o número de
 * visitantes**, que é justamente o que a landing existe para aumentar. Quanto
 * melhor ela funciona, mais caro fica — e ninguém receberia aviso nenhum antes
 * de a cota estourar.
 *
 * Medido antes e depois, mesma ferramenta, landing anônima:
 *
 *     antes   3 WebSocket (1 tentativa + 2 retentativas)
 *     depois  0
 *
 * ── Por que o roteiro tem DUAS asserções, e a segunda é a que protege ──────
 *
 * A primeira sozinha seria uma armadilha: dá para satisfazê-la apagando o
 * provedor inteiro — e aí volta o bug de 03/09, em que o dono escreveu um
 * motivo de pausa personalizado, viu a mensagem certa no PC e a **genérica** no
 * celular, porque aquele navegador só tinha passado pela landing e nunca
 * chegara a BUSCAR o motivo.
 *
 * A leitura de `site_config` continua sendo de todo mundo. O que ficou só para
 * quem tem sessão é o **ao vivo**. As duas asserções juntas dizem isso: sem
 * socket, **com** leitura.
 *
 * ── O que este roteiro NÃO prova ───────────────────────────────────────────
 *
 * Que a pessoa logada continua recebendo a atualização ao vivo. Isso exigiria
 * sessão de verdade no CI, e credencial no CI é a troca que este projeto já
 * recusou três vezes. O lado logado está coberto pela leitura do código e pelo
 * teste de contrato em `src/lib/__tests__/realtimeSoComSessao.test.js`.
 */
import { abrirNavegador, exigirServidor, salvarEvidencia } from './util.mjs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173';

await exigirServidor(BASE);
const navegador = await abrirNavegador();
const page = await navegador.newPage();

const sockets = [];
const leituras = [];
page.on('websocket', (ws) => sockets.push(ws.url()));
page.on('request', (r) => {
  if (/\/rest\/v1\/site_config/.test(r.url())) leituras.push(r.url());
});

let passo = 0;
try {
  await page.goto(BASE, { waitUntil: 'load' });
  // O canal, quando existia, subia junto com o provedor — mas as retentativas
  // do Supabase vêm depois. Sem esta espera o teste passaria por chegar cedo
  // demais, que é a forma mais silenciosa de uma trava virar decoração.
  await page.waitForTimeout(6000);

  // ── 1. nenhum socket de realtime ──────────────────────────────────────────
  const deRealtime = sockets.filter((u) => /realtime/.test(u));
  if (deRealtime.length > 0) {
    throw new Error(
      `a landing anônima abriu ${deRealtime.length} conexão(ões) de realtime.\n`
      + `    ${deRealtime[0].slice(0, 80)}\n\n`
      + '    Conexão de realtime é contada por plano, e esta cresce com o\n'
      + '    NÚMERO DE VISITANTES — o custo sobe junto com o sucesso da\n'
      + '    landing, sem aviso nenhum antes da cota estourar.\n\n'
      + '    Quem assina tem que ter sessão. Ver `hooks/useConfigDoSite.jsx`:\n'
      + '    o efeito do canal depende de `user`, e sai cedo sem ele.');
  }
  console.log('  OK   a landing anônima não abre realtime');
  passo += 1;

  // ── 2. e a leitura CONTINUA — senão o conserto virou regressão ────────────
  if (leituras.length === 0) {
    throw new Error(
      'a landing não leu `site_config` nenhuma vez.\n\n'
      + '    Isto NÃO é economia: é o bug de 03/09 de volta. O motivo da pausa\n'
      + '    só pode ser aprendido ENQUANTO HÁ BANCO, e quem chega pela landing\n'
      + '    precisa aprendê-lo ali — senão vê a mensagem genérica quando o site\n'
      + '    cair.\n\n'
      + '    O que ficou restrito a quem tem sessão é o canal AO VIVO, não a\n'
      + '    leitura.');
  }
  console.log(`  OK   a leitura de site_config continua (${leituras.length}x)`);
  passo += 1;
} catch (e) {
  console.error(`\n  FALHOU no passo ${passo + 1}: ${e.message}\n`);
  await salvarEvidencia(page);
  await navegador.close();
  process.exit(1);
}

await navegador.close();
console.log(`\n  ${passo}/2 contratos do realtime anônimo corretos.\n`);
