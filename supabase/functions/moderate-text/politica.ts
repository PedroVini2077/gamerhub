// Extraído do index.ts em 23/08/2026 (§4: o arquivo estava em 328 linhas).
//
// Aqui mora a POLÍTICA — o que conta como violação e quem responde. O index.ts
// ficou com o HTTP: quem pode chamar, de onde vem o texto, e o que fazer com o
// veredito. São duas perguntas diferentes e agora dá para ler uma sem a outra.

// ---------------------------------------------------------------------------
// POLITICA DE MODERACAO
//
// O modelo antigo (HuggingFace) devolvia UM numero de "toxicidade" e por isso
// era cego pra conteudo sexual: medimos "quer trocar nudes, mando foto pelada"
// dando 0.136 e passando batido, enquanto "caralho que jogo foda" dava 0.943 e
// era ocultado. Invertido pro que este site quer ser.
//
// A OpenAI devolve uma pontuacao POR CATEGORIA, entao a politica vira duas
// camadas:
//
// 1. PISOS FIXOS para o que nunca e aceitavel aqui. Nao dependem do ajuste do
//    painel — se alguem afrouxar o dial, isto continua valendo.
// 2. DIAL do painel (`mod_ai_text_threshold`) para o resto, onde o dono decide
//    quao rigido quer ser sem precisar de deploy.
// ---------------------------------------------------------------------------

/** Piso por categoria. Passou disto, oculta — o dial do painel nao afrouxa. */
export const PISOS_FIXOS: Record<string, number> = {
  "sexual/minors":          0.10,
  "sexual":                 0.40,
  "harassment/threatening": 0.50,
  "hate/threatening":       0.40,
  "self-harm/instructions": 0.30,
  "self-harm/intent":       0.40,
  "violence/graphic":       0.65,
  "illicit/violent":        0.50,
};

/** Categorias governadas pelo dial do painel. */
export const CATEGORIAS_DIAL = [
  "harassment", "hate", "violence", "self-harm", "illicit",
];

export const DIAL_PADRAO = 0.7;

export type Decisao = {
  flagged: boolean;
  motivos: string[];
  maiorScore: number;
  categorias: Record<string, number>;
  // Categoria que MAIS pesou entre as que dispararam. Vai pra RPC para que o
  // aviso ao autor diga "por assedio" em vez de "por violar as regras".
  categoriaPrincipal: string | null;
};

function resumirCategorias(scores: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    if (typeof v === "number" && v >= 0.01) out[k] = Math.round(v * 1000) / 1000;
  }
  return out;
}

export function decidir(scores: Record<string, number>, dial: number): Decisao {
  const motivos: string[] = [];
  let maiorScore = 0;
  let maiorCategoria: string | null = null;
  let principal: string | null = null;
  let principalValor = -1;

  for (const [cat, valor] of Object.entries(scores)) {
    if (typeof valor !== "number") continue;
    if (valor > maiorScore) { maiorScore = valor; maiorCategoria = cat; }

    let disparou = false;
    const piso = PISOS_FIXOS[cat];
    if (piso !== undefined && valor >= piso) {
      motivos.push(`${cat}=${valor.toFixed(3)} (piso ${piso})`);
      disparou = true;
    } else if (CATEGORIAS_DIAL.includes(cat) && valor >= dial) {
      motivos.push(`${cat}=${valor.toFixed(3)} (dial ${dial})`);
      disparou = true;
    }

    if (disparou && valor > principalValor) { principal = cat; principalValor = valor; }
  }

  return {
    flagged: motivos.length > 0,
    motivos,
    maiorScore,
    categorias: resumirCategorias(scores),
    categoriaPrincipal: principal ?? maiorCategoria,
  };
}

const OPENAI_URL   = "https://api.openai.com/v1/moderations";
const OPENAI_MODEL = "omni-moderation-latest";
const HF_URL = "https://router.huggingface.co/hf-inference/models/unitary/multilingual-toxic-xlm-roberta";

export async function viaOpenAI(
  text: string, dial: number, apiKey: string,
): Promise<Decisao | null> {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: OPENAI_MODEL, input: text.slice(0, 4000) }),
  });

  if (!res.ok) {
    console.error("[moderate-text] OpenAI error:", res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const r = data?.results?.[0];
  if (!r) return null;

  const decisao = decidir(r.category_scores ?? {}, dial);
  if (r.flagged && !decisao.flagged) {
    decisao.flagged = true;
    decisao.motivos.push("openai.flagged=true");
  }
  return decisao;
}

/** Fallback caso a OPENAI_API_KEY seja removida ou nunca configurada. */
export async function viaHuggingFace(
  text: string, dial: number, apiKey: string,
): Promise<Decisao | null> {
  const res = await fetch(HF_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: text.slice(0, 512) }),
  });
  if (!res.ok) {
    console.error("[moderate-text] HF error:", res.status, await res.text());
    return null;
  }
  const result = await res.json();
  const arr = Array.isArray(result?.[0]) ? result[0] : result;
  const toxic = Array.isArray(arr)
    ? arr.find((x: { label: string }) => x.label === "toxic")
    : null;
  const score = typeof toxic?.score === "number" ? toxic.score : 0;

  return {
    flagged: score >= dial,
    motivos: score >= dial ? [`toxic=${score.toFixed(3)} (dial ${dial})`] : [],
    maiorScore: score,
    categorias: { toxic: Math.round(score * 1000) / 1000 },
    // Este modelo nao separa categoria; `null` faz a RPC usar o texto generico.
    categoriaPrincipal: null,
  };
}
