-- Por que esta função existe.
--
-- Em 02/09 a conferência achou que o Supabase tinha **151** migrations e o
-- espelho em `supabase/migrations/` tinha **142**. Nove migrations aplicadas
-- por `apply_migration` nunca viraram arquivo no repositório — entre elas o
-- canal de contato inteiro, a idade mínima e a tabela de aceite das políticas.
--
-- O README daquela pasta afirma que ela "é a verdade sobre o schema" e que as
-- migrations "reconstroem o banco do zero". Estava falso: recriar dali
-- produziria um banco sem nada de 29/08 em diante. É falha silenciosa (§1.5)
-- aplicada a recuperação de desastre — só apareceria no dia em que alguém
-- precisasse dela, que é o pior dia possível para descobrir.
--
-- O próprio README dizia, com todas as letras: *"Não existe teste comparando
-- esta pasta com o Supabase"*, porque comparar exigiria um token de gestão
-- guardado no CI. Isso continua verdade para comparar CONTEÚDO — mas não para
-- comparar a CONTAGEM, e a contagem já pega a deriva que aconteceu.
--
-- ── Por que expor isto a `anon` não é vazamento ─────────────────────────────
--
-- Ela devolve um inteiro. As migrations em si estão num repositório PÚBLICO,
-- com o SQL completo — o número de arquivos é derivável só de olhar o GitHub.
-- Nenhum nome, nenhum conteúdo, nenhuma estrutura sai daqui.
--
-- A alternativa era guardar um token de gestão nos secrets do CI, que é a
-- mesma troca ruim já recusada no `portas-fechadas.mjs` e no alerta de cota do
-- Sentry: trocar incerteza de monitoramento por credencial exposta.
CREATE OR REPLACE FUNCTION public.contagem_de_migrations()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = supabase_migrations, public
STABLE
AS $$
  SELECT count(*)::integer FROM supabase_migrations.schema_migrations;
$$;

COMMENT ON FUNCTION public.contagem_de_migrations() IS
  'Quantas migrations o banco aplicou. Existe para o CI comparar com os arquivos '
  'de supabase/migrations/ e reprovar quando o espelho fica para tras. Devolve '
  'so um inteiro: o SQL das migrations ja esta num repositorio publico.';

REVOKE ALL ON FUNCTION public.contagem_de_migrations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contagem_de_migrations() TO anon, authenticated;
