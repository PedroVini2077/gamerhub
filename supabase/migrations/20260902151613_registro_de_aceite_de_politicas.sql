-- ─────────────────────────────────────────────────────────────────────────────
-- Registro de aceite das políticas
--
-- Pergunta do dono em 02/09: *"acha uma boa ideia já colocar o check no login
-- ou cadastro pra a pessoa aceitar os termos?"*
--
-- ── Por que a caixinha sozinha não vale nada ────────────────────────────────
--
-- Para a LGPD o que conta não é a pessoa ter marcado: é **conseguir provar
-- depois** que ela marcou, QUAL VERSÃO aceitou, e QUANDO. Uma caixinha que só
-- valida o formulário é teatro — no dia em que alguém questionar, não há o que
-- mostrar. Esta tabela é a prova.
--
-- ── Por que tabela, e não colunas em `profiles` ─────────────────────────────
--
-- 1. **Histórico.** Documento muda, a pessoa reaceita, e as DUAS linhas ficam.
--    Coluna guardaria só a última, e a pergunta jurídica costuma ser sobre a
--    versão antiga.
-- 2. **`profiles` é a tabela mais sensível do projeto.** Ela tem privilégio por
--    COLUNA por papel, e mexer nisso já derrubou o site uma vez (revogar
--    colunas quebrou postar, comentar, mural e chat). Coluna nova ali é
--    revisitar aqueles grants; tabela nova, não.
--
-- ── Append-only DE PROPÓSITO ────────────────────────────────────────────────
--
-- Não existe policy de UPDATE nem de DELETE. Registro de consentimento que
-- pode ser reescrito não prova nada — e a prova é a única razão de ele
-- existir. `ON DELETE CASCADE` no `user_id` é a exceção deliberada: a política
-- promete que apagar a conta apaga os dados, e promessa que o banco não
-- sustenta é promessa falsa.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  documento text NOT NULL,
  versao text NOT NULL,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  -- Lista fechada. O mapa do JS é conferido contra ela por teste de contrato.
  CONSTRAINT policy_acceptances_documento_check
    CHECK (documento IN ('privacidade','regras','termos')),
  -- Faixa e não só tipo (§5): `text` aceitaria "sei la" como versão, e uma
  -- versão que não é data não serve para provar nada.
  CONSTRAINT policy_acceptances_versao_check
    CHECK (versao ~ '^\d{4}-\d{2}-\d{2}$'),
  -- Reaceitar a MESMA versão não cria linha nova; aceitar uma versão nova cria.
  CONSTRAINT policy_acceptances_unico UNIQUE (user_id, documento, versao)
);

COMMENT ON TABLE public.policy_acceptances IS
  'Prova de aceite das politicas: quem, qual documento, qual versao, quando. Append-only.';

ALTER TABLE public.policy_acceptances ENABLE ROW LEVEL SECURITY;

-- A pessoa vê o próprio aceite (é dado dela, e a LGPD dá direito de acesso);
-- a equipe vê todos, que é o que permite responder a um pedido de titular.
CREATE POLICY pa_ve_o_proprio ON public.policy_acceptances
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.is_staff());

-- `WITH CHECK (user_id = auth.uid())` é a linha que impede alguém de forjar
-- aceite em nome de outra pessoa — testado, e é o teste que mais importa aqui.
CREATE POLICY pa_registra_o_proprio ON public.policy_acceptances
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX policy_acceptances_user_idx ON public.policy_acceptances (user_id);

GRANT SELECT, INSERT ON public.policy_acceptances TO authenticated;
REVOKE ALL ON public.policy_acceptances FROM anon;
