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
// qualidade?"* — tem resposta medida, e ela é NÃO, se for por encolhimento.
//
// Renderizado numa tela de 400 px:
//
//   a arte 16:9 inteira encolhida .... 400x225. O texto da interface desenhada
//                                      dentro dela fica com 2-3 px: ILEGÍVEL
//
// O problema nunca foi resolução: é **densidade de informação por pixel de
// tela**. Uma composição larga espremida numa tela em pé perde o assunto.
//
// ── `[12/09]` O recorte automático SAIU. Cada cena tem duas ARTES ───────────
//
// A primeira versão deste script recortava a arte 16:9 no miolo para produzir
// a versão de celular. Funcionava — media melhor que encolher —, mas era
// remendo: **corte não escolhe enquadramento, só descarta o que sobra**.
//
// O dono resolveu por outro caminho, e é o certo: ele **regerou as sete cenas
// em retrato**, compostas para a tela em pé. Comparado ao recorte, o ganho não
// é de resolução, é de COMPOSIÇÃO — na versão dele o assunto está no lugar
// porque foi posto lá, não porque sobrou.
//
// Então este script agora só REDIMENSIONA duas fontes diferentes, e não
// inventa enquadramento nenhum.

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ORIGEM_LARGA = 'docs/identidade/referencias/cenas';
const ORIGEM_ALTA = 'docs/identidade/referencias/cenas-retrato';
const DESTINO = 'src/assets/landing/cenas';

/** As larguras servidas. O navegador escolhe pelo `sizes` do `srcset`. */
const LARGURAS_LARGAS = [1600, 1200, 828];
const LARGURAS_ALTAS = [828, 620, 420];

/** As sete cenas. Cada nome existe nas DUAS pastas de referência. */
const CENAS = [
  '1-hero', '2-feed', '3-comunidade', '4-keys', '5-ranks', '6-lives', '7-cta',
];

/** Qualidade. 0,80 num fundo escuro e detalhado é indistinguível de 0,92. */
const QUALIDADE = 0.8;

mkdirSync(DESTINO, { recursive: true });

const nav = await chromium.launch({ executablePath: CHROMIUM });
const pagina = await (await nav.newContext()).newPage();
let total = 0;
const faltando = [];

for (const nome of CENAS) {
  const larga = `${ORIGEM_LARGA}/${nome}.webp`;
  const alta = `${ORIGEM_ALTA}/${nome}.webp`;
  for (const f of [larga, alta]) if (!existsSync(f)) faltando.push(f);
  if (faltando.length) continue;

  const pedacos = [];
  for (const [fonte, rotulo, tamanhos] of [
    [larga, 'larga', LARGURAS_LARGAS], [alta, 'alta', LARGURAS_ALTAS],
  ]) {
    const b64 = readFileSync(fonte).toString('base64');
    const saidas = await pagina.evaluate(async ({ b64, tamanhos, q }) => {
      const img = new Image();
      img.src = 'data:image/webp;base64,' + b64;
      await img.decode();
      const feito = {};
      for (const larg of tamanhos) {
        const c = document.createElement('canvas');
        c.width = larg;
        c.height = Math.round(larg * img.height / img.width);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        feito[larg] = c.toDataURL('image/webp', q).split(',')[1];
      }
      return feito;
    }, { b64, tamanhos, q: QUALIDADE });

    for (const [larg, dados] of Object.entries(saidas)) {
      const buf = Buffer.from(dados, 'base64');
      writeFileSync(`${DESTINO}/${nome}-${rotulo}-${larg}.webp`, buf);
      total += buf.length;
      pedacos.push(`${rotulo[0]}${larg}:${Math.round(buf.length / 1024)}kB`);
    }
  }
  console.log(`  ${nome.padEnd(14)} ${pedacos.join('  ')}`);
}

await nav.close();

if (faltando.length) {
  console.error(`\n  FALTA a referência de: ${faltando.join(', ')}`);
  console.error('  As artes largas moram em docs/identidade/referencias/cenas/');
  console.error('  e as de retrato em docs/identidade/referencias/cenas-retrato/.\n');
  process.exit(1);
}

console.log(`\n  ${CENAS.length} cenas x 6 arquivos = ${Math.round(total / 1024)} kB no total.`);
console.log('  O visitante NÃO baixa tudo: o `srcset` escolhe um por cena, e as');
console.log('  cenas de baixo só chegam quando ele rola até elas.\n');
