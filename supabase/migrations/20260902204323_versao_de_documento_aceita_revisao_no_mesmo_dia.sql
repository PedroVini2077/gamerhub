-- Por que esta mudança existe.
--
-- O CHECK antigo era `^\d{4}-\d{2}-\d{2}$`: a versão de um documento legal só
-- podia ser uma DATA. Isso torna a segunda revisão do MESMO DIA inexprimível.
--
-- E isso não é hipótese: em 02/09/2026 o dono aceitou a política de privacidade
-- na versão "2026-09-02" às 19:58 UTC, e o bloco "por quanto tempo guardamos
-- seu dado" foi reescrito no PR #140 depois disso — de "falta definir" para uma
-- tabela com seis prazos. O registro passou a dizer que ele concordou com um
-- texto que nunca viu, que é exatamente o que versionar o aceite existe para
-- impedir.
--
-- O sufixo opcional `-N` deixa a revisão do mesmo dia ser dita. O formato de
-- data pura continua válido, então nenhuma linha existente é invalidada e o
-- caminho feliz não muda (mudança aditiva, §7).
--
-- Validado em ROLLBACK antes de aplicar: aceita "2026-09-02-2" e "2026-09-03",
-- recusa "v2" e "2026-09-02-" (sufixo vazio), e as 3 linhas de aceite que já
-- existiam sobreviveram.
ALTER TABLE public.policy_acceptances DROP CONSTRAINT policy_acceptances_versao_check;

ALTER TABLE public.policy_acceptances ADD CONSTRAINT policy_acceptances_versao_check
  CHECK (versao ~ '^\d{4}-\d{2}-\d{2}(-\d+)?$');

COMMENT ON COLUMN public.policy_acceptances.versao IS
  'A versão do documento que a pessoa aceitou: AAAA-MM-DD, com sufixo -N '
  'opcional para a segunda revisão do mesmo dia. Sobe apenas quando o CONTEÚDO '
  'muda de forma relevante para quem lê — subir por vírgula treina todo mundo a '
  'ignorar o pedido de reaceite. A trava que força a decisão é '
  'src/lib/__tests__/documentosLegais.test.js.';
