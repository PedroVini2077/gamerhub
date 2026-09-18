-- LIVE-037 · `[18/09]` O XP de live passa a contar do REGISTRO, nao do post —
-- e passa a exigir que a live tenha DURADO.
--
-- ── O que muda, em uma linha ─────────────────────────────────────────────
--
--   antes:  lives = quantos POSTS com was_live existem agora
--   depois: lives = quantas SESSOES registradas duraram >= N minutos
--
-- A primeira some quando o cron apaga o post, 15 minutos depois de encerrar. A
-- segunda nunca some. Ver LIVE-036 para o porque.
--
-- ── A regra de duracao, e por que ela e a certa ──────────────────────────
--
-- Decisao do dono. As alternativas avaliadas:
--
--   so "foi encerrada"  -> abrir e fechar = 30 XP em dois segundos
--   precisa ter CHAT    -> pune quem tem publico pequeno, e dois amigos burlam
--   precisa ter DURADO  -> mede a coisa em si: uma live E tempo no ar
--
-- O que decide e o custo do abuso: burlar duracao exige tempo de relogio REAL
-- **e** deixa um card "AO VIVO" visivel no site o tempo todo. Farm caro e
-- visivel, o oposto do clique — que era gratis e invisivel.
--
-- ── O numero mora no site_config, e NAO no codigo ────────────────────────
--
-- Nao existe uma unica live real neste banco. Entao 10 minutos e raciocinio,
-- nao medicao: curto o bastante para nao punir live rapida legitima, longo o
-- bastante para clicar deixar de compensar.
--
-- Como e chute honesto, ele precisa ser barato de trocar quando houver dado —
-- e `site_config` e onde ja moram os limiares de moderacao.
--
-- ── O piso de leitura NAO e fallback silencioso (§4) ─────────────────────
--
-- `live_minutos_para_xp()` volta 10 quando a chave nao existe, nao e numero, ou
-- esta fora de 1..600. Isso parece o "fallback silencioso" que o §4 proibe, e a
-- diferenca esta em ONDE o erro e recusado:
--
--   na ESCRITA  -> `owner_set_site_config` rejeita valor invalido, com mensagem
--   na LEITURA  -> o piso existe para um valor ruim nunca derrubar o XP de
--                  TODO MUNDO numa tela que so le
--
-- Ou seja: o valor errado e impossivel de gravar, e o piso e defesa em
-- profundidade — nao um palpite escondendo uma chave inexistente.
--
-- ── Provado em ROLLBACK ─────────────────────────────────────────────────
--
--   duas sessoes gravadas: uma de 40 min, uma de 2 min
--   lives que contam ................................... 1  (so a de 40)
--   **depois de APAGAR os posts, lives continua** ...... 1

CREATE OR REPLACE FUNCTION public.live_minutos_para_xp()
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v text; n int;
BEGIN
  SELECT value INTO v FROM site_config WHERE key = 'live_xp_minutos';
  IF v IS NULL THEN RETURN 10; END IF;
  BEGIN n := v::int; EXCEPTION WHEN OTHERS THEN RETURN 10; END;
  IF n < 1 OR n > 600 THEN RETURN 10; END IF;
  RETURN n;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.live_minutos_para_xp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.live_minutos_para_xp() FROM anon;

INSERT INTO public.site_config (key, value) VALUES ('live_xp_minutos','10')
  ON CONFLICT (key) DO NOTHING;

-- A chave nova precisa entrar na RPC, senao o dono nao consegue troca-la — a
-- propria mensagem de erro dela avisa isso.
CREATE OR REPLACE FUNCTION public.owner_set_site_config(p_key text, p_value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NOT is_owner() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;

  -- `IS NULL` antes do `NOT IN`, pela mesma razao do SEC-017.
  IF p_key IS NULL OR p_key NOT IN (
    'banner_enabled', 'banner_text', 'banner_color',
    'maintenance_mode', 'pause_reason',
    'feature_keys', 'feature_lives', 'feature_community',
    'mod_report_threshold', 'mod_suspend_threshold', 'mod_ban_threshold',
    'mod_ai_enabled', 'mod_ai_text_threshold', 'mod_ai_image_threshold',
    'live_xp_minutos'
  ) THEN
    RAISE EXCEPTION 'Chave de configuracao desconhecida: %. Chave nova precisa ser adicionada na RPC e no painel.',
      COALESCE(p_key, '(vazio)');
  END IF;

  IF p_value IS NULL OR length(p_value) > 500 THEN
    RAISE EXCEPTION 'O valor deve ter de 1 a 500 caracteres.';
  END IF;

  -- FAIXA, e nao so tipo (BANCO.md). Sem isto, `live_xp_minutos = 'abc'` seria
  -- gravado e so apareceria como XP silenciosamente errado na tela de todo
  -- mundo — que e o §1.5 exato.
  IF p_key = 'live_xp_minutos' THEN
    IF p_value !~ '^[0-9]+$' OR p_value::int < 1 OR p_value::int > 600 THEN
      RAISE EXCEPTION 'O tempo minimo de live para valer XP deve ser um numero de 1 a 600 minutos.';
    END IF;
  END IF;

  INSERT INTO site_config (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = p_value, updated_at = now(), updated_by = auth.uid();
END;
$fn$;

CREATE OR REPLACE VIEW public.xp_dos_usuarios AS
SELECT p.id AS user_id,
  COALESCE(pc.posts,0)::int        AS posts,
  COALESCE(lv.lives,0)::int        AS lives,
  COALESCE(lc.likes,0)::int        AS likes,
  COALESCE(cc.comentarios,0)::int  AS comentarios,
  (CASE WHEN length(trim(COALESCE(p.bio,'')))        > 0 THEN 50 ELSE 0 END
 + CASE WHEN length(trim(COALESCE(p.avatar_url,''))) > 0 THEN 30 ELSE 0 END
 + CASE WHEN length(trim(COALESCE(p.platform,'')))   > 0 THEN 15 ELSE 0 END
 + CASE WHEN length(trim(COALESCE(p.discord,'')))    > 0 THEN 15 ELSE 0 END
 + CASE WHEN length(trim(COALESCE(p.twitch,'')))     > 0 THEN 15 ELSE 0 END
 + CASE WHEN length(trim(COALESCE(p.youtube,'')))    > 0 THEN 15 ELSE 0 END)::int AS profile_bonus
FROM profiles p
LEFT JOIN (SELECT user_id, COUNT(*) AS posts
             FROM posts WHERE deleted_at IS NULL AND hidden_at IS NULL
            GROUP BY user_id) pc ON pc.user_id = p.id
-- `lives_realizadas` e nao `posts`: o post e apagado, o registro nao (LIVE-036).
LEFT JOIN (SELECT user_id, COUNT(*) AS lives
             FROM lives_realizadas
            WHERE encerrada_em - iniciada_em >= (interval '1 minute' * live_minutos_para_xp())
            GROUP BY user_id) lv ON lv.user_id = p.id
LEFT JOIN (SELECT po.user_id, COUNT(*) AS likes
             FROM post_likes l JOIN posts po ON po.id = l.post_id
            WHERE po.deleted_at IS NULL AND po.hidden_at IS NULL
              AND l.user_id <> po.user_id
            GROUP BY po.user_id) lc ON lc.user_id = p.id
LEFT JOIN (SELECT user_id, COUNT(*) AS comentarios
             FROM comments WHERE hidden_at IS NULL
            GROUP BY user_id) cc ON cc.user_id = p.id;

COMMENT ON VIEW public.xp_dos_usuarios IS
  'SEC-028 + LIVE-037: fonte unica do XP. Live conta de lives_realizadas, com duracao minima. Nao dar GRANT a anon/authenticated.';
