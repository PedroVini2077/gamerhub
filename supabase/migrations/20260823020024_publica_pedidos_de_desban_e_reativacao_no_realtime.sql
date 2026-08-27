-- Por que esta migracao existe
--
-- `useAdminRealtime` assina `unban_requests` e `live_reactivation_requests`
-- desde sempre — mas nenhuma das duas esta na publicacao `supabase_realtime`.
-- Assinatura em tabela nao publicada nao da erro: ela simplesmente NUNCA
-- entrega evento. O painel prometia atualizar sozinho quando chegasse pedido
-- novo e ficava parado ate alguem recarregar a pagina.
--
-- Custo: as duas sao tabelas de baixissimo volume (pedido de desban e de
-- reativacao de live sao eventos raros) e so admin com o painel aberto assina.
-- Publicar e o certo aqui; o contrario seria arrancar as assinaturas e trocar
-- por poll, o que gastaria mais para entregar menos.

ALTER PUBLICATION supabase_realtime ADD TABLE public.unban_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactivation_requests;;
