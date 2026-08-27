-- Revisao da minha propria lista, terceira vez. O controle de falso positivo
-- pegou "as antas do zoologico e o pateta da Disney" caindo na fila.
--
-- `pateta` e o nome do personagem da Disney em portugues — num site de jogos e
-- cultura pop isso e garantia de ruido.
-- `anta` e o animal antes de ser xingamento.
-- `mane` sem acento e mais provavel ser nome proprio (Mane Garrincha) ou erro
-- de digitacao do que ofensa; `mane` com acento fica.
--
-- Nenhum dos tres oculta nada (sao `medium`), mas fila cheia de ruido faz o
-- moderador parar de olhar a fila — e ai o que importa passa junto.

DELETE FROM public.blocked_words WHERE word IN ('anta', 'pateta', 'mane');;
