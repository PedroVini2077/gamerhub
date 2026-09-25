-- NEWS — o corte de permissão editorial. DECISÃO DELE em 25/09, saída "B".
--
-- Antes: `is_staff()` criava, editava E publicava. Agora:
--
--   criar rascunho · editar · mandar revisar ...... admin, super admin, owner
--   PUBLICAR (e AGENDAR) .......................... só super admin e owner
--   editar o que JÁ ESTÁ NO AR ..................... só super admin e owner
--   apagar ......................................... só super admin e owner
--
-- POR QUE PUBLICAR É O CORTE. Rascunho é reversível; publicado é a voz do
-- GamerHub falando com todo mundo, e erro editorial publicado não desfaz. Quem
-- escreve deixa de ser quem aprova — que é a única coisa que um fluxo editorial
-- de verdade precisa ter.
--
-- POR QUE `scheduled` CONTA COMO PUBLICAR. Agendar é publicar com atraso. Se
-- só `published` fosse guardado, o admin agendaria para daqui a um minuto e o
-- corte viraria enfeite.
--
-- POR QUE EDITAR O QUE ESTÁ NO AR TAMBÉM É DO SUPER. Senão o admin publica
-- texto novo sem revisão nenhuma — basta editar um artigo já aprovado. Seria
-- proteção acidental (§1.3): valeria só enquanto ninguém pensasse nisso.
--
-- A INVERSA EXISTE, e é o que faz o corte funcionar (§5). `in_review` é estado
-- novo: o admin manda para revisão e pode puxar de volta para `draft` sozinho.
-- Sem ele, o admin escreveria e ficaria preso sem caminho — a ação de ida sem
-- volta que esta regra proíbe.
--
-- POR QUE TRIGGER E NÃO POLICY. `WITH CHECK` só enxerga a linha NOVA; guardar
-- "editar o que já está no ar" exige ver a linha VELHA. E policy nega com **0
-- linhas e nenhum erro** (§1.5) — o admin clicaria em publicar e não aconteceria
-- nada. O trigger levanta exceção, e a mensagem chega no toast dizendo o que
-- fazer.
--
-- O guarda só alcança o CLIENTE (`authenticated`/`anon`), do mesmo jeito que o
-- `guard_profile_privileged_cols`: o agendador que um dia virar `scheduled` em
-- `published` roda no servidor e não pode ser barrado pelo próprio guarda.
--
-- PROVADO EM ROLLBACK, papel real, 8 de 8:
--   admin cria rascunho OK · manda revisar OK · PUBLICA bloqueado ·
--   nasce publicado bloqueado · AGENDA bloqueado · edita o que está no ar
--   bloqueado · owner publica OK · owner edita o que está no ar OK

ALTER TABLE news_articles DROP CONSTRAINT news_articles_status;
ALTER TABLE news_articles ADD CONSTRAINT news_articles_status
  CHECK (status = ANY (ARRAY['draft','in_review','scheduled','published','archived']));

CREATE OR REPLACE FUNCTION public.news_guarda_a_publicacao()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $fn$
DECLARE
  -- Os dois estados que colocam (ou vão colocar) o artigo na frente do público.
  NO_AR constant text[] := ARRAY['published','scheduled'];
BEGIN
  -- O guarda é para quem chega pelo navegador. Trabalho de servidor passa.
  IF current_user NOT IN ('authenticated','anon') THEN RETURN NEW; END IF;

  IF NEW.status = ANY(NO_AR) AND NOT is_super() THEN
    RAISE EXCEPTION 'Publicar e do super admin. Mande para revisao (in_review).';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = ANY(NO_AR) AND NOT is_super() THEN
    RAISE EXCEPTION 'Este artigo ja esta no ar. So um super admin edita ou tira do ar.';
  END IF;

  RETURN NEW;
END $fn$;

-- Função de trigger nasce chamável como RPC neste banco (SEC-042). A trava
-- `funcaoDeTriggerNaoEhRpc.test.js` reprova se este REVOKE sumir.
REVOKE EXECUTE ON FUNCTION public.news_guarda_a_publicacao() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER news_guarda_a_publicacao
  BEFORE INSERT OR UPDATE ON news_articles
  FOR EACH ROW EXECUTE FUNCTION public.news_guarda_a_publicacao();
