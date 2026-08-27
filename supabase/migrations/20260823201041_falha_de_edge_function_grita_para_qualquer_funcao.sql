-- Por que esta migration existe
-- ------------------------------
-- `registrar_falha_de_moderacao` foi escrita para as funções de moderação e
-- crava a categoria 'moderation' e o texto "Falha na moderação". A `send-email`
-- precisa do mesmo mecanismo e NÃO é moderação: ela é a porta de entrada do
-- site. Se o Google travar a conta, a senha de app expirar ou o secret ficar
-- errado, ninguém se cadastra nem recupera senha — e hoje o erro morre num
-- `console.error` que ninguém abre (CLAUDE.md §1.5, fonte de silêncio nº 7).
--
-- A generalização é a mesma lição de sempre: corrigir pela CLASSE. Qualquer
-- Edge Function que falhe precisa gritar, não só as duas de moderação.

CREATE OR REPLACE FUNCTION public.registrar_falha_de_edge_function(
  p_funcao    text,
  p_detalhe   text,
  p_categoria text  DEFAULT 'system',
  p_metadata  jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO admin_logs (action, details, category, severity,
                          admin_id, admin_username, actor_id, actor_username, metadata)
  VALUES ('edge_function_error',
          format('Falha em %s: %s', p_funcao, left(coalesce(p_detalhe, 'sem detalhe'), 300)),
          coalesce(p_categoria, 'system'), 'critical',
          NULL, 'sistema', NULL, 'sistema',
          coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('funcao', p_funcao));
END;
$$;

COMMENT ON FUNCTION public.registrar_falha_de_edge_function IS
  'Registra falha de Edge Function em admin_logs. Chamável só por service_role: '
  'o texto vai direto para o painel do dono, então não pode ser escrito por cliente.';

-- Quem chama é a própria Edge Function com a service_role. Ninguém logado (nem
-- anônimo) pode inventar linha na trilha de auditoria.
REVOKE ALL ON FUNCTION public.registrar_falha_de_edge_function(text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_falha_de_edge_function(text, text, text, jsonb)
  TO service_role;

-- A versão antiga continua existindo e passa a delegar: os chamadores de hoje
-- (moderate-text, moderate-image) não mudam, e o comportamento fica num lugar
-- só em vez de duplicado — fonte única de verdade (§4).
CREATE OR REPLACE FUNCTION public.registrar_falha_de_moderacao(
  p_funcao   text,
  p_detalhe  text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.registrar_falha_de_edge_function(
    p_funcao, p_detalhe, 'moderation', p_metadata);
END;
$$;;
