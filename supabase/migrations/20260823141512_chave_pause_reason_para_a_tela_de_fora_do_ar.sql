-- Motivo exibido na landing quando o site perde acesso ao banco.
--
-- A armadilha logica desta funcionalidade: se o banco caiu, o motivo NAO pode
-- ser lido do banco. Por isso o app le esta chave enquanto esta ONLINE e
-- guarda em `localStorage`; quando o banco cai, mostra o que estava guardado.
--
-- Ou seja: pausa PLANEJADA (o dono escreve o motivo antes de pausar) mostra o
-- motivo de verdade. Queda inesperada mostra a mensagem generica. Nao ha como
-- fugir disso sem depender de outro servico fora do Supabase.
--
-- Vazio por padrao — sem motivo escrito, a tela usa o texto generico.
INSERT INTO public.site_config (key, value)
SELECT 'pause_reason', ''
 WHERE NOT EXISTS (SELECT 1 FROM public.site_config WHERE key = 'pause_reason');;
