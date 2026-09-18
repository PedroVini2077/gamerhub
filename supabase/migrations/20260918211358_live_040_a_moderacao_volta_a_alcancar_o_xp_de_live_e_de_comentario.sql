-- LIVE-040 · `[18/09]` A moderacao volta a alcancar o XP. Achados N8, N9 e N10
-- de uma auditoria externa, e os TRES sao consequencia de mudancas minhas.
--
-- ── N8: eu reabri, ontem, a falha que a SEC-028 tinha fechado ─────────────
--
-- A SEC-028 fechou uma coisa com todas as letras: *"ocultar conteudo era
-- punicao sem efeito — a moderacao tirava o conteudo da tela e o autor ficava
-- com o XP"*.
--
-- A LIVE-036/037 soltou o XP de live do post, para ele sobreviver ao cron que
-- apaga a live 15 minutos depois de encerrar. Isso estava certo. O que eu nao
-- vi e que, ao soltar do POST, soltei tambem da MODERACAO — porque a moderacao
-- age no post, e o XP tinha deixado de olhar para ele.
--
-- Medido antes desta migration:
--
--   ocultar um POST COMUM ..... XP 1 -> 0   (a SEC-028 funciona)
--   ocultar uma LIVE .......... XP 1 -> 1   (nao alcanca)
--   apagar  uma LIVE .......... XP 1 -> 1   (nao alcanca)
--
-- ── N9 e N10: o comentario nao olhava o PAI ──────────────────────────────
--
-- A SEC-028 filtrou `comments.hidden_at`, e parou ai. Um comentario cujo POST
-- foi apagado ou ocultado continuava pagando 3 XP — invisivel na tela, vivo na
-- conta. Mesma regra, meia aplicacao.
--
-- ── A regra que fica escrita, porque as tres vieram de nao te-la ──────────
--
--   XP paga pelo que ESTA NO AR. Conteudo que a moderacao tirou nao paga,
--   **em nenhuma forma** — post, comentario ou live.
--
-- ── Por que INVALIDAR e nao apagar o registro ────────────────────────────
--
-- `lives_realizadas` e a testemunha de que a live aconteceu. Apagar a linha
-- destruiria o fato junto com a punicao, e tornaria a restauracao impossivel.
-- A coluna `invalidada_em` separa "aconteceu" de "conta para XP".
--
-- E ela tem INVERSA, como o BANCO.md exige de toda acao de estado: restaurar o
-- post devolve o XP. Sem isso, um engano da moderacao seria permanente.
--
-- ── A decisao mais importante daqui, e ela e sobre COMO FALHAR ────────────
--
-- A primeira versao invalidava tambem no DELETE fisico, distinguindo cron de
-- moderacao por `auth.uid()` ser NULL. **O teste reprovou** — e o modo como
-- reprovou vale mais que o resultado: `RESET role` nao limpa
-- `request.jwt.claims`, entao o meu "cron" de mentira ainda tinha um admin
-- dentro e invalidou o registro.
--
-- Isso expos a fragilidade do desenho, nao do teste. Se essa suposicao falhar
-- em producao, **todo mundo perde o XP de live 15 minutos depois de cada
-- live**, em silencio, para sempre.
--
-- Entao o DELETE fisico **nao invalida nunca**. Os dois modos de errar nao sao
-- equivalentes:
--
--   nao invalidar quando devia -> um banido guarda XP que nao usa
--   invalidar quando nao devia -> o site inteiro perde XP de live, calado
--
-- `ban_user` apaga conteudo fisicamente, entao o XP de quem foi banido
-- sobrevive. E aceitavel: a conta esta banida.
--
-- ── Provado em ROLLBACK ─────────────────────────────────────────────────
--
--   live de 20 min conta ..................... 1
--   moderacao OCULTA ......................... 0
--   moderacao RESTAURA ....................... 1   (a inversa)
--   cron apaga o post, SEM sessao ............ 1   (o registro sobrevive)
--   comentario em post vivo .................. 1
--   post pai APAGADO ......................... 0   (N9)
--   post pai OCULTO .......................... 0   (N10)

ALTER TABLE public.lives_realizadas ADD COLUMN IF NOT EXISTS invalidada_em timestamptz;
ALTER TABLE public.lives_realizadas ADD COLUMN IF NOT EXISTS invalidada_motivo text;

COMMENT ON COLUMN public.lives_realizadas.invalidada_em IS
  'LIVE-040: a live aconteceu, mas a moderacao tirou o conteudo do ar. Ela continua registrada e para de contar XP. Tem inversa: restaurar o post limpa isto.';

CREATE OR REPLACE FUNCTION public.invalidar_lives_do_post_moderado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_ator uuid := auth.uid(); v_motivo text;
BEGIN
  IF OLD.hidden_at IS NULL AND NEW.hidden_at IS NOT NULL THEN
    -- So quem tem role_rank >= 2 consegue gravar `hidden_at` (o guard do
    -- SEC-027 fixa a coluna para o autor), entao ocultar E sempre moderacao.
    v_motivo := 'ocultada pela moderacao';

  ELSIF OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL THEN
    -- A INVERSA (BANCO.md): restaurar devolve o XP. So desfaz o que ESTA
    -- invalidacao causou — uma live apagada pela equipe continua invalidada.
    UPDATE lives_realizadas SET invalidada_em = NULL, invalidada_motivo = NULL
     WHERE post_id = NEW.id AND invalidada_motivo = 'ocultada pela moderacao';
    RETURN NEW;

  ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
        AND v_ator IS NOT NULL AND v_ator <> NEW.user_id THEN
    -- Apagado por OUTRA pessoa que nao o autor = moderacao. O autor apagando o
    -- proprio post NAO tira o XP: a live aconteceu, e apagar o registro dela
    -- depois nao desfaz o tempo transmitido.
    v_motivo := 'apagada pela equipe';

  ELSE RETURN NEW;
  END IF;

  UPDATE lives_realizadas SET invalidada_em = now(), invalidada_motivo = v_motivo
   WHERE post_id = NEW.id AND invalidada_em IS NULL;
  RETURN NEW;
END;
$fn$;

-- APENAS `AFTER UPDATE`. O DELETE fisico nao dispara isto de proposito — ver o
-- bloco "COMO FALHAR" no topo.
DROP TRIGGER IF EXISTS trg_invalidar_lives_moderadas ON public.posts;
CREATE TRIGGER trg_invalidar_lives_moderadas
  AFTER UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.invalidar_lives_do_post_moderado();

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
-- LIVE-040: `invalidada_em` — a moderacao alcanca o XP de live.
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
-- LIVE-040 (N9/N10): o comentario so conta se o POST PAI estiver no ar. Antes
-- olhava so o proprio `hidden_at` — meia aplicacao da mesma regra.
LEFT JOIN (SELECT c.user_id, COUNT(*) AS comentarios
             FROM comments c JOIN posts po ON po.id = c.post_id
            WHERE c.hidden_at IS NULL
              AND po.deleted_at IS NULL AND po.hidden_at IS NULL
            GROUP BY c.user_id) cc ON cc.user_id = p.id;

COMMENT ON VIEW public.xp_dos_usuarios IS
  'Fonte unica do XP. Regra: paga o que ESTA NO AR. Conteudo que a moderacao tirou nao conta, em nenhuma forma. Nao dar GRANT a anon/authenticated.';
