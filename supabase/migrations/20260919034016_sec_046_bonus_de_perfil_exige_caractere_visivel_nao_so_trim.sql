-- SEC-046 · `[19/09]` O N3 estava fechado para ESPACO e aberto para UNICODE.
--
-- ══ O QUE O RELATORIO DEU COMO PASS, E POR QUE ELE ERROU SEM CULPA ══════
--
-- N3 ("campos vazios geravam XP de perfil") foi retestado com: strings vazias,
-- strings com ESPACOS, e NULL. Os tres passaram, e o achado virou PASS.
--
-- O teste estava certo; o alcance e que era menor do que parecia:
--
--     trim() do PostgreSQL remove BRANCO ASCII. So isso.
--
-- Medido:
--
--     length(trim('   '))        = 0    <- o que foi testado
--     length(trim(U+200B))       = 1    <- ZERO WIDTH SPACE
--     length(trim(U+00A0))       = 1    <- NO-BREAK SPACE
--     length(trim(U+3000))       = 1    <- IDEOGRAPHIC SPACE
--     length(trim(U+FEFF))       = 1    <- BOM
--     length(trim(U+2060))       = 1    <- WORD JOINER
--
-- ══ EXPLORACAO MEDIDA ══════════════════════════════════════════════════
--
-- Colando um caractere invisivel em bio, avatar_url, discord, twitch e youtube:
--
--     ANTES  ... profile_bonus = 125
--     DEPOIS ... profile_bonus = 0
--
-- Com `platform` (que tem CHECK de lista fechada) o teto seria 140 — o bonus
-- inteiro, sem preencher nada que apareca na tela. E XP conta para
-- `check_staff_eligibility` (>= 1000 vira admin).
--
-- Severidade ALTO: explorável por qualquer conta, sem ferramenta nenhuma —
-- copiar e colar um caractere invisivel no formulario de perfil.
--
-- ══ POR QUE UMA FUNCAO E NAO UM `trim` MAIOR ═══════════════════════════
--
-- Nao da para resolver com trim: `U+200B` nao e "espaco", e categoria Cf
-- (format). Nenhum `trim`/`btrim` o remove, e `[[:space:]]` tambem nao pega.
--
-- `texto_visivel()` responde a pergunta certa e fica em UM lugar, usada pelos
-- seis campos. Antes a regra estava repetida seis vezes na view, e regra
-- repetida seis vezes e regra que diverge (§4).
--
-- ══ O QUE ELA NAO FAZ, dito para ninguem confiar demais ════════════════
--
-- Ela nao valida CONTEUDO: `discord = 'a'` continua pagando 15. Proposital —
-- decidir que "a" nao e discord valido e regra de produto, e um CHECK apertado
-- demais quebraria quem usa nick curto.
--
-- O que ela fecha e o caso em que a TELA MOSTRA VAZIO e o XP paga cheio.
--
-- ══ PROVADO EM ROLLBACK — 16 asercoes ══════════════════════════════════
--   12 casos: ASCII, U+200B, U+00A0, U+3000, U+FEFF, U+2060, mistura, NULL,
--      vazio, texto real, emoji, letra entre espacos
--   ANTES bonus com invisivel = 125 · DEPOIS = 0
--   REGRESSAO perfil de verdade = 140 (o teto, intacto)

CREATE OR REPLACE FUNCTION public.texto_visivel(t text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $fn$
  SELECT COALESCE(length(regexp_replace(t,
    '[' || E'\u0009\u000a\u000b\u000c\u000d \u0085  ᠎'
        || E' -‏  ‪-  ⁠-⁤'
        || E'⁪-⁯　﻿￹-￻' || ']', '', 'g')) > 0, false);
$fn$;

COMMENT ON FUNCTION public.texto_visivel(text) IS
  'SEC-046: sobra algum caractere VISIVEL? `trim` so tira branco ASCII, entao U+200B e companhia passavam por ele e pagavam bonus de perfil sem aparecer na tela.';

CREATE OR REPLACE VIEW public.xp_dos_usuarios AS
SELECT p.id AS user_id,
  COALESCE(pc.posts,0)::int        AS posts,
  COALESCE(lv.lives,0)::int        AS lives,
  COALESCE(lc.likes,0)::int        AS likes,
  COALESCE(cc.comentarios,0)::int  AS comentarios,
  -- SEC-046: era `length(trim(COALESCE(campo,'')))>0`, seis vezes.
  (CASE WHEN texto_visivel(p.bio)        THEN 50 ELSE 0 END
 + CASE WHEN texto_visivel(p.avatar_url) THEN 30 ELSE 0 END
 + CASE WHEN texto_visivel(p.platform)   THEN 15 ELSE 0 END
 + CASE WHEN texto_visivel(p.discord)    THEN 15 ELSE 0 END
 + CASE WHEN texto_visivel(p.twitch)     THEN 15 ELSE 0 END
 + CASE WHEN texto_visivel(p.youtube)    THEN 15 ELSE 0 END)::int AS profile_bonus
FROM profiles p
LEFT JOIN (SELECT user_id, COUNT(*) AS posts
             FROM posts WHERE deleted_at IS NULL AND hidden_at IS NULL
            GROUP BY user_id) pc ON pc.user_id = p.id
LEFT JOIN (SELECT user_id, COUNT(*) AS lives
             FROM lives_realizadas
            WHERE invalidada_em IS NULL
              AND encerrada_em - iniciada_em >= (interval '1 minute' * live_minutos_para_xp())
            GROUP BY user_id) lv ON lv.user_id = p.id
LEFT JOIN (SELECT po.user_id, COUNT(*) AS likes
             FROM post_likes l JOIN posts po ON po.id = l.post_id
            WHERE po.deleted_at IS NULL AND po.hidden_at IS NULL
              AND l.user_id <> po.user_id
            GROUP BY po.user_id) lc ON lc.user_id = p.id
LEFT JOIN (SELECT c.user_id, COUNT(*) AS comentarios
             FROM comments c JOIN posts po ON po.id = c.post_id
            WHERE c.hidden_at IS NULL
              AND po.deleted_at IS NULL AND po.hidden_at IS NULL
            GROUP BY c.user_id) cc ON cc.user_id = p.id;

COMMENT ON VIEW public.xp_dos_usuarios IS
  'Fonte unica do XP. Regra: paga o que ESTA NO AR e o que APARECE. Nao dar GRANT a anon/authenticated.';
