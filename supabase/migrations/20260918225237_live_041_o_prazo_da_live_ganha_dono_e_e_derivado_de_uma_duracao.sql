-- LIVE-041 · `[18/09]` `expires_at` ganha DONO. A 4a e ultima decisao de live.
--
-- ── O que estava errado, e nao era "falta a feature" ──────────────────────
--
-- `expires_at` era uma feature MEIO CONSTRUIDA, e so o escritor faltava:
--
--   a TELA ja mostrava o prazo .... "ate HH:MM" no card (`LivesList`), e o
--                                   `EmbedPlayer` marca a live como encerrada
--   o CRON ja lia a coluna ........ `expire-lives` e `expire-lives-every-minute`
--   o CLIENTE nao escreve ......... desde a SEC-027 o guard pina a coluna
--
-- Nenhuma linha de `posts` tinha valor ali. Resultado pratico: uma live
-- esquecida no ar ocupa o topo do feed por 24 HORAS com um embed morto, que e
-- o teto do cron — uma regra que existia desde junho e nunca esteve escrita.
--
-- ── O desenho: o cliente declara INTENCAO, o banco calcula o VALOR ────────
--
-- Mesmo principio do `was_live`. O autor escolhe uma DURACAO; o servidor deriva
-- o instante. Dar `expires_at` de volta ao cliente reabriria o achado do
-- pentest — a `cleanup_expired_posts` APAGA DE VERDADE por essa coluna, entao
-- escreve-la e destruir conteudo sob moderacao pulando a janela de 30 dias.
--
-- A faixa e CHECK, nao validacao de tela (§1.3: o site usa a anon key):
--
--     15 min ..... abaixo disso nao e transmissao, e engano de clique
--   1440 min ..... 24h, o MESMO teto que o cron ja impunha. O numero nao e
--                  novo; ele so deixou de ser invisivel
--
-- ── Onde a derivacao mora, e por que NAO no ramo do usuario comum ─────────
--
-- A LIVE-039 foi exatamente este erro: pus a derivacao de `was_live` dentro do
-- ramo `v_comum` e a live criada por ADMIN nasceu com `was_live = false` — o
-- cron nunca a apagaria. A derivacao do prazo vai no bloco de TODO MUNDO.
--
-- Provado: live de admin com 240 min recebe os 240 min (asercao 7).
--
-- ── A REATIVACAO reconta do zero, e isso nao e detalhe ───────────────────
--
-- A equipe reativa uma live encerrada. Se o prazo ficasse congelado no valor
-- antigo, a live voltaria **ja vencida** e o cron a mataria no minuto seguinte:
-- reativar viraria um clique que nao faz nada — §1.5 puro. Por isso o ramo
-- `false -> true` recalcula `now() + duracao`.
--
-- ── O QUE QUASE FOI PARA PRODUCAO, e e a parte que importa ────────────────
--
-- Eu escrevi o modo de seguranca elevado no rascunho desta funcao. Em producao
-- ela roda com o privilegio de QUEM CHAMA, e isso e deliberado: ela le
-- `current_user` para saber quem e. Com o privilegio do DONO, `current_user`
-- vira `postgres`, `v_comum` fica sempre falso e **TODA a pinagem da SEC-027
-- desliga em silencio** — nada estoura, nada loga, e o site volta a aceitar
-- `was_live`, `expires_at` e `deleted_at` forjados por PATCH.
--
-- O teste pegou: as asercoes 9, 10 e 11 reprovaram juntas, e foi ao investigar
-- POR QUE que o `prosecdef = false` de producao apareceu. Sem elas eu teria
-- revertido a SEC-027 inteira num commit que dizia "prazo de live".
--
-- Ha trava para isso agora, em `src/lib/__tests__/prazoDaLive.test.js`.
--
-- ── Provado em ROLLBACK, papel `authenticated` real (11 asercoes) ─────────
--
--   1_duracao_120_vira_prazo ............... OK: 120 min
--   2_sem_duracao_sem_prazo ................ OK: NULL (o de hoje, preservado)
--   3_forjar_expires_at_no_INSERT .......... OK: virou 60 min
--   4_acima_do_teto_24h .................... OK: recusado
--   5_abaixo_do_minimo ..................... OK: recusado
--   6_post_comum_com_duracao ............... OK: NULL
--   7_live_de_ADMIN_tambem_ganha_prazo ..... OK: 240 min   <- a LIVE-039
--   8_reativar_reconta_do_ZERO ............. OK: 240 min
--   9_comum_nao_estica_a_duracao ........... OK: continua 60
--  10_comum_nao_forja_expires_at ........... OK: pinado
--  11_comum_continua_sem_reativar .......... OK: continua encerrada

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS live_duracao_minutos smallint;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_live_duracao_faixa;
ALTER TABLE public.posts ADD CONSTRAINT posts_live_duracao_faixa
  CHECK (live_duracao_minutos IS NULL OR live_duracao_minutos BETWEEN 15 AND 1440);

COMMENT ON COLUMN public.posts.live_duracao_minutos IS
  'LIVE-041: a INTENCAO do autor ("minha live dura 2h"). O valor real fica em expires_at, derivado pelo guard. NULL = sem prazo proprio, e ai vale o teto de 24h do cron expire-lives.';

GRANT INSERT(live_duracao_minutos), UPDATE(live_duracao_minutos), SELECT(live_duracao_minutos)
  ON public.posts TO authenticated;

-- ATENCAO ao modo de seguranca abaixo: ver o bloco "O QUE QUASE FOI PARA
-- PRODUCAO" no topo. Esta funcao roda com o privilegio de QUEM CHAMA de
-- proposito, e ha teste que reprova se alguem trocar isso.
CREATE OR REPLACE FUNCTION public.guard_post_privileged_cols()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE v_comum boolean;
BEGIN
  -- ── DERIVACAO — vale para TODO MUNDO (a licao da LIVE-039) ────────────
  IF TG_OP = 'INSERT' THEN
    NEW.was_live := COALESCE(NEW.is_live, false);
    NEW.expires_at := CASE
      WHEN COALESCE(NEW.is_live,false) AND NEW.live_duracao_minutos IS NOT NULL
        THEN now() + (interval '1 minute' * NEW.live_duracao_minutos)
      ELSE NULL END;
  ELSE
    NEW.was_live := OLD.was_live OR COALESCE(NEW.is_live, false);
    -- Reativacao: o prazo reconta de AGORA, senao a live volta ja vencida.
    IF COALESCE(NEW.is_live,false) AND NOT COALESCE(OLD.is_live,false) THEN
      NEW.expires_at := CASE
        WHEN OLD.live_duracao_minutos IS NOT NULL
          THEN now() + (interval '1 minute' * OLD.live_duracao_minutos)
        ELSE NULL END;
    END IF;
  END IF;

  v_comum := current_user IN ('authenticated','anon')
         AND role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2;
  IF NOT v_comum THEN RETURN NEW; END IF;

  -- ── PINAGEM — so para usuario comum ───────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    NEW.live_ended_at := NULL;
    NEW.created_at    := now();
    NEW.deleted_at    := NULL;
    RETURN NEW;
  END IF;

  NEW.user_id         := OLD.user_id;
  NEW.hidden_at       := OLD.hidden_at;
  NEW.deleted_at      := OLD.deleted_at;
  NEW.created_at      := OLD.created_at;
  NEW.expires_at      := OLD.expires_at;
  -- A duracao e a INTENCAO registrada na abertura. Esticar a propria live
  -- depois seria uma acao nova, com regras proprias — nao um UPDATE de coluna.
  NEW.live_duracao_minutos := OLD.live_duracao_minutos;
  NEW.live_kind       := OLD.live_kind;
  NEW.live_kind_label := OLD.live_kind_label;
  NEW.live_ended_at   := OLD.live_ended_at;
  NEW.live_started_at := OLD.live_started_at;

  -- Reativar e ato de equipe (LIVE-038). O autor ENCERRA; por de volta no ar
  -- passa pelo pedido.
  IF COALESCE(NEW.is_live,false) AND NOT COALESCE(OLD.is_live,false) THEN
    NEW.is_live := OLD.is_live;
  END IF;
  RETURN NEW;
END;
$fn$;
