-- SEC-027 · `[18/09]` As colunas de CICLO DE VIDA do post deixam de ser
-- declaradas pelo cliente. Fecha 5 achados do pentest com UM mecanismo.
--
-- ── A causa raiz, e por que ela produziu 5 achados ─────────────────────────
--
-- `authenticated` tinha `UPDATE`/`INSERT` nas 22 colunas de `posts`, e a policy
-- `posts_update` nao tem `WITH CHECK`. O trigger `guard_post_privileged_cols`
-- protegia exatamente TRES colunas — `user_id`, `hidden_at`, `deleted_at` — e
-- **nada sobre live**. Tudo o que sobrou era declaravel por PATCH direto na
-- REST API, pulando o site inteiro:
--
--   GH-XP-LIVE-001/002/011  was_live = true  -> +30 XP sem live nenhuma
--   Achado 8                is_live = true   -> live falsa no ar
--   Achado 9                live_ended_at no passado com is_live = true
--   Achado 10               is_live e was_live manipulaveis em separado
--
-- ── DOIS achados que o pentest NAO viu ────────────────────────────────────
--
-- 1. `was_live` e forjavel no **INSERT**, nao so no PATCH: o `createPost` do
--    cliente manda `was_live: isLive`, entao um POST direto nasce valendo
--    +30 XP. Testar so o PATCH deixava metade do buraco aberto.
--
-- 2. `expires_at` e gravavel pelo autor, e a `cleanup_expired_posts` faz
--    **DELETE de verdade** (nao soft) por ela. Era caminho para destruir
--    conteudo sob moderacao pulando a janela de 30 dias que existe justamente
--    para o admin conseguir restaurar.
--
-- ── O que este trigger faz, e o que ele deliberadamente NAO faz ────────────
--
-- `was_live` passa a ser **derivado e monotonico**: nasce igual a `is_live` e
-- so acende quando a live acende. Nunca vem do cliente.
--
-- `is_live` continua gravavel nos DOIS sentidos pelo autor, e isso e
-- deliberado: o formulario de edicao (`PostCard`) deixa o autor marcar o
-- proprio post como live, e tirar isso seria mudar o produto, nao fechar uma
-- brecha. **Consequencia dita com todas as letras:** marcar a caixa na UI
-- continua valendo 30 XP. Tornar o XP de live dependente de uma live que
-- aconteceu de verdade e decisao de produto, e esta no BACKLOG.
--
-- ── O que NAO foi revogado, e por que revogar QUEBRARIA o site ─────────────
--
-- `hidden_at` e `deleted_at` mantem o `GRANT` para `authenticated`: a moderacao
-- grava `hidden_at` por **UPDATE direto de tabela** (`moderationService.js`,
-- `setHiddenAt`), e admin tambem e `authenticated`. Revogar a coluna teria
-- derrubado o painel — a classe exata do erro do SEC-025, encontrada antes de
-- subir. Quem separa admin de usuario comum aqui e o `role_rank >= 2` do
-- proprio trigger.
--
-- ── Ordem dos triggers, que aqui NAO e detalhe ────────────────────────────
--
-- Em `BEFORE` do mesmo evento o Postgres dispara por ordem ALFABETICA de nome:
--   trg_guard_post_privileged  <  trg_set_live_ended_at  <  trg_wordlist_posts
-- Entao o guard fixa `live_ended_at := OLD` e o `trg_set_live_ended_at` grava
-- `now()` DEPOIS, no encerramento legitimo; e o `trg_wordlist_posts` consegue
-- marcar `hidden_at` num INSERT mesmo com o guard zerando `deleted_at` antes.
--
-- ── Provado em ROLLBACK, papel `authenticated` real, os DOIS lados ─────────
--
--   ATAQUES (antes: todos passavam / depois: todos FECHADOS)
--     PATCH was_live=true .......................... FECHADO
--     PATCH expires_at no passado .................. FECHADO
--     PATCH created_at 5 anos atras ................ FECHADO
--     INSERT nascendo com was_live=true ............ FECHADO
--     INSERT com expires_at no passado ............. FECHADO
--
--   CAMINHOS QUE NAO PODIAM QUEBRAR (§2)
--     autor abre live (INSERT is_live=true) ........ ok, was_live=true
--     autor encerra a propria live ................. 1 linha, live_ended_at gravado
--     autor edita o conteudo ....................... 1 linha, texto trocado
--     admin oculta pelo painel ..................... 1 linha, hidden_at gravado
--
-- Nota de sequenciamento: o `REVOKE` das colunas (segunda camada) NAO entra
-- aqui de proposito. O cliente ainda manda `was_live` no corpo ate o deploy,
-- e revogar antes quebraria publicar post na janela entre migration e deploy.
-- O trigger ja neutraliza o valor; o revoke esta no BACKLOG.

CREATE OR REPLACE FUNCTION public.guard_post_privileged_cols()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE v_comum boolean;
BEGIN
  -- `current_user` e o papel do CLIENTE aqui porque esta funcao NAO e
  -- SECURITY DEFINER. Dentro de uma RPC `SECURITY DEFINER` o papel passa a ser
  -- o dono da funcao, e por isso as RPCs legitimas atravessam este guarda.
  v_comum := current_user IN ('authenticated','anon')
         AND role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2;
  IF NOT v_comum THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.was_live      := COALESCE(NEW.is_live, false);  -- derivado, nunca declarado
    NEW.expires_at    := NULL;   -- so o sistema de lives define validade
    NEW.live_ended_at := NULL;   -- quem grava e o trg_set_live_ended_at
    NEW.created_at    := now();  -- data de nascimento nao se escolhe
    NEW.deleted_at    := NULL;   -- nascer apagado esconderia o post da moderacao
    RETURN NEW;
  END IF;

  NEW.user_id         := OLD.user_id;
  NEW.hidden_at       := OLD.hidden_at;
  NEW.deleted_at      := OLD.deleted_at;
  NEW.created_at      := OLD.created_at;
  NEW.expires_at      := OLD.expires_at;
  NEW.live_kind       := OLD.live_kind;
  NEW.live_kind_label := OLD.live_kind_label;
  NEW.live_ended_at   := OLD.live_ended_at;
  -- Monotonico: uma vez que a live aconteceu, ela aconteceu. E so acende junto
  -- com `is_live` — nunca sozinho, que era o ataque.
  NEW.was_live        := OLD.was_live OR COALESCE(NEW.is_live, false);
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_post_privileged ON public.posts;
CREATE TRIGGER trg_guard_post_privileged
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_post_privileged_cols();
