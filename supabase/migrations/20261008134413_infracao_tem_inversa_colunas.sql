-- As colunas da revogação. Ver o cabeçalho de
-- `20261008133220_infracao_tem_inversa_teste_de_porta.sql` para o diagnóstico.
--
-- `revogada_motivo` é obrigatório quando há revogação: revogação sem motivo é a
-- linha que ninguém consegue explicar seis meses depois.
ALTER TABLE public.violations
  ADD COLUMN IF NOT EXISTS revogada_em     timestamptz,
  ADD COLUMN IF NOT EXISTS revogada_por    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revogada_motivo text;

COMMENT ON COLUMN public.violations.revogada_em IS
  'Quando a infração deixou de contar para a escalada. A linha FICA: revogar nao e apagar, e a trilha precisa continuar legivel.';
COMMENT ON COLUMN public.violations.revogada_por IS
  'Quem revogou. NULL com revogada_em preenchido = revogacao automatica (conteudo restaurado), e o motivo diz qual foi.';

ALTER TABLE public.violations
  ADD CONSTRAINT violations_revogacao_tem_motivo
  CHECK (revogada_em IS NULL OR btrim(coalesce(revogada_motivo, '')) <> '');

-- A escalada passa a filtrar por `revogada_em IS NULL`, então o índice cobre
-- exatamente a consulta que o gatilho faz a cada infração registrada.
CREATE INDEX IF NOT EXISTS violations_user_vivas_idx
  ON public.violations (user_id) WHERE revogada_em IS NULL;
