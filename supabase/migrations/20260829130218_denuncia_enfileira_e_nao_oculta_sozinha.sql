-- ── Denunciar passa a servir para alguma coisa ──────────────────────────────
--
-- Relato do dono: "pra que exatamente a denuncia no site serve? pq o post so
-- vai la pra area de denuncia e a unica coisa que da pra fazer e dispensar".
--
-- Ele estava certo, e a causa era o piso: `mod_report_threshold` = 3. O site
-- tem 5 usuarios. Tres pessoas DIFERENTES precisavam denunciar o mesmo
-- conteudo antes de qualquer coisa acontecer — na pratica, nunca. Enquanto
-- isso o toast prometia "nossa equipe vai revisar em breve", que era falso
-- para o caso comum (§1.5, toda mensagem tem que ser verdadeira).
--
-- Tres decisoes do dono em 29/08:
--
--  1. UMA denuncia ja leva a fila. Com 5 usuarios e o unico piso que funciona.
--  2. E NADA e ocultado automaticamente. Com piso 1, auto-ocultar deixaria
--     qualquer pessoa derrubar qualquer post sozinha. Quem oculta e o
--     moderador, pelo painel — o caminho ja existe e ja funciona
--     (`handleResolve` -> `aplicarOcultacao`).
--  3. O contador ignora denuncia DISPENSADA. Antes ela contava para sempre:
--     tres dispensadas deixavam o contador cravado em 3, e a proxima denuncia
--     ocultava na hora, passando por cima do julgamento humano que ja tinha
--     dito "isto nao e problema".
--
-- A funcao mudou de nome junto porque o nome antigo virou mentira:
-- `handle_report_auto_hide` nao oculta mais nada.
--
-- Testado em ROLLBACK antes de aplicar, quatro casos: uma denuncia enfileira ·
-- nao oculta sozinho · segunda pendente da mesma pessoa e bloqueada ·
-- redenunciar depois de dispensar funciona.

CREATE OR REPLACE FUNCTION public.enfileirar_conteudo_denunciado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $f$
DECLARE
  v_pendentes int;
  v_piso      int;
BEGIN
  -- So PENDENTE conta. Denuncia que um moderador ja avaliou e dispensou nao
  -- pode continuar empurrando o conteudo para a fila.
  SELECT COUNT(*) INTO v_pendentes
    FROM reports
   WHERE content_type = NEW.content_type
     AND content_id   = NEW.content_id
     AND status       = 'pending';

  SELECT COALESCE(value::int, 1) INTO v_piso
    FROM site_config WHERE key = 'mod_report_threshold';

  IF v_pendentes >= COALESCE(v_piso, 1) THEN
    -- Um item por conteudo: item repetido e trabalho repetido para quem revisa.
    IF NOT EXISTS (
      SELECT 1 FROM moderation_queue
       WHERE content_type = NEW.content_type
         AND content_id   = NEW.content_id
         AND status       = 'pending'
    ) THEN
      INSERT INTO moderation_queue (content_type, content_id, trigger_type)
      VALUES (NEW.content_type, NEW.content_id, 'report');
    END IF;
  END IF;

  RETURN NEW;
END;
$f$;

DROP TRIGGER IF EXISTS trigger_report_auto_hide ON reports;
DROP FUNCTION IF EXISTS public.handle_report_auto_hide();

CREATE TRIGGER trigger_enfileira_denuncia
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION public.enfileirar_conteudo_denunciado();

-- Uma denuncia PENDENTE por pessoa e conteudo. A restricao antiga valia para
-- SEMPRE: depois de dispensada, a pessoa nunca mais podia denunciar aquele
-- conteudo, e a mensagem dizia so "voce ja denunciou" — verdadeiro e inutil.
-- Se o conteudo piorou ou foi editado depois, agora da para denunciar de novo.
ALTER TABLE reports DROP CONSTRAINT reports_reporter_id_content_type_content_id_key;

CREATE UNIQUE INDEX reports_uma_pendente_por_pessoa
  ON reports (reporter_id, content_type, content_id)
  WHERE status = 'pending';

UPDATE site_config SET value = '1' WHERE key = 'mod_report_threshold';
