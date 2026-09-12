-- ============================================================================
-- SEC-019 — `owner_set_site_config` aceita QUALQUER chave, e o erro é MUDO
-- ============================================================================
--
-- ```sql
-- INSERT INTO site_config (key, value, ...) VALUES (p_key, p_value, ...)
-- ON CONFLICT (key) DO UPDATE SET value = p_value, ...
-- ```
--
-- `p_key text`, sem faixa. O `ON CONFLICT ... DO UPDATE` faz a função **criar
-- linha nova** quando a chave não existe — que é justamente o que a torna
-- silenciosa.
--
-- ── O caminho da falha, e por que ninguém veria ─────────────────────────────
--
-- O dono digita (ou um refactor renomeia) `maintenence_mode`. A RPC responde
-- **sucesso**, o painel mostra o toast verde, e a trilha de auditoria registra
-- *"@dono alterou maintenence_mode: 'false' para 'true'"* — tudo certo, do lado
-- de quem clicou. Só que o site lê `maintenance_mode`, essa linha continua
-- `false`, e **o site não entra em manutenção**.
--
-- Nada estoura, nada aparece na tela, nada vai para log de erro, nenhum teste
-- quebra. É o §1.5 inteiro, no painel que controla o site sair do ar.
--
-- ── A faixa é lista fechada, e ela vale para os DOIS lados ──────────────────
--
-- As 14 chaves são exatamente as que o `SiteTab.jsx` conhece — conferido chave
-- a chave contra o estado inicial do componente, e contra as 14 linhas que
-- existem hoje na tabela: os três conjuntos batem, sem sobra de nenhum lado.
--
-- Chave nova passa a exigir **uma linha aqui e uma no painel**, e o teste de
-- contrato `siteConfigChavesFechadas.test.js` reprova se só um lado mudar. É a
-- mesma escolha do motivo de ban (SEC-014): trocar uma falha muda por uma
-- falha alta.
--
-- ── Duas coisas menores, no mesmo lugar ─────────────────────────────────────
--
-- `is_owner()` no lugar do `role = 'owner'` escrito à mão — o auxiliar nasceu
-- no SEC-016 e esta era mais uma cópia da mesma decisão (§4, fonte única).
--
-- E faixa no valor: `banner_text` vai para a tela de todo mundo, e `text` aceita
-- megabytes.
--
-- 🔵 **Baixo**, e o número importa para não inflar: só o `owner` alcança esta
-- função. Não é brecha de privilégio — é um comando de painel que pode mentir
-- que funcionou, no painel cuja função é derrubar e levantar o site.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.owner_set_site_config(p_key text, p_value text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT is_owner() THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- `IS NULL` antes do `NOT IN`, pela mesma razão do SEC-017: `NULL NOT IN
  -- (...)` é NULL e o IF não dispararia.
  IF p_key IS NULL OR p_key NOT IN (
    'banner_enabled', 'banner_text', 'banner_color',
    'maintenance_mode', 'pause_reason',
    'feature_keys', 'feature_lives', 'feature_community',
    'mod_report_threshold', 'mod_suspend_threshold', 'mod_ban_threshold',
    'mod_ai_enabled', 'mod_ai_text_threshold', 'mod_ai_image_threshold'
  ) THEN
    RAISE EXCEPTION 'Chave de configuracao desconhecida: %. Chave nova precisa ser adicionada na RPC e no painel.',
      COALESCE(p_key, '(vazio)');
  END IF;

  -- `banner_text` e `pause_reason` vao para a tela de TODO MUNDO, e `text`
  -- aceita megabytes. 500 e folgado para um aviso de topo de pagina.
  IF p_value IS NULL OR length(p_value) > 500 THEN
    RAISE EXCEPTION 'O valor deve ter de 1 a 500 caracteres.';
  END IF;

  INSERT INTO site_config (key, value, updated_at, updated_by)
  VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = p_value, updated_at = now(), updated_by = auth.uid();
END;
$fn$;
