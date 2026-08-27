ALTER TABLE live_chat_timeouts
DROP CONSTRAINT live_chat_timeouts_user_id_fkey;

ALTER TABLE live_chat_timeouts
ADD CONSTRAINT live_chat_timeouts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
;
