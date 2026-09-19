/**
 * GATILHO DA WEB — o que um estranho recebe do servidor, antes de qualquer JS.
 *
 * ── Por que este arquivo existe, e por que NÃO é um scanner pronto ──────────
 *
 * Em 19/09 o dono perguntou se existe ferramenta de pentest para apontar no
 * site. Pesquisei, e a resposta honesta tem duas metades:
 *
 *   1. Existem (OWASP ZAP, Nuclei, Burp). São boas no CONHECIDO e baratas.
 *   2. Contra ESTA arquitetura, a maioria delas grita errado.
 *
 * O motivo é o rewrite de SPA do `vercel.json`: `"/(.*)" -> "/"`. **Toda** URL
 * devolve `200` com o `index.html`. Medido em produção no mesmo dia:
 *
 *     GET /.env        -> 200, text/html, 6593 bytes   (= o index.html)
 *     GET /.git/config -> 200, text/html, 6593 bytes   (= o index.html)
 *
 * Um scanner de caminho marca as duas como "arquivo sensível exposto". Seriam
 * dois alarmes falsos no primeiro minuto — e alarme que grita à toa é o mesmo
 * problema do silêncio, do outro lado (`CLAUDE.md` §0.2, 4ª regra). O que
 * separa vazamento de rewrite não é o código HTTP: é **o que veio no corpo**.
 *
 * Então este script faz o que o scanner genérico não sabe fazer aqui: conhece
 * o rewrite e exige que o caminho sensível devolva **o app**, não conteúdo.
 *
 * ── As DUAS direções, igual ao `portas-do-banco.mjs` ────────────────────────
 *
 * 1. **O que é fechado continua fechado** — `.env`, `.git`, mapa de fonte.
 * 2. **O que é ligado continua ligado** — os cabeçalhos de segurança. Esta é a
 *    direção que quase ninguém testa, e é a que some sem ninguém ver: um
 *    `vercel.json` editado por outro motivo derruba um `headers` inteiro e
 *    nada quebra na tela. É a mesma classe das três quedas registradas em
 *    `docs/regras/POSTURA.md`.
 *
 * ── O que ele NÃO cobre, dito com todas as letras ───────────────────────────
 *
 * Ele é caixa-preta e olha só a resposta HTTP da borda. Não testa lógica, não
 * testa permissão, não testa XSS — nada do que um humano ou uma auditoria (§6)
 * faz. E **não** verifica CSP, porque o site ainda não tem: isso é item aberto
 * no `BACKLOG.md`, com o motivo escrito. Portão não inventa cobertura que não
 * tem (§6.3).
 *
 * Uso:  SITE_URL=https://exemplo.app node e2e/portas-da-web.mjs
 */

const SITE = (process.env.SITE_URL || 'https://gamerhub-nine.vercel.app').replace(/\/$/, '');

/**
 * Cabeçalhos que PRECISAM estar ligados, com o valor que o `vercel.json` manda.
 *
 * O valor é comparado, não só a presença: `X-Frame-Options: SAMEORIGIN` no
 * lugar de `DENY` é uma proteção enfraquecida que a checagem de presença
 * aprovaria sorrindo.
 */
const CABECALHOS = [
  ['x-content-type-options',   'nosniff',                            'sniffing de MIME'],
  ['x-frame-options',          'DENY',                               'clickjacking'],
  ['referrer-policy',          'strict-origin-when-cross-origin',    'vazamento de URL no Referer'],
  ['permissions-policy',       'camera=(self), microphone=(self), geolocation=()', 'câmera/mic/GPS'],
  ['strict-transport-security', /max-age=\d{7,}/,                    'downgrade para HTTP'],
];

/** Caminhos que, por causa do rewrite, DEVEM devolver o app — nunca conteúdo. */
const NAO_PODEM_VAZAR = ['/.env', '/.env.local', '/.git/config', '/package.json'];

const falhas = [];
const ok = [];

function reprova(titulo, detalhe) { falhas.push({ titulo, detalhe }); }

async function pegar(caminho) {
  const r = await fetch(SITE + caminho, { redirect: 'follow' });
  return { status: r.status, headers: r.headers, corpo: await r.text() };
}

async function main() {
  console.log(`\n  Batendo em ${SITE}\n`);

  let raiz;
  try {
    raiz = await pegar('/');
  } catch (e) {
    console.error(`\n  Nao consegui alcancar ${SITE}: ${e.message}`);
    console.error('  Ambiente errado, nao site com problema.\n');
    process.exit(2);          // 2 = ambiente, != 1 = site
  }

  if (raiz.status !== 200) {
    reprova('a raiz do site nao respondeu 200',
      `recebi ${raiz.status}. O site esta no ar?`);
  }

  // ── Direção 2: o que é ligado continua ligado ────────────────────────────
  for (const [nome, esperado, protege] of CABECALHOS) {
    const valor = raiz.headers.get(nome);
    if (!valor) {
      reprova(`o cabecalho "${nome}" SUMIU`,
        `Ele protege contra ${protege}, e esta declarado no "headers" do\n`
        + '    vercel.json. Cabecalho que some nao quebra tela nenhuma — some\n'
        + '    em silencio, que e a classe das tres quedas do POSTURA.md.\n'
        + '    Se a remocao foi deliberada, mude a expectativa AQUI, com o\n'
        + '    motivo escrito ao lado.');
      continue;
    }
    const bate = esperado instanceof RegExp ? esperado.test(valor) : valor === esperado;
    if (!bate) {
      reprova(`o cabecalho "${nome}" mudou de valor`,
        `esperado: ${esperado}\n    recebido: ${valor}\n`
        + `    Ele protege contra ${protege}. Valor mais fraco e protecao mais\n`
        + '    fraca — e a checagem de PRESENCA aprovaria isso sorrindo.');
    } else {
      ok.push(`${nome}: ${valor}`);
    }
  }

  // ── Direção 1: o que é fechado continua fechado ──────────────────────────
  //
  // A comparação é com o corpo da raiz, e não com o código HTTP, exatamente
  // porque o rewrite faz todo caminho responder 200.
  for (const caminho of NAO_PODEM_VAZAR) {
    let r;
    try { r = await pegar(caminho); } catch { continue; }

    const ehOApp = r.corpo === raiz.corpo
      || (r.headers.get('content-type') || '').includes('text/html');

    if (!ehOApp) {
      reprova(`${caminho} devolveu CONTEUDO, nao o app`,
        `status ${r.status}, content-type ${r.headers.get('content-type')}\n`
        + `    primeiros bytes: ${JSON.stringify(r.corpo.slice(0, 120))}\n`
        + '    O rewrite do SPA faz todo caminho devolver o index.html. Este\n'
        + '    devolveu OUTRA coisa — ou seja, existe um arquivo de verdade ali.');
    } else {
      ok.push(`${caminho}: rewrite do SPA (nao vaza)`);
    }
  }

  // ── Mapa de fonte publicado ──────────────────────────────────────────────
  //
  // Um `.map` entrega o codigo-fonte original inteiro, com nomes e comentarios.
  const scripts = [...raiz.corpo.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
  for (const js of scripts.slice(0, 3)) {
    let r;
    try { r = await pegar(js + '.map'); } catch { continue; }
    const ehMapa = r.status === 200 && r.corpo.trimStart().startsWith('{')
      && r.corpo.includes('"sources"');
    if (ehMapa) {
      reprova(`o mapa de fonte ${js}.map esta PUBLICADO`,
        '    Ele entrega o codigo-fonte original inteiro — nomes de variavel,\n'
        + '    comentarios e a estrutura dos arquivos. Para um SPA que usa a\n'
        + '    anon key, isso e o mapa de onde procurar.\n'
        + '    Desligue com `build.sourcemap: false` no vite.config.js.');
    } else {
      ok.push(`${js}.map: nao publicado`);
    }
  }

  // ── Relatório ────────────────────────────────────────────────────────────
  for (const linha of ok) console.log(`  OK      ${linha}`);

  if (falhas.length === 0) {
    console.log(`\n  ${ok.length} verificacoes, nenhuma falha.`);
    console.log('  Isto cobre a BORDA HTTP. Logica, permissao e XP continuam');
    console.log('  sendo trabalho de auditoria (§6) — verde aqui nao e verde la.\n');
    return;
  }

  console.log('');
  for (const f of falhas) console.log(`  FALHOU  ${f.titulo}\n    ${f.detalhe}\n`);
  console.log(`  ${falhas.length} porta(s) da web fora do contrato.\n`);
  process.exit(1);
}

main().catch((e) => {
  console.error(`\n  O proprio portao quebrou: ${e.stack}`);
  process.exit(2);
});
