-- SEC-054 — o literal `role = 'owner'` sai das OITO. DECISÃO DELE em 25/09.
--
-- A SEC-051 (24/09) achou cinco funções do painel do Fundador autorizando por
-- literal, e a SEC-053 (hoje) achou três policies de `site_config` iguais. Nos
-- dois casos eu NÃO troquei, porque a troca não é mecânica:
--
--   is_owner()        e  role_rank(...) >= 4
--   role = 'owner'    e  igualdade exata
--
-- Hoje dão o mesmo resultado. Um cargo futuro de rank 5 passaria num e não no
-- outro — e isso é semântica de produto, não limpeza. Ele decidiu: "pode fazer
-- esse do is_owner", ciente de que um cargo acima de owner herdaria o painel.
--
-- O QUE **NÃO** ENTRA JUNTO, e continua valendo: pôr `exige_operador_ativo()`
-- nas cinco. Ninguém consegue banir o fundador pelo produto (hierarquia
-- estrita), então guardá-las só criaria o risco de trancá-lo fora do próprio
-- painel **sem inversa** — a classe do erro da `apply_suspension` sem
-- `lift_suspension`. Por isso elas seguem na lista de isenção do auditor, agora
-- na checagem do SEC-043 em vez da do SEC-051.
--
-- COMO A TROCA FOI FEITA, e por que assim: em vez de reescrever cinco corpos à
-- mão (longos, e um deslize silencioso em qualquer um deles é uma RPC de painel
-- quebrada), o bloco abaixo lê a definição REAL de cada função, troca só o
-- bloco da guarda, e **estoura se o padrão não casar**. Nada é reescrito no
-- escuro, e o resto do corpo é preservado byte a byte.
--
-- PROVADO EM ROLLBACK: owner chama as cinco e mexe em `site_config` (15 linhas);
-- admin recebe "Acesso negado." nas cinco e 0 linhas em `site_config`.

DO $mig$
DECLARE f record; novo text; trocadas int := 0;
BEGIN
  FOR f IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('owner_get_stats','owner_get_users','owner_get_metrics',
                         'owner_get_audit_logs','owner_get_notifications')
  LOOP
    novo := regexp_replace(f.def,
      'IF NOT EXISTS \(\s*SELECT 1 FROM profiles\s*WHERE (profiles\.)?id = auth\.uid\(\) AND (profiles\.)?role = ''owner''\s*\) THEN',
      'IF NOT is_owner() THEN', 'g');

    IF novo = f.def THEN
      RAISE EXCEPTION 'A guarda de % nao casou com o padrao — nao reescrevo no escuro.', f.proname;
    END IF;

    EXECUTE novo;
    trocadas := trocadas + 1;
  END LOOP;

  IF trocadas <> 5 THEN
    RAISE EXCEPTION 'Esperava trocar 5 funcoes do painel, troquei %.', trocadas;
  END IF;
END $mig$;

ALTER POLICY site_config_owner_delete ON site_config USING (is_owner());
ALTER POLICY site_config_owner_insert ON site_config WITH CHECK (is_owner());
ALTER POLICY site_config_owner_update ON site_config USING (is_owner()) WITH CHECK (is_owner());
