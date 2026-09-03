-- ─────────────────────────────────────────────────────────────────────────────
-- Idade mínima de 13 anos — agora imposta pelo BANCO, não só pelo navegador
--
-- Decisão do dono em 02/09: *"a idade mínima pode ser 13 anos"*.
--
-- Antes disto o limite existia **só** no atributo `max` do input de data do
-- `RegisterForm`. O site entrega a anon key: qualquer um chamava
-- `PATCH /rest/v1/profiles` com a data que quisesse e pulava o formulário
-- inteiro (§1.3 — validação no cliente não vale nada sozinha).
--
-- ── Por que TRIGGER e não CHECK ─────────────────────────────────────────────
--
-- Não é preferência: `CHECK (birth_date <= current_date - interval '13 years')`
-- é **recusado pelo Postgres**. Expressão de CHECK precisa ser IMMUTABLE, e
-- `current_date` é STABLE — idade é relativa a hoje, e "hoje" muda. Trigger é
-- o único mecanismo que expressa isso.
--
-- ── Dimensionamento antes de aplicar (§5) ───────────────────────────────────
--
--   5 perfis no total · 2 com `birth_date` · **0 com menos de 13 anos**
--
-- Ou seja: nenhuma linha existente passa a violar a regra. O trigger não
-- quebra ninguém que já está dentro.
--
-- ── O que ele deliberadamente NÃO faz ───────────────────────────────────────
--
-- Não impede alguém de MENTIR a data. Nada em software impede — verificação de
-- idade de verdade exige documento, e isso é desproporcional para este site.
-- O que ele garante é que o limite declarado na política de privacidade seja
-- verdade no sistema, e não só no formulário. Promessa que o banco não sustenta
-- é promessa falsa.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_idade_minima() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  -- Perfil sem data continua válido: o trigger de criação de conta cria a
  -- linha antes de o formulário mandar os campos extras, e barrar aqui
  -- quebraria o cadastro inteiro.
  IF NEW.birth_date IS NULL THEN RETURN NEW; END IF;

  IF NEW.birth_date > current_date THEN
    RAISE EXCEPTION 'Data de nascimento nao pode estar no futuro.';
  END IF;

  -- A mensagem chega no toast de quem está se cadastrando, então é em
  -- português e diz o número (§5: a mensagem tem que ensinar).
  IF NEW.birth_date > (current_date - interval '13 years') THEN
    RAISE EXCEPTION 'E preciso ter pelo menos 13 anos para usar o GamerHub.';
  END IF;

  RETURN NEW;
END $fn$;

REVOKE ALL ON FUNCTION public.guard_idade_minima() FROM PUBLIC, anon, authenticated;

-- `UPDATE OF birth_date` e não `UPDATE` puro: assim editar bio, avatar ou
-- qualquer outro campo não paga o custo do guarda nem corre risco de ser
-- barrado por um dado antigo que ninguém está tentando mudar.
DROP TRIGGER IF EXISTS profiles_guard_idade_minima ON public.profiles;
CREATE TRIGGER profiles_guard_idade_minima
  BEFORE INSERT OR UPDATE OF birth_date ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_idade_minima();
