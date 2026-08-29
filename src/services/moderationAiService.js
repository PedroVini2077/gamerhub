/**
 * As chamadas de moderação por IA — o cliente das Edge Functions.
 *
 * ── Por que saiu do `moderationService.js` ──────────────────────────────────
 *
 * O arquivo passou de 300 linhas ao ganhar o relato de falha de vídeo (§4), e o
 * corte natural já estava desenhado nele: o resto do `moderationService` fala
 * com TABELAS do Supabase (denúncias, fila, palavras, violações, ocultar), e
 * este bloco fala com EDGE FUNCTIONS por `fetch`. São duas superfícies
 * diferentes, com dois modos de falhar diferentes — a primeira devolve
 * `{ data, error }` e é esperada pela tela; a segunda é fire-and-forget e
 * precisa gritar sozinha (§1.5).
 *
 * Nenhum comportamento mudou nesta separação: é movimentação de código.
 */
import { supabase } from '../lib/supabase';
import { registrarErro } from '../lib/monitoring';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

// Fire-and-forget: texto — não bloqueia o fluxo do usuário.
//
// O `text` NÃO vai mais no corpo: a Edge Function lê o texto direto da linha no
// banco. Mandar o texto daqui era um buraco — bastava enviar o `content_id` de
// um post alheio junto de uma frase ofensiva qualquer para derrubar o post de
// outra pessoa. O parâmetro continua aqui só como guarda de "não tem o que
// moderar" antes de gastar uma chamada.
export async function moderateText(contentType, contentId, text) {
  if (!text?.trim()) return;
  const auth = await getAuthHeader();
  if (!auth) return;
  fetch(`${SUPABASE_URL}/functions/v1/moderate-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify({ content_type: contentType, content_id: contentId }),
  }).catch(() => {});
}

// Fire-and-forget: link — Google Safe Browsing (não bloqueia o fluxo).
export async function moderateLinks(contentType, contentId, url) {
  if (!url?.trim()) return;
  const auth = await getAuthHeader();
  if (!auth) return;
  fetch(`${SUPABASE_URL}/functions/v1/moderate-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify({ content_type: contentType, content_id: contentId, url }),
  }).catch(() => {});
}

/**
 * Fire-and-forget: vídeos, por amostragem de quadros.
 *
 * Vídeo era o único tipo de mídia que subia sem nenhuma checagem. Aqui alguns
 * quadros são extraídos no navegador e mandados **embutidos** para a mesma
 * Edge Function que analisa imagem — reaproveitando a cobertura que ela já tem
 * de nudez, gore e automutilação, por custo de imagem e não de vídeo.
 *
 * `extrairQuadros` é importado sob demanda: ele só existe para quem publica
 * vídeo, e não tem por que pesar no carregamento de quem só lê o feed (§0.3).
 *
 * **Lista vazia é "não analisado", nunca "analisado e limpo".** Por isso o
 * `registrarErro`: sem ele, um vídeo que a extração não conseguisse abrir
 * passaria em silêncio absoluto — nada na tela, nada no log, nenhum teste
 * quebrando (§1.5). É exatamente a forma de falha que manteve a moderação por
 * IA quebrada em 26 de 26 chamadas por semanas.
 */
export async function moderateVideos(contentType, contentId, videoFiles) {
  // `[28/08]` DEVOLVE ESTADO, e o motivo é um buraco real.
  //
  // O dono postou um vídeo às 22:20 e a moderação **não rodou**. A prova está
  // no log da Supabase: `moderate-text` foi chamada para aquele post e
  // `moderate-image` não foi chamada nenhuma vez — ou seja, a falha aconteceu
  // no navegador, antes da rede, e não deixou rastro em lugar nenhum que a
  // gente olhe.
  //
  // A causa mais provável é `extrairQuadros` devolver lista vazia (codec que o
  // `<canvas>` não abre). Mas "mais provável" não basta: o `registrarErro`
  // manda para o Sentry, que é onde ninguém olhou, enquanto TODO o resto da
  // moderação grita em `admin_logs`. Falha silenciosa clássica (§1.5).
  //
  // Não dá para gritar em `admin_logs` daqui: a RPC que registra é
  // `service_role`, e abrir um canal de log chamável pelo cliente seria repetir
  // o erro do `register_login_attempt` — qualquer um forjaria entradas. Então a
  // saída é o outro canal do §1.5: **quem publicou fica sabendo**, e o
  // resultado passa a ser inspecionável por quem chama.
  const resumo = { videos: videoFiles?.length ?? 0, analisados: 0, semQuadros: 0 };
  if (!videoFiles?.length) return resumo;

  const auth = await getAuthHeader();
  if (!auth) return { ...resumo, erro: 'sem_sessao' };

  const { extrairQuadros } = await import('../lib/framesDeVideo');

  for (const arquivo of videoFiles) {
    const { quadros, motivo } = await extrairQuadros(arquivo);
    if (!quadros.length) {
      resumo.semQuadros++;
      // O motivo entra no texto do erro, e não só nos metadados: o Sentry
      // agrupa por mensagem, então "não consegui extrair quadros" jogava
      // causas diferentes na mesma pilha. Separadas, dá para ver qual delas
      // acontece de verdade — que é a pergunta que ficou aberta em 28/08.
      resumo.motivos = [...(resumo.motivos ?? []), motivo];
      registrarErro(new Error(`nao consegui extrair quadros de um video: ${motivo}`), {
        content_type: contentType, content_id: contentId,
        tipo_do_arquivo: arquivo?.type, tamanho: arquivo?.size, motivo,
      });
      // `[29/08]` O TERCEIRO canal, e o unico que sobrevive a sessao.
      //
      // O Sentry acima e o aviso na tela cobriam (a) e (b) do §1.5, mas os dois
      // dependem de alguem estar olhando: o toast some em 6 s e o Sentry e um
      // painel que ninguem abre por diversao. A trilha de `admin_logs` e o
      // lugar onde TODO o resto da moderacao ja grita — a falha do navegador
      // passa a aparecer ao lado das outras, com motivo, tipo do arquivo e
      // agente. Sem isto, "o video nao foi analisado" continua sendo uma
      // informacao que so existe enquanto o dono estiver com a aba aberta.
      enviarParaModerarImagem(auth, {
        content_type: contentType, content_id: contentId,
        falha_de_extracao: { motivo, tipo: arquivo?.type, tamanho: arquivo?.size },
      });
      continue;
    }
    resumo.analisados++;
    enviarParaModerarImagem(auth, { content_type: contentType, content_id: contentId, image_urls: quadros });
  }
  return resumo;
}

function enviarParaModerarImagem(auth, corpo) {
  return fetch(`${SUPABASE_URL}/functions/v1/moderate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify(corpo),
  }).catch(() => {});
}

// Fire-and-forget: imagens (apenas URLs de imagem; vídeo vai por `moderateVideos`).
export async function moderateImages(contentType, contentId, imageUrls) {
  if (!imageUrls?.length) return;
  const auth = await getAuthHeader();
  if (!auth) return;
  fetch(`${SUPABASE_URL}/functions/v1/moderate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth, apikey: SUPABASE_ANON },
    body: JSON.stringify({ content_type: contentType, content_id: contentId, image_urls: imageUrls }),
  }).catch(() => {});
}
