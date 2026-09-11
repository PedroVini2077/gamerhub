-- `[11/09]` O "Esqueci o codigo" do cofre passa a exigir a SENHA DA CONTA.
--
-- O ACHADO, do dono: "que sentido faz ter um botao pra resetar senha? se alguem
-- pega meu PC ou celular ligado na tela e nao souber a senha, ele so vai
-- redefinir". Ele estava certo: `esquecerCodigo()` apagava o resumo e o sal do
-- localStorage e a tela caia em "definir novo codigo". Dois cliques e qualquer
-- um entrava. O cofre protegia contra ninguem.
--
-- Nao era brecha de seguranca — o cofre e cenografico por decisao registrada, e
-- quem protege o painel e a RLS com `is_super()`. Era pior de outro jeito: um
-- cadeado que nao tranca sugere uma protecao que nao existe.
--
-- POR QUE UMA RPC e nao `signInWithPassword` no cliente:
-- `signInWithPassword` SUBSTITUI a sessao, e `useAuth.jsx` e o arquivo de maior
-- risco do projeto (§7) — trocar sessao para conferir uma senha e efeito
-- colateral grande demais para o tamanho da pergunta. Esta funcao responde
-- true/false e nao encosta na sessao.
--
-- SUPERFICIE (§1.3), e cada trava:
--   - so confere a senha de QUEM CHAMA (`u.id = auth.uid()`), nunca de outro;
--   - so responde para `is_super()` — usuario comum recebe `false` mesmo com a
--     senha certa, entao ela nao vira um oraculo de senha para o site inteiro;
--   - devolve BOOLEAN. Nada do hash, nada da senha, nada do usuario sai daqui;
--   - `anon` nao tem EXECUTE;
--   - `SET search_path` explicito, incluindo `extensions` por causa do `crypt`.
--
-- Provado em ROLLBACK, tres vias:
--   dono + senha certa            -> true
--   dono + senha errada           -> false
--   usuario comum + senha certa   -> false   (o portao de cargo segura)
--
-- E o risco que EU checei antes de escolher este caminho: senha errada aqui NAO
-- tranca ninguem fora do site. A contagem de tentativa falha foi removida em
-- 28/08 por ser forjavel, e o freio que resta e o rate limit do proprio GoTrue.
CREATE OR REPLACE FUNCTION public.confere_a_propria_senha(p_senha text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions, auth AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.encrypted_password = extensions.crypt(p_senha, u.encrypted_password)
      AND public.is_super()
  );
$fn$;

REVOKE ALL ON FUNCTION public.confere_a_propria_senha(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confere_a_propria_senha(text) TO authenticated;

COMMENT ON FUNCTION public.confere_a_propria_senha(text) IS
  'Confere a senha de QUEM CHAMA, e so para is_super(). Devolve boolean; nada do hash sai daqui. Usada pelo "Esqueci o codigo" do Cofre do Fundador, para que resetar o cofre exija a senha da conta.';
