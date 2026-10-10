-- ============================================================================
-- As CONQUISTAS ganham REGISTRO de desbloqueio — e nenhum gatilho.
--
-- ── O que isto é, e o que explicitamente NÃO é ──────────────────────────────
--
-- `src/lib/conquistas.js` recusou a tabela em 05/09, e a recusa continua certa
-- para o desenho que ela recusou: `achievements` + `user_achievements` com
-- TRIGGER em `posts`, `post_likes` e `comments`. Aquilo e uma escrita por
-- interacao de todo mundo — a conta que multiplica por usuarios x posts x
-- leitores, que e o §0.2 na veia.
--
-- Este desenho nao tem gatilho nenhum. A escrita acontece uma vez por
-- conquista, por pessoa, PARA SEMPRE: no maximo 8 linhas por conta na vida
-- inteira, gravadas quando ela abre o PROPRIO perfil e algo novo cruzou a meta.
-- Depois disso, abrir o perfil nao escreve mais nada (`ON CONFLICT DO NOTHING`
-- sobre a chave primaria).
--
-- ── Por que o SERVIDOR mede, e o cliente nao pode dizer "desbloqueei" ───────
--
-- O site usa a `anon key` (§1.3). Uma RPC que aceitasse `p_conquista_id` do
-- cliente daria a qualquer pessoa logada todas as conquistas por um `POST` no
-- `/rest/v1/rpc/`. Entao a funcao nao recebe parametro nenhum: ela mede, do
-- zero, a partir da `xp_dos_usuarios` e de `profiles`, para `auth.uid()`.
--
-- O preco disso e que as METAS passam a existir em DOIS lugares — aqui e no
-- `CONQUISTAS` do JS. Isso e deriva por construcao (FASE 4 do §6), e a resposta
-- do projeto para deriva e trava de contrato, nao confianca:
-- `conquistaNaoDerivaDoBanco.test.js` compara os dois conjuntos `id -> meta`
-- nos dois sentidos.
--
-- ── O BACKFILL, e por que ele NAO e opcional ────────────────────────────────
--
-- Sem ele, quem ja tem sete conquistas receberia a data de HOJE nas sete, no
-- primeiro acesso depois do deploy. Uma data que se apresenta como historia e
-- nao e vale menos do que data nenhuma (§1.1) — e, pior, nada acusaria.
--
-- Varrendo a base de uma vez com `retroativa = true`, todo registro gravado
-- DEPOIS tem data verdadeira, e a RPC nunca precisa decidir se e o primeiro
-- registro daquela conta. A alternativa — a RPC adivinhar "e a primeira vez?"
-- olhando se a tabela esta vazia para o usuario — erra justamente no caso novo:
-- uma conta criada hoje, que publica o 1o post amanha, teria a tabela vazia e
-- marcaria retroativa uma conquista de data conhecida.
-- ============================================================================

-- ── A tabela ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conquistas_desbloqueadas (
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conquista_id    text        NOT NULL,
  desbloqueada_em timestamptz NOT NULL DEFAULT now(),
  -- `true` = a condicao ja estava cumprida quando o registro passou a existir,
  -- entao NAO SABEMOS quando aconteceu. A tela mostra "conquistada" sem data,
  -- em vez de inventar uma.
  retroativa      boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, conquista_id)
);

COMMENT ON TABLE public.conquistas_desbloqueadas IS
  'Registro append-only de desbloqueio. Escrita SO pela RPC registrar_conquistas(), '
  'nunca por gatilho de interacao — ver o cabecalho da migration e lib/conquistas.js.';

COMMENT ON COLUMN public.conquistas_desbloqueadas.retroativa IS
  'Condicao ja cumprida antes de existir registro: a data e do backfill, nao do feito.';

-- `ON DELETE CASCADE` acima responde a 2a pergunta do §5 (quem passa a apontar
-- para o nada): excluir a conta leva as conquistas junto. Sem FK, a exclusao de
-- conta deixaria linhas orfas apontando para um `user_id` morto.

-- ── Portas (SEC-052: TODA tabela nova nasce ABERTA) ─────────────────────────

ALTER TABLE public.conquistas_desbloqueadas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.conquistas_desbloqueadas FROM anon, authenticated;

-- Nenhuma tela publica le conquista: o card vive em `/perfil`, atras de
-- `RequireAuth`. Entao `anon` nao recebe nada de volta (regua de papeis, §5).
GRANT SELECT ON public.conquistas_desbloqueadas TO authenticated;

-- Ler o PROPRIO registro, e so.
DROP POLICY IF EXISTS "Ve as proprias conquistas" ON public.conquistas_desbloqueadas;
CREATE POLICY "Ve as proprias conquistas"
  ON public.conquistas_desbloqueadas FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- NAO existe policy de INSERT, UPDATE nem DELETE, e isso e deliberado: quem
-- escreve e a RPC `SECURITY DEFINER` abaixo. Sem `GRANT INSERT`, a REST API
-- nao alcanca a tabela nem com a policy certa — sao duas camadas, e o §1.3
-- pede as duas. Registrado aqui porque "tabela sem policy de UPDATE nega em
-- silencio" e um achado real deste projeto: a diferenca e que aqui NENHUM
-- caminho do cliente escreve, entao nao ha update para negar.
