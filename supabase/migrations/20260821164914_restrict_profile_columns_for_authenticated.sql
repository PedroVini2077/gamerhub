-- Fecha o último vazamento de `profiles`: qualquer usuário LOGADO lia
-- `birth_date` (dado de LGPD) e o histórico de moderação de todo mundo.
-- O vazamento sem login já tinha sido fechado; este exigia conta, mas era real.
--
-- RLS é por LINHA e não distingue coluna, e privilégio de coluna é por PAPEL
-- (não por dono da linha) — então "o dono vê tudo do próprio perfil, mas nada
-- do alheio" não se expressa nem com RLS nem com GRANT sozinho. A saída é
-- restringir a tabela e expor as leituras privilegiadas por RPC SECURITY
-- DEFINER, cada uma com seu próprio controle de acesso.

-- Perfil próprio, completo. Só a linha de auth.uid().
CREATE OR REPLACE FUNCTION public.get_own_profile()
  RETURNS public.profiles
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM profiles WHERE id = auth.uid() $$;

-- Lista completa para o painel admin (precisa dos campos de banimento).
CREATE OR REPLACE FUNCTION public.admin_list_users(p_limit int DEFAULT 1000)
  RETURNS SETOF public.profiles
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY SELECT * FROM profiles ORDER BY role, username LIMIT p_limit;
END $$;

-- Perfil público de outra pessoa. Devolve a IDADE calculada no banco em vez de
-- `birth_date`: a página de perfil mostra a idade, então o dado exposto passa a
-- ser só o que a tela realmente precisa.
CREATE OR REPLACE FUNCTION public.get_public_profile(p_username text)
  RETURNS TABLE(id uuid, username text, avatar_url text, bio text,
                created_at timestamptz, role text, banned boolean,
                state varchar, platform text, favorite_games text,
                discord text, twitch text, youtube text, playstyle text, age int)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.username, p.avatar_url, p.bio, p.created_at, p.role, p.banned,
         p.state, p.platform, p.favorite_games, p.discord, p.twitch, p.youtube, p.playstyle,
         CASE WHEN p.birth_date IS NULL THEN NULL
              ELSE EXTRACT(YEAR FROM age(p.birth_date))::int END
  FROM profiles p WHERE p.username = p_username
$$;

REVOKE ALL ON FUNCTION public.get_own_profile()        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users(int)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(int)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO authenticated;

-- Colunas que continuam legíveis direto na tabela (perfil público, feed,
-- avatar popup). Tudo que ficou de fora só sai por RPC.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, avatar_url, bio, created_at, role, banned,
              state, platform, favorite_games, discord, twitch, youtube,
              playstyle, role_changed_at) ON public.profiles TO authenticated;;
