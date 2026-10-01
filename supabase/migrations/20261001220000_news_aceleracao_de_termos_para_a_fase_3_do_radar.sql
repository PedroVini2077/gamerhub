-- `[01/10]` FASE 3 do radar: o sinal de "está pegando fogo" sai do NOSSO
-- histórico, porque as duas fontes que o plano previa estão mortas.
--
-- POR QUE A FONTE MUDOU, e foi medido
--
--   `TimelineVol` do GDELT  -> a GDELT foi DESLIGADA em 01/10: sete
--                              tentativas, dois IPs, zero sucessos. O teto
--                              dela é por IP e saímos de IP compartilhado.
--   Google Trends           -> REJEITADO na auditoria de 01/10 por trazer
--                              loteria e futebol. O dono reclamou disso em
--                              texto: "não tem nenhuma cara de GamerHub".
--
-- Dizer "a Fase 3 não dá" seria verdade e inútil. O valor dela é um SINAL DE
-- ACELERAÇÃO anexado ao evento, e `news_items_raw` já tem com que produzi-lo:
-- 772 itens em 5 dias distintos, de 17 fontes.
--
-- O sinal medido antes de escrever isto:
--
--   Gears of War / E-Day    25/09:  1     28/09:  2     01/10: 16
--
-- O QUE ISTO NÃO É, e a diferença importa para quem lê a tela
--
-- Não é Trends. Trends mede o MUNDO PROCURANDO; isto mede OS VEÍCULOS QUE NÓS
-- ESCOLHEMOS PUBLICANDO. É um sinal mais estreito e mais honesto: "a imprensa
-- de games está falando mais disso hoje do que ontem" — não "o Brasil está
-- buscando isso".
--
-- AS FAIXAS, porque tipo não é faixa (regra do BANCO.md)
--
-- `p_janela_dias` sem teto aceitaria 36500, e `p_termos` sem teto aceitaria
-- dez mil `ILIKE`. Nenhum dos dois é brecha com 772 linhas, mas é a mesma
-- disciplina que fez uma suspensão de "alguns dias" virar o ano 2126.
--
-- E o `%` É ESCAPADO: os termos vêm do MODELO, e um `%` solto casaria com
-- tudo, inflando a contagem em silêncio. Não é injeção (é parâmetro), é
-- resultado absurdo apresentado como medição.

CREATE OR REPLACE FUNCTION public.news_aceleracao_de_termos(
  p_termos text[],
  p_janela_dias integer DEFAULT 7
) RETURNS TABLE (termo text, hoje bigint, antes bigint, desde date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT t.termo,
         count(r.id) FILTER (WHERE r.coletado_em >= current_date)::bigint,
         count(r.id) FILTER (WHERE r.coletado_em <  current_date)::bigint,
         min(r.coletado_em)::date
    FROM unnest(p_termos[1:20]) AS t(termo)
    LEFT JOIN news_items_raw r
      ON r.coletado_em > now() - make_interval(days => least(greatest(coalesce(p_janela_dias, 7), 1), 30))
     AND length(btrim(t.termo)) >= 3
     -- `\` escapa `%` e `_`, que o modelo pode escrever sem querer.
     AND r.titulo ILIKE '%' || replace(replace(btrim(t.termo), '%', '\%'), '_', '\_') || '%'
   GROUP BY t.termo;
$fn$;

-- Só o cron e a Edge Function (service role) chamam. Nenhuma tela precisa, e
-- função que varre manchete aberta a `authenticated` é superfície sem dono.
REVOKE ALL ON FUNCTION public.news_aceleracao_de_termos(text[], integer)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.news_aceleracao_de_termos(text[], integer) IS
  'FASE 3 do radar: quantas vezes cada termo apareceu HOJE contra os dias '
  'anteriores, em news_items_raw. Substitui o TimelineVol do GDELT, que foi '
  'desligado por teto de IP. Mede os veiculos que assinamos publicando, nao '
  'o mundo procurando.';
