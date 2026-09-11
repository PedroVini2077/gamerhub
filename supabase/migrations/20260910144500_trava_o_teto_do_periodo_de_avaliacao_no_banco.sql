-- ============================================================================
-- A TRAVA do SEC-008 — o teto do trial deixa de depender da função
-- ============================================================================
--
-- A migration anterior pôs faixa nos parâmetros de `review_staff_nomination` e
-- `decide_staff_trial`. Isso conserta o caso; esta constraint fecha a CLASSE.
--
-- Pela tabela do §2 do CLAUDE.md, a trava mais forte é a que torna o dado
-- errado **impossível de existir** — e ela é a única que continua valendo se
-- alguém amanhã reescrever a função e esquecer o teto, que é exatamente como
-- este projeto já perdeu a mesma proteção três vezes por lista de papéis
-- escrita à mão.
--
-- Provado em ROLLBACK:
--     1_linhas_existentes  0 linha(s), e o ALTER passou
--     2_trial_absurdo      OK: recusado pela constraint
--     3_trial_de_180       OK: aceito
--
-- Os NULL passam de propósito: uma indicação `pending` ainda não tem trial, e
-- `trial_started_at`/`trial_review_date` só existem depois da aprovação.
-- ============================================================================

ALTER TABLE public.staff_nominations
  ADD CONSTRAINT staff_nominations_trial_max_365d
  CHECK (
    trial_review_date IS NULL OR trial_started_at IS NULL
    OR trial_review_date <= trial_started_at + interval '365 days'
  );

COMMENT ON CONSTRAINT staff_nominations_trial_max_365d ON public.staff_nominations IS
  'SEC-008: o periodo de avaliacao de staff nao passa de 365 dias contados do inicio. '
  'Trial que vence longe demais e promocao definitiva com outro nome — e nada cobra o '
  'vencimento por maquina (nao ha cron sobre trial_review_date), so uma pessoa olhando '
  'o TrialCard do painel.';
