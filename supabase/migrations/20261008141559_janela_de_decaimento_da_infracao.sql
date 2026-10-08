-- ─────────────────────────────────────────────────────────────────────────────
-- A JANELA DE DECAIMENTO DA INFRAÇÃO — 180 dias
--
-- Decisão dele em 08/10, sobre a minha recomendação. Era o que ficou aberto
-- quando a inversa entrou: a inversa resolve o perdão EXPLÍCITO (alguém
-- restaura o conteúdo, ou um admin tira a suspensão) e não resolve o TEMPO.
--
-- O QUE AINDA ACONTECIA, e foi o que esta migration fecha:
--
--   . quem servia a suspensão inteira MANTINHA os pontos, e a infração
--     seguinte escalava a partir de 8;
--   . a soma não tinha recorte nenhum — cobria a vida inteira da conta;
--   . com limiar de ban em 15, sete advertências espalhadas por dois anos
--     deixavam a pessoa a uma infração do banimento permanente.
--
-- POR QUE 180 DIAS, e por que isso não é chute. Meio ano é longo o bastante
-- para a escalada continuar significando alguma coisa — quem reincide em
-- sequência acumula e escala —, e curto o bastante para que um erro de meio ano
-- atrás pare de pesar. Prazo menor (30, 90) tornaria a escalada quase
-- inofensiva para quem reincide devagar; prazo maior repõe o problema que a
-- janela existe para resolver.
--
-- O VALOR MORA EM `site_config`, junto dos dois limiares que ele já governa.
-- Não é constante escondida no corpo da função: a mesma tela que ajusta
-- `mod_ban_threshold` ajusta este, sem migration e sem mim.
--
-- A JANELA VALE PARA OS DOIS LIMIARES, e isso é escolha. Aplicá-la só à
-- suspensão criaria o caso absurdo de alguém ser BANIDO por pontos que já não
-- contam para suspender — duas réguas discordando sobre o mesmo histórico.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.site_config (key, value)
VALUES ('mod_violation_window_days', '180')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_violation_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total    int;
  v_ban_thr  int;
  v_sus_thr  int;
  v_janela   int;
BEGIN
  SELECT COALESCE(value::int, 180) INTO v_janela
    FROM site_config WHERE key = 'mod_violation_window_days';
  -- Linha ausente OU valor absurdo cai nos 180. `v_janela` entra num
  -- `make_interval`, e aceitar 0 ou negativo faria a janela virar o passado
  -- inteiro ou o futuro — nos dois casos a escalada mentiria em silencio.
  IF v_janela IS NULL OR v_janela < 1 THEN v_janela := 180; END IF;

  -- As DUAS condicoes, e elas sao independentes:
  --   `revogada_em IS NULL`  -> ninguem perdoou esta infracao
  --   `created_at > corte`   -> ela ainda esta dentro da janela
  SELECT COALESCE(SUM(points), 0) INTO v_total
    FROM violations
   WHERE user_id = NEW.user_id
     AND revogada_em IS NULL
     AND created_at > now() - make_interval(days => v_janela);

  SELECT COALESCE(value::int, 15) INTO v_ban_thr FROM site_config WHERE key = 'mod_ban_threshold';
  SELECT COALESCE(value::int, 8)  INTO v_sus_thr FROM site_config WHERE key = 'mod_suspend_threshold';

  IF v_total >= v_ban_thr THEN
    PERFORM apply_mod_auto_ban(NEW.user_id, v_total);
  ELSIF v_total >= v_sus_thr THEN
    PERFORM apply_mod_auto_suspend(NEW.user_id, v_total);
  END IF;

  RETURN NEW;
END;
$function$;
