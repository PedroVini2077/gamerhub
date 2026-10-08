import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[08/10]` A TOLERÂNCIA DE DEPLOY PENDENTE DO `portas-da-web.mjs`.
 *
 * ── O impasse que ela resolve ──────────────────────────────────────────────
 *
 * Aquele roteiro compara as diretivas travadas da CSP **por igualdade** contra
 * a **produção**. Isso é certo — uma checagem de "contém `'self'`" aprovaria
 * `script-src 'self' 'unsafe-inline'` sorrindo.
 *
 * O efeito colateral só apareceu quando foi preciso mudar uma delas: **o PR
 * reprovava a si mesmo**, porque a produção ainda serve a política antiga e só
 * passa a servir a nova depois do merge. O próprio comentário de
 * `CSP_TRAVADAS` antecipou isso para as diretivas que crescem
 * (`connect-src`, `frame-src`) e esqueceu das travadas.
 *
 * ── Por que a tolerância é estreita, e o que ela NÃO pode virar ────────────
 *
 * Ela vale **só quando o valor no ar é subconjunto do esperado** — ou seja, só
 * quando a mudança AFROUXA. Aí a produção está mais RESTRITA do que mandamos: o
 * risco é um recurso novo não funcionar, nunca uma porta aberta.
 *
 * Quando a mudança APERTA, a produção é que está mais fraca, e aquilo reprova
 * como sempre reprovou. **Inverter isso transformaria o portão num carimbo:**
 * qualquer afrouxamento no ar passaria a ser lido como "deploy pendente".
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 * Três reinjeções: a tolerância virar irrestrita, o sentido do subconjunto
 * inverter, e o aviso deixar de existir.
 */

const ROTEIRO = 'e2e/portas-da-web.mjs';

function fonte() {
  return readFileSync(ROTEIRO, 'utf8');
}

/** A função `aguardandoDeploy` do roteiro, avaliada de verdade. */
async function aguardandoDeploy() {
  const corpo = fonte().match(
    /function aguardandoDeploy\(noAr, esperado\) \{([\s\S]*?)\n\}/,
  );
  expect(corpo, `a função \`aguardandoDeploy\` sumiu de \`${ROTEIRO}\`.`).not.toBeNull();
  return new Function('noAr', 'esperado', corpo[1]);
}

describe('deploy pendente não é afrouxamento', () => {
  it('a produção ATRASADA num afrouxamento é tolerada', async () => {
    const f = await aguardandoDeploy();
    // O caso real de 08/10: o site ainda serve `'self'` e nós passamos a
    // mandar `'self' + Cloudflare`. A produção está MAIS restrita.
    expect(
      f("'self'", "'self' https://challenges.cloudflare.com"),
      'o portão voltou a reprovar o PR que afrouxa uma diretiva travada.\n'
      + 'Ele bate na PRODUÇÃO, que só recebe a política nova depois do merge —\n'
      + 'então reprovar aqui é reprovar o caminho correto, e portão que reprova\n'
      + 'quem está certo ensina a ser ignorado (§0.2, 4ª regra).',
    ).toBe(true);
  });

  it('a produção MAIS FRACA continua reprovando', async () => {
    const f = await aguardandoDeploy();
    for (const [noAr, esperado, caso] of [
      ["'self' 'unsafe-inline'", "'self'", 'inline liberado no ar'],
      ["'self' https://evil.example", "'self'", 'origem estranha no ar'],
      ["'self' https://challenges.cloudflare.com", "'self'", 'aperto pendente'],
    ]) {
      expect(
        f(noAr, esperado),
        `a tolerância passou a aceitar "${caso}".\n`
        + 'Ela só pode valer quando o que está NO AR é subconjunto do esperado —\n'
        + 'isto é, quando a mudança AFROUXA e a produção está mais restrita.\n'
        + 'Invertido, o portão vira carimbo: todo afrouxamento no ar passaria a\n'
        + 'ser lido como "deploy pendente".',
      ).toBe(false);
    }
  });

  it('valor idêntico não precisa de tolerância', async () => {
    const f = await aguardandoDeploy();
    // Igual é subconjunto de si mesmo — e o roteiro só chama isto quando os
    // valores JÁ diferem, então aqui só se prova que a função não inventa nada.
    expect(f("'self'", "'self'")).toBe(true);
  });

  it('o aviso EXISTE e não reprova', () => {
    const s = fonte();
    expect(
      /function avisa\(titulo, detalhe\)/.test(s),
      'o canal de AVISO sumiu do roteiro.\n'
      + 'Sem ele só há "passou" e "falhou", e deploy pendente não é nenhum dos\n'
      + 'dois: chamar de falha reprova o caminho certo, chamar de sucesso apaga\n'
      + 'o sinal de que o deploy não aconteceu.',
    ).toBe(true);

    expect(
      /avisos\.push/.test(s) && !/avisa\([\s\S]{0,200}?falhas\.push/.test(s),
      'o aviso voltou a reprovar — ele escreve em `falhas`.',
    ).toBe(true);

    expect(
      /::warning title=/.test(s),
      'o aviso deixou de virar anotação do GitHub.\n'
      + 'Deploy pendente que só existe no log de um job VERDE é o sinal que\n'
      + 'ninguém lê (§1.5) — a anotação é o que o põe no topo do PR.',
    ).toBe(true);
  });

  it('a Cloudflare está autorizada nos DOIS lugares que o Turnstile precisa', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    let csp = null;
    for (const bloco of vercel.headers ?? []) {
      for (const h of bloco.headers ?? []) {
        if (h.key === 'Content-Security-Policy') csp = h.value;
      }
    }
    expect(csp, 'a CSP sumiu do `vercel.json`.').not.toBeNull();

    const diretiva = (nome) =>
      csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${nome} `)) ?? '';

    for (const nome of ['script-src', 'frame-src']) {
      expect(
        diretiva(nome).includes('https://challenges.cloudflare.com'),
        `\`${nome}\` deixou de autorizar a Cloudflare.\n`
        + 'O Turnstile do `/contato` carrega script DE FORA e desenha a caixinha\n'
        + 'num IFRAME — precisa dos dois. Sem um deles o script não roda, a tela\n'
        + 'cai no teto de 12 s do `lib/turnstile.js` e o formulário fica sem\n'
        + 'captcha **sem erro nenhum na tela**. Foi assim que isso passou\n'
        + 'despercebido até 08/10.',
      ).toBe(true);
    }
  });
});
