/**
 * `[08/10]` O SERVICE WORKER, num navegador de verdade.
 *
 * ── Por que este roteiro existe, e por que ele veio ANTES da Fase 3 ────────
 *
 * A trava `servicoDeCacheNaoPrendeNaVersaoVelha.test.js` lê o ARQUIVO `sw.js`
 * e prova o **contrato**: que ele não cacheia HTML, que só aceita nome com
 * hash, que apaga cache velho. Ela não prova que o worker **se comporta** como
 * o contrato diz — isso só um navegador responde.
 *
 * E a diferença importa mais aqui do que em qualquer outro lugar do projeto: o
 * service worker é o único código que **sobrevive ao deploy**. Se o
 * comportamento divergir do contrato, não há conserto pelo servidor.
 *
 * Por isso este roteiro é a Fase 2 e a Fase 3 (aviso de atualização) espera
 * por ele: mexer na parte arriscada sem rede de proteção é o oposto do que
 * este projeto faz.
 *
 * ── O que ele prova, e o 3 é o que vale por todos ─────────────────────────
 *
 * 1. o worker **assume o controle** da página;
 * 2. um `assets/*` com hash entra no cache;
 * 3. **NENHUM HTML entra no cache** — é a regra que impede o desastre;
 * 4. sem rede, a navegação mostra a tela de offline;
 * 5. sem rede, um asset já cacheado **continua carregando** — senão o cache
 *    estaria lá sem servir para nada.
 *
 * ── O servidor é local, e isso é exigência do navegador ───────────────────
 *
 * Service worker só existe em contexto seguro. `http://localhost` conta como
 * seguro pela especificação, então não é preciso certificado — mas `127.0.0.1`
 * com outro nome, ou um IP de rede, não serviria.
 *
 * Uso:  npm run build && node e2e/servico-de-cache.mjs
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { abrirNavegador, salvarEvidencia } from './util.mjs';

const DIST = 'dist';
const PORTA = 4178;
const BASE = `http://localhost:${PORTA}`;

const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon',
};

const srv = createServer((req, res) => {
  const url = req.url.split('?')[0];
  let f = join(DIST, url === '/' ? 'index.html' : url);
  if (!existsSync(f) || url === '/') {
    // Mesma regra do roteiro da CSP: asset inexistente devolve 404, nunca o
    // `index.html` — senão um JS faltando chega como HTML e o erro manda
    // procurar no lugar errado.
    if (url !== '/' && /\.[a-z0-9]+$/i.test(url)) { res.writeHead(404); return res.end(); }
    f = join(DIST, 'index.html');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => srv.listen(PORTA, r));

const falhas = [];
const ok = [];
const reprova = (t, d) => falhas.push({ titulo: t, detalhe: d });

const browser = await abrirNavegador();
const ctx = await browser.newContext();
const page = await ctx.newPage();

try {
  await page.goto(BASE, { waitUntil: 'load' });

  // ── 1. O worker assume o controle ────────────────────────────────────────
  //
  // `register()` acontece no `load` e a ativação é assíncrona. Esperar pelo
  // `controller` é o único sinal confiável de que ele está no caminho das
  // requisições — `ready` resolve antes disso.
  const assumiu = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return true;
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), 8000);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(t); resolve(true);
      });
    });
  }).catch(() => false);

  if (!assumiu) {
    reprova('o service worker NAO assumiu o controle da pagina',
      'Sem controlador ele nao intercepta requisicao nenhuma: o cache nao\n'
      + '    existe, a tela de offline nunca aparece, e nada disso daria erro.\n'
      + '    Conferir o registro em `src/lib/servicoDeCache.js` e se o build e\n'
      + '    de PRODUCAO (ele nao registra em desenvolvimento, de proposito).');
  } else {
    ok.push('o worker assumiu o controle');
  }

  // Segunda visita: é nela que o cache serve.
  await page.reload({ waitUntil: 'load' });

  const guardado = await page.evaluate(async () => {
    const nomes = await caches.keys();
    const urls = [];
    for (const n of nomes) {
      const c = await caches.open(n);
      for (const req of await c.keys()) urls.push(new URL(req.url).pathname);
    }
    return { nomes, urls };
  });

  // ── 2. Asset com hash entra ──────────────────────────────────────────────
  const comHash = guardado.urls.filter((u) => /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\./.test(u));
  if (comHash.length === 0) {
    reprova('nenhum asset com hash entrou no cache',
      `  cache(s): ${guardado.nomes.join(', ') || '(nenhum)'}\n`
      + `    guardado: ${guardado.urls.join(', ') || '(nada)'}\n`
      + '    O worker esta de pe e nao esta guardando nada — a segunda visita\n'
      + '    continua baixando o bundle inteiro, e o ganho da Fase 1 nao existe.');
  } else {
    ok.push(`${comHash.length} asset(s) com hash no cache`);
  }

  // ── 3. NENHUM HTML entra — a regra que impede o desastre ─────────────────
  //
  // Esta e a checagem que vale por todas. HTML cacheado prende quem usa na
  // versao velha, e deploy nao alcanca: nao ha conserto pelo servidor.
  const html = guardado.urls.filter((u) => u === '/' || u.endsWith('.html'))
    .filter((u) => u !== '/offline.html');
  if (html.length > 0) {
    reprova('HTML entrou no cache do service worker',
      `  guardado: ${html.join(', ')}\n`
      + '    Esta e a falha que NAO TEM CONSERTO DEPOIS: subir um site novo nao\n'
      + '    alcanca quem ja tem o worker instalado, e a pessoa fica presa na\n'
      + '    versao velha ate limpar os dados do navegador — o que apaga a\n'
      + '    sessao junto.\n'
      + '    A navegacao tem de ser rede-primeiro, com o cache SO no erro.');
  } else {
    ok.push('nenhum HTML no cache (so a pagina de offline, que e pre-carregada)');
  }

  // ── 3b. E NADA sem hash entra ────────────────────────────────────────────
  //
  // Esta entrou por reinjecao: trocar o filtro de caminho por `if (false)` nao
  // quebrava NENHUMA checagem, porque o HTML continua protegido pela regra de
  // navegacao. Mas cachear arquivo sem hash e falha de outra natureza —
  // `manifest.webmanifest` e as fontes mudam SEM mudar de nome, e passariam a
  // ser servidos velhos para sempre.
  const semHash = guardado.urls
    .filter((u) => u !== '/offline.html')
    .filter((u) => !/^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\./.test(u));
  if (semHash.length > 0) {
    reprova('entrou no cache arquivo cujo nome NAO carrega hash',
      `  guardado: ${semHash.join(', ')}\n`
      + '    Nome sem hash muda de conteudo sem mudar de nome — e o cache passa a\n'
      + '    servir a versao velha para sempre. O `manifest.webmanifest` e as\n'
      + '    fontes de `public/fonts/` sao exatamente esse caso, e ja houve troca\n'
      + '    de fonte neste projeto.');
  } else {
    ok.push('nada sem hash no cache');
  }

  // ── 4 e 5. Sem rede ──────────────────────────────────────────────────────
  await ctx.setOffline(true);

  await page.goto(`${BASE}/qualquer-rota`, { waitUntil: 'load' }).catch(() => {});
  const textoOffline = await page.textContent('body').catch(() => '');
  if (!/sem conex/i.test(textoOffline || '')) {
    reprova('a tela de offline NAO apareceu sem rede',
      `  o que a tela disse: ${JSON.stringify((textoOffline || '').slice(0, 120))}\n`
      + '    Sem ela, quem perde a conexao ve o erro cru do navegador — e a\n'
      + '    pagina de offline existe no cache justamente para isso.');
  } else {
    ok.push('sem rede, a tela de offline aparece');
  }

  if (comHash.length > 0) {
    const alvo = comHash[0];
    const serviu = await page.evaluate(async (p) => {
      try {
        const r = await fetch(p);
        return r.ok;
      } catch { return false; }
    }, alvo);
    if (!serviu) {
      reprova('asset cacheado NAO foi servido sem rede',
        `  ${alvo}\n`
        + '    Ele esta no cache e mesmo assim falhou — entao o cache existe e\n'
        + '    nao serve para nada, que e pior do que nao existir: ocupa espaco\n'
        + '    no aparelho de quem usa sem nenhum ganho.');
    } else {
      ok.push('sem rede, asset cacheado continua carregando');
    }
  }

  await ctx.setOffline(false);
} catch (e) {
  reprova('o proprio roteiro quebrou', e.message);
  await salvarEvidencia(page, { causa: e.message }).catch(() => {});
} finally {
  await browser.close();
  srv.close();
}

console.log('\n  Service worker, num navegador de verdade\n');
for (const l of ok) console.log(`  OK      ${l}`);

if (falhas.length === 0) {
  console.log(`\n  ${ok.length} verificacoes, nenhuma falha.\n`);
  process.exit(0);
}

console.log('');
for (const f of falhas) {
  console.log(`  FALHOU  ${f.titulo}\n    ${f.detalhe}\n`);
  if (process.env.GITHUB_ACTIONS) {
    console.log(`::error title=${f.titulo}::${f.detalhe.replace(/\n/g, '%0A')}`);
  }
}
console.log(`  ${falhas.length} falha(s) no service worker.\n`);
process.exit(1);
