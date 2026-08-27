-- 1. Adiciona 'owner' ao constraint da coluna role
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['user','admin','super_admin','owner']));

-- 2. Atualiza role_rank() — owner = 4 (acima de super_admin = 3)
CREATE OR REPLACE FUNCTION role_rank(r text)
RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE r
    WHEN 'user'        THEN 1
    WHEN 'admin'       THEN 2
    WHEN 'super_admin' THEN 3
    WHEN 'owner'       THEN 4
    ELSE 0
  END;
$$;

-- 3. Atribui role owner ao opedrovini
UPDATE profiles
SET role = 'owner'
WHERE id = '7ca78f83-8bfe-4d84-803f-d42de03e22e4';
;
