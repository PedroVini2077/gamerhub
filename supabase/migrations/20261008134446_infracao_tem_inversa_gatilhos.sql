-- `AFTER UPDATE OF hidden_at`, e a condicao WHEN e o que torna o gatilho
-- barato: ele só roda quando a coluna realmente foi de "oculto" para "no ar".
CREATE TRIGGER trg_revogar_infracao_restaurada
  AFTER UPDATE OF hidden_at ON public.posts
  FOR EACH ROW
  WHEN (OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL)
  EXECUTE FUNCTION public.revogar_infracao_de_conteudo_restaurado();

CREATE TRIGGER trg_revogar_infracao_restaurada
  AFTER UPDATE OF hidden_at ON public.comments
  FOR EACH ROW
  WHEN (OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL)
  EXECUTE FUNCTION public.revogar_infracao_de_conteudo_restaurado();

CREATE TRIGGER trg_revogar_infracao_restaurada
  AFTER UPDATE OF hidden_at ON public.community_posts
  FOR EACH ROW
  WHEN (OLD.hidden_at IS NOT NULL AND NEW.hidden_at IS NULL)
  EXECUTE FUNCTION public.revogar_infracao_de_conteudo_restaurado();
