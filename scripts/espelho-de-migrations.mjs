#!/usr/bin/env node
/**
 * PORTÃO: o espelho de migrations não pode ficar para trás do banco.
 *
 * ── O buraco que ele fecha, e ele estava aberto agora ───────────────────────
 *
 * Em 02/09 o Supabase tinha **151** migrations aplicadas e
 * `supabase/migrations/` tinha **142** arquivos. Nove migrations feitas por
 * `apply_migration` nunca viraram arquivo — o canal de contato inteiro, a
 * idade mínima de 13 anos, a tabela de aceite das políticas, os prazos de
 * retenção.
 *
 * O README daquela pasta afirma que ela **é a verdade sobre o schema** e que as
 * migrations **reconstroem o banco do zero**. Estava falso: recriar dali daria
 * um banco sem nada de 29/08 em diante — sem `/contato`, sem o aceite, sem a
 * trava de idade. Falha silenciosa (§1.5) aplicada a recuperação de desastre,
 * que só apareceria no pior dia possível.
 *
 * ── Por que ele não existia antes, e o que mudou ────────────────────────────
 *
 * O README dizia, com todas as letras: *"Não existe teste comparando esta
 * pasta com o Supabase"*, porque comparar exigiria um token de gestão no CI —
 * a mesma troca ruim recusada no `portas-fechadas.mjs` e no alerta de cota do
 * Sentry.
 *
 * Isso continua verdade para comparar **conteúdo**. Não para comparar
 * **contagem** — e a contagem já pega a deriva que de fato aconteceu, que é
 * "apliquei e esqueci de espelhar". A RPC `contagem_de_migrations()` devolve um
 * inteiro e é chamável com a anon key. Nenhum segredo entra no CI.
 *
 * ── O que ele NÃO pega, dito antes que alguém confie demais ─────────────────
 *
 * Se alguém apagar um arquivo e criar outro, a contagem bate e o conteúdo não.
 * Ele responde uma pergunta só — *o espelho tem o mesmo NÚMERO de migrations
 * que o banco?* — e é a pergunta que teria evitado o caso real.
 *
 * Uso:  VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/espelho-de-migrations.mjs
 */
import { readdirSync } from 'node:fs';

const URL_BASE = process.env.VITE_SUPABASE_URL;
const CHAVE = process.env.VITE_SUPABASE_ANON_KEY;
const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

if (!URL_BASE || !CHAVE) {
  console.error('\n  VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sao obrigatorios.');
  console.error('  Sem eles o teste passaria sem ter testado nada — e teste que');
  console.error('  passa sem testar e pior do que teste nenhum (§1.5).\n');
  process.exit(2);   // 2 = ambiente errado, != 1 = espelho com problema
}

const locais = readdirSync(`${RAIZ}/supabase/migrations`)
  .filter(f => f.endsWith('.sql'));

const r = await fetch(`${URL_BASE}/rest/v1/rpc/contagem_de_migrations`, {
  method: 'POST',
  headers: {
    apikey: CHAVE,
    Authorization: `Bearer ${CHAVE}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
  signal: AbortSignal.timeout(15000),
});

if (!r.ok) {
  console.error(`\n  A RPC contagem_de_migrations respondeu HTTP ${r.status}.`);
  console.error('  Ela existe no banco e tem EXECUTE para `anon`? Se foi removida,');
  console.error('  este portao parou de vigiar o espelho — e o espelho ja ficou');
  console.error('  9 migrations para tras uma vez, em silencio.\n');
  process.exit(2);
}

const noBanco = Number(await r.json());

console.log('\n  Espelho de migrations — o repositório × o banco\n');
console.log(`  arquivos em supabase/migrations/ : ${locais.length}`);
console.log(`  migrations aplicadas no Supabase : ${noBanco}`);

if (locais.length === noBanco) {
  console.log('\n  OK: o espelho está completo.\n');
  process.exit(0);
}

const faltam = noBanco - locais.length;

if (faltam > 0) {
  console.error(
    `\n  ${faltam} migration(s) existem no banco e NAO no repositorio.\n`
    + '\n  Recriar o banco a partir desta pasta produziria um schema INCOMPLETO,\n'
    + '  e o README dela promete o contrario. Isso so apareceria no dia em que\n'
    + '  alguem precisasse recuperar o banco — o pior dia para descobrir.\n'
    + '\n  Como corrigir: liste o que falta e exporte cada uma para um arquivo\n'
    + '  <version>_<name>.sql nesta pasta.\n'
    + '\n    select version, name from supabase_migrations.schema_migrations\n'
    + '     order by version desc limit 20;\n'
    + '\n    select array_to_string(statements, E\';\\n\\n\') from\n'
    + '      supabase_migrations.schema_migrations where version = \'<version>\';\n',
  );
} else {
  console.error(
    `\n  ${-faltam} arquivo(s) a MAIS no repositorio do que migrations no banco.\n`
    + '\n  Ou alguem criou um .sql aqui sem aplicar (e ai o schema real nao tem\n'
    + '  aquela mudanca), ou o arquivo nao e uma migration e nao deveria estar\n'
    + '  nesta pasta. As duas fazem o README mentir, em direcoes opostas.\n',
  );
}

process.exit(1);
