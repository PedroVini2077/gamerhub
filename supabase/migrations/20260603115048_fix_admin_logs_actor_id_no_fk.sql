-- Remove FK de actor_id — logs de auditoria devem persistir mesmo após user deletado
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_actor_id_fkey;
;
