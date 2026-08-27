-- Fix: owner was excluded from admin_notifications SELECT and admin_notification_reads INSERT
-- Both policies only had ('admin', 'super_admin') — owner must be included

ALTER POLICY admins_select_notifications ON admin_notifications
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['admin', 'super_admin', 'owner'])
    )
  );

ALTER POLICY admins_insert_reads ON admin_notification_reads
  WITH CHECK (
    (SELECT auth.uid()) IN (
      SELECT profiles.id FROM profiles
      WHERE profiles.role = ANY (ARRAY['admin', 'super_admin', 'owner'])
    )
    AND admin_id = (SELECT auth.uid())
  );
;
