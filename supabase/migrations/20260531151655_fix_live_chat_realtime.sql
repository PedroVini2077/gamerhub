alter table live_chat replica identity full;
alter table live_chat_timeouts replica identity full;
alter publication supabase_realtime add table live_chat_timeouts;
;
