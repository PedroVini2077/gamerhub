-- Por que esta migration existe
-- ------------------------------
-- Em 23/08 eu fiz as Edge Functions gritarem em `admin_logs` para acabar com
-- falha silenciosa. Funcionou — e criou um problema novo, que os números de
-- 27/08 expuseram:
--
--   `edge_function_error` virou a 2ª ação mais frequente de TODA a trilha
--   (67 linhas), e as 67 são "chamada recusada". Nenhuma é falha de verdade.
--
-- De onde vinham:
--   * a própria trava `e2e/portas-fechadas.mjs` manda 3 requisições recusadas
--     por execução, e roda em TODO PR;
--   * a `send-email` é pública por construção (auth hook), então qualquer
--     pessoa da internet grava uma linha com um POST — sem limite.
--
-- O espaço em disco NÃO é o problema (376 kB numa base de 23 MB de 500 MB, e
-- a retenção de 90 dias mantém o regime permanente em ~1,8 MB). O problema é
-- que essas linhas entram como `critical` e a função FUNCIONOU: ela recusou um
-- estranho, que é o trabalho dela. Uma falha real da `send-email` — Google
-- travou a conta, cadastro parado — chegaria num canal já cheio de ruído.
--
-- É a §1.5 ao contrário: o silêncio virou fadiga de alarme. E fere a regra
-- "toda mensagem de erro tem que ser verdadeira": "falha crítica em
-- send-email" quando um scanner bateu na porta não é verdade.
--
-- A correção
-- ----------
-- Uma linha por hora, por (função, tipo de falha). Preserva o sinal e mata o
-- ruído: hook mal configurado produz recusa contínua e você vê a linha de hora
-- em hora; scanner também vira uma linha por hora em vez de mil. Falha real do
-- SMTP continua aparecendo.
--
-- `p_severidade` entra como parâmetro NOVO com padrão `critical`, para que
-- nenhum chamador atual mude de comportamento. Passar `warning` nas recusas
-- exige alterar duas Edge Functions — fica para um passo separado, com
-- aprovação, porque Edge Function é §7 🟡.
--
-- ATENÇÃO ao mexer nisto: `CREATE OR REPLACE` com parâmetro novo NÃO
-- substitui — cria uma segunda função com outra assinatura, e a chamada de 2
-- argumentos passa a ser ambígua ("function is not unique"). Por isso o DROP
-- explícito da assinatura antiga antes.

DROP FUNCTION IF EXISTS public.registrar_falha_de_edge_function(text, text, text, jsonb);

CREATE FUNCTION public.registrar_falha_de_edge_function(
  p_funcao     text,
  p_detalhe    text,
  p_categoria  text  DEFAULT 'system',
  p_metadata   jsonb DEFAULT '{}'::jsonb,
  p_severidade text  DEFAULT 'critical'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chave text;
BEGIN
  -- 80 caracteres bastam para separar "chamada recusada: sem assinatura" de
  -- "chamada recusada: assinatura invalida" e de "SMTP recusou o envio: ...".
  -- Motivos diferentes continuam sendo eventos diferentes.
  v_chave := left(coalesce(p_detalhe, 'sem detalhe'), 80);

  IF EXISTS (
    SELECT 1 FROM admin_logs
     WHERE action = 'edge_function_error'
       AND created_at > now() - interval '1 hour'
       AND metadata->>'funcao' = p_funcao
       AND metadata->>'chave'  = v_chave
  ) THEN
    -- Suprimido de propósito. A trilha é append-only, então não dá para
    -- incrementar um contador na linha existente sem mudar essa natureza —
    -- consequência aceita: a linha diz QUE aconteceu, não quantas vezes.
    RETURN;
  END IF;

  INSERT INTO admin_logs (action, details, category, severity,
                          admin_id, admin_username, actor_id, actor_username, metadata)
  VALUES ('edge_function_error',
          format('Falha em %s: %s', p_funcao, left(coalesce(p_detalhe, 'sem detalhe'), 300)),
          coalesce(p_categoria, 'system'),
          coalesce(p_severidade, 'critical'),
          NULL, 'sistema', NULL, 'sistema',
          coalesce(p_metadata, '{}'::jsonb)
            || jsonb_build_object('funcao', p_funcao, 'chave', v_chave));
END;
$$;

COMMENT ON FUNCTION public.registrar_falha_de_edge_function IS
  'Registra falha de Edge Function em admin_logs, no máximo UMA linha por hora '
  'por (funcao, tipo de falha). Só service_role: o texto vai direto para o '
  'painel do dono, então não pode ser escrito por cliente.';

REVOKE ALL ON FUNCTION public.registrar_falha_de_edge_function(text, text, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_falha_de_edge_function(text, text, text, jsonb, text)
  TO service_role;;
