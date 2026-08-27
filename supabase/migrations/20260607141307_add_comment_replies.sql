ALTER TABLE public.comments ADD COLUMN parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;
CREATE INDEX idx_comments_parent_id ON public.comments (parent_id);

CREATE OR REPLACE FUNCTION public.notify_post_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_target uuid; v_commenter text; v_notif boolean; v_is_reply boolean;
begin
  v_is_reply := NEW.parent_id is not null;
  if v_is_reply then
    select user_id into v_target from comments where id = NEW.parent_id;
  else
    select user_id into v_target from posts where id = NEW.post_id;
  end if;
  if v_target is null or v_target = NEW.user_id then return NEW; end if;
  select coalesce(notif_comments, true) into v_notif from profiles where id = v_target;
  if not v_notif then return NEW; end if;
  select username into v_commenter from profiles where id = NEW.user_id;
  insert into notifications (user_id, type, message)
  values (v_target, 'comment',
    coalesce(v_commenter,'Alguém') || (case when v_is_reply then ' respondeu seu comentário' else ' comentou no seu post' end));
  return NEW;
end; $function$;;
