-- SEC-049 · `[19/09]` Um auditor que PERGUNTA AO BANCO, e as duas falhas que
-- ele achou na primeira execucao — as duas minhas, das ultimas horas.
--
-- ══ POR QUE ISTO EXISTE ════════════════════════════════════════════════
--
-- A SEC-043 injetou a guarda numa LISTA DE 25 NOMES escrita a mao. Eu registrei
-- o risco residual no proprio PR: *"uma RPC administrativa NOVA nao entra
-- sozinha na lista; a trava pega a lista encolhendo, nao ficando para tras"*.
--
-- **Registrar o risco nao e fechar o risco.** E a resposta nao podia ser um
-- teste que le migration — o dado que importa (quem tem EXECUTE, o que a funcao
-- faz) so existe no Postgres. Entao a pergunta passa a ser feita AO POSTGRES.
--
-- ══ O QUE ELE ACHOU, NA PRIMEIRA EXECUCAO ══════════════════════════════
--
--   request_unban ... administrativa e NAO chama exige_operador_ativo()
--   texto_visivel ... alcancavel por ANON
--
-- **As duas sao minhas, de hoje.**
--
-- `request_unban` eu simplesmente esqueci na lista da SEC-043 — pus
-- `request_role_demotion` e nao pus a irma. Um admin BANIDO podia abrir pedido
-- de unban para outra pessoa. Severidade BAIXA (criar pedido nao e agir, e a
-- decisao ja e guardada), mas e exatamente o padrao.
--
-- `texto_visivel` eu criei na SEC-046, DEPOIS de escrever a SEC-042 explicando
-- que `pg_default_acl` faz toda funcao nova nascer com EXECUTE para `anon`.
-- Escrevi a regra e repeti o erro 20 minutos depois. A funcao e pura (recebe
-- texto, devolve booleano, nao le tabela), entao o impacto e nulo — mas
-- "inofensiva hoje" e a protecao acidental que o §1.3 manda desconfiar.
--
-- ══ COMO USAR ══════════════════════════════════════════════════════════
--
--     SELECT * FROM auditoria_de_operadores();
--
-- Zero linhas = superficie limpa. Fica FORA do CI pelo mesmo motivo do
-- `npm run edges`: consultar `pg_proc` exige credencial de banco, e este
-- projeto ja recusou essa troca tres vezes. E `SECURITY DEFINER` sem EXECUTE
-- para ninguem — so quem tem a credencial do banco roda.
--
-- ══ A LISTA DE DISPENSADAS, e por que ela e EXPLICITA ═════════════════
--
-- "O que me parecer ok" e como a cobertura escorrega. Sao os proprios helpers
-- de autorizacao (perguntar a guarda se ela chama a guarda seria circular), os
-- de leitura pura, e as tres portas publicas ja documentadas.

CREATE OR REPLACE FUNCTION public.auditoria_de_operadores()
RETURNS TABLE (funcao text, problema text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  WITH f AS (
    SELECT p.oid, p.proname::text AS nome,
           -- PROSA NAO E CODIGO: sem isto, um comentario citando
           -- `exige_operador_ativo` faria a funcao parecer guardada.
           regexp_replace(regexp_replace(pg_get_functiondef(p.oid),'--[^\n]*',' ','g'),
                          '/\*.*?\*/',' ','gs') AS def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype
       AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
  SELECT nome, 'administrativa e NAO chama exige_operador_ativo() (SEC-043)'
    FROM f
   WHERE def ~* 'role_rank|is_staff\(|is_super\(|is_owner\('
     AND def !~* 'exige_operador_ativo'
     AND nome NOT IN (
       'is_staff','is_super','is_owner','role_rank','can_moderate_content',
       'operador_ativo','exige_operador_ativo','exige_alvo_apto',
       'check_staff_eligibility','log_audit_event','confere_a_propria_senha',
       'pode_publicar','post_aceita_interacao')
  UNION ALL
  SELECT p.proname::text, 'funcao de TRIGGER chamavel como RPC (SEC-042)'
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.prorettype='trigger'::regtype
     AND (has_function_privilege('anon', p.oid,'EXECUTE')
       OR has_function_privilege('authenticated', p.oid,'EXECUTE'))
  UNION ALL
  SELECT p.proname::text, 'alcancavel por ANON — confira se e intencional'
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND has_function_privilege('anon', p.oid,'EXECUTE')
     -- as tres portas publicas documentadas: o portao de espelho do CI, o
     -- cadastro, e uma funcao pura que nao le dado nenhum.
     AND p.proname NOT IN ('contagem_de_migrations','username_disponivel','role_rank')
  ORDER BY 1;
$fn$;

COMMENT ON FUNCTION public.auditoria_de_operadores() IS
  'SEC-049: pergunta ao BANCO quais funcoes administrativas ficaram sem guarda. Zero linhas = limpo. Fora do CI porque exige credencial de banco.';

REVOKE EXECUTE ON FUNCTION public.auditoria_de_operadores() FROM PUBLIC, anon, authenticated;

-- ── Os dois achados do proprio auditor ─────────────────────────────────
DO $edit$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.request_unban(uuid,text)'::regprocedure);
  IF d ~* 'exige_operador_ativo' THEN
    RAISE NOTICE 'request_unban ja tem a guarda';
  ELSE
    IF strpos(upper(d),'BEGIN') = 0
       OR strpos(upper(d),'BEGIN')
        <> strpos(upper(regexp_replace(d,'--[^\n]*',' ','g')),'BEGIN') THEN
      RAISE EXCEPTION 'o 1o BEGIN do request_unban nao e confiavel';
    END IF;
    EXECUTE regexp_replace(d, '\mBEGIN\M',
      E'BEGIN\n  PERFORM public.exige_operador_ativo();', 1, 1, 'i');
  END IF;
END $edit$;

REVOKE EXECUTE ON FUNCTION public.texto_visivel(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.texto_visivel(text) TO authenticated;
