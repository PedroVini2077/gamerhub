-- C3-b, segunda metade: tirar `admin_logs` da publicacao de realtime.
--
-- Era o pior custo/beneficio de realtime do projeto: `admin_logs` e tabela de
-- auditoria de ALTO VOLUME (393 linhas hoje, cresce a cada acao no site) e
-- estava sendo transmitida para TODO admin com o painel aberto — mesmo com a
-- aba de logs fechada, porque o handler so filtrava depois de receber.
--
-- Esta migration so pode rodar DEPOIS da troca no frontend, ja aplicada:
--
--   * `useAdminRealtime` nao assina mais `admin_logs`.
--   * A aba de Logs do admin usa `useVisiblePoll` a cada 30s, e SO enquanto a
--     aba esta selecionada e visivel.
--   * O painel de notificacoes do dono (que tambem lista logs) idem.
--
-- O poll tambem revalida no `visibilitychange`, entao voltar pra aba depois de
-- um tempo fora atualiza na hora em vez de esperar o proximo tique.
--
-- REVERSIVEL: `ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_logs;`

ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_logs;;
