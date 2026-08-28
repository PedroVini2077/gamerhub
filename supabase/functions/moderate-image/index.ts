// Espelho do que está implantado — ver ../README.md. Editar aqui e implantar,
// nunca o contrário: em 27/08 este diretório passou a ser a fonte, e é ele que
// os testes de contrato leem.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON  = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const HF_API_KEY     = Deno.env.get("HUGGINGFACE_API_KEY") ?? "";

const OPENAI_URL   = "https://api.openai.com/v1/moderations";
const OPENAI_MODEL = "omni-moderation-latest";
const HF_MODEL_URL = "https://router.huggingface.co/hf-inference/models/Falconsai/nsfw_image_detection";

// So imagem do proprio storage do projeto e analisada. Sem isto a funcao aceita
// qualquer URL do corpo e vira um SSRF: quem chama escolhe o destino do fetch
// que sai de dentro da infra da Supabase.
const PREFIXO_STORAGE = `${SUPABASE_URL}/storage/v1/object/public/`;

// ─── Imagem embutida (`data:`) — o caminho da moderação de VÍDEO ─────────────
//
// Vídeo era o único tipo de mídia que subia sem NENHUMA checagem: em
// `postService.js`, só `type === 'image'` entrava na lista mandada para cá.
//
// A saída é extrair alguns quadros no navegador (`lib/framesDeVideo.js`) e
// mandá-los aqui. Quadro extraído não é URL de storage — e subi-lo para o
// bucket só para moderar custaria egress e deixaria lixo para limpar depois.
//
// Nenhum caminho novo de análise foi preciso: a API da OpenAI aceita `data:`
// no mesmo campo `image_url.url`, e o `fetch()` do Deno (usado pela reserva do
// Hugging Face) também resolve `data:`. A mudança é só de VALIDAÇÃO.
//
// E validação com limite, porque `data:` é a única entrada aqui cujo tamanho
// quem chama controla — URL de storage pesa ~100 bytes, um quadro embutido pesa
// centenas de KB. Sem teto, uma conta qualquer manda 4 imagens gigantes e
// queima cota da OpenAI. Os quadros que a `framesDeVideo.js` gera ficam na casa
// de 30-60 KB, então 400 KB é folga larga e ainda assim um teto.
const PREFIXO_EMBUTIDO = /^data:image\/(jpeg|png|webp);base64,/;
const MAX_BYTES_EMBUTIDO = 400 * 1024;

function imagemAceita(u: unknown): u is string {
  if (typeof u !== "string") return false;
  if (u.startsWith(PREFIXO_STORAGE)) return true;
  return PREFIXO_EMBUTIDO.test(u) && u.length <= MAX_BYTES_EMBUTIDO;
}

const CARGOS_STAFF = ["admin", "super_admin", "owner"];
const TABELAS: Record<string, string> = {
  post: "posts", comment: "comments", mural: "community_posts",
};

// ---------------------------------------------------------------------------
// POLITICA DE IMAGEM — e o "jogo de cintura" do gore
//
// O modelo antigo (Falconsai/nsfw_image_detection) era binario nsfw/normal,
// treinado em pornografia: nao pegava sangue, gore, automutilacao nem simbolo
// de odio. Medimos foto de rapaz sem camisa na praia em nsfw_score=0.000 — o
// pipeline funcionava, o modelo e que era estreito.
//
// A troca para `omni-moderation-latest` cobre tudo isso numa chamada so. Mas
// num site de JOGOS a maioria das imagens e print de jogo, e NENHUM modelo
// distingue gore de Doom de gore real. Por isso a nota tem dois destinos:
// ---------------------------------------------------------------------------

/**
 * Passou disto, OCULTA na hora. So o que nunca e aceitavel aqui.
 *
 * ── `[28/08]` ATENCAO: `sexual/minors` NAO VALE PARA IMAGEM ─────────────────
 *
 * Isto e FATO conferido na documentacao da OpenAI, nao deducao. A
 * `omni-moderation-latest` aplica a imagem apenas seis categorias:
 *
 *     sexual · violence · violence/graphic
 *     self-harm · self-harm/intent · self-harm/instructions
 *
 * `sexual/minors` (e tambem `hate*`, `harassment*`, `illicit*`) e TEXT ONLY.
 * Em imagem a API nao devolve nota nenhuma para ela — nos logs desta funcao ela
 * aparece como `sexual/minors=-`, e foi assim que o buraco apareceu, no dia
 * seguinte a passarmos a registrar todas as notas.
 *
 * Ou seja: o piso de 0.10 abaixo NUNCA disparou em imagem, e nunca disparara
 * enquanto a API for assim. Ele nao esta protegendo nada aqui.
 *
 * POR QUE ELE FICA MESMO ASSIM: remover daria a impressao de que a decisao de
 * produto mudou, e ele volta a valer sozinho no dia em que a OpenAI estender a
 * categoria para imagem. O que NAO pode acontecer e alguem ler esta linha e
 * concluir que ha deteccao de menor em imagem — por isso este bloco existe.
 *
 * QUEM DE FATO PROTEGE IMAGEM NESTA CLASSE e `sexual` em 0.55, que vale para
 * imagem e OCULTA na hora. Ele e deliberadamente mais folgado que o piso do
 * texto justamente para pegar o caso duvidoso.
 *
 * O caminho de TEXTO (`moderate-text`) continua com `sexual/minors` ativo e
 * funcionando — la a categoria e suportada.
 */
const OCULTA: Record<string, number> = {
  "sexual/minors":          0.10, // TEXT ONLY na API: inerte em imagem (ver acima)
  "sexual":                 0.55, // mais folgado que no texto: foto de praia
                                  // e biquini pontuam sem ser pornografia.
                                  // E, na pratica, o unico desta classe que
                                  // realmente roda em imagem.
  "self-harm":              0.50,
  "self-harm/intent":       0.40,
  "self-harm/instructions": 0.30,
};

/**
 * As categorias que a OpenAI de fato aplica a IMAGEM.
 *
 * Serve de fonte unica para o teste de contrato saber quais pisos podem
 * disparar aqui e quais sao decoracao. Sem esta lista, "o piso existe" e "o
 * piso funciona" viram a mesma coisa aos olhos de quem le o codigo.
 */
const CATEGORIAS_QUE_VALEM_EM_IMAGEM = [
  "sexual", "violence", "violence/graphic",
  "self-harm", "self-harm/intent", "self-harm/instructions",
];

/**
 * Passou disto, SO ENFILEIRA para uma pessoa olhar — nunca oculta sozinho.
 *
 * Auto-ocultar `violence/graphic` derrubaria metade do conteudo legitimo do
 * site no primeiro dia. Com o destino sendo a fila, um limiar errado gera fila
 * maior; nunca censura.
 *
 * ── `[28/08]` Os numeros mudaram, e agora com dado ──────────────────────────
 *
 * Os pisos anteriores (0.80 e 0.90) foram escolhidos sem medicao nenhuma. A
 * primeira medicao real, assim que o bug do `too_many_images` foi corrigido:
 *
 *     print de jogo, 1 imagem  -> violence/graphic 0.854  (piso era 0.80)
 *     print de jogo, 4 imagens -> violence         0.943  (piso era 0.90)
 *
 * DOIS DE DOIS prints de jogo COMUNS foram para a fila. Nao foi erro do modelo
 * — as imagens sao violentas de fato. Foram os pisos que nao cabiam num site
 * cujo conteudo normal e print de jogo de tiro e de luta.
 *
 * `violence` SAIU. Nao subiu de piso: saiu. Num site de jogos "ha violencia na
 * imagem" e o estado normal do conteudo, entao a categoria nao separa nada —
 * ela so produz fila. E a pergunta que decide e o que a equipe FARIA com o
 * item: um print de jogo de acao na fila e aprovado, sempre, todas as vezes.
 * Sinal que dispara no caso comum e cujo veredito e sempre o mesmo nao e
 * sinal; e ruido. E fila 100% ruido ensina a ignorar a fila, o que cega
 * tambem os avisos que importam (CLAUDE.md §0.2, 4ª regra).
 *
 * `violence/graphic` FICOU, em 0.95. E a categoria que de fato separa gore de
 * acao comum, e 0.95 poe uma margem de ~0.10 acima do unico print medido.
 *
 * O QUE SE PERDE, dito sem maquiagem: gore leve — entre 0.80 e 0.95 — deixa de
 * ser revisado por uma pessoa. Continua coberto por denuncia, pela wordlist do
 * texto que acompanha, e pela moderacao manual. A troca e deliberada: errar
 * para baixo enchia a fila e fazia ninguem olhar nenhum item; errar para cima
 * deixa passar o caso duvidoso e mantem a fila util para o caso grave.
 *
 * Nada disto afrouxa o que OCULTA: `sexual*` e `self-harm*` seguem iguais.
 */
const SO_ENFILEIRA: Record<string, number> = {
  "violence/graphic": 0.95,
};

/**
 * Categorias que vao para o log em TODA analise, passando ou nao do piso.
 *
 * Existe por causa de um buraco que a decisao acima expos: as notas eram
 * calculadas e jogadas fora. O log so contava a categoria VENCEDORA, e o corpo
 * da resposta e descartado pelo chamador (fire-and-forget) — entao ajustar
 * piso exigia pedir ao dono que postasse imagem de teste, uma a uma.
 *
 * Registrando sempre, a distribuicao se acumula sozinha com o uso normal do
 * site, e o proximo ajuste tem amostra em vez de dois pontos. Custo zero: os
 * numeros ja estao na memoria quando esta linha e escrita.
 */
const CATEGORIAS_OBSERVADAS = [
  "violence/graphic", "violence",
  "sexual", "sexual/minors",
  "self-harm", "self-harm/intent", "self-harm/instructions",
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });

type Veredito = {
  categoria: string | null;
  score: number;
  ocultar: boolean;
  scores: Record<string, number>;
  /**
   * Quantas imagens o provedor de fato analisou.
   *
   * Existe porque, desde que cada imagem virou uma requisicao propria, "deu
   * certo" deixou de ser sim ou nao: 3 de 4 podem responder. Sem este numero, a
   * imagem que ficou de fora passaria como analisada e limpa — que e o formato
   * exato de falha silenciosa que este arquivo inteiro tenta evitar (§1.5).
   */
  analisadas?: number;
};

const NADA: Veredito = { categoria: null, score: 0, ocultar: false, scores: {} };

/** Escolhe o pior caso entre todas as imagens do post. */
function decidir(scores: Record<string, number>): Veredito {
  let melhor: Veredito = { ...NADA, scores };

  for (const [cat, valor] of Object.entries(scores)) {
    if (typeof valor !== "number") continue;

    const pisoOculta = OCULTA[cat];
    if (pisoOculta !== undefined && valor >= pisoOculta) {
      // Ocultar sempre vence enfileirar, e entre dois que ocultam vence o maior.
      if (!melhor.ocultar || valor > melhor.score) {
        melhor = { categoria: cat, score: valor, ocultar: true, scores };
      }
      continue;
    }

    const pisoFila = SO_ENFILEIRA[cat];
    if (pisoFila !== undefined && valor >= pisoFila && !melhor.ocultar) {
      if (valor > melhor.score) {
        melhor = { categoria: cat, score: valor, ocultar: false, scores };
      }
    }
  }
  return melhor;
}

// UMA IMAGEM POR REQUISICAO. Nao e escolha de estilo — e limite da API.
//
// Ate 28/08/2026 esta funcao mandava as imagens todas num `input` so, e a
// `omni-moderation-latest` respondia:
//
//     400 too_many_images — "Number of images (4) exceeds maximum of 1"
//
// O efeito era o pior possivel: nao era degradacao, era TUDO OU NADA. Post com
// 1 imagem funcionava; post com 2 ou mais nao era analisado de forma nenhuma —
// e a moderacao de VIDEO, que nasceu em 28/08 mandando varios quadros de uma
// vez, nunca funcionou um dia sequer.
//
// Mandar em LOTES resolve porque a agregacao ja era por PIOR CASO entre as
// imagens (`decidir` recebe o maximo por categoria): o resultado de N
// requisicoes e o mesmo que o de uma requisicao com N imagens teria sido. O
// endpoint de moderacao da OpenAI e gratuito, entao N chamadas nao custam N
// vezes mais — custam N vezes o tempo, e isto e fire-and-forget.
//
// A constante e o lote de fato, e nao um comentario: se a OpenAI passar a
// aceitar mais de uma imagem, muda so este numero (§4, fonte unica).
const MAX_IMAGENS_POR_REQUISICAO = 1;

async function viaOpenAI(urls: string[]): Promise<Veredito | null> {
  const maximos: Record<string, number> = {};
  let analisadas = 0;

  for (let i = 0; i < urls.length; i += MAX_IMAGENS_POR_REQUISICAO) {
    const lote = urls.slice(i, i + MAX_IMAGENS_POR_REQUISICAO);
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        // As imagens estao em bucket publico, entao a OpenAI busca a URL direto —
        // sem precisar trafegar o arquivo por aqui.
        input: lote.map(url => ({ type: "image_url", image_url: { url } })),
      }),
    });
    if (!res.ok) {
      console.error("[moderate-image] OpenAI error:", res.status, await res.text());
      continue;
    }
    const data = await res.json();
    const resultados = data?.results;
    if (!Array.isArray(resultados) || resultados.length === 0) continue;

    analisadas += lote.length;
    // Pior caso por categoria entre todas as imagens.
    for (const r of resultados) {
      for (const [cat, v] of Object.entries(r?.category_scores ?? {})) {
        if (typeof v === "number" && v > (maximos[cat] ?? 0)) maximos[cat] = v;
      }
    }
  }

  // Nenhuma respondeu = nao analisado. Devolver `decidir({})` aqui seria dizer
  // "analisei e esta limpo" sobre imagem que ninguem olhou (§1.5) — e quem
  // chama trata `null` gritando em `admin_logs`.
  if (analisadas === 0) return null;
  return { ...decidir(maximos), analisadas };
}

/** Reserva: so pornografia, como era antes. Usado se a chave da OpenAI sumir. */
async function viaHuggingFace(urls: string[]): Promise<Veredito | null> {
  let maior = 0;
  for (const url of urls) {
    try {
      const img = await fetch(url);
      if (!img.ok) continue;
      const bytes = await img.arrayBuffer();
      const hf = await fetch(HF_MODEL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": img.headers.get("content-type") || "image/jpeg",
        },
        body: bytes,
      });
      if (!hf.ok) { console.error("[moderate-image] HF error:", hf.status); continue; }
      const r = await hf.json();
      const arr: Array<{ label: string; score: number }> = Array.isArray(r[0]) ? r[0] : r;
      const nsfw = arr.find(x => x.label === "nsfw");
      if (nsfw && nsfw.score > maior) maior = nsfw.score;
    } catch (e) {
      console.error("[moderate-image] erro ao processar imagem:", e);
    }
  }
  return { categoria: maior >= 0.85 ? "nsfw" : null, score: maior,
           ocultar: maior >= 0.85, scores: { nsfw: maior } };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Nao autorizado" }, 401);

  if (!SERVICE_ROLE) {
    console.error("[moderate-image] SUPABASE_SERVICE_ROLE_KEY ausente");
    return json({ error: "Servico mal configurado" }, 500);
  }
  if (!OPENAI_API_KEY && !HF_API_KEY) {
    console.error("[moderate-image] nenhuma API key configurada");
    return json({ error: "API key nao configurada" }, 500);
  }

  let body: { content_type?: string; content_id?: string; image_urls?: string[] };
  try { body = await req.json(); }
  catch { return json({ error: "Payload invalido" }, 400); }

  const { content_type, content_id, image_urls } = body;
  const tabela = content_type ? TABELAS[content_type] : undefined;
  if (!tabela || !content_id || !image_urls?.length)
    return json({ error: "content_type, content_id e image_urls sao obrigatorios" }, 400);

  const clienteUsuario = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user } } = await clienteUsuario.auth.getUser();
  if (!user) return json({ error: "Nao autorizado" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // A falha vai para a trilha que o dono ja olha. O corpo da resposta sozinho
  // nao basta: o cliente dispara e descarta (fire-and-forget), entao o erro
  // ficaria sem ninguem para ouvi-lo — foi assim que a IA ficou quebrada em
  // 26 de 26 chamadas por semanas (§1.5).
  const gritar = async (detalhe: string, extra: Record<string, unknown> = {}) => {
    try {
      await admin.rpc("registrar_falha_de_moderacao", {
        p_funcao: "moderate-image", p_detalhe: detalhe,
        p_metadata: { content_type, content_id, ...extra },
      });
    } catch { /* se nem isto passar, o console e o ultimo recurso */ }
  };

  const { data: linha } = await admin
    .from(tabela).select("user_id").eq("id", content_id).maybeSingle();
  if (!linha) return json({ error: "Conteudo nao encontrado" }, 404);

  if (linha.user_id !== user.id) {
    const { data: perfil } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!CARGOS_STAFF.includes(perfil?.role ?? "")) {
      console.warn(`[moderate-image] ${user.id} tentou moderar ${content_type}/${content_id} de outro`);
      return json({ error: "Nao autorizado" }, 403);
    }
  }

  const urls = image_urls
    .filter(imagemAceita)
    .slice(0, 4);
  const recusadas = image_urls.length - urls.length;
  // Recusa silenciosa aqui seria falha silenciosa: a mídia passaria sem análise
  // e ninguém saberia que ela não foi analisada (§1.5). Vai para o log com o
  // motivo separado, porque "URL de outro domínio" e "quadro grande demais" têm
  // causas e correções completamente diferentes.
  if (recusadas > 0) {
    const grandes = image_urls.filter(
      u => typeof u === "string" && PREFIXO_EMBUTIDO.test(u) && u.length > MAX_BYTES_EMBUTIDO,
    ).length;
    console.warn(
      `[moderate-image] ${recusadas} imagem(ns) ignorada(s): ` +
      `${grandes} embutida(s) acima de ${MAX_BYTES_EMBUTIDO} bytes, ` +
      `${recusadas - grandes} fora do storage`,
    );
  }
  if (!urls.length) return json({ score: 0, flagged: false, status: "sem_imagem_valida" });

  const provedor = OPENAI_API_KEY ? "openai" : "huggingface";
  let veredito: Veredito | null = null;
  try {
    veredito = OPENAI_API_KEY ? await viaOpenAI(urls) : await viaHuggingFace(urls);
  } catch (e) {
    console.error("[moderate-image] fetch error:", e);
  }

  // Provedor fora do ar tambem e falha silenciosa: a imagem passa sem analise e
  // ninguem fica sabendo que ela nao foi analisada.
  if (!veredito) {
    await gritar(`provedor ${provedor} nao respondeu`, { provedor });
    return json({ score: 0, flagged: false, provider: provedor, status: "api_error" });
  }

  // Analise PARCIAL tambem precisa gritar. Com uma requisicao por imagem,
  // "deu certo" virou uma escala: 3 de 4 podem responder, e as 3 decidem o
  // veredito enquanto a 4ª passa sem ninguem olhar. Se este aviso nao existisse,
  // esse caso seria indistinguivel de "analisei tudo e esta limpo".
  const analisadas = veredito.analisadas ?? urls.length;
  if (analisadas < urls.length) {
    await gritar(`analise parcial: ${analisadas} de ${urls.length} imagens`, {
      provedor, analisadas, enviadas: urls.length,
    });
  }

  // As notas de TODAS as categorias observadas, tenham passado do piso ou nao.
  // E o que transforma o proximo ajuste de piso numa leitura de log em vez de
  // uma sessao de teste manual. `-` quando o provedor nao devolveu a categoria
  // (a reserva do Hugging Face so conhece `nsfw`).
  const notas = CATEGORIAS_OBSERVADAS
    .map(cat => {
      const v = veredito.scores[cat];
      if (typeof v === "number") return `${cat}=${v.toFixed(3)}`;
      // Sem nota tem duas causas MUITO diferentes, e confundi-las custou tempo:
      // ou a API nao aplica a categoria a imagem (`sexual/minors`), ou ela
      // deveria ter vindo e nao veio (a reserva do Hugging Face, ou algo
      // errado). A primeira e esperada; a segunda e sintoma.
      const esperado = CATEGORIAS_QUE_VALEM_EM_IMAGEM.includes(cat)
        ? "-" : "-(so_texto)";
      return `${cat}=${esperado}`;
    })
    .join(" ");

  console.log(
    `[moderate-image] ${provedor} ${content_type}/${content_id} ` +
    `analisadas=${analisadas}/${urls.length} ` +
    `categoria=${veredito.categoria ?? "-"} score=${veredito.score.toFixed(3)} ` +
    `acao=${veredito.categoria ? (veredito.ocultar ? "ocultar" : "enfileirar") : "nada"} ` +
    `| notas: ${notas}`
  );

  if (!veredito.categoria) {
    return json({ score: Math.round(veredito.score * 1000) / 1000, flagged: false,
                  scores: veredito.scores, provider: provedor,
                  analisadas, enviadas: urls.length, status: "ok" });
  }

  // Score 1 porque a decisao ja foi tomada aqui pela politica por categoria; o
  // limiar do painel nao deve desfazer o que os pisos fixos decidiram.
  const { error: rpcError } = await admin.rpc("apply_ai_moderation", {
    p_content_type:  content_type,
    p_content_id:    content_id,
    p_score:         1,
    p_threshold_key: "mod_ai_image_threshold",
    p_categoria:     veredito.categoria,
    p_ocultar:       veredito.ocultar,
  });
  if (rpcError) {
    console.error("[moderate-image] RPC error:", rpcError.message);
    await gritar(rpcError.message, { categoria: veredito.categoria });
    return json({ score: Math.round(veredito.score * 1000) / 1000,
                  status: "rpc_error", error: rpcError.message }, 500);
  }

  return json({
    score: Math.round(veredito.score * 1000) / 1000,
    category: veredito.categoria,
    flagged: true,
    hidden: veredito.ocultar,
    scores: veredito.scores,
    provider: provedor,
    analisadas,
    enviadas: urls.length,
    status: "ok",
  });
});
