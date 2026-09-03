-- `sem_analise`: o conteudo foi publicado e a checagem automatica NAO RODOU.
--
-- Por que um tipo proprio, e nao reusar `ai`:
--
-- Os cinco tipos existentes significam todos a mesma coisa — "alguma checagem
-- APONTOU este conteudo". Este significa o oposto: nenhuma checagem conseguiu
-- olhar. Marca-lo como `ai` faria o painel dizer que a IA sinalizou algo quando
-- a IA nem rodou, e mensagem falsa manda o moderador julgar pelo criterio
-- errado (CLAUDE.md §1.5 — toda mensagem tem que ser verdadeira).
--
-- O caso que gera isto hoje: video cuja extracao de quadros falha nos DOIS
-- caminhos (arquivo local e URL do storage). O video fica publicado sem analise
-- nenhuma, e sem este item ninguem jamais saberia disso olhando o painel.
--
-- Decisao do dono em 29/08, com a alternativa registrada: enfileirar apenas
-- quando os dois caminhos falham, para a fila nao encher de conteudo que o
-- plano B ja analisou.
--
-- Mudanca ADITIVA: os cinco tipos antigos seguem valendo. Testado em ROLLBACK
-- antes de aplicar — aceita `sem_analise`, recusa tipo inventado, mantem `ai`.
ALTER TABLE moderation_queue DROP CONSTRAINT moderation_queue_trigger_type_check;

ALTER TABLE moderation_queue ADD CONSTRAINT moderation_queue_trigger_type_check
  CHECK (trigger_type = ANY (ARRAY[
    'report'::text, 'wordlist'::text, 'ai'::text,
    'escalation'::text, 'links'::text, 'sem_analise'::text
  ]));
