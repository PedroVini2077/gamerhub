-- `[05/09]` A XP contava curtidas de uma coluna que ninguém mantinha.
--
-- O PROBLEMA. `get_user_xp` fazia `SUM(posts.likes) * 5`. Nada no banco nunca
-- escreveu em `posts.likes`: o único trigger em `post_likes` é o
-- `notify_post_like`, que apenas insere uma notificação. A soma dava 0 para
-- todo mundo, para sempre.
--
-- COMO FOI COMPROVADO. Em transação com ROLLBACK: criado um post, inseridas 3
-- linhas em `post_likes`, e medido — `posts.likes` = 0, `get_user_xp` = 0,
-- `count(*)` em `post_likes` = 3.
--
-- O IMPACTO. A tela de ranks anuncia "Receber um like -> 5 XP", e essa promessa
-- nunca foi cumprida. Não estourava, não logava, nenhum teste quebrava (§1.5).
-- Depois deste conserto o XP de quem já recebeu curtidas SOBE — é a correção de
-- um valor que estava errado para baixo.
--
-- POR QUE ESCAPOU. Este era o TERCEIRO lugar que lia a coluna morta. Os outros
-- dois — `fetchProfileStats` no frontend e `owner_get_metrics` no banco — já
-- tinham sido corrigidos em passadas anteriores, cada um por conta própria.
-- Ninguém perguntou "onde MAIS este padrão existe?" (§1.3, varredura de
-- classe), e a função que sobrou ficou errada sozinha.
--
-- A ESCOLHA. Contar da tabela em vez de criar trigger para manter a coluna.
-- Contador denormalizado exige acertar INSERT e DELETE e desincroniza no
-- primeiro caminho que alguém esquecer — e esta coluna morta é a prova.
--
-- ANTI-FARM. `pl.user_id <> p.user_id` exclui a auto-curtida: "receber um like"
-- é de outra pessoa. Sem isso, curtir o próprio post seria 5 XP por clique.
CREATE OR REPLACE FUNCTION public.get_user_xp(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_post_count    int := 0;
  v_total_likes   int := 0;
  v_comment_count int := 0;
  v_live_count    int := 0;
  v_profile_bonus int := 0;
  v_xp            int;
  v_profile       profiles%rowtype;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

  SELECT COUNT(*) INTO v_post_count FROM posts WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_total_likes
    FROM post_likes pl
    JOIN posts p ON p.id = pl.post_id
   WHERE p.user_id = p_user_id
     AND pl.user_id <> p.user_id;

  SELECT COUNT(*) INTO v_comment_count FROM comments WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_live_count
    FROM posts WHERE user_id = p_user_id AND was_live = true;

  IF v_profile.bio IS NOT NULL AND length(trim(v_profile.bio)) > 0 THEN
    v_profile_bonus := v_profile_bonus + 50;
  END IF;
  IF v_profile.avatar_url IS NOT NULL THEN v_profile_bonus := v_profile_bonus + 30; END IF;
  IF v_profile.platform  IS NOT NULL THEN v_profile_bonus := v_profile_bonus + 15; END IF;
  IF v_profile.discord   IS NOT NULL THEN v_profile_bonus := v_profile_bonus + 15; END IF;
  IF v_profile.twitch    IS NOT NULL THEN v_profile_bonus := v_profile_bonus + 15; END IF;
  IF v_profile.youtube   IS NOT NULL THEN v_profile_bonus := v_profile_bonus + 15; END IF;

  -- Lives já entram como posts (+20); o +30 aqui completa os 50 por live.
  v_xp := (v_post_count * 20)
        + (v_total_likes * 5)
        + (v_comment_count * 3)
        + (v_live_count * 30)
        + v_profile_bonus;

  RETURN jsonb_build_object(
    'xp',            v_xp,
    'posts',         v_post_count,
    'likes',         v_total_likes,
    'comments',      v_comment_count,
    'lives',         v_live_count,
    'profile_bonus', v_profile_bonus
  );
END;
$fn$;

COMMENT ON FUNCTION public.get_user_xp(uuid) IS
  'XP calculado na hora. As curtidas vêm de post_likes (a coluna posts.likes '
  'nunca foi mantida por ninguém) e a auto-curtida não conta.';
