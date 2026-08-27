-- Gera notificações de like/comentário no servidor (trigger SECURITY DEFINER),
-- respeitando notif_likes/notif_comments do dono do post. Substitui o INSERT
-- direto do cliente (que dependia de uma policy "sempre-true" e permitia forjar
-- notificações para qualquer usuário).

create or replace function public.notify_post_like()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_owner uuid; v_title text; v_liker text; v_notif boolean;
begin
  select user_id, title into v_owner, v_title from posts where id = NEW.post_id;
  if v_owner is null or v_owner = NEW.user_id then return NEW; end if;
  select coalesce(notif_likes, true) into v_notif from profiles where id = v_owner;
  if not v_notif then return NEW; end if;
  select username into v_liker from profiles where id = NEW.user_id;
  insert into notifications (user_id, type, message)
  values (v_owner, 'like', coalesce(v_liker,'Alguém')||' curtiu seu post "'||coalesce(v_title,'')||'"');
  return NEW;
end; $$;

drop trigger if exists trg_notify_post_like on public.post_likes;
create trigger trg_notify_post_like after insert on public.post_likes
  for each row execute function public.notify_post_like();

create or replace function public.notify_post_comment()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_owner uuid; v_commenter text; v_notif boolean;
begin
  select user_id into v_owner from posts where id = NEW.post_id;
  if v_owner is null or v_owner = NEW.user_id then return NEW; end if;
  select coalesce(notif_comments, true) into v_notif from profiles where id = v_owner;
  if not v_notif then return NEW; end if;
  select username into v_commenter from profiles where id = NEW.user_id;
  insert into notifications (user_id, type, message)
  values (v_owner, 'comment', coalesce(v_commenter,'Alguém')||' comentou no seu post');
  return NEW;
end; $$;

drop trigger if exists trg_notify_post_comment on public.comments;
create trigger trg_notify_post_comment after insert on public.comments
  for each row execute function public.notify_post_comment();

-- Remove a policy "sempre-true": cliente não insere mais notificações direto.
-- Os triggers acima são SECURITY DEFINER e bypassam RLS.
drop policy if exists "Sistema insere notificacoes" on public.notifications;
;
