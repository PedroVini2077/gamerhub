-- `alertar_enchente_de_contato()` é função de TRIGGER: ela não tem por que
-- estar exposta em /rest/v1/rpc/. O `get_advisors` acusou logo depois da
-- migration anterior, na mesma classe do `checar_palavras_bloqueadas`.
--
-- Chamá-la de fora não faria estrago (ela só lê contadores e, no máximo,
-- gravaria uma linha de alarme), mas função de trigger na superfície pública
-- é superfície que ninguém revisa — e o padrão do projeto é fechar.
REVOKE ALL ON FUNCTION public.alertar_enchente_de_contato() FROM PUBLIC, anon, authenticated;
