// O que está NO AR é o que está no repositório? — o vigia das Edge Functions.
//
// ── O caso real que produziu este portão ────────────────────────────────────
//
// `[10/09]` As duas correções da `send-email` ficaram **5 dias mortas** em
// produção. Três lugares afirmavam o comportamento novo — a documentação, um
// comentário no `e2e/portas-fechadas.mjs`, e o próprio código do repositório —
// e produção rodava a v33, de ~25/08. Ninguém escreveu nada errado: é o §9.9
// em estado puro, *commit não é deploy*.
//
// `scripts/espelho-de-migrations.mjs` já fazia esta pergunta para as migrations.
// Para as Edge Functions não existia equivalente, e a diferença entre as duas
// é justamente a que dói: migration aplicada fica no histórico do banco, função
// implantada não deixa rastro nenhum no repositório.
//
// ── Por que um GET, e não a API de gerenciamento ────────────────────────────
//
// A API de gerenciamento do Supabase devolve o `ezbr_sha256` de cada função
// implantada — seria o caminho direto, e ele exige um **token de gerenciamento**
// guardado como segredo do CI. Trocar incerteza de monitoramento por credencial
// exposta é a conta ruim do `CLAUDE.md` §0.2, e é a mesma razão pela qual o
// alerta de cota do Sentry ficou de fora.
//
// Em vez disso, cada função responde a um `GET` com a própria impressão. O que
// esse endereço revela é um hash de 16 caracteres — **não revela código**, não
// aceita entrada, não toca banco e não gasta provedor. Ele só muda quando o
// código muda, que é exatamente o que se quer saber.
//
// ── O que este script NÃO consegue afirmar ──────────────────────────────────
//
// Que o código implantado é idêntico ao do repositório. Ele afirma que a função
// no ar **foi gerada a partir** deste código, o que é mais fraco e é o
// suficiente: a falha que ele existe para pegar é "editei e não implantei", e
// nessa falha as duas impressões divergem.
//
// Uso:  node scripts/edges-implantadas.mjs
// Precisa de VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (a anon key é pública —
// ela já vai para o navegador de todo visitante; não é segredo).

import { funcoes, calcular, escrita } from './impressao-das-edges.mjs';

const URL_BASE = process.env.VITE_SUPABASE_URL ?? '';
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!URL_BASE || !ANON) {
  console.error('\n  Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY.');
  console.error('  Sem elas o portao nao tem como perguntar nada a producao —');
  console.error('  e passar em silencio seria pior do que nao existir (§1.5).\n');
  process.exit(1);
}

/**
 * Pergunta a impressão a uma função no ar.
 *
 * O `Authorization` vai sempre: duas das oito têm `verify_jwt: true`
 * (`delete-user` e `cleanup-orphans`), e nessas a plataforma recusa antes de o
 * nosso código rodar. Com a anon key as oito respondem pelo mesmo caminho.
 */
async function perguntar(nome) {
  const endereco = `${URL_BASE}/functions/v1/${nome}`;
  let r;
  try {
    r = await fetch(endereco, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON },
    });
  } catch (e) {
    return { erro: `nao consegui falar com a funcao: ${e.message}` };
  }
  if (!r.ok) return { erro: `respondeu ${r.status}` };
  let corpo;
  try { corpo = await r.json(); } catch { return { erro: 'resposta nao era JSON' }; }
  if (typeof corpo?.impressao !== 'string') {
    return { erro: 'resposta sem o campo `impressao`' };
  }
  return { impressao: corpo.impressao };
}

const lista = funcoes();
const problemas = [];
const ok = [];

for (const nome of lista) {
  const noRepo = escrita(nome);
  if (noRepo === null) {
    problemas.push({ nome, texto: 'nao tem marcador de impressao no repositorio' });
    continue;
  }
  // Se a impressão escrita estiver velha, quem acusa é o `npm test`. Aqui isso
  // viraria uma segunda mensagem para a mesma causa, e duas mensagens para um
  // problema mandam procurar em dois lugares.
  if (noRepo !== calcular(nome)) {
    problemas.push({ nome, texto: 'impressao do repositorio esta velha — rode `npm run impressao-edges`' });
    continue;
  }

  const r = await perguntar(nome);
  if (r.erro) { problemas.push({ nome, texto: r.erro }); continue; }

  if (r.impressao === '') {
    problemas.push({
      nome,
      texto: 'a versao NO AR e anterior ao vigia (impressao vazia) — falta implantar',
    });
    continue;
  }
  if (r.impressao !== noRepo) {
    problemas.push({
      nome,
      texto: `no ar ${r.impressao}, no repositorio ${noRepo} — falta implantar`,
    });
    continue;
  }
  ok.push(nome);
}

console.log(`\n  Edge Functions: o que esta no ar e o que esta no repositorio\n`);
for (const n of ok) console.log(`    OK        ${n}`);
for (const p of problemas) console.log(`    DIVERGE   ${p.nome.padEnd(20)} ${p.texto}`);

if (!problemas.length) {
  console.log(`\n  As ${lista.length} funcoes no ar foram geradas deste codigo.\n`);
  process.exit(0);
}

console.log('\n  ---------------------------------------------------------------');
console.log('  O codigo desta branch NAO e o que roda em producao.');
console.log('');
console.log('  Foi exatamente assim que as duas correcoes da `send-email` ficaram');
console.log('  5 dias mortas enquanto a documentacao as descrevia como vivas.');
console.log('');
console.log('  Como implantar: supabase/functions/README.md');
console.log('  ---------------------------------------------------------------\n');
process.exit(1);
