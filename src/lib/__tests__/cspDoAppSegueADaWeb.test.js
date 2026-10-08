import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[08/10]` A POLÍTICA DE CONTEÚDO DO APP ANDROID SEGUE A DA WEB.
 *
 * ── O buraco que ela fecha, e ele é da nossa própria esteira ──────────────
 *
 * A CSP, o `X-Frame-Options`, o `Referrer-Policy` e o `Permissions-Policy` vêm
 * do `vercel.json` — ou seja, de **cabeçalho de resposta HTTP**, que só existe
 * porque um servidor responde.
 *
 * O app Capacitor **não tem servidor**: ele serve o `dist/` de
 * `https://localhost`, de dentro do próprio APK. Nenhum desses cabeçalhos se
 * aplica. O app nasceria sem política nenhuma.
 *
 * E o pior: o `e2e/portas-da-web.mjs`, que compara esses cabeçalhos **por
 * valor** e reprova o PR quando um enfraquece, bate no SITE. Ele continuaria
 * verde sobre um app desprotegido — a "cobertura que não cobre" do §1.5,
 * aplicada à vigilância em vez de ao produto.
 *
 * ── A saída, e por que ela é um teste e não uma segunda política ──────────
 *
 * O `index.html` carrega a MESMA política numa `<meta http-equiv>`. Na web ela
 * é redundante (política igual tem interseção igual, então nada muda); no app
 * ela é a única que existe.
 *
 * Duas cópias da mesma string divergem — é o §4 na letra. Por isso o que vale
 * aqui não é "existe um meta": é **o meta dizer exatamente o que o `vercel.json`
 * diz**. Quem apertar a CSP da web e esquecer o app, ou o contrário, reprova.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 * Três reinjeções: tirar o meta, mudar uma diretiva só no `vercel.json`, e
 * mudar uma diretiva só no `index.html`.
 */

function cspDoVercel() {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8'));
  for (const bloco of v.headers ?? []) {
    for (const h of bloco.headers ?? []) {
      if (h.key === 'Content-Security-Policy') return h.value;
    }
  }
  return null;
}

function cspDoIndex() {
  const html = readFileSync('index.html', 'utf8');
  // `content` e delimitado por ASPAS DUPLAS e o valor contem aspas SIMPLES
  // (`'self'`, `'none'`). A 1a versao usava `[^"']+` e parava no primeiro
  // `'self'`, devolvendo meia politica — e o teste reprovou a si mesmo.
  const m = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i,
  );
  return m ? m[1] : null;
}

/** Espaço a mais não é diferença de política. */
const normalizar = (s) => s.replace(/\s+/g, ' ').trim();

describe('a política de conteúdo do app segue a da web', () => {
  it('o `vercel.json` continua definindo uma CSP', () => {
    expect(
      cspDoVercel(),
      'a CSP sumiu do `vercel.json`.\n'
      + 'Ela é a política do SITE, e o `e2e/portas-da-web.mjs` a confere por valor\n'
      + 'contra o que está no ar. Se ela saiu de propósito, esta trava e aquela\n'
      + 'precisam sair juntas — e aí o site passa a não ter política nenhuma.',
    ).not.toBeNull();
  });

  it('o `index.html` carrega a MESMA política, para o app', () => {
    const meta = cspDoIndex();
    expect(
      meta,
      'o `<meta http-equiv="Content-Security-Policy">` sumiu do `index.html`.\n'
      + 'Na web isso não muda nada — o cabeçalho do `vercel.json` continua\n'
      + 'valendo. No APP Android é a política INTEIRA que desaparece, porque o\n'
      + 'Capacitor serve de `https://localhost` e não existe cabeçalho de\n'
      + 'resposta nenhum. E nada acusaria: o `portas-da-web.mjs` bate no site.',
    ).not.toBeNull();

    expect(
      normalizar(meta),
      'a CSP do `index.html` (app) divergiu da do `vercel.json` (web).\n'
      + 'Duas cópias da mesma string sempre divergem (§4) — a diferença aqui é\n'
      + 'que divergir significa o app rodar com uma política mais fraca do que a\n'
      + 'que o site tem, sem ninguém notar.\n'
      + 'Alinhe as duas, ou — se a diferença for deliberada — escreva o motivo\n'
      + 'ao lado e ajuste esta trava para conhecê-la.',
    ).toBe(normalizar(cspDoVercel()));
  });

  it('a política cobre o que o app precisa para falar com o Supabase', () => {
    // Sem `connect-src` para o Supabase o app abre e NADA carrega — tela em
    // branco com erro só no console, que ninguem abre num celular (§1.5).
    const csp = cspDoIndex() ?? '';
    for (const exigido of ['https://*.supabase.co', 'wss://*.supabase.co']) {
      expect(
        csp.includes(exigido),
        `a CSP não permite \`${exigido}\` em \`connect-src\`.\n`
        + 'No app isso é fatal: ele abre e não carrega nada, porque o Supabase é\n'
        + 'a ÚNICA coisa com que ele fala. No navegador o sintoma seria o mesmo,\n'
        + 'mas lá dá para abrir o console.',
      ).toBe(true);
    }
  });
});
