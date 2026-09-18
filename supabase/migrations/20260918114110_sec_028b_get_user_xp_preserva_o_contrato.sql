-- SEC-028b · `[18/09]` Conserto de uma regressao que EU acabei de introduzir
-- na SEC-028, encontrada conferindo o contrato em vez de confiar nele.
--
-- Ao trocar o corpo por `SELECT ... FROM xp_dos_usuarios WHERE user_id = $1`, um
-- id sem linha passou a devolver **NULL**, e antes devolvia `{"xp":0,...}`.
--
-- Duas coisas quebravam, e a segunda e a que importa:
--
-- 1. **Contrato.** `Ranks.jsx` le `xpData.posts` direto. Objeto virando `null`
--    e a diferenca entre "0 XP" e uma tela quebrada.
--
-- 2. **Oraculo de existencia (achado 14).** O relatorio marcou como 🟡 e o
--    pedido foi explicito: *"nao classifique automaticamente como
--    vulnerabilidade"*. Ele era FRACO de proposito — conta real sem atividade e
--    uuid inexistente devolviam o mesmo `0`, entao a resposta nao distinguia.
--    Devolver `NULL` para um e objeto para o outro transformaria um achado que
--    eu avaliei como nao-vulneravel num oraculo **limpo**. Seria fechar 14
--    achados e abrir o 15o com a propria correcao.
--
-- O `COALESCE` restaura os dois: mesma forma de antes, mesma ambiguidade de
-- antes.

CREATE OR REPLACE FUNCTION public.get_user_xp(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
       'xp',            v.posts*20 + v.lives*30 + v.likes*5 + v.comentarios*3 + v.profile_bonus,
       'posts',         v.posts,
       'likes',         v.likes,
       'comments',      v.comentarios,
       'lives',         v.lives,
       'profile_bonus', v.profile_bonus)
     FROM xp_dos_usuarios v WHERE v.user_id = p_user_id),
    jsonb_build_object('xp',0,'posts',0,'likes',0,'comments',0,'lives',0,'profile_bonus',0));
$fn$;
