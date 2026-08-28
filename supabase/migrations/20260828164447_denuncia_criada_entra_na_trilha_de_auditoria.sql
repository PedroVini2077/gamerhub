-- Denúncia passa a deixar rastro na trilha.
--
-- A decisão original era não logar: qualquer pessoa denuncia, e o receio era
-- inflar `admin_logs` com ruído. O dono reavaliou em 28/08 e pediu o log.
--
-- E o receio se inverteu no caminho: **denúncia é a única ação de moderação que
-- não deixava rastro nenhum.** Ocultar, suspender, banir, aprovar na fila — tudo
-- registra. A denúncia, que é o gatilho de boa parte disso, sumia. Quando um
-- conteúdo aparecia na fila, a trilha não sabia dizer se veio da IA, da wordlist
-- ou de alguém denunciando.
--
-- Sobre o volume: `admin_logs` já tem retenção agendada (`cleanup_old_data`), e
-- com 4 usuários o risco de enxurrada é teórico. Se um dia virar ruído de fato,
-- o caminho é o mesmo já usado no `registrar_falha_de_edge_function` — uma linha
-- por hora por tipo — e não voltar ao silêncio.
--
-- Trigger, e não uma chamada no `createReport` do frontend: o site entrega a
-- `anon key`, então qualquer um insere em `reports` direto pela REST API. Log
-- que depende do cliente chamar é log que o cliente escolhe não gerar.
CREATE OR REPLACE FUNCTION public.log_report_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_username text;
BEGIN
  SELECT username INTO v_username FROM profiles WHERE id = NEW.reporter_id;
  INSERT INTO admin_logs
    (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('content_report_created',
    '@' || COALESCE(v_username, 'desconhecido') || ' denunciou ' || NEW.content_type ||
      ' (' || NEW.reason || ')',
    'moderation', NEW.reporter_id, COALESCE(v_username, 'desconhecido'), 'info',
    jsonb_build_object('content_type', NEW.content_type, 'content_id', NEW.content_id,
                       'reason', NEW.reason, 'report_id', NEW.id),
    NULL, 'sistema');
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_log_report_created ON public.reports;
CREATE TRIGGER trg_log_report_created
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.log_report_created();