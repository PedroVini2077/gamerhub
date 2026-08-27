-- Lives de jogadores: categoria opcional da live (gameplay/react/outro) +
-- rótulo livre quando "outro". null = post/live comum (comportamento atual).
ALTER TABLE public.posts ADD COLUMN live_kind text;
ALTER TABLE public.posts ADD COLUMN live_kind_label text;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_live_kind_check
  CHECK (live_kind IN ('gameplay', 'react', 'outro'));

-- Quando o tipo for "outro", exige um rótulo descritivo.
ALTER TABLE public.posts
  ADD CONSTRAINT posts_live_kind_label_check
  CHECK (live_kind IS DISTINCT FROM 'outro' OR live_kind_label IS NOT NULL);

COMMENT ON COLUMN public.posts.live_kind IS 'Tipo de live de jogador: gameplay, react, outro. null = post/live comum (aparece no feed).';
COMMENT ON COLUMN public.posts.live_kind_label IS 'Rótulo livre descrevendo a live quando live_kind = outro.';;
