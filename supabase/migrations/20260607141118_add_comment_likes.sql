CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX idx_comment_likes_comment_id ON public.comment_likes (comment_id);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos veem likes de comentario" ON public.comment_likes
  FOR SELECT USING (true);

CREATE POLICY "User insere proprio like de comentario" ON public.comment_likes
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "User remove proprio like de comentario" ON public.comment_likes
  FOR DELETE USING ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.notify_comment_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_author uuid; v_liker text; v_notif boolean;
begin
  select user_id into v_author from comments where id = NEW.comment_id;
  if v_author is null or v_author = NEW.user_id then return NEW; end if;
  select coalesce(notif_likes, true) into v_notif from profiles where id = v_author;
  if not v_notif then return NEW; end if;
  select username into v_liker from profiles where id = NEW.user_id;
  insert into notifications (user_id, type, message)
  values (v_author, 'like', coalesce(v_liker,'Alguém')||' curtiu seu comentário');
  return NEW;
end; $function$;

CREATE TRIGGER trg_notify_comment_like
  AFTER INSERT ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_like();;
