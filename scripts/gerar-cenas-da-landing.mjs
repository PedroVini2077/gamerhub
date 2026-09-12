// Gera as artes da landing a partir das REFERÊNCIAS, em tamanhos responsivos.
//
// `[12/09]` Mesma disciplina dos ícones: a fonte é
// `docs/identidade/referencias/cenas/`, e nada em `src/assets/landing/cenas/` é
// editado à mão. Trocar uma arte é trocar a referência e rodar de novo.
//
// Uso:  npm run cenas
//
// ── Por que DOIS formatos por cena, e não um redimensionamento só ───────────
//
// Porque a pergunta do dono — *"dá para usar no PC e no celular sem perder a
// qualidade?"* — tem resposta medida, e ela é "sim, por RECORTE".
//
// Renderizado numa tela de 400 px:
//
//   a arte inteira encolhida .... 400x225. O texto da interface desenhada
//                                 dentro dela fica com 2-3 px: ILEGÍVEL
//   um recorte alto do miolo .... funciona. Dá para ler os posts, e a
//                                 atmosfera sobrevive
//
// O problema nunca foi resolução: foi **densidade de informação por pixel de
// tela**. No recorte, os mesmos pixels cobrem uma área menor da composição, e
// cada detalhe fica MAIOR. É o oposto de encolher.
//
// ── O recorte é ESCOLHIDO, cena a cena ──────────────────────────────────────
//
// Centralizar por padrão cortaria o assunto de metade delas: em `2-feed` o
// miolo é o feed, em `5-ranks` é a torre de patentes, em `7-cta` são as
// pessoas. `foco` abaixo é a fração horizontal onde o recorte se centra.

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ORIGEM = 'docs/identidade/referencias/cenas';
const DESTINO = 'src/assets/landing/cenas';

/** As larguras servidas. O navegador escolhe pelo `sizes` do `srcset`. */
const LARGURAS_LARGAS = [1600, 1200, 828];
const LARGURAS_ALTAS = [828, 620, 420];

/** A proporção do recorte de celular. 1:1,7 — alto, mas não uma fresta. */
const PROPORCAO_ALTA = 1 / 1.7;

/**
 * `foco` é onde o recorte alto se CENTRA, em fração da largura (0 = esquerda).
 * Escolhido olhando cada arte, não por padrão.
 */
const CENAS = [
  { nome: '1-hero', foco: 0.50 },
  { nome: '2-feed', foco: 0.52 },
  { nome: '3-comunidade', foco: 0.50 },
  { nome: '4-keys', foco: 0.45 },
  { nome: '5-ranks', foco: 0.52 },
  { nome: '6-lives', foco: 0.44 },
  { nome: '7-cta', foco: 0.47 },
];

/** Qualidade. 0,80 num fundo escuro e detalhado é indistinguível de 0,92. */
const QUALIDADE = 0.8;

mkdirSync(DESTINO, { recursive: true });

const nav = await chromium.launch({ executablePath: CHROMIUM });
const pagina = await (await nav.newContext()).newPage();
let total = 0;
const faltando = [];

for (const cena of CENAS) {
  const fonte = `${ORIGEM}/${cena.nome}.webp`;
  if (!existsSync(fonte)) { faltando.push(fonte); continue; }
  const b64 = readFileSync(fonte).toString('base64');

  const saidas = await pagina.evaluate(async ({ b64, larguras, altas, prop, foco, q }) => {
    const img = new Image();
    img.src = 'data:image/webp;base64,' + b64;
    await img.decode();

    const paraWebp = (c) => c.toDataURL('image/webp', q).split(',')[1];
    const feito = {};

    // A larga: a arte inteira, só menor.
    for (const larg of larguras) {
      const c = document.createElement('canvas');
      c.width = larg;
      c.height = Math.round(larg * img.height / img.width);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      feito[`larga-${larg}`] = paraWebp(c);
    }

    // A alta: recorta a FONTE (não a versão menor) e só então redimensiona —
    // recortar depois de encolher jogaria fora a resolução que o recorte existe
    // para aproveitar.
    const larguraDoRecorte = Math.round(img.height * prop);
    let x = Math.round(img.width * foco - larguraDoRecorte / 2);
    x = Math.max(0, Math.min(x, img.width - larguraDoRecorte));

    for (const larg of altas) {
      const c = document.createElement('canvas');
      c.width = larg;
      c.height = Math.round(larg / prop);
      c.getContext('2d').drawImage(
        img, x, 0, larguraDoRecorte, img.height, 0, 0, c.width, c.height,
      );
      feito[`alta-${larg}`] = paraWebp(c);
    }
    return feito;
  }, {
    b64, larguras: LARGURAS_LARGAS, altas: LARGURAS_ALTAS,
    prop: PROPORCAO_ALTA, foco: cena.foco, q: QUALIDADE,
  });

  const pedacos = [];
  for (const [sufixo, dados] of Object.entries(saidas)) {
    const buf = Buffer.from(dados, 'base64');
    writeFileSync(`${DESTINO}/${cena.nome}-${sufixo}.webp`, buf);
    total += buf.length;
    pedacos.push(`${sufixo.split('-')[1]}:${Math.round(buf.length / 1024)}kB`);
  }
  console.log(`  ${cena.nome.padEnd(14)} ${pedacos.join('  ')}`);
}

await nav.close();

if (faltando.length) {
  console.error(`\n  FALTA a referência de: ${faltando.join(', ')}`);
  console.error('  As artes moram em docs/identidade/referencias/cenas/.\n');
  process.exit(1);
}

console.log(`\n  ${CENAS.length} cenas x 6 arquivos = ${Math.round(total / 1024)} kB no total.`);
console.log('  O visitante NÃO baixa tudo: o `srcset` escolhe um por cena, e as');
console.log('  cenas de baixo só chegam quando ele rola até elas.\n');
