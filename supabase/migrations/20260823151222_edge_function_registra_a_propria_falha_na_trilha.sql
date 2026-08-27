-- Por que esta migracao existe
--
-- As Edge Functions de moderacao ja devolvem `status: "rpc_error"` no corpo da
-- resposta. Isso resolve para QUEM TESTA — mas o cliente dispara e descarta a
-- resposta (fire-and-forget, de proposito, para nao travar o usuario). Ou seja:
-- a falha continua sem ninguem para ouvi-la, que e exatamente a §1.5.
--
-- Foi assim que a moderacao por IA ficou quebrada em 26 de 26 chamadas por
-- semanas: ela GRITAVA, num `console.error` que ninguem abre.
--
-- Esta RPC leva a falha para `admin_logs`, que e o painel que o dono ja olha.
-- Escolhi isto em vez do SDK do Sentry para Deno por tres razoes:
--   1. sem dependencia nova em funcao que esta no caminho critico da moderacao;
--   2. cai onde o dono ja procura, em portugues, junto do resto da trilha;
--   3. o Sentry do frontend ja cobre o outro lado (a chamada que nem sai).
-- Se um dia a operacao crescer, o Sentry no Deno vira complemento, nao troca.
CREATE OR REPLACE FUNCTION public.registrar_falha_de_moderacao(
  p_funcao text, p_detalhe text, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO admin_logs (action, details, category, severity,
                          admin_id, admin_username, actor_id, actor_username, metadata)
  VALUES ('edge_function_error',
          format('Falha na moderação (%s): %s', p_funcao, left(coalesce(p_detalhe,'sem detalhe'), 300)),
          'moderation', 'critical', NULL, 'sistema', NULL, 'sistema',
          coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('funcao', p_funcao));
END;
$fn$;

-- So a Edge Function chama isto. Ninguem mais precisa poluir a trilha.
REVOKE ALL ON FUNCTION public.registrar_falha_de_moderacao(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_falha_de_moderacao(text, text, jsonb) TO service_role;;
