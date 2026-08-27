-- ─── 1. hidden_at nas tabelas de conteúdo ────────────────────────────────────
ALTER TABLE posts           ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE comments        ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS hidden_at timestamptz;

-- ─── 2. Tabelas de moderação ─────────────────────────────────────────────────

CREATE TABLE reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('post','comment','mural','chat')),
  content_id   uuid NOT NULL,
  reason       text NOT NULL CHECK (reason IN ('spam','hate','nsfw','harassment','misinformation','other')),
  details      text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (reporter_id, content_type, content_id)
);

CREATE TABLE blocked_words (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word       text UNIQUE NOT NULL,
  severity   text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE violations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_type text,
  content_id   uuid,
  reason       text,
  action_taken text CHECK (action_taken IN ('warn','hide','suspend_1d','suspend_7d','ban')),
  points       int NOT NULL DEFAULT 1,
  reviewed_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE moderation_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL,
  content_id   uuid NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('report','wordlist','ai','escalation')),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- ─── 3. Índices ───────────────────────────────────────────────────────────────
CREATE INDEX reports_content_idx       ON reports (content_type, content_id);
CREATE INDEX reports_reporter_idx      ON reports (reporter_id);
CREATE INDEX reports_status_idx        ON reports (status);
CREATE INDEX violations_user_idx       ON violations (user_id);
CREATE INDEX modq_status_idx           ON moderation_queue (status);
CREATE INDEX modq_content_idx          ON moderation_queue (content_type, content_id);

-- ─── 4. Thresholds em site_config ────────────────────────────────────────────
INSERT INTO site_config (key, value) VALUES
  ('mod_report_threshold', '3'),
  ('mod_ban_threshold',    '15'),
  ('mod_suspend_threshold','8')
ON CONFLICT (key) DO NOTHING;

-- ─── 5. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE reports          ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_words    ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

-- reports: reporter vê as próprias; admin+ vê tudo
CREATE POLICY "reports_select" ON reports FOR SELECT USING (
  (SELECT reporter_id) = (SELECT auth.uid())
  OR role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);
CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (
  reporter_id = (SELECT auth.uid()) AND (SELECT auth.uid()) IS NOT NULL
);
CREATE POLICY "reports_update" ON reports FOR UPDATE USING (
  role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);

-- blocked_words: leitura pública (necessário pro filtro client-side); escrita admin+
CREATE POLICY "blocked_words_select" ON blocked_words FOR SELECT USING (true);
CREATE POLICY "blocked_words_insert" ON blocked_words FOR INSERT WITH CHECK (
  role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);
CREATE POLICY "blocked_words_update" ON blocked_words FOR UPDATE USING (
  role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);
CREATE POLICY "blocked_words_delete" ON blocked_words FOR DELETE USING (
  role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);

-- violations: usuário vê as próprias; admin+ vê tudo
CREATE POLICY "violations_select" ON violations FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);
CREATE POLICY "violations_insert" ON violations FOR INSERT WITH CHECK (
  role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);
CREATE POLICY "violations_update" ON violations FOR UPDATE USING (
  role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);

-- moderation_queue: só admin+
CREATE POLICY "modq_select" ON moderation_queue FOR SELECT USING (
  role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);
CREATE POLICY "modq_insert" ON moderation_queue FOR INSERT WITH CHECK (
  role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
  OR current_setting('role', true) = 'supabase_admin'
);
CREATE POLICY "modq_update" ON moderation_queue FOR UPDATE USING (
  role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);

-- ─── 6. Filtrar hidden_at nas políticas SELECT existentes ────────────────────
-- Não-admins não veem conteúdo oculto; admins+ veem com banner.
DROP POLICY IF EXISTS "Public posts"     ON posts;
DROP POLICY IF EXISTS "Todos veem comentarios" ON comments;
DROP POLICY IF EXISTS "Public community" ON community_posts;

CREATE POLICY "posts_select" ON posts FOR SELECT USING (
  hidden_at IS NULL
  OR role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);
CREATE POLICY "comments_select" ON comments FOR SELECT USING (
  hidden_at IS NULL
  OR role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);
CREATE POLICY "community_posts_select" ON community_posts FOR SELECT USING (
  hidden_at IS NULL
  OR role_rank((SELECT role FROM profiles WHERE id = (SELECT auth.uid()))) >= 2
);

-- ─── 7. Função de ban automático pelo sistema ─────────────────────────────────
CREATE OR REPLACE FUNCTION apply_mod_auto_ban(p_user_id uuid, p_points int)
RETURNS void SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE v_username text;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND banned = true) THEN RETURN; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = p_user_id;

  UPDATE profiles SET
    banned              = true,
    ban_reason          = 'Banimento automático — limite de infrações atingido (' || p_points || ' pontos)',
    banned_by_username  = 'Sistema',
    banned_at           = now(),
    ban_count           = ban_count + 1
  WHERE id = p_user_id;

  DELETE FROM posts           WHERE user_id = p_user_id;
  DELETE FROM comments        WHERE user_id = p_user_id;
  DELETE FROM community_posts WHERE user_id = p_user_id;
  DELETE FROM live_chat       WHERE user_id = p_user_id;

  INSERT INTO admin_logs
    (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES (
    'auto_ban',
    '@' || v_username || ' banido automaticamente pelo sistema (' || p_points || ' pontos de infrações)',
    'security', NULL, 'Sistema', 'critical',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_username, 'points', p_points),
    NULL, 'Sistema'
  );

  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES (
    'auto_ban', 'Banimento automático',
    '@' || v_username || ' foi banido automaticamente pelo sistema (' || p_points || ' pontos).',
    'all_admins',
    jsonb_build_object('target_username', v_username, 'points', p_points)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION apply_mod_auto_ban FROM PUBLIC, anon, authenticated;

-- ─── 8. Trigger: auto-hide ao atingir threshold de denúncias ──────────────────
CREATE OR REPLACE FUNCTION handle_report_auto_hide()
RETURNS TRIGGER SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_count     int;
  v_threshold int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM reports
  WHERE content_type = NEW.content_type AND content_id = NEW.content_id;

  SELECT COALESCE(value::int, 3) INTO v_threshold
  FROM site_config WHERE key = 'mod_report_threshold';

  IF v_count >= v_threshold THEN
    -- Evita duplicar item na fila
    IF NOT EXISTS (
      SELECT 1 FROM moderation_queue
      WHERE content_type = NEW.content_type AND content_id = NEW.content_id AND status = 'pending'
    ) THEN
      INSERT INTO moderation_queue (content_type, content_id, trigger_type)
      VALUES (NEW.content_type, NEW.content_id, 'report');

      IF NEW.content_type = 'post' THEN
        UPDATE posts SET hidden_at = now() WHERE id = NEW.content_id AND hidden_at IS NULL;
      ELSIF NEW.content_type = 'comment' THEN
        UPDATE comments SET hidden_at = now() WHERE id = NEW.content_id AND hidden_at IS NULL;
      ELSIF NEW.content_type = 'mural' THEN
        UPDATE community_posts SET hidden_at = now() WHERE id = NEW.content_id AND hidden_at IS NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_report_auto_hide
AFTER INSERT ON reports
FOR EACH ROW EXECUTE FUNCTION handle_report_auto_hide();

-- ─── 9. Trigger: escalação de pontos → ban automático ────────────────────────
CREATE OR REPLACE FUNCTION handle_violation_escalation()
RETURNS TRIGGER SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_total   int;
  v_ban_thr int;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_total FROM violations WHERE user_id = NEW.user_id;
  SELECT COALESCE(value::int, 15) INTO v_ban_thr FROM site_config WHERE key = 'mod_ban_threshold';

  IF v_total >= v_ban_thr THEN
    PERFORM apply_mod_auto_ban(NEW.user_id, v_total);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_violation_escalation
AFTER INSERT ON violations
FOR EACH ROW EXECUTE FUNCTION handle_violation_escalation();
;
