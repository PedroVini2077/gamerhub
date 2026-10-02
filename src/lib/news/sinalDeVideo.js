/**
 * `[02/10]` FASE 4 do radar — o sinal de "tem vídeo falando disso hoje?".
 *
 * ── O que ele mede, e a diferença importa ─────────────────────────────────
 *
 * `search.list` devolve o que foi **PUBLICADO**, não o que foi assistido.
 * "3 videos hoje" quer dizer que três canais acharam o assunto digno de
 * vídeo nas últimas 24h — um sinal honesto e **menor** do que parece, e é
 * por isso que a dica fala em "publicaram" e nunca em "views" ou "assistido".
 *
 * ── Por que ele NÃO encosta na confiabilidade ─────────────────────────────
 *
 * O plano é explícito: *"`tendencia` e `discussao` nunca viram `relato` por
 * acumulação"*. Muita gente falando não é fato. Título de vídeo é qualquer
 * pessoa com uma conta; manchete de veículo é alguém que assinou embaixo.
 * Por isso o vídeo é um selo próprio, ao lado, e nunca altera o outro.
 *
 * ── A outra metade está em `radar-de-pautas/youtube.ts` ───────────────────
 *
 * Duas cópias do mesmo formato, e `radarSinalDeVideo.test.js` reprova se
 * divergirem. O lado perigoso é o servidor mudar o texto e a tela descartar:
 * o selo some e nada estoura (§1.5).
 */

/** `3 videos hoje`. O servidor conta; a tela só confere a forma. */
const FORMA = /^(\d{1,3}) videos hoje$/;

/**
 * Traduz o sinal cru num selo desenhável, ou `null`.
 *
 * `null` para o desconhecido é a mesma regra da editoria, da confiabilidade e
 * da aceleração — e aqui ela também é defesa: texto livre do servidor indo
 * para uma `className` é como isso vira XSS de classe em outro projeto.
 */
export function seloDeVideo(video) {
  if (typeof video !== 'string' || !video) return null;
  const m = video.match(FORMA);
  if (!m) return null;
  return {
    rotulo: video,
    dica: `${m[1]} canais publicaram vídeo sobre este assunto nas últimas 24 horas. `
        + 'Mede o que foi PUBLICADO, não o que foi assistido — e não confirma nada.',
    classe: 'text-red-400/70',
  };
}
