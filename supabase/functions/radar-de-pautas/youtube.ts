// O SINAL DE VÍDEO — "tem gente falando disso em vídeo HOJE?"
//
// ============================================================================
// `[02/10]` FASE 4, e ela é SINAL, não fonte
// ============================================================================
//
// O plano (`PLANO-FEED-BUSCA-NEWS.md`, item 4) põe YouTube do lado direito do
// diagrama: **sinal anexado ao evento**, nunca entrada da lista de manchetes.
// A diferença não é estética.
//
// Manchete de veículo é apuração: alguém assinou embaixo. Título de vídeo é
// qualquer pessoa com uma conta. Misturar os dois na lista que vai ao modelo
// faria "um youtuber disse" valer o mesmo que "a Eurogamer publicou" — e o
// radar inteiro existe para não fazer isso.
//
// Então o vídeo não vira pauta. Ele responde **uma pergunta sobre pauta que já
// existe**: há vídeo recente falando deste assunto?
//
// ============================================================================
// A COTA DECIDE O DESENHO, e ela foi medida ANTES de existir código
// ============================================================================
//
// A YouTube Data API v3 tem **dois** medidores, e o específico aperta muito
// antes do geral:
//
//     10.000 unidades/dia    somando TODOS os endpoints
//        100 search.list/dia    <- teto SEPARADO, e é este que morde
//
// É o mesmo formato do `413` da Groq e do `429` da GDELT. Responder "quantas
// vezes por dia?" contra as 10.000 daria uma falsa folga de 100x.
//
// **Consequência, e é ela que define a arquitetura: UMA busca por clique de
// editor, nunca uma por pauta.** Oito pautas × uma busca cada seriam 8
// chamadas por clique — doze cliques no dia e a cota acabou.
//
// Por isso não perguntamos "tem vídeo sobre a pauta 3?". Pegamos **uma** lista
// dos vídeos recentes do nosso assunto e cruzamos com os termos de TODAS as
// pautas aqui dentro, de graça. É a mesma forma do sinal de aceleração: uma
// consulta, N pautas.
//
// ============================================================================
// ⚠️ OS TRÊS PARÂMETROS QUE PARECEM OPCIONAIS E NÃO SÃO
// ============================================================================
//
// **`type=video`** — sem ele o `search.list` mistura canal, playlist e vídeo.
// Isto não é teoria: o primeiro teste real do dono, no navegador, voltou um
// **canal**, e o radar teria anexado "um canal" a uma pauta.
//
// **`order=date`** — o padrão é `relevance`, que devolve o vídeo mais popular
// de três anos atrás. Para "está falando disso HOJE" isso é a resposta errada
// com cara de certa.
//
// **`publishedAfter`** — sem a janela, `order=date` ainda pode trazer o que
// escapou do filtro de relevância. A janela é o que faz o sinal significar
// "hoje" em vez de "algum dia".
//
// ============================================================================
// O QUE ESTE SINAL NÃO É
// ============================================================================
//
// **Não é confirmação.** O plano é explícito: `tendencia` e `discussao` nunca
// viram `relato` por acumulação. Muita gente falando não é fato. Por isso o
// rótulo diz "vídeos", conta uma coisa contável, e não encosta no campo de
// confiabilidade.
//
// **E não é medida de audiência.** `search.list` devolve o que foi PUBLICADO,
// não o que foi assistido. "4 vídeos hoje" quer dizer que quatro canais
// acharam o assunto digno de vídeo — o que é um sinal honesto e menor do que
// parece.

export type Video = { titulo: string; canal: string; url: string; publicadoEm: string };
export type FalhaDeVideo = { nome: string; motivo: string };

/** Janela da busca. 24h é o que faz o sinal significar "hoje". */
export const JANELA_DE_HORAS = 24;

/** Teto da API por chamada. Mais do que isto ela ignora. */
export const TETO_DE_VIDEOS = 50;

/**
 * **UMA** busca por clique. O teto de `search.list` é 100/dia, e este número
 * é o que separa "o radar tem sinal de vídeo" de "a cota acabou ao meio-dia".
 *
 * Fonte que sobrar deste teto **não** é ignorada em silêncio: ela vira linha
 * em `comFalha` dizendo que ficou de fora e por quê (§4, fallback silencioso).
 */
export const TETO_DE_BUSCAS_POR_CLIQUE = 1;

export const TIMEOUT_DA_BUSCA_MS = 10_000;

/** A API v3 responde JSON com `error.errors[].reason` — é ele que diz o motivo. */
export function motivoDaFalha(status: number, corpo: string): string {
  let razao = "";
  try {
    const j = JSON.parse(corpo);
    razao = j?.error?.errors?.[0]?.reason ?? j?.error?.status ?? "";
  } catch { /* corpo que nao e JSON cai no texto cru abaixo */ }

  // Mapa EXPLICITO: o desconhecido mostra o codigo, nao um palpite.
  if (razao === "quotaExceeded" || razao === "dailyLimitExceeded") {
    return "a cota diaria de buscas do YouTube acabou — ela volta amanha";
  }
  if (razao === "keyInvalid" || razao === "badRequest") {
    return "a YOUTUBE_API_KEY foi recusada — confira a chave e a restricao de API";
  }
  if (razao === "accessNotConfigured") {
    return "a YouTube Data API v3 nao esta habilitada neste projeto do Google Cloud";
  }
  return razao ? `HTTP ${status} (${razao})` : `HTTP ${status}`;
}

/**
 * Monta a URL da busca a partir da URL CADASTRADA na fonte.
 *
 * ── Por que a fonte guarda URL inteira, e não só o termo ─────────────────
 *
 * É a convenção de `news_sources`, e ela é imposta por `CHECK`:
 * `url ~* '^https?://'`. As duas buscas amplas do Google News já moram assim.
 * Guardar só o termo exigiria relaxar a regra para um tipo — e regra com
 * exceção por tipo é regra que ninguém confere.
 *
 * ── O que o cadastro NÃO pode decidir, e isto é o ponto ──────────────────
 *
 * `type`, `order` e `publishedAfter` são **sobrescritos aqui**, por cima do
 * que estiver na linha. Quem cadastra escolhe o ASSUNTO; os três parâmetros
 * que decidem se o sinal significa alguma coisa não são configuração.
 *
 * Sem isso, uma fonte cadastrada sem `type=video` traria canal — e o estrago
 * seria exatamente o do primeiro teste real, só que vindo de uma linha de
 * tabela que ninguém releu. Mesma lógica do teto que mora na RPC e não no
 * dropdown (`BANCO.md`, "toda entrada precisa de FAIXA").
 *
 * ── A chave NUNCA entra no banco ─────────────────────────────────────────
 *
 * Ela vem do ambiente e é acrescentada aqui. Segredo em tabela que a equipe
 * lê é segredo compartilhado com a equipe inteira.
 *
 * `agora` entra por parâmetro para o teste poder fixar o relógio — sem isso a
 * asserção sobre `publishedAfter` seria uma corrida com o próprio relógio.
 */
export function montarUrlDaBusca(urlDaFonte: string, chave: string, agora = new Date()): string {
  const u = new URL(urlDaFonte);
  const desde = new Date(agora.getTime() - JANELA_DE_HORAS * 3600_000).toISOString();

  // Os tres que o cadastro nao decide — ver o cabecalho desta funcao.
  u.searchParams.set("type", "video");
  u.searchParams.set("order", "date");
  u.searchParams.set("publishedAfter", desde);

  // Estes o cadastro PODE mudar: sao recorte editorial, nao protecao.
  if (!u.searchParams.has("part")) u.searchParams.set("part", "snippet");
  if (!u.searchParams.has("regionCode")) u.searchParams.set("regionCode", "BR");
  if (!u.searchParams.has("relevanceLanguage")) u.searchParams.set("relevanceLanguage", "pt");
  if (!u.searchParams.has("maxResults")) u.searchParams.set("maxResults", String(TETO_DE_VIDEOS));

  u.searchParams.set("key", chave);
  return u.toString();
}

/**
 * Lê a resposta. **Descarta o que não for vídeo, mesmo com `type=video`.**
 *
 * Isso não é paranoia: o teste real do dono voltou um canal, e confiar no
 * parâmetro é confiar que ninguém vai editá-lo um dia. Um canal escapando para
 * cá entraria como "vídeo" na contagem e o sinal passaria a contar outra coisa,
 * sem nada estourar.
 */
export function lerRespostaDaBusca(texto: string, teto = TETO_DE_VIDEOS): Video[] {
  let j: unknown;
  try { j = JSON.parse(texto); } catch { return []; }

  const itens = (j as { items?: unknown[] })?.items;
  if (!Array.isArray(itens)) return [];

  const videos: Video[] = [];
  for (const bruto of itens) {
    const it = bruto as {
      id?: { kind?: string; videoId?: string };
      snippet?: { title?: string; channelTitle?: string; publishedAt?: string };
    };
    if (it?.id?.kind !== "youtube#video" || !it?.id?.videoId) continue;

    const titulo = (it.snippet?.title ?? "").trim();
    if (!titulo) continue;

    videos.push({
      titulo,
      canal: (it.snippet?.channelTitle ?? "").trim(),
      url: `https://www.youtube.com/watch?v=${it.id.videoId}`,
      publicadoEm: it.snippet?.publishedAt ?? "",
    });
    if (videos.length >= teto) break;
  }
  return videos;
}

/**
 * Faz a busca. **Falha aqui não derrota o radar** — mesma regra do coletor de
 * feed e do sinal de aceleração: enfeite informativo não custa as pautas.
 *
 * O teto de 1 busca por clique é aplicado AQUI e não no chamador, pelo mesmo
 * motivo que a faixa de `p_days` mora na RPC e não no dropdown: o lugar que
 * conhece a cota é o lugar que tem de impô-la.
 */
export async function buscarVideos(
  fontes: { nome: string; url: string }[],
  chave: string | undefined,
  buscar: (url: string, tetoMs?: number) => Promise<{ ok: boolean; status: number; texto: string }>,
  agora = new Date(),
): Promise<{ videos: Video[]; comFalha: FalhaDeVideo[] }> {
  const comFalha: FalhaDeVideo[] = [];
  if (!fontes.length) return { videos: [], comFalha };

  // Sem chave o sinal simplesmente NAO EXISTE, e isso e dito. O radar inteiro
  // continua funcionando — foi assim que a Fase 4 pode entrar sem virar
  // dependencia dura de um segredo que pode nao estar configurado.
  if (!chave) {
    return {
      videos: [],
      comFalha: [{ nome: "YouTube", motivo: "YOUTUBE_API_KEY nao esta configurada — o sinal de video fica de fora" }],
    };
  }

  const usadas = fontes.slice(0, TETO_DE_BUSCAS_POR_CLIQUE);
  for (const sobrando of fontes.slice(TETO_DE_BUSCAS_POR_CLIQUE)) {
    comFalha.push({
      nome: sobrando.nome,
      motivo: `fora desta busca: o teto e ${TETO_DE_BUSCAS_POR_CLIQUE} consulta por clique `
            + "(a API permite so 100 search.list por dia)",
    });
  }

  const videos: Video[] = [];
  for (const f of usadas) {
    try {
      const r = await buscar(montarUrlDaBusca(f.url, chave, agora), TIMEOUT_DA_BUSCA_MS);
      if (!r.ok) { comFalha.push({ nome: f.nome, motivo: motivoDaFalha(r.status, r.texto) }); continue; }
      const lidos = lerRespostaDaBusca(r.texto);
      if (!lidos.length) { comFalha.push({ nome: f.nome, motivo: "nenhum video na janela de 24h" }); continue; }
      videos.push(...lidos);
    } catch (e) {
      comFalha.push({ nome: f.nome, motivo: e instanceof Error ? e.message : String(e) });
    }
  }
  return { videos, comFalha };
}

/** Tira acento e caixa: "Pokemon" tem de casar com "Pokémon". */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Quantos dos vídeos recentes falam desta pauta.
 *
 * Casa por SUBSTRING no título normalizado, e o termo precisa de 3 caracteres
 * — mesma régua do sinal de aceleração, e pelo mesmo motivo: termo de duas
 * letras casa com tudo e o número vira ruído com cara de medida.
 *
 * **Conta VÍDEO, não casamento.** Um vídeo cujo título bate com três termos da
 * mesma pauta é um vídeo, não três — senão a pauta com mais sinônimos ganharia
 * sozinha, que é exatamente o erro do "score mágico" que o plano recusa.
 */
export function contarVideosDaPauta(termos: string[], videos: Video[]): number {
  const alvos = [...new Set(termos.map((t) => normalizar(t.trim())).filter((t) => t.length >= 3))];
  if (!alvos.length) return 0;
  return videos.filter((v) => {
    const t = normalizar(v.titulo);
    return alvos.some((a) => t.includes(a));
  }).length;
}

/**
 * O rótulo. **Lista fechada e número refazível**, como o da aceleração: quem
 * lê "3 videos hoje" consegue conferir contando, e "87 de relevância" não.
 *
 * Um vídeo só não vira rótulo: um canal qualquer postando sobre o assunto não
 * é sinal de nada, e rótulo que aparece sempre deixa de informar.
 */
export function rotuloDeVideo(quantos: number): string {
  if (quantos < 2) return "";
  return `${quantos} videos hoje`;
}
