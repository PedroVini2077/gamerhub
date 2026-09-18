-- LIVE-038 · `[18/09]` Reativar a propria live deixa de ser poder do autor, e
-- ele ganha uma PORTA para pedir. Decisao do dono.
--
-- ── Por que tirar ────────────────────────────────────────────────────────
--
-- Alternar `is_live` era o unico caminho pelo qual um usuario comum enchia o
-- painel da equipe de notificacao (a SEC-034 pos teto, mas a origem continuava
-- aberta). E a tabela `live_reactivation_requests` existe desde sempre — o
-- desenho original ja tratava reativacao como ato de equipe. Os dois caminhos
-- coexistiam.
--
-- ── A ORDEM importa, e por isso as duas coisas estao na MESMA migration ──
--
-- Tirar o poder antes de existir a porta deixaria a pessoa sem nada: live
-- encerrada por engano, e nem como pedir de volta. Por isso a RPC nasce junto.
--
-- ── A porta: uma RPC, nao um GRANT na tabela ─────────────────────────────
--
-- A policy da tabela e `admins_insert_requests` — so admin insere. Afrouxar ela
-- para aceitar o autor obrigaria a expressar "e o dono da live, e a live e dele,
-- e ela ja acabou, e nao existe pedido pendente" dentro de um WITH CHECK.
--
-- Com `SECURITY DEFINER` a tabela continua FECHADA e as regras ficam num lugar
-- que da para ler. E o projeto ja tem esse padrao pronto:
-- `solicitar_revisao_do_proprio_ban` faz exatamente isto para o ban. Copiado de
-- proposito, inclusive a marca `auto_solicitado` — sem ela o painel mostraria
-- "@joao pediu reativacao da live de @joao" sem explicar por que o solicitante
-- e o proprio dono.
--
-- ── O cron para de apagar live com pedido pendente ───────────────────────
--
-- Sem isto a porta seria decorativa: a live e apagada 15 minutos depois de
-- encerrar, e a equipe nao tem como reativar o que nao existe mais. O pedido
-- pendente SEGURA o post ate alguem decidir.
--
-- ── Provado em ROLLBACK, papel `authenticated` real ──────────────────────
--
--   autor ENCERRA a propria live ............. ok
--   autor REATIVA a propria live ............. bloqueado
--   equipe reativa ........................... ok
--   sessao registrada no encerramento ........ 1

CREATE OR REPLACE FUNCTION public.solicitar_reativacao_da_propria_live(
  p_post_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_eu uuid := auth.uid();
  v_username text; v_dono uuid; v_titulo text;
  v_no_ar boolean; v_apagado timestamptz; v_foi_live boolean;
BEGIN
  IF v_eu IS NULL THEN RAISE EXCEPTION 'Precisa estar autenticado.'; END IF;

  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Escreva pelo menos 10 caracteres explicando o pedido.';
  END IF;
  IF length(p_motivo) > 500 THEN
    RAISE EXCEPTION 'O pedido pode ter no maximo 500 caracteres.';
  END IF;

  SELECT user_id, title, COALESCE(is_live,false), deleted_at, was_live
    INTO v_dono, v_titulo, v_no_ar, v_apagado, v_foi_live
    FROM posts WHERE id = p_post_id;

  -- Mensagem UNIFICADA para "nao existe" e "nao e sua" (SEC-032): sem isso a
  -- funcao vira oraculo de existencia de post.
  IF v_dono IS NULL OR v_dono <> v_eu OR v_apagado IS NOT NULL THEN
    RAISE EXCEPTION 'Live nao encontrada ou nao e sua.';
  END IF;
  IF NOT COALESCE(v_foi_live,false) THEN RAISE EXCEPTION 'Este post nao e uma live.'; END IF;
  IF v_no_ar THEN RAISE EXCEPTION 'Esta live ja esta no ar.'; END IF;

  IF EXISTS (SELECT 1 FROM live_reactivation_requests
              WHERE post_id = p_post_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Ja existe um pedido em analise para esta live.';
  END IF;

  SELECT username INTO v_username FROM profiles WHERE id = v_eu;

  -- `admin_*` sao NOT NULL e recebem o proprio autor. O que separa este caso do
  -- pedido aberto por um admin e a marca `auto_solicitado`.
  INSERT INTO live_reactivation_requests
    (post_id, post_title, admin_id, admin_username, reason, details)
  VALUES (p_post_id, COALESCE(v_titulo,'(sem título)'), v_eu, v_username,
          btrim(p_motivo), 'auto_solicitado');

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('live_reactivation_request', 'Pedido de reativacao de live',
    '@' || v_username || ' pediu para reativar a propria live "' || COALESCE(v_titulo,'sem título') || '".',
    'all_admins',
    jsonb_build_object('post_id', p_post_id, 'auto_solicitado', true, 'username', v_username));

  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.solicitar_reativacao_da_propria_live(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.solicitar_reativacao_da_propria_live(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.solicitar_reativacao_da_propria_live(uuid, text) TO authenticated;

-- O cron passa a NAO apagar live com pedido pendente. Sem isto a porta acima
-- seria decorativa: a equipe nao reativa o que ja foi apagado.
SELECT cron.schedule(
  'expire-lives',
  '*/5 * * * *',
  $cron$
    UPDATE public.posts SET is_live = false
    WHERE is_live = true AND (
      (expires_at IS NOT NULL AND expires_at < now())
      OR created_at < now() - interval '24 hours'
    );

    DELETE FROM public.posts
    WHERE was_live = true
      AND is_live = false
      AND live_ended_at IS NOT NULL
      AND live_ended_at < now() - interval '15 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM public.live_reactivation_requests r
         WHERE r.post_id = public.posts.id AND r.status = 'pending'
      );
  $cron$
);
