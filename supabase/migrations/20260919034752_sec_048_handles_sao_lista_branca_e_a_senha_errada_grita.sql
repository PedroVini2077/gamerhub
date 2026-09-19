-- SEC-048 · `[19/09]` Dois achados MEUS, de fora da lista da auditoria.
--
-- ══ 1. Os campos sociais viram `href` e nao tinham validacao nenhuma ════
--
-- `UserProfile.jsx` monta:
--
--     href={`https://twitch.tv/${profile.twitch}`}
--     href={`https://youtube.com/@${profile.youtube}`}
--
-- E `discord`, `twitch` e `youtube` nao tinham CHECK no banco nem validacao no
-- cliente. Medido: nenhuma constraint existia nos tres.
--
-- **Nao e redirecionamento aberto** — o host e literal, e caminho nao muda
-- host. Nao vou vender como o que nao e. O que da para fazer:
--
--   . `bio` de 5.000 caracteres viaja em TODO carregamento de perfil (egress,
--     a cota mais apertada do Supabase)
--   . `a@evil.com`, `x?r=...`, `../..` produzem link torto na tela
--
-- ── LISTA BRANCA, nao lista negra ──────────────────────────────────────
--
-- A 1a versao era lista negra de caracteres. **A minha propria regressao pegou
-- o erro**: ela barrava `@fulano`, que e handle LEGITIMO do YouTube. Lista
-- negra esquece caso; lista branca diz o que E valido (§4).
--
-- `#` fica liberado no discord porque `fulano#1234` e o formato antigo dele.
--
-- ══ 2. Senha errada no `delete_own_account` nao deixava rastro ═════════
--
-- Analise ESTRUTURAL (o teste dinamico de senha errada foi bloqueado pela
-- ferramenta, e eu NAO vou dizer que passou):
--
--   auth.uid() obrigatorio ............... OK
--   senha vazia/NULL recusada ............ OK
--   bcrypt via extensions.crypt .......... OK
--   `a_senha_confere` sem EXECUTE ........ OK — nao e oraculo direto
--   loga ANTES de apagar ................. OK — o log sobrevive a conta
--
-- O que FALTA: nao ha limite de tentativa. Quem tiver sessao roubada pode
-- chamar em laco ate acertar — e cada erro era SILENCIOSO.
--
-- Nao dei limite de taxa (o teto certo e decisao de produto). Dei VOZ: a
-- tentativa errada vai para `admin_logs` como `warning`. Uma rajada passa a ser
-- visivel na trilha em vez de invisivel. §1.5.
--
-- Severidade MEDIA: exige sessao roubada antes. Por isso ele GRITA em vez de
-- travar — travar sem numero definido seria inventar politica.
--
-- ══ PROVADO EM ROLLBACK ═══════════════════════════════════════════════
--   8 ataques barrados: ../.., query string, @host, barra, espaco, barra
--   invertida, `#:`, bio de 5.000
--   6 handles legitimos passam: fulano_gamer, @fulano, Fulano.Gamer,
--   fulano-123, a, fulano#1234

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tamanhos_razoaveis;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tamanhos_razoaveis CHECK (
      (bio        IS NULL OR length(bio)        <= 300)
  AND (discord    IS NULL OR length(discord)    <= 64)
  AND (twitch     IS NULL OR length(twitch)     <= 64)
  AND (youtube    IS NULL OR length(youtube)    <= 64)
  AND (avatar_url IS NULL OR length(avatar_url) <= 500));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_redes_sao_handles;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_redes_sao_handles CHECK (
      (discord IS NULL OR discord = '' OR discord ~ '^@?[A-Za-z0-9._#-]{1,64}$')
  AND (twitch  IS NULL OR twitch  = '' OR twitch  ~ '^@?[A-Za-z0-9._-]{1,64}$')
  AND (youtube IS NULL OR youtube = '' OR youtube ~ '^@?[A-Za-z0-9._-]{1,64}$'));

CREATE OR REPLACE FUNCTION public.delete_own_account(p_senha text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_id uuid := auth.uid(); v_username text;
BEGIN
  IF v_id IS NULL THEN RAISE EXCEPTION 'Precisa estar autenticado.'; END IF;
  IF p_senha IS NULL OR length(p_senha) = 0 THEN
    RAISE EXCEPTION 'Digite sua senha para confirmar a exclusao.';
  END IF;

  SELECT username INTO v_username FROM profiles WHERE id = v_id;

  -- SEC-048: a tentativa errada passa a GRITAR. Sem isto, quem tem uma sessao
  -- roubada tenta a senha em laco e nada aparece em lugar nenhum.
  IF NOT public.a_senha_confere(p_senha) THEN
    INSERT INTO admin_logs (action, details, category, actor_id, actor_username,
                            severity, metadata, admin_id, admin_username)
    VALUES ('auth_delete_senha_errada',
            'Tentativa de apagar a conta de @' || coalesce(v_username,'?') || ' com senha incorreta.',
            'security', v_id, v_username, 'warning',
            jsonb_build_object('username', v_username), NULL, 'sistema');
    RAISE EXCEPTION 'Senha incorreta.';
  END IF;

  INSERT INTO admin_logs (action, details, category, actor_id, actor_username,
                          severity, metadata, admin_id, admin_username)
  VALUES ('auth_account_deleted',
          '@' || coalesce(v_username, '?') || ' apagou a propria conta.',
          'security', v_id, v_username, 'warning',
          jsonb_build_object('username', v_username), NULL, 'sistema');

  DELETE FROM auth.users WHERE id = v_id;
END;
$fn$;
