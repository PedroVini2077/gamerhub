/**
 * Trava da extração de quadros de vídeo — roda num navegador de verdade.
 *
 * ── Por que ela existe ──────────────────────────────────────────────────────
 *
 * A moderação de vídeo (`lib/framesDeVideo.js` → `moderateVideos`) falhou no
 * primeiro vídeo real publicado, em 28/08. O log da Supabase provou onde: a
 * `moderate-image` **não foi chamada nenhuma vez** para aquele post, enquanto a
 * `moderate-text` foi — ou seja, a falha estava no navegador, antes da rede.
 *
 * Nenhum teste unitário pegaria isso. `extrairQuadros` depende de decodificação
 * de vídeo, de `<canvas>` e das políticas de mídia do navegador; no ambiente do
 * Vitest nada disso existe, e um mock provaria só que o mock funciona.
 *
 * ── Como ela fabrica um vídeo sem depender de arquivo no repositório ────────
 *
 * Desenha quadros coloridos num `<canvas>`, captura com `captureStream()` e
 * grava com `MediaRecorder`. O resultado é um `Blob` de vídeo real, gerado na
 * hora — sem binário versionado, sem `ffmpeg`, e com o formato que o próprio
 * navegador produz.
 *
 * ── O que ela afirma ────────────────────────────────────────────────────────
 *
 * Que um vídeo comum devolve os 3 quadros. Se voltar lista vazia, a moderação
 * de vídeo está desligada de fato — o conteúdo sobe sem análise nenhuma, e do
 * lado de quem publica isso é indistinguível de "analisado e limpo" (§1.5).
 *
 * Uso:  npx vite --port 5174 &  →  node e2e/quadros-de-video.mjs
 */
import { abrirNavegador } from './util.mjs';

const BASE = process.env.QUADROS_BASE ?? 'http://localhost:5174';
const PAGINA = `${BASE}/e2e/fixtures/quadros.html`;

const browser = await abrirNavegador({ webgl: true });
const page = await browser.newPage();

let falhas = 0;
const falhar = (msg) => { console.error(`  FALHA: ${msg}`); falhas++; };

page.on('pageerror', e => falhar(`exceção na página: ${e.message}`));

const resposta = await page.goto(PAGINA, { waitUntil: 'domcontentloaded' }).catch(() => null);
if (!resposta || !resposta.ok()) {
  console.error(
    `Não consegui abrir ${PAGINA}.\n`
    + 'Este teste precisa do vite em modo DEV (ele serve `src/` direto).\n'
    + 'Suba com:  npx vite --port 5174',
  );
  await browser.close();
  process.exit(2);
}

await page.waitForFunction(() => window.pronto === true, { timeout: 15000 });

/** Gera um vídeo de verdade no navegador e devolve o resultado da extração. */
const resultado = await page.evaluate(async () => {
  const LARGURA = 320;
  const ALTURA = 240;
  const DURACAO_MS = 1500;

  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  const tipos = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = tipos.find(t => window.MediaRecorder?.isTypeSupported?.(t));
  if (!mimeType) return { erro: 'MediaRecorder não suporta nenhum formato webm neste navegador' };

  const pedacos = [];
  const gravador = new MediaRecorder(stream, { mimeType });
  gravador.ondataavailable = (e) => { if (e.data.size) pedacos.push(e.data); };

  const gravado = new Promise((resolve) => { gravador.onstop = resolve; });
  gravador.start();

  // Cores mudando: garante que os quadros são diferentes entre si, então um
  // quadro preto ou repetido denuncia problema de decodificação.
  const inicio = performance.now();
  await new Promise((resolve) => {
    const desenhar = () => {
      const t = performance.now() - inicio;
      ctx.fillStyle = `hsl(${Math.round((t / DURACAO_MS) * 360)}, 90%, 50%)`;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      if (t >= DURACAO_MS) return resolve();
      requestAnimationFrame(desenhar);
    };
    desenhar();
  });

  gravador.stop();
  await gravado;

  const blob = new Blob(pedacos, { type: mimeType });
  if (!blob.size) return { erro: 'o MediaRecorder não produziu bytes' };

  const inicioExtracao = performance.now();
  const { quadros, motivo } = await window.extrairQuadros(blob);

  // Segundo caso: arquivo que NÃO é vídeo. Tem que falhar dizendo por quê —
  // era um dos cinco caminhos que devolviam lista vazia calada.
  const lixo = await window.extrairQuadros(
    new Blob(['isto definitivamente nao e um video'], { type: 'video/mp4' }),
  );

  return {
    mimeType,
    bytesDoVideo: blob.size,
    motivo,
    motivoDoLixo: lixo.motivo,
    quadrosDoLixo: lixo.quadros.length,
    quadros: quadros.length,
    esperado: window.QUANTIDADE_DE_QUADROS,
    duracaoMs: Math.round(performance.now() - inicioExtracao),
    // Confirma que é JPEG de verdade e que os quadros não são idênticos.
    todosJpeg: quadros.every(q => q.startsWith('data:image/jpeg;base64,')),
    distintos: new Set(quadros).size,
    menorEmBytes: quadros.length ? Math.min(...quadros.map(q => q.length)) : 0,
  };
});

if (resultado.erro) {
  falhar(`${resultado.erro} — o teste não conseguiu fabricar o vídeo`);
} else {
  console.log(`  vídeo gerado: ${resultado.bytesDoVideo} bytes (${resultado.mimeType})`);
  console.log(`  quadros extraídos: ${resultado.quadros}/${resultado.esperado} em ${resultado.duracaoMs} ms`);
  console.log(`  distintos: ${resultado.distintos} · todos JPEG: ${resultado.todosJpeg}`);
  console.log(`  arquivo inválido → ${resultado.quadrosDoLixo} quadros, motivo: "${resultado.motivoDoLixo}"`);

  if (resultado.quadrosDoLixo !== 0) {
    falhar('um arquivo que não é vídeo produziu quadros — a extração está inventando');
  }
  if (!resultado.motivoDoLixo || resultado.motivoDoLixo === 'motivo_desconhecido') {
    falhar(
      'a extração falhou SEM DIZER POR QUÊ.\n'
      + '  Era o bug de fundo de 28/08: cinco causas diferentes (formato, duração\n'
      + '  não finita, teto de tempo, canvas recusado, URL negada) terminavam na\n'
      + '  mesma lista vazia, e nenhuma delas dava pista. Sem o motivo, a próxima\n'
      + '  falha volta a custar uma investigação inteira (§1.5).',
    );
  }

  if (resultado.quadros === 0) {
    falhar(
      'a extração devolveu ZERO quadros — foi exatamente o bug de 28/08.\n'
      + '  Com lista vazia, `moderateVideos` não chama a moderação e o vídeo sobe\n'
      + '  SEM ANÁLISE NENHUMA. Do lado de quem publica, isso é indistinguível de\n'
      + '  "analisado e limpo" (§1.5).',
    );
  } else if (resultado.quadros < resultado.esperado) {
    falhar(`extraiu só ${resultado.quadros} de ${resultado.esperado} quadros`);
  }

  if (resultado.quadros > 0 && !resultado.todosJpeg) {
    falhar('algum quadro não é um JPEG embutido — a Edge Function vai recusar');
  }
  if (resultado.quadros > 1 && resultado.distintos < 2) {
    falhar(
      'todos os quadros saíram idênticos: o vídeo não estava decodificando de\n'
      + '  fato, e a amostragem está olhando sempre o mesmo instante.',
    );
  }
  // O teto de 400 KB por imagem embutida vive na Edge Function; quadro acima
  // disso é recusado lá e vira análise silenciosamente parcial.
  if (resultado.menorEmBytes > 400 * 1024) {
    falhar('os quadros passaram de 400 KB — a Edge Function recusa nesse tamanho');
  }
}

await browser.close();

if (falhas) {
  console.error(`\n${falhas} falha(s) na extração de quadros.`);
  process.exit(1);
}
console.log('\nOK: vídeo comum rende os quadros que a moderação precisa.');
