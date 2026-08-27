-- admin_id agora é nullable — logs de sistema/conteúdo não têm admin_id
ALTER TABLE admin_logs ALTER COLUMN admin_id DROP NOT NULL;
;
