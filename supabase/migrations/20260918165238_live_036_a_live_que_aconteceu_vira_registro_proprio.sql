-- LIVE-036 · `[18/09]` A live que aconteceu passa a ter registro PROPRIO, que
-- nao depende do post continuar existindo.
--
-- ── O problema, e ele nao foi decidido por ninguem ────────────────────────
--
-- O XP deste site nao e um saldo guardado: ele e **contado na hora**, somando
-- as linhas que existem no instante em que a tela abre. `posts * 20`,
-- `lives * 30`, e assim por diante.
--
-- E desde junho um cron apaga FISICAMENTE toda live encerrada ha mais de 15
-- minutos (`20260603011930_auto_delete_ended_lives.sql`).
--
-- As duas decisoes nunca se encontraram. O resultado, medido hoje:
--
--   14h00  fica ao vivo    -> o post existe -> conta +30 XP
--   14h40  encerra a live  -> o post existe -> conta +30 XP
--   14h55  o cron apaga    -> nao existe    -> conta  +0 XP
--
-- **O XP de live deste site dura 15 minutos.** Ninguem escolheu isso; caiu por
-- efeito colateral. Conferido no banco: ZERO lives encerradas ha mais de 15
-- minutos existem.
--
-- ── A decisao do dono, e por que NAO foi "parar de apagar" ────────────────
--
-- Apagar o post e defensavel: ele carrega um `embed_url` de Twitch/YouTube, e
-- quando a transmissao acaba o embed nao mostra mais nada. Manter seria encher
-- o feed de card quebrado. *(O motivo nao esta escrito na migration de junho —
-- isto e leitura, nao fato.)*
--
-- Entao o conserto nao e segurar o post: e **soltar o XP dele**. O post
-- continua sendo apagado, e o que a live FOI fica gravado aqui.
--
-- ── Por que isto NAO e o erro do `posts.likes` ───────────────────────────
--
-- O BANCO.md registra: *"contador desnormalizado exige acertar INSERT e DELETE,
-- e desincroniza no primeiro caminho que alguem esquecer"* — foi por isso que a
-- coluna `posts.likes` foi apagada.
--
-- A diferenca e o que a fonte faz depois. `posts.likes` duplicava uma fonte que
-- **continuava existindo** (`post_likes`), entao as duas divergiam. Aqui a
-- fonte e **apagada de proposito**. Nao ha o que duplicar: esta tabela e a
-- unica testemunha de que a live aconteceu. E registro de evento, nao contador
-- espelhado.
--
-- ── `live_started_at`, e por que `created_at` nao servia ─────────────────
--
-- Duracao precisa do inicio da SESSAO, nao do nascimento do post. Sem essa
-- coluna, uma live reativada pela equipe tres dias depois teria "duracao de
-- tres dias" — e passaria em qualquer regra de tempo minimo.
--
-- ── Uma linha por SESSAO, de proposito ──────────────────────────────────
--
-- Reativar e encerrar de novo grava uma segunda linha. Isso e correto: foram
-- duas transmissoes. E protege sozinho contra abuso — uma reativacao de dois
-- segundos vira uma sessao de dois segundos, que nao passa em regra de duracao.
--
-- ── Sem GRANT para ninguem ──────────────────────────────────────────────
--
-- A regua de papeis do BANCO.md: o publico alcanca FUNCAO, nunca tabela. Quem
-- le e a view de XP, que roda como dono. Se um dia existir tela de "minhas
-- lives", ela nasce como RPC.
--
-- ── Provado em ROLLBACK ─────────────────────────────────────────────────
--
--   live nasce com `live_started_at` .............. ok
--   encerrar grava UMA linha em lives_realizadas .. ok
--   a duracao registrada bate (40 min) ............ ok
--   **o registro SOBREVIVE ao DELETE do post** .... ok

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS live_started_at timestamptz;

COMMENT ON COLUMN public.posts.live_started_at IS
  'LIVE-036: inicio da SESSAO atual de live. Nao e o created_at do post — uma live reativada comeca de novo aqui.';

CREATE TABLE IF NOT EXISTS public.lives_realizadas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- SEM foreign key para `posts`: o post e apagado de proposito, e uma FK
  -- levaria este registro junto — que e exatamente o que esta tabela existe
  -- para impedir.
  post_id      uuid,
  titulo       text NOT NULL,
  live_kind    text,
  iniciada_em  timestamptz NOT NULL,
  encerrada_em timestamptz NOT NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lives_realizadas_fim_depois_do_inicio CHECK (encerrada_em >= iniciada_em)
);

COMMENT ON TABLE public.lives_realizadas IS
  'LIVE-036: a testemunha de que a live aconteceu. O post e apagado 15 min depois de encerrar; isto fica. Uma linha por SESSAO.';

ALTER TABLE public.lives_realizadas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lives_realizadas FROM PUBLIC;
REVOKE ALL ON public.lives_realizadas FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_lives_realizadas_user ON public.lives_realizadas (user_id);

CREATE OR REPLACE FUNCTION public.set_live_ended_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_live,false) THEN NEW.live_started_at := now(); END IF;
    RETURN NEW;
  END IF;

  -- Apagar o post encerra a live (SEC-034), em QUALQUER caminho de apagamento.
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL
     AND COALESCE(OLD.is_live,false) THEN
    NEW.is_live := false;
  END IF;

  IF COALESCE(NEW.is_live,false) = false AND COALESCE(OLD.is_live,false) = true THEN
    NEW.live_ended_at := now();
  ELSIF COALESCE(NEW.is_live,false) = true AND COALESCE(OLD.is_live,false) = false THEN
    NEW.live_ended_at   := NULL;   -- reativou: a live nao terminou (SEC-034)
    NEW.live_started_at := now();  -- e a SESSAO comeca agora, nao no created_at
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_set_live_ended_at ON public.posts;
CREATE TRIGGER trg_set_live_ended_at
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_live_ended_at();

CREATE OR REPLACE FUNCTION public.registrar_live_realizada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF COALESCE(OLD.is_live,false) = true AND COALESCE(NEW.is_live,false) = false THEN
    INSERT INTO lives_realizadas (user_id, post_id, titulo, live_kind, iniciada_em, encerrada_em)
    VALUES (NEW.user_id, NEW.id, COALESCE(NEW.title,'(sem título)'), NEW.live_kind,
            COALESCE(NEW.live_started_at, NEW.created_at),
            COALESCE(NEW.live_ended_at, now()));
  END IF;
  RETURN NEW;
END;
$fn$;

-- AFTER de proposito: so registra transicao que de fato foi gravada. Um BEFORE
-- registraria sessao de UPDATE que a RLS ainda pode recusar.
DROP TRIGGER IF EXISTS trg_registrar_live_realizada ON public.posts;
CREATE TRIGGER trg_registrar_live_realizada
  AFTER UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.registrar_live_realizada();

-- ── Backfill do que DA para saber, e so isso ─────────────────────────────
--
-- Post que ainda existe, foi live e ja encerrou: a duracao sai de
-- `live_ended_at - created_at`. E aproximacao (nao havia `live_started_at`),
-- mas e dado REAL — nao inventa nada.
--
-- As lives ja apagadas pelo cron NAO sao recuperadas: nao existe registro
-- nenhum delas. Quem tinha o bonus perde, e isso esta certo — o numero de antes
-- era o que ia sumir em 15 minutos de qualquer jeito.
INSERT INTO public.lives_realizadas (user_id, post_id, titulo, live_kind, iniciada_em, encerrada_em)
SELECT user_id, id, COALESCE(title,'(sem título)'), live_kind, created_at, live_ended_at
  FROM public.posts
 WHERE was_live AND NOT COALESCE(is_live,false) AND live_ended_at IS NOT NULL
   AND live_ended_at >= created_at;
