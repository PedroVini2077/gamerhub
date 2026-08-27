CREATE POLICY "Admin e dono atualizam timeout"
ON live_chat_timeouts
FOR UPDATE
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin'))
  OR
  auth.uid() IN (SELECT user_id FROM posts WHERE id = live_chat_timeouts.post_id)
)
WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin'))
  OR
  auth.uid() IN (SELECT user_id FROM posts WHERE id = live_chat_timeouts.post_id)
);
;
