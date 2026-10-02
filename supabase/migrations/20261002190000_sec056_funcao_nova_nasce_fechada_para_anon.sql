-- ============================================================================
-- SEC-056 — TODA FUNÇÃO NOVA NASCE FECHADA PARA `anon` E PARA `PUBLIC`
-- ============================================================================
--
-- ## O buraco, e por que escrever mais uma regra não o fecharia
--
-- O `pg_default_acl` do schema `public` dá `EXECUTE` a `anon` **e a `PUBLIC`**
-- em toda função criada pelo `postgres`. Medido em 02/10, numa função de teste
-- criada sem um único `GRANT` escrito:
--
--     {=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}
--      ^^^^^^^^^^^  o `=X` sem papel à esquerda é o PUBLIC
--
-- Ou seja: a função nasce chamável por quem não tem conta, via
-- `/rest/v1/rpc/<nome>`. A proteção que existia era **alguém lembrar** de
-- escrever o `REVOKE` — e isso é a classe inteira do `funcaoDeTriggerNaoEhRpc`,
-- que trava um caso e deixa o mecanismo de pé.
--
-- Isto é o 🟠 do `BACKLOG.md` de 18/09, que dizia que fechar na raiz era
-- "mudança de contrato". É esta.
--
-- ## Por que EVENT TRIGGER e não `ALTER DEFAULT PRIVILEGES`
--
-- `ALTER DEFAULT PRIVILEGES` só alcança o default de quem o escreve, e o
-- `pg_default_acl` daqui tem entrada do `supabase_admin` — papel que esta
-- credencial não assume. Tentei em 24/09 e registrei que "não é alcançável";
-- **a parte errada daquela frase era o 'não é alcançável' genérico**: era
-- verdade daquela tentativa, não do objetivo. `CREATE EVENT TRIGGER` funciona,
-- e age depois do fato, que é justamente onde o default já se aplicou.
--
-- ## As quatro exceções são MEDIDAS, não escolhidas
--
-- Em 02/10, estas são as únicas funções de `public` com `anon` no `proacl`:
--
--     contagem_de_achados_de_seguranca()   username_disponivel(text)
--     contagem_de_migrations()             role_rank(text)
--
-- Elas precisam continuar abertas porque dois portões do CI as chamam com a
-- chave anônima, e o cadastro confere o apelido antes de existir conta.
--
-- Elas existem aqui porque `CREATE OR REPLACE` de uma função que já existe
-- **também** dispara `ddl_command_end` com a tag `CREATE FUNCTION`: sem a
-- lista, a próxima vez que alguém editasse `username_disponivel` o cadastro
-- pararia de conferir apelido, em silêncio.
--
-- É a MESMA lista da 4ª checagem de `auditoria_de_operadores()` (SEC-049), e
-- duas cópias divergem (§4). `funcaoNovaNasceFechada.test.js` reprova se
-- divergirem.
--
-- ## O `EXCEPTION WHEN OTHERS` é deliberado, e o custo dele é coberto
--
-- Erro aqui aborta o `CREATE FUNCTION` que o disparou — ou seja, travaria
-- qualquer migration. A escolha é não travar, e aceitar que uma falha deixe a
-- função aberta **em silêncio**.
--
-- O que torna esse silêncio aceitável (§1.5) é que a DETECÇÃO já existe e já
-- está no CI: a 4ª checagem de `auditoria_de_operadores()` acusa
-- "alcancavel por ANON", `contagem_de_achados_de_seguranca()` devolve o
-- número, e `e2e/portas-do-banco.mjs` o lê com a anon key. O trigger previne;
-- o auditor detecta. Nenhum dos dois sozinho bastaria.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fecha_funcao_nova_para_anon()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
              WHERE command_tag = 'CREATE FUNCTION' AND schema_name = 'public' LOOP
    IF obj.object_identity ~ '^public\.(username_disponivel|contagem_de_migrations|contagem_de_achados_de_seguranca|role_rank)\(' THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', obj.object_identity);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $function$;

-- Ela mesma não escapa da regra que impõe.
REVOKE ALL ON FUNCTION public.fecha_funcao_nova_para_anon() FROM PUBLIC, anon, authenticated;

CREATE EVENT TRIGGER fecha_funcao_nova_para_anon ON ddl_command_end
  WHEN TAG IN ('CREATE FUNCTION')
  EXECUTE FUNCTION public.fecha_funcao_nova_para_anon();
