-- A nota real da IA passa a chegar no painel.
--
-- O PROBLEMA: `p_score` fazia dois trabalhos ao mesmo tempo — decidir se passa
-- do limiar E ser o número gravado. A `moderate-image` manda `p_score = 1` de
-- propósito, porque a decisão dela já foi tomada pelos pisos fixos por
-- categoria e o dial do painel não pode desfazer isso. O efeito colateral é que
-- TODO item de imagem aparecia na fila com "score 1".
--
-- Quem revisa não conseguia distinguir um 0.96 raspando o piso de um 0.99
-- gritante — e são casos com decisões diferentes. A nota verdadeira só existia
-- no log da Edge Function, que serve para ajustar limiar e não para quem está
-- olhando um item da fila agora.
--
-- A CORREÇÃO é separar os dois papéis: `p_score` continua decidindo,
-- `p_score_real` é o que fica registrado. Quando não vier, cai no
-- comportamento antigo — nenhum chamador existente muda de comportamento.
--
-- POR QUE DROP E NÃO CREATE OR REPLACE: `CREATE OR REPLACE` não muda a lista de
-- argumentos; acrescentar um 7º parâmetro criaria uma SOBRECARGA, e aí toda
-- chamada com 6 argumentos ficaria ambígua entre as duas versões. Como as duas
-- coisas acontecem na mesma transação, não existe janela em que a função esteja
-- ausente.
--
-- E o DROP leva os GRANTs junto — por isso eles são refeitos abaixo. Sem isso a
-- função ficaria inexecutável pela `service_role` e a moderação inteira pararia
-- em silêncio, que é exatamente a classe de falha que este projeto persegue.
--
-- Testado em ROLLBACK antes de aplicar: chamada de 6 argumentos continua
-- gravando o score que recebeu; a de 7 grava 0.962 em vez de 1; o texto do log
-- acompanha; e os privilégios voltam para `postgres, service_role`.

DROP FUNCTION public.apply_ai_moderation(text, uuid, double precision, text, text, boolean);

CREATE FUNCTION public.apply_ai_moderation(
  p_content_type text, p_content_id uuid, p_score double precision,
  p_threshold_key text DEFAULT 'mod_ai_text_threshold'::text,
  p_categoria text DEFAULT NULL::text, p_ocultar boolean DEFAULT true,
  p_score_real double precision DEFAULT NULL::double precision)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean; v_threshold float; v_ocultou boolean := false;
  -- A nota que DECIDE (`p_score`) e a nota que se REGISTRA podem ser
  -- diferentes. Sem `p_score_real`, são a mesma — o comportamento antigo.
  v_registrar float;
BEGIN
  SELECT COALESCE(value::boolean, false) INTO v_enabled FROM site_config WHERE key = 'mod_ai_enabled';
  IF NOT v_enabled THEN RETURN; END IF;
  SELECT COALESCE(value::float, 0.7) INTO v_threshold FROM site_config WHERE key = p_threshold_key;
  IF p_score < v_threshold THEN RETURN; END IF;

  v_registrar := COALESCE(p_score_real, p_score);

  IF p_ocultar THEN
    IF p_content_type = 'post' THEN
      UPDATE posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
    ELSIF p_content_type = 'comment' THEN
      UPDATE comments SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
    ELSIF p_content_type = 'mural' THEN
      UPDATE community_posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
    END IF;
    v_ocultou := FOUND AND p_content_type IN ('post','comment','mural');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM moderation_queue
    WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending'
  ) THEN
    INSERT INTO moderation_queue (content_type, content_id, trigger_type, metadata)
    VALUES (p_content_type, p_content_id, 'ai',
            jsonb_build_object('ai_score', v_registrar, 'categoria', p_categoria,
                               'ocultou', v_ocultou));

    -- A trilha precisa distinguir "ocultou" de "so mandou revisar", senao o
    -- log mente sobre o que aconteceu.
    INSERT INTO admin_logs (action, details, category, severity,
                            admin_id, admin_username, actor_id, actor_username, metadata)
    VALUES ('ai_moderation_hidden',
            format('IA %s %s por %s (score %s)',
                   CASE WHEN v_ocultou THEN 'ocultou' ELSE 'enviou para revisão' END,
                   p_content_type, motivo_legivel(p_categoria), round(v_registrar::numeric, 3)),
            'moderation', CASE WHEN v_ocultou THEN 'warning' ELSE 'info' END,
            NULL, 'sistema', NULL, 'sistema',
            jsonb_build_object('content_type', p_content_type, 'content_id', p_content_id,
                               'ai_score', v_registrar, 'categoria', p_categoria,
                               'ocultou', v_ocultou));
  END IF;

  -- So avisa quem teve conteudo REALMENTE ocultado. Mandar "seu post foi
  -- ocultado" para quem so entrou na fila seria mentira.
  IF v_ocultou THEN
    PERFORM avisar_autor_do_ocultamento(p_content_type, p_content_id, p_categoria);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_ai_moderation(text, uuid, double precision, text, text, boolean, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ai_moderation(text, uuid, double precision, text, text, boolean, double precision) TO service_role;
