-- Muda FK do live_chat para referenciar profiles diretamente
alter table live_chat drop constraint live_chat_user_id_fkey;
alter table live_chat add constraint live_chat_user_id_fkey 
  foreign key (user_id) references profiles(id) on delete cascade;
;
