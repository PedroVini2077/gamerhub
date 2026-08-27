-- Revisao da propria migracao anterior. Num site de JOGOS, parte do que eu
-- classifiquei como ameaca e fala normal de partida:
--   "esse boss vai morrer", "te mato no PvP", "morre logo".
-- Como `high` OCULTA o post na hora, um falso positivo aqui e censura de
-- conteudo legitimo — pior do que deixar passar e revisar depois.
--
-- E `privacy` foi erro puro: e o nome de uma plataforma adulta brasileira, mas
-- tambem a palavra inglesa comum ("privacy policy"). Sai da lista.

DELETE FROM public.blocked_words WHERE word IN ('vai morrer', 'privacy');

-- Rebaixados para `medium`: continuam indo pra fila do admin, mas nao ocultam
-- sozinhos. Quem decide e a pessoa, olhando o contexto.
UPDATE public.blocked_words SET severity = 'medium'
 WHERE word IN ('te mato', 'morre logo', 'vou te achar', 'nudez');;
