-- `[11/09]` O aceite dos documentos passa a nascer com a conta.
--
-- O PROBLEMA, reproduzido antes de tocar em nada:
-- com confirmacao de email ligada, `supabase.auth.signUp` cria o usuario e NAO
-- abre sessao. O cliente segue como `anon`, e a policy de INSERT de
-- `policy_acceptances` e `TO authenticated` com `user_id = auth.uid()`.
-- Provado em ROLLBACK: como `anon` da "permission denied for table
-- policy_acceptances"; como `authenticated` sem `sub` no jwt da "new row
-- violates row-level security policy".
--
-- Ou seja: TODO cadastro novo ficava sem a prova do consentimento, e a pessoa
-- via um toast vermelho dizendo isso. O dado confirma — a conta criada em
-- 28/08 esta com 0 aceites, enquanto as anteriores tem 3, 4 e 8.
--
-- POR QUE AQUI e nao no cliente: aqui nao ha RLS no caminho (SECURITY DEFINER)
-- e a escrita acontece na MESMA transacao que cria a conta. Ou existem os dois,
-- ou nao existe nenhum.
--
-- POR QUE ENTRADA INVALIDA E PULADA e nao estoura: derrubar a criacao da conta
-- por causa de uma linha de auditoria trocaria um problema por um pior — a
-- pessoa ficaria sem conta. E o silencio tem canal: sem o aceite, o
-- `AvisoDeAceite` aparece no primeiro login, porque a lista de pendentes deixa
-- de bater.
--
-- SUPERFICIE DE ABUSO (§1.3): o trigger so escreve para `NEW.id`, entao ninguem
-- registra aceite de outra pessoa. Forjar a propria versao e possivel e
-- limitado pelos dois CHECK da tabela (3 documentos conhecidos, formato de
-- data) — nao concede nada, so suja o proprio registro.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_nasc  date;
  v_bruto text := NEW.raw_user_meta_data->>'birth_date';
  v_item  jsonb;
BEGIN
  IF v_bruto IS NOT NULL AND btrim(v_bruto) <> '' THEN
    BEGIN
      v_nasc := v_bruto::date;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Data de nascimento invalida: %', v_bruto;
    END;
  END IF;

  INSERT INTO public.profiles (id, username, role, birth_date, state, platform)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'user',
    v_nasc,
    left(nullif(btrim(coalesce(NEW.raw_user_meta_data->>'state','')), ''), 2),
    left(nullif(btrim(coalesce(NEW.raw_user_meta_data->>'platform','')), ''), 20)
  )
  ON CONFLICT (id) DO NOTHING;

  IF jsonb_typeof(NEW.raw_user_meta_data->'aceites') = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.raw_user_meta_data->'aceites') LOOP
      CONTINUE WHEN jsonb_typeof(v_item) <> 'object';
      CONTINUE WHEN (v_item->>'documento') IS NULL OR (v_item->>'versao') IS NULL;
      CONTINUE WHEN (v_item->>'documento') NOT IN ('privacidade','regras','termos');
      CONTINUE WHEN (v_item->>'versao') !~ '^\d{4}-\d{2}-\d{2}(-\d+)?$';
      INSERT INTO public.policy_acceptances (user_id, documento, versao)
      VALUES (NEW.id, v_item->>'documento', v_item->>'versao')
      ON CONFLICT (user_id, documento, versao) DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END $fn$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Cria o perfil E registra o aceite dos documentos, na mesma transacao do INSERT em auth.users. O aceite vem de raw_user_meta_data->aceites; entrada invalida e pulada, nunca derruba o cadastro.';
