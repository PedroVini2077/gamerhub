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
 * faz.
 *
 * `[24/09]` A **CSP** entrou aqui no PR seguinte ao que a publicou, e a ordem
 * era obrigatória: este roteiro bate na **produção**, então exigir o cabeçalho
 * antes do deploy teria reprovado o próprio PR que o publica. O
 * `e2e/politica-de-conteudo.mjs` continua sendo o que prova, num navegador de
 * verdade, que a política **não quebra a tela**; aqui se prova outra coisa —
 * que ela **continua no ar e não afrouxou** (ver `CSP_TRAVADAS`).
 *
 * Uso:  SITE_URL=https://exemplo.app node e2e/portas-da-web.mjs
 */

const SITE = (process.env.SITE_URL || 'https://gamerhub-nine.vercel.app').replace(/\/$/, '');

// ── As expectativas moram em `portas-da-web/expectativas.mjs` ──────────────
//
// `[10/10]` Separadas daqui no corte de 375 linhas. Elas são o que se EXIGE da
// borda — e o alvo das duas travas que impedem este portão de ser esvaziado.
// Aqui ficou a verificação: buscar e comparar.
import {
  CABECALHOS,
  CSP_TRAVADAS,
  NAO_PODEM_VAZAR,
  NAO_PODEM_RECEBER_O_APP,
  aguardandoDeploy,
} from './portas-da-web/expectativas.mjs';

const falhas = [];
const ok = [];
const avisos = [];

function reprova(titulo, detalhe) { falhas.push({ titulo, detalhe }); }

/**
 * `[08/10]` Aviso NAO reprova, e essa distincao e o ponto.
 *
 * Existe um estado que nao e "passou" nem "falhou": a producao ainda nao
 * recebeu o deploy de uma politica que AFROUXOU. Chamar isso de falha
 * transforma o portao em algo que reprova o caminho correto — e portao que
 * reprova quem esta certo ensina a ser ignorado (§0.2, 4a regra).
 *
 * Chamar de sucesso seria pior: some o sinal de que o deploy nao aconteceu.
 */
function avisa(titulo, detalhe) { avisos.push({ titulo, detalhe }); }

async function pegar(caminho) {
  const r = await fetch(SITE + caminho, { redirect: 'follow' });
  return { status: r.status, headers: r.headers, corpo: await r.text() };
}

/** Quebra o valor do cabecalho em `{ diretiva: 'valor' }`. */
function diretivasDaCsp(valor) {
  const mapa = {};
  for (const parte of valor.split(';')) {
    const t = parte.trim().split(/\s+/);
    if (t[0]) mapa[t[0].toLowerCase()] = t.slice(1).join(' ');
  }
  return mapa;
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

  // ── Direção 2b: a CSP não afrouxa nas diretivas travadas ─────────────────
  //
  // O cabeçalho pode estar presente e valer pouco. Presença não é proteção.
  const csp = raiz.headers.get('content-security-policy');
  if (csp) {
    const d = diretivasDaCsp(csp);
    for (const [diretiva, exigido, protege] of CSP_TRAVADAS) {
      const valor = d[diretiva];
      if (valor === undefined) {
        reprova(`a diretiva "${diretiva}" SUMIU da CSP`,
          `Ela protege contra ${protege}.\n`
          + '    Diretiva que some nao quebra tela nenhuma. E o default-src nao\n'
          + '    cobre o buraco: frame-ancestors, form-action e base-uri NAO tem\n'
          + '    fallback nenhum — sem a diretiva, nao ha restricao alguma.');
      } else if (valor !== exigido && aguardandoDeploy(valor, exigido)) {
        // `[08/10]` A PRODUCAO ESTA ATRASADA, e isso nao e afrouxamento.
        //
        // Este roteiro bate na PRODUCAO, entao o PR que afrouxa uma diretiva
        // travada reprovava A SI MESMO: o site ainda serve a politica antiga, e
        // so passa a servir a nova depois do merge. Impasse real — o proprio
        // comentario de CSP_TRAVADAS antecipou isso para as diretivas que
        // crescem e esqueceu das travadas.
        //
        // A tolerancia e ESTREITA de proposito: so vale quando o valor no ar e
        // um SUBCONJUNTO do esperado, ou seja, quando a mudanca AFROUXA. Nesse
        // caso a producao esta mais RESTRITA do que mandamos — o risco e o
        // recurso novo nao funcionar, nunca uma porta aberta.
        //
        // Quando a mudanca APERTA (o esperado e subconjunto do que esta no ar),
        // a producao esta mais FRACA, e ai reprova como sempre reprovou.
        avisa(`a diretiva "${diretiva}" ainda nao chegou na producao`,
          `no ar:     ${diretiva} ${valor}\n    esperado:  ${diretiva} ${exigido}\n`
          + '    O valor no ar e mais RESTRITO que o esperado, entao isto e deploy\n'
          + '    pendente, nao afrouxamento. Some sozinho no proximo deploy — e se\n'
          + '    NAO sumir, este aviso continua aparecendo em todo PR.');
      } else if (valor !== exigido) {
        reprova(`a diretiva "${diretiva}" da CSP AFROUXOU`,
          `esperado: ${diretiva} ${exigido}\n    recebido: ${diretiva} ${valor}\n`
          + `    Ela protege contra ${protege}. Uma checagem de "contem 'self'"\n`
          + '    aprovaria isto sorrindo — por isso a comparacao e por igualdade.\n'
          + '    Se o afrouxamento foi deliberado, mude a expectativa em\n'
          + '    CSP_TRAVADAS com o motivo escrito ao lado.');
      } else {
        ok.push(`csp ${diretiva}: ${valor}`);
      }
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

  // ── Direção 3: caminho de MÁQUINA não recebe o app ───────────────────────
  //
  // Reprova nos dois sentidos, como o resto deste arquivo: o `404` tem de
  // estar lá, e um arquivo que a gente DECIDIR publicar em
  // `public/.well-known/` também é resposta válida — o que não pode é a casca
  // do SPA. Por isso a checagem é sobre `text/html`, e não sobre o status.
  for (const caminho of NAO_PODEM_RECEBER_O_APP) {
    let r;
    try { r = await pegar(caminho); } catch { continue; }

    const ehOApp = r.status === 200
      && (r.corpo === raiz.corpo || (r.headers.get('content-type') || '').includes('text/html'));

    if (ehOApp) {
      reprova(`${caminho} recebeu o APP em vez de 404`,
        `status ${r.status}, content-type ${r.headers.get('content-type')}\n`
        + '    O `/.well-known/` voltou a cair no rewrite do SPA. Ferramenta que\n'
        + '    sonda esse caminho conclui que o arquivo EXISTE e tenta ler o\n'
        + '    `<!doctype html>` — foi assim que o Lighthouse passou a reprovar\n'
        + '    `ard-schema` com "Malformed JSON".\n'
        + '    Conserto: o `(?!\\.well-known/)` no `source` do vercel.json.');
    } else {
      ok.push(`${caminho}: ${r.status} (nao recebe o app)`);
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

  // Os avisos aparecem ANTES do veredito, e tambem como anotacao do GitHub:
  // deploy pendente que so existe no log de um job verde e exatamente o tipo
  // de sinal que ninguem le (§1.5).
  for (const a of avisos) {
    console.log(`\n  AVISO   ${a.titulo}\n    ${a.detalhe}`);
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::warning title=${a.titulo}::${a.detalhe.replace(/\n/g, '%0A')}`);
    }
  }

  if (falhas.length === 0) {
    console.log(`\n  ${ok.length} verificacoes, nenhuma falha`
      + `${avisos.length ? `, ${avisos.length} aviso(s) de deploy pendente` : ''}.`);
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
