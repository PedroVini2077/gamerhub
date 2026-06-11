-- ============================================================
-- GamerHub — Database Schema Backup
-- Supabase Project: yuqbdcoljlvncxdnesxk
-- Date: 2026-06-11
-- ============================================================
-- This file contains the full DDL to recreate the GamerHub
-- schema from scratch: tables, constraints, indexes, RLS
-- policies, triggers, and stored functions.
-- ============================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────
-- These are enabled by default on Supabase:
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()
-- pg_cron is used for scheduled jobs (enable via Supabase dashboard).


-- ============================================================
-- SECTION 1 — TABLES
-- ============================================================

-- ─── profiles ───────────────────────────────────────────────
-- 1:1 with auth.users. Central table for user data.
CREATE TABLE public.profiles (
  id                  uuid                     NOT NULL,
  username            text                     NOT NULL UNIQUE,
  avatar_url          text,
  bio                 text,
  created_at          timestamp with time zone DEFAULT now(),
  role                text                     DEFAULT 'user'
                        CHECK (role = ANY (ARRAY['user','admin','super_admin','owner'])),
  banned              boolean                  DEFAULT false,
  notif_likes         boolean                  DEFAULT true,
  notif_comments      boolean                  DEFAULT true,
  birth_date          date,
  state               character varying,
  platform            text
                        CHECK (platform IS NULL OR platform = ANY (
                          ARRAY['PC','PlayStation','Xbox','Mobile','Switch','Multi'])),
  favorite_games      text,
  discord             text,
  twitch              text,
  youtube             text,
  playstyle           text
                        CHECK (playstyle IS NULL OR playstyle = ANY (
                          ARRAY['casual','competitivo','ambos'])),
  ban_reason          text,
  ban_details         text,
  banned_by           uuid,
  banned_by_username  text,
  banned_at           timestamp with time zone,
  ban_count           integer                  NOT NULL DEFAULT 0,
  role_changed_at     timestamp with time zone NOT NULL DEFAULT now(),
  suspended_until     timestamp with time zone,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey       FOREIGN KEY (id)        REFERENCES auth.users (id),
  ADD CONSTRAINT profiles_banned_by_fkey FOREIGN KEY (banned_by) REFERENCES auth.users (id);


-- ─── posts ──────────────────────────────────────────────────
CREATE TABLE public.posts (
  id              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid,
  title           text                     NOT NULL,
  content         text,
  category        text                     DEFAULT 'dica',
  likes           integer                  DEFAULT 0,
  created_at      timestamp with time zone DEFAULT now(),
  media_url       text,
  media_type      text,
  edited_at       timestamp with time zone,
  audio_url       text,
  audio_type      text,
  audio_name      text,
  embed_url       text,
  embed_type      text,
  expires_at      timestamp with time zone,
  is_live         boolean                  DEFAULT false,
  was_live        boolean                  NOT NULL DEFAULT false,
  live_ended_at   timestamp with time zone,
  live_kind       text
                    CHECK (live_kind = ANY (ARRAY['gameplay','react','outro'])),
  live_kind_label text,
  hidden_at       timestamp with time zone,
  deleted_at      timestamp with time zone,
  CONSTRAINT posts_pkey PRIMARY KEY (id)
);

COMMENT ON COLUMN public.posts.live_kind IS
  'Tipo de live de jogador: gameplay, react, outro. null = post/live comum (aparece no feed).';
COMMENT ON COLUMN public.posts.live_kind_label IS
  'Rótulo livre descrevendo a live quando live_kind = outro.';

ALTER TABLE public.posts
  ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id);


-- ─── post_media ─────────────────────────────────────────────
CREATE TABLE public.post_media (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  post_id    uuid,
  url        text                     NOT NULL,
  type       text                     NOT NULL
               CHECK (type = ANY (ARRAY['image','video','audio'])),
  position   integer                  DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_media_pkey PRIMARY KEY (id)
);

ALTER TABLE public.post_media
  ADD CONSTRAINT post_media_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts (id);


-- ─── post_likes ─────────────────────────────────────────────
CREATE TABLE public.post_likes (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  post_id    uuid,
  user_id    uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT post_likes_pkey PRIMARY KEY (id),
  CONSTRAINT post_likes_post_id_user_id_key UNIQUE (post_id, user_id)
);

ALTER TABLE public.post_likes
  ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts    (id),
  ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id);


-- ─── comments ───────────────────────────────────────────────
CREATE TABLE public.comments (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  post_id    uuid,
  user_id    uuid,
  content    text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  parent_id  uuid,
  hidden_at  timestamp with time zone,
  CONSTRAINT comments_pkey PRIMARY KEY (id)
);

ALTER TABLE public.comments
  ADD CONSTRAINT comments_post_id_fkey   FOREIGN KEY (post_id)   REFERENCES public.posts     (id),
  ADD CONSTRAINT comments_user_id_fkey   FOREIGN KEY (user_id)   REFERENCES public.profiles  (id),
  ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments  (id);


-- ─── comment_likes ──────────────────────────────────────────
CREATE TABLE public.comment_likes (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  comment_id uuid                     NOT NULL,
  user_id    uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comment_likes_pkey                  PRIMARY KEY (id),
  CONSTRAINT comment_likes_comment_id_user_id_key UNIQUE (comment_id, user_id)
);

ALTER TABLE public.comment_likes
  ADD CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.comments (id),
  ADD CONSTRAINT comment_likes_user_id_fkey    FOREIGN KEY (user_id)    REFERENCES public.profiles (id);


-- ─── community_posts ────────────────────────────────────────
CREATE TABLE public.community_posts (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid,
  message    text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  hidden_at  timestamp with time zone,
  CONSTRAINT community_posts_pkey PRIMARY KEY (id)
);

ALTER TABLE public.community_posts
  ADD CONSTRAINT community_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id);


-- ─── community_post_media ───────────────────────────────────
CREATE TABLE public.community_post_media (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  post_id    uuid                     NOT NULL,
  url        text                     NOT NULL,
  type       text                     NOT NULL DEFAULT 'image',
  position   integer                  NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT community_post_media_pkey PRIMARY KEY (id)
);

ALTER TABLE public.community_post_media
  ADD CONSTRAINT community_post_media_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts (id);


-- ─── community_post_likes ───────────────────────────────────
CREATE TABLE public.community_post_likes (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  post_id    uuid                     NOT NULL,
  user_id    uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT community_post_likes_pkey                 PRIMARY KEY (id),
  CONSTRAINT community_post_likes_post_id_user_id_key  UNIQUE (post_id, user_id)
);

ALTER TABLE public.community_post_likes
  ADD CONSTRAINT community_post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles       (id),
  ADD CONSTRAINT community_post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.community_posts (id);


-- ─── notifications ──────────────────────────────────────────
-- User-facing notifications (likes, comments, replies).
CREATE TABLE public.notifications (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid,
  type       text                     NOT NULL,
  message    text                     NOT NULL,
  read       boolean                  DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id);


-- ─── game_keys ──────────────────────────────────────────────
CREATE TABLE public.game_keys (
  id               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  game_title       text                     NOT NULL,
  platform         text                     NOT NULL,
  key_code         text,
  is_promo         boolean                  DEFAULT false,
  promo_url        text,
  discount_percent integer,
  expires_at       timestamp with time zone,
  created_at       timestamp with time zone DEFAULT now(),
  CONSTRAINT game_keys_pkey PRIMARY KEY (id)
);


-- ─── live_chat ──────────────────────────────────────────────
CREATE TABLE public.live_chat (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  post_id    uuid,
  user_id    uuid,
  message    text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT live_chat_pkey PRIMARY KEY (id)
);

ALTER TABLE public.live_chat
  ADD CONSTRAINT live_chat_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id),
  ADD CONSTRAINT live_chat_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts    (id);


-- ─── live_muted ─────────────────────────────────────────────
CREATE TABLE public.live_muted (
  id          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  post_id     uuid,
  user_id     uuid,
  muted_until timestamp with time zone NOT NULL,
  created_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT live_muted_pkey                  PRIMARY KEY (id),
  CONSTRAINT live_muted_post_id_user_id_key   UNIQUE (post_id, user_id)
);

ALTER TABLE public.live_muted
  ADD CONSTRAINT live_muted_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts      (id),
  ADD CONSTRAINT live_muted_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users         (id);


-- ─── live_chat_timeouts ─────────────────────────────────────
CREATE TABLE public.live_chat_timeouts (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  post_id    uuid,
  user_id    uuid,
  expires_at timestamp with time zone NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT live_chat_timeouts_pkey                PRIMARY KEY (id),
  CONSTRAINT live_chat_timeouts_post_id_user_id_key UNIQUE (post_id, user_id)
);

ALTER TABLE public.live_chat_timeouts
  ADD CONSTRAINT live_chat_timeouts_user_id_fkey    FOREIGN KEY (user_id)    REFERENCES public.profiles (id),
  ADD CONSTRAINT live_chat_timeouts_post_id_fkey    FOREIGN KEY (post_id)    REFERENCES public.posts    (id),
  ADD CONSTRAINT live_chat_timeouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users      (id);


-- ─── live_reactivation_requests ─────────────────────────────
CREATE TABLE public.live_reactivation_requests (
  id                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  post_id           uuid,
  post_title        text                     NOT NULL,
  admin_id          uuid                     NOT NULL,
  admin_username    text                     NOT NULL,
  reason            text                     NOT NULL,
  details           text,
  status            text                     NOT NULL DEFAULT 'pending'
                      CHECK (status = ANY (ARRAY['pending','approved','denied'])),
  reviewed_by       uuid,
  reviewer_username text,
  reviewed_at       timestamp with time zone,
  created_at        timestamp with time zone DEFAULT now(),
  CONSTRAINT live_reactivation_requests_pkey PRIMARY KEY (id)
);

ALTER TABLE public.live_reactivation_requests
  ADD CONSTRAINT live_reactivation_requests_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts (id);


-- ─── unban_requests ─────────────────────────────────────────
CREATE TABLE public.unban_requests (
  id                        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  target_user_id            uuid                     NOT NULL,
  target_username           text                     NOT NULL,
  requesting_admin_id       uuid                     NOT NULL,
  requesting_admin_username text                     NOT NULL,
  reason                    text                     NOT NULL,
  status                    text                     NOT NULL DEFAULT 'pending'
                              CHECK (status = ANY (ARRAY['pending','approved','denied'])),
  created_at                timestamp with time zone DEFAULT now(),
  reviewed_by               uuid,
  reviewed_by_username      text,
  reviewed_at               timestamp with time zone,
  review_note               text,
  CONSTRAINT unban_requests_pkey PRIMARY KEY (id)
);

ALTER TABLE public.unban_requests
  ADD CONSTRAINT unban_requests_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.profiles (id);


-- ─── login_attempts ─────────────────────────────────────────
-- No direct client access (RLS policy: false for ALL).
CREATE TABLE public.login_attempts (
  email        text                     NOT NULL,
  attempts     integer                  NOT NULL DEFAULT 0,
  blocked_until timestamp with time zone,
  updated_at   timestamp with time zone NOT NULL DEFAULT now(),
  permanent    boolean                  NOT NULL DEFAULT false,
  CONSTRAINT login_attempts_pkey PRIMARY KEY (email)
);


-- ─── admin_logs ─────────────────────────────────────────────
CREATE TABLE public.admin_logs (
  id             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  admin_id       uuid,
  admin_username text                     NOT NULL,
  action         text                     NOT NULL,
  details        text,
  created_at     timestamp with time zone DEFAULT now(),
  category       text                     NOT NULL DEFAULT 'admin',
  actor_id       uuid,
  actor_username text,
  severity       text                     NOT NULL DEFAULT 'info',
  metadata       jsonb,
  CONSTRAINT admin_logs_pkey PRIMARY KEY (id)
);


-- ─── admin_notifications ────────────────────────────────────
CREATE TABLE public.admin_notifications (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  type       text                     NOT NULL,
  title      text                     NOT NULL,
  message    text                     NOT NULL,
  audience   text                     NOT NULL DEFAULT 'all_admins'
               CHECK (audience = ANY (ARRAY['all_admins','super_admin','owner'])),
  metadata   jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_notifications_pkey PRIMARY KEY (id)
);


-- ─── admin_notification_reads ───────────────────────────────
CREATE TABLE public.admin_notification_reads (
  notification_id uuid                     NOT NULL,
  admin_id        uuid                     NOT NULL,
  read_at         timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_notification_reads_pkey PRIMARY KEY (notification_id, admin_id)
);

ALTER TABLE public.admin_notification_reads
  ADD CONSTRAINT admin_notification_reads_notification_id_fkey
    FOREIGN KEY (notification_id) REFERENCES public.admin_notifications (id);


-- ─── site_config ────────────────────────────────────────────
-- Key/value global config. Only owner can write.
CREATE TABLE public.site_config (
  key        text                     NOT NULL,
  value      text                     NOT NULL DEFAULT '',
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT site_config_pkey PRIMARY KEY (key)
);

ALTER TABLE public.site_config
  ADD CONSTRAINT site_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users (id);


-- ─── reports ────────────────────────────────────────────────
CREATE TABLE public.reports (
  id           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  reporter_id  uuid,
  content_type text                     NOT NULL
                 CHECK (content_type = ANY (ARRAY['post','comment','mural','chat'])),
  content_id   uuid                     NOT NULL,
  reason       text                     NOT NULL
                 CHECK (reason = ANY (ARRAY['spam','hate','nsfw','harassment','misinformation','other'])),
  details      text,
  status       text                     NOT NULL DEFAULT 'pending'
                 CHECK (status = ANY (ARRAY['pending','reviewed','dismissed'])),
  created_at   timestamp with time zone DEFAULT now(),
  CONSTRAINT reports_pkey                                            PRIMARY KEY (id),
  CONSTRAINT reports_reporter_id_content_type_content_id_key UNIQUE (reporter_id, content_type, content_id)
);

ALTER TABLE public.reports
  ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles (id);


-- ─── blocked_words ──────────────────────────────────────────
CREATE TABLE public.blocked_words (
  id         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  word       text                     NOT NULL UNIQUE,
  severity   text                     NOT NULL DEFAULT 'medium'
               CHECK (severity = ANY (ARRAY['low','medium','high'])),
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT blocked_words_pkey PRIMARY KEY (id)
);

ALTER TABLE public.blocked_words
  ADD CONSTRAINT blocked_words_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles (id);


-- ─── violations ─────────────────────────────────────────────
CREATE TABLE public.violations (
  id           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  user_id      uuid                     NOT NULL,
  content_type text,
  content_id   uuid,
  reason       text,
  action_taken text
                 CHECK (action_taken = ANY (ARRAY['warn','hide','suspend_1d','suspend_7d','ban'])),
  points       integer                  NOT NULL DEFAULT 1,
  reviewed_by  uuid,
  notes        text,
  created_at   timestamp with time zone DEFAULT now(),
  CONSTRAINT violations_pkey PRIMARY KEY (id)
);

ALTER TABLE public.violations
  ADD CONSTRAINT violations_user_id_fkey     FOREIGN KEY (user_id)     REFERENCES public.profiles (id),
  ADD CONSTRAINT violations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles (id);


-- ─── moderation_queue ───────────────────────────────────────
CREATE TABLE public.moderation_queue (
  id           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  content_type text                     NOT NULL,
  content_id   uuid                     NOT NULL,
  trigger_type text                     NOT NULL
                 CHECK (trigger_type = ANY (ARRAY['report','wordlist','ai','escalation','links'])),
  status       text                     NOT NULL DEFAULT 'pending'
                 CHECK (status = ANY (ARRAY['pending','approved','rejected'])),
  reviewed_by  uuid,
  reviewed_at  timestamp with time zone,
  created_at   timestamp with time zone DEFAULT now(),
  metadata     jsonb,
  CONSTRAINT moderation_queue_pkey PRIMARY KEY (id)
);

ALTER TABLE public.moderation_queue
  ADD CONSTRAINT moderation_queue_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles (id);


-- ─── staff_nominations ──────────────────────────────────────
CREATE TABLE public.staff_nominations (
  id                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  candidate_id          uuid                     NOT NULL,
  nominated_by          uuid,
  target_role           text                     NOT NULL
                          CHECK (target_role = ANY (ARRAY['admin','super_admin'])),
  status                text                     NOT NULL DEFAULT 'pending'
                          CHECK (status = ANY (
                            ARRAY['pending','rejected','trial_active','confirmed','reverted','cancelled'])),
  eligibility_snapshot  jsonb,
  review_notes          text,
  reviewed_by           uuid,
  decided_at            timestamp with time zone,
  trial_started_at      timestamp with time zone,
  trial_review_date     timestamp with time zone,
  final_decision_notes  text,
  final_decided_by      uuid,
  final_decided_at      timestamp with time zone,
  created_at            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT staff_nominations_pkey PRIMARY KEY (id),
  CONSTRAINT uniq_staff_nominations_active_candidate
    UNIQUE (candidate_id) WHERE (status = ANY (ARRAY['pending','trial_active']))
);

ALTER TABLE public.staff_nominations
  ADD CONSTRAINT staff_nominations_candidate_id_fkey    FOREIGN KEY (candidate_id)   REFERENCES public.profiles (id),
  ADD CONSTRAINT staff_nominations_nominated_by_fkey    FOREIGN KEY (nominated_by)   REFERENCES public.profiles (id),
  ADD CONSTRAINT staff_nominations_reviewed_by_fkey     FOREIGN KEY (reviewed_by)    REFERENCES public.profiles (id),
  ADD CONSTRAINT staff_nominations_final_decided_by_fkey FOREIGN KEY (final_decided_by) REFERENCES public.profiles (id);


-- ─── role_change_requests ───────────────────────────────────
CREATE TABLE public.role_change_requests (
  id            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  target_id     uuid                     NOT NULL,
  requested_by  uuid                     NOT NULL,
  previous_role text                     NOT NULL,
  proposed_role text                     NOT NULL,
  reason        text                     NOT NULL,
  status        text                     NOT NULL DEFAULT 'pending'
                  CHECK (status = ANY (ARRAY['pending','approved','rejected'])),
  reviewed_by   uuid,
  review_notes  text,
  decided_at    timestamp with time zone,
  created_at    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT role_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT uniq_role_change_requests_pending_target
    UNIQUE (target_id) WHERE (status = 'pending')
);

ALTER TABLE public.role_change_requests
  ADD CONSTRAINT role_change_requests_target_id_fkey   FOREIGN KEY (target_id)    REFERENCES public.profiles (id),
  ADD CONSTRAINT role_change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles (id),
  ADD CONSTRAINT role_change_requests_reviewed_by_fkey  FOREIGN KEY (reviewed_by)  REFERENCES public.profiles (id);


-- ============================================================
-- SECTION 2 — ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_media       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_likes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_keys                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_muted                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_timeouts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_reactivation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unban_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_reads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_config                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_words              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violations                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_nominations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_change_requests       ENABLE ROW LEVEL SECURITY;

-- ─── profiles ───────────────────────────────────────────────
CREATE POLICY "Todos podem ver profiles"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Usuario insere proprio profile"
  ON public.profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update"
  ON public.profiles FOR UPDATE
  USING (
    ((SELECT auth.uid()) = id)
    OR ((SELECT auth.uid()) IN (
      SELECT p.id FROM profiles p
      WHERE p.role = ANY (ARRAY['admin','super_admin'])
    ))
  );

-- ─── posts ──────────────────────────────────────────────────
CREATE POLICY "posts_select"
  ON public.posts FOR SELECT
  USING (
    ((deleted_at IS NULL) OR (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2))
    AND
    ((hidden_at IS NULL)  OR (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2))
  );

CREATE POLICY "posts_insert"
  ON public.posts FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id)
    AND (NOT ((SELECT auth.uid()) IN (
      SELECT profiles.id FROM profiles
      WHERE (profiles.banned = true)
         OR (profiles.suspended_until IS NOT NULL AND profiles.suspended_until > now())
    )))
  );

CREATE POLICY "posts_update"
  ON public.posts FOR UPDATE
  USING (
    ((SELECT auth.uid()) = user_id)
    OR ((SELECT auth.uid()) IN (
      SELECT profiles.id FROM profiles
      WHERE profiles.role = ANY (ARRAY['admin','super_admin'])
    ))
  );

CREATE POLICY "posts_delete"
  ON public.posts FOR DELETE TO authenticated
  USING (
    ((SELECT auth.uid()) = user_id)
    OR can_moderate_content(user_id)
  );

-- ─── post_media ─────────────────────────────────────────────
CREATE POLICY "Todos veem midias"       ON public.post_media FOR SELECT USING (true);
CREATE POLICY "Auth insere midia"       ON public.post_media FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "Auth deleta propria midia" ON public.post_media FOR DELETE
  USING ((SELECT auth.uid()) IN (SELECT posts.user_id FROM posts WHERE posts.id = post_media.post_id));

-- ─── post_likes ─────────────────────────────────────────────
CREATE POLICY "Todos veem likes"       ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "User insere proprio like" ON public.post_likes FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "User remove proprio like" ON public.post_likes FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ─── comments ───────────────────────────────────────────────
CREATE POLICY "comments_select"
  ON public.comments FOR SELECT
  USING (
    (hidden_at IS NULL)
    OR (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2)
  );

CREATE POLICY "comments_insert"
  ON public.comments FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id)
    AND (NOT ((SELECT auth.uid()) IN (
      SELECT profiles.id FROM profiles
      WHERE (profiles.banned = true)
         OR (profiles.suspended_until IS NOT NULL AND profiles.suspended_until > now())
    )))
  );

CREATE POLICY "comments_delete"
  ON public.comments FOR DELETE TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR can_moderate_content(user_id));

-- ─── comment_likes ──────────────────────────────────────────
CREATE POLICY "Todos veem likes de comentario"       ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "User insere proprio like de comentario" ON public.comment_likes FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "User remove proprio like de comentario" ON public.comment_likes FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ─── community_posts ────────────────────────────────────────
CREATE POLICY "community_posts_select"
  ON public.community_posts FOR SELECT
  USING (
    (hidden_at IS NULL)
    OR (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2)
  );

CREATE POLICY "community_posts_insert"
  ON public.community_posts FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id)
    AND (NOT ((SELECT auth.uid()) IN (
      SELECT profiles.id FROM profiles
      WHERE (profiles.banned = true)
         OR (profiles.suspended_until IS NOT NULL AND profiles.suspended_until > now())
    )))
  );

CREATE POLICY "community_posts_delete"
  ON public.community_posts FOR DELETE TO authenticated
  USING (((SELECT auth.uid()) = user_id) OR can_moderate_content(user_id));

-- ─── community_post_media ───────────────────────────────────
CREATE POLICY "cpm_select" ON public.community_post_media FOR SELECT USING (true);
CREATE POLICY "cpm_insert" ON public.community_post_media FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IN (SELECT community_posts.user_id FROM community_posts WHERE community_posts.id = community_post_media.post_id));
CREATE POLICY "cpm_delete" ON public.community_post_media FOR DELETE
  USING (
    ((SELECT auth.uid()) IN (SELECT community_posts.user_id FROM community_posts WHERE community_posts.id = community_post_media.post_id))
    OR ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])))
  );

-- ─── community_post_likes ───────────────────────────────────
CREATE POLICY "cpl_select" ON public.community_post_likes FOR SELECT USING (true);
CREATE POLICY "cpl_insert" ON public.community_post_likes FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id)
    AND (NOT ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.banned = true)))
  );
CREATE POLICY "cpl_delete" ON public.community_post_likes FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ─── notifications ──────────────────────────────────────────
-- INSERT is intentionally omitted (done via SECURITY DEFINER triggers only).
CREATE POLICY "User ve proprias notificacoes" ON public.notifications FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "User marca como lida"          ON public.notifications FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- ─── game_keys ──────────────────────────────────────────────
CREATE POLICY "Public keys"       ON public.game_keys FOR SELECT USING (true);
CREATE POLICY "Admins inserem keys" ON public.game_keys FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])));
CREATE POLICY "Admins atualizam keys" ON public.game_keys FOR UPDATE
  USING ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])))
  WITH CHECK ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])));
CREATE POLICY "Admins deletam keys" ON public.game_keys FOR DELETE
  USING ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])));

-- ─── live_chat ──────────────────────────────────────────────
CREATE POLICY "Todos veem chat" ON public.live_chat FOR SELECT USING (true);
CREATE POLICY "live_chat_insert" ON public.live_chat FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) = user_id)
    AND (NOT ((SELECT auth.uid()) IN (
      SELECT profiles.id FROM profiles
      WHERE (profiles.banned = true)
         OR (profiles.suspended_until IS NOT NULL AND profiles.suspended_until > now())
    )))
  );
CREATE POLICY "Dono e admin deletam mensagens" ON public.live_chat FOR DELETE TO authenticated
  USING (
    ((SELECT auth.uid()) = user_id)
    OR ((SELECT auth.uid()) IN (SELECT posts.user_id FROM posts WHERE posts.id = live_chat.post_id))
    OR can_moderate_content(user_id)
  );

-- ─── live_muted ─────────────────────────────────────────────
CREATE POLICY "Todos veem silenciados" ON public.live_muted FOR SELECT USING (true);
CREATE POLICY "Admin e dono silenciam" ON public.live_muted FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])))
    OR ((SELECT auth.uid()) IN (SELECT posts.user_id FROM posts WHERE posts.id = live_muted.post_id))
  );
CREATE POLICY "Admin e dono removem silencio" ON public.live_muted FOR DELETE
  USING (
    ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])))
    OR ((SELECT auth.uid()) IN (SELECT posts.user_id FROM posts WHERE posts.id = live_muted.post_id))
  );

-- ─── live_chat_timeouts ─────────────────────────────────────
CREATE POLICY "Todos veem timeouts" ON public.live_chat_timeouts FOR SELECT USING (true);
CREATE POLICY "Admin e dono criam timeout" ON public.live_chat_timeouts FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])))
    OR ((SELECT auth.uid()) IN (SELECT posts.user_id FROM posts WHERE posts.id = live_chat_timeouts.post_id))
  );
CREATE POLICY "Admin e dono atualizam timeout" ON public.live_chat_timeouts FOR UPDATE
  USING (
    ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])))
    OR ((SELECT auth.uid()) IN (SELECT posts.user_id FROM posts WHERE posts.id = live_chat_timeouts.post_id))
  )
  WITH CHECK (
    ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])))
    OR ((SELECT auth.uid()) IN (SELECT posts.user_id FROM posts WHERE posts.id = live_chat_timeouts.post_id))
  );
CREATE POLICY "Admin e dono deletam timeout" ON public.live_chat_timeouts FOR DELETE
  USING (
    ((SELECT auth.uid()) IN (SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])))
    OR ((SELECT auth.uid()) IN (SELECT posts.user_id FROM posts WHERE posts.id = live_chat_timeouts.post_id))
  );

-- ─── live_reactivation_requests ─────────────────────────────
CREATE POLICY "admins_insert_requests" ON public.live_reactivation_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = ANY (ARRAY['admin','super_admin'])
      AND NOT profiles.banned
  ));
CREATE POLICY "select_own_or_superadmin_requests" ON public.live_reactivation_requests FOR SELECT TO authenticated
  USING (
    (admin_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin')
  );
CREATE POLICY "superadmin_update_requests" ON public.live_reactivation_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'super_admin'));

-- ─── unban_requests ─────────────────────────────────────────
CREATE POLICY "unban_req_select_scoped" ON public.unban_requests FOR SELECT TO authenticated
  USING (
    (requesting_admin_id = (SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = ANY (ARRAY['super_admin','owner'])
    )
  );

-- ─── login_attempts ─────────────────────────────────────────
CREATE POLICY "no_direct_access" ON public.login_attempts FOR ALL USING (false);

-- ─── admin_logs ─────────────────────────────────────────────
CREATE POLICY "admin_logs_select" ON public.admin_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = ANY (ARRAY['admin','super_admin','owner'])
  ));
CREATE POLICY "admins_insert_logs" ON public.admin_logs FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IN (
    SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin'])
  ));

-- ─── admin_notifications ────────────────────────────────────
CREATE POLICY "admins_select_notifications" ON public.admin_notifications FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = ANY (ARRAY['admin','super_admin','owner'])
  ));

-- ─── admin_notification_reads ───────────────────────────────
CREATE POLICY "admins_select_reads" ON public.admin_notification_reads FOR SELECT TO authenticated
  USING (admin_id = (SELECT auth.uid()));
CREATE POLICY "admins_insert_reads" ON public.admin_notification_reads FOR INSERT
  WITH CHECK (
    ((SELECT auth.uid()) IN (
      SELECT profiles.id FROM profiles WHERE profiles.role = ANY (ARRAY['admin','super_admin','owner'])
    ))
    AND (admin_id = (SELECT auth.uid()))
  );

-- ─── site_config ────────────────────────────────────────────
CREATE POLICY "site_config_select_all"   ON public.site_config FOR SELECT USING (true);
CREATE POLICY "site_config_owner_insert" ON public.site_config FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));
CREATE POLICY "site_config_owner_update" ON public.site_config FOR UPDATE
  USING   (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));
CREATE POLICY "site_config_owner_delete" ON public.site_config FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'owner'));

-- ─── reports ────────────────────────────────────────────────
CREATE POLICY "reports_insert" ON public.reports FOR INSERT
  WITH CHECK ((reporter_id = (SELECT auth.uid())) AND ((SELECT auth.uid()) IS NOT NULL));
CREATE POLICY "reports_select" ON public.reports FOR SELECT
  USING (
    ((SELECT reports.reporter_id) = (SELECT auth.uid()))
    OR (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2)
  );
CREATE POLICY "reports_update" ON public.reports FOR UPDATE
  USING (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2);

-- ─── blocked_words ──────────────────────────────────────────
CREATE POLICY "blocked_words_select" ON public.blocked_words FOR SELECT USING (true);
CREATE POLICY "blocked_words_insert" ON public.blocked_words FOR INSERT
  WITH CHECK (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2);
CREATE POLICY "blocked_words_update" ON public.blocked_words FOR UPDATE
  USING (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2);
CREATE POLICY "blocked_words_delete" ON public.blocked_words FOR DELETE
  USING (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2);

-- ─── violations ─────────────────────────────────────────────
CREATE POLICY "violations_select" ON public.violations FOR SELECT
  USING (
    (user_id = (SELECT auth.uid()))
    OR (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2)
  );
CREATE POLICY "violations_insert" ON public.violations FOR INSERT
  WITH CHECK (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2);
CREATE POLICY "violations_update" ON public.violations FOR UPDATE
  USING (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2);

-- ─── moderation_queue ───────────────────────────────────────
CREATE POLICY "modq_select" ON public.moderation_queue FOR SELECT
  USING (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2);
CREATE POLICY "modq_insert" ON public.moderation_queue FOR INSERT
  WITH CHECK (
    (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2)
    OR (current_setting('role', true) = 'supabase_admin')
  );
CREATE POLICY "modq_update" ON public.moderation_queue FOR UPDATE
  USING (role_rank((SELECT profiles.role FROM profiles WHERE profiles.id = (SELECT auth.uid()))) >= 2);

-- ─── staff_nominations ──────────────────────────────────────
CREATE POLICY "staff_nominations_select" ON public.staff_nominations FOR SELECT
  USING (
    (auth.uid() = candidate_id)
    OR (auth.uid() = nominated_by)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['super_admin','owner'])
    )
  );

-- ─── role_change_requests ───────────────────────────────────
CREATE POLICY "role_change_requests_select" ON public.role_change_requests FOR SELECT
  USING (
    (auth.uid() = requested_by)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['super_admin','owner'])
    )
  );


-- ============================================================
-- SECTION 3 — INDEXES
-- ============================================================

CREATE INDEX idx_admin_logs_category      ON public.admin_logs           USING btree (category);
CREATE INDEX idx_admin_logs_created       ON public.admin_logs           USING btree (created_at DESC);
CREATE INDEX idx_comment_likes_comment_id ON public.comment_likes        USING btree (comment_id);
CREATE INDEX idx_comments_parent_id       ON public.comments             USING btree (parent_id);
CREATE INDEX idx_comments_post_id         ON public.comments             USING btree (post_id);
CREATE INDEX idx_comments_user_id         ON public.comments             USING btree (user_id);
CREATE INDEX community_post_likes_post_id_idx    ON public.community_post_likes USING btree (post_id);
CREATE INDEX community_post_media_post_id_idx    ON public.community_post_media USING btree (post_id);
CREATE INDEX idx_community_posts_user_id  ON public.community_posts      USING btree (user_id);
CREATE INDEX idx_live_chat_post_id        ON public.live_chat            USING btree (post_id);
CREATE INDEX idx_live_chat_user_id        ON public.live_chat            USING btree (user_id);
CREATE INDEX idx_live_chat_timeouts_created_by ON public.live_chat_timeouts USING btree (created_by);
CREATE INDEX idx_live_chat_timeouts_user_id    ON public.live_chat_timeouts USING btree (user_id);
CREATE INDEX idx_live_muted_user_id       ON public.live_muted           USING btree (user_id);
CREATE INDEX idx_live_reactivation_post_id ON public.live_reactivation_requests USING btree (post_id);
CREATE INDEX idx_notifications_user_id    ON public.notifications        USING btree (user_id);
CREATE INDEX idx_post_likes_user_id       ON public.post_likes           USING btree (user_id);
CREATE INDEX idx_post_media_post_id       ON public.post_media           USING btree (post_id);
CREATE INDEX idx_posts_user_id            ON public.posts                USING btree (user_id);
CREATE INDEX idx_profiles_banned_by       ON public.profiles             USING btree (banned_by);
CREATE INDEX idx_role_change_requests_status ON public.role_change_requests USING btree (status);
CREATE INDEX idx_role_change_requests_target ON public.role_change_requests USING btree (target_id);
CREATE INDEX idx_site_config_updated_by   ON public.site_config          USING btree (updated_by);
CREATE INDEX idx_staff_nominations_candidate ON public.staff_nominations USING btree (candidate_id);
CREATE INDEX idx_staff_nominations_status ON public.staff_nominations    USING btree (status);
CREATE INDEX idx_unban_requests_target_user ON public.unban_requests     USING btree (target_user_id);
CREATE INDEX modq_content_idx             ON public.moderation_queue     USING btree (content_type, content_id);
CREATE INDEX modq_status_idx              ON public.moderation_queue     USING btree (status);
CREATE INDEX reports_content_idx          ON public.reports              USING btree (content_type, content_id);
CREATE INDEX reports_reporter_idx         ON public.reports              USING btree (reporter_id);
CREATE INDEX reports_status_idx           ON public.reports              USING btree (status);
CREATE INDEX violations_user_idx          ON public.violations           USING btree (user_id);


-- ============================================================
-- SECTION 4 — TRIGGERS
-- ============================================================

-- auth.users → handle_new_user → creates profile row
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- profiles
CREATE TRIGGER trg_guard_profile_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_cols();

CREATE TRIGGER trg_notify_new_user
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_user();

-- posts
CREATE TRIGGER trg_set_live_ended_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_live_ended_at();

CREATE TRIGGER on_post_event
  AFTER INSERT OR UPDATE OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.log_post_event();

CREATE TRIGGER trg_notify_new_live
  AFTER INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_live();

-- post_likes
CREATE TRIGGER trg_notify_post_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

-- comments
CREATE TRIGGER trg_notify_post_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

-- comment_likes
CREATE TRIGGER trg_notify_comment_like
  AFTER INSERT ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_like();

-- live_reactivation_requests
CREATE TRIGGER trg_notify_reactivation_request
  AFTER INSERT ON public.live_reactivation_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_reactivation_request();

-- reports
CREATE TRIGGER trigger_report_auto_hide
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_report_auto_hide();

-- violations
CREATE TRIGGER trigger_violation_escalation
  AFTER INSERT ON public.violations
  FOR EACH ROW EXECUTE FUNCTION public.handle_violation_escalation();


-- ============================================================
-- SECTION 5 — STORED FUNCTIONS
-- (see functions below — extracted from pg_proc)
-- ============================================================

-- ─── role_rank ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.role_rank(r text)
 RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT CASE r
    WHEN 'user'        THEN 1
    WHEN 'admin'       THEN 2
    WHEN 'super_admin' THEN 3
    WHEN 'owner'       THEN 4
    ELSE 0
  END;
$function$;

-- ─── can_moderate_content ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_moderate_content(author_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT role_rank((SELECT role FROM profiles WHERE id = auth.uid()))
       > role_rank((SELECT role FROM profiles WHERE id = author_id));
$function$;

-- ─── handle_new_user ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ─── handle_user_confirmed ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.confirmed_at IS NOT NULL AND (OLD.confirmed_at IS NULL OR OLD.confirmed_at != NEW.confirmed_at) THEN
    INSERT INTO public.profiles (id, username, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
      'user'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── guard_profile_privileged_cols ───────────────────────────
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_cols()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
begin
  if current_user in ('authenticated','anon') then
    new.role               := old.role;
    new.banned             := old.banned;
    new.ban_reason         := old.ban_reason;
    new.ban_details        := old.ban_details;
    new.banned_by          := old.banned_by;
    new.banned_by_username := old.banned_by_username;
    new.banned_at          := old.banned_at;
    new.ban_count          := old.ban_count;
    new.suspended_until    := old.suspended_until;
  end if;
  return new;
end;
$function$;

-- ─── set_live_ended_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_live_ended_at()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_live = false AND OLD.is_live = true THEN
    NEW.live_ended_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── log_audit_event ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text, p_details text,
  p_category text DEFAULT 'auth', p_severity text DEFAULT 'info',
  p_metadata jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid; v_username text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NOT NULL THEN SELECT username INTO v_username FROM profiles WHERE id = v_uid; END IF;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES (p_action, p_details, p_category, v_uid, COALESCE(v_username,'anônimo'),
    p_severity, p_metadata, v_uid, COALESCE(v_username,'sistema'));
END;
$function$;

-- ─── log_post_event ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_post_event()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid; v_username text; v_action text; v_details text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_uid := NEW.user_id;
    SELECT username INTO v_username FROM profiles WHERE id = v_uid;
    INSERT INTO admin_logs (action,details,category,actor_id,actor_username,severity,admin_username,metadata)
    VALUES ('content_post_created',
      format('Post "%s" criado por @%s (categoria: %s)', COALESCE(NEW.title,'sem título'), COALESCE(v_username,'?'), COALESCE(NEW.category,'geral')),
      'content',v_uid,COALESCE(v_username,'?'),'info','sistema',
      jsonb_build_object('post_id',NEW.id,'category',NEW.category));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.title IS NOT DISTINCT FROM NEW.title AND OLD.content IS NOT DISTINCT FROM NEW.content THEN RETURN NEW; END IF;
    v_uid := NEW.user_id;
    SELECT username INTO v_username FROM profiles WHERE id = v_uid;
    INSERT INTO admin_logs (action,details,category,actor_id,actor_username,severity,admin_username,metadata)
    VALUES ('content_post_edited',
      format('Post "%s" editado por @%s', COALESCE(NEW.title,'sem título'), COALESCE(v_username,'?')),
      'content',v_uid,COALESCE(v_username,'?'),'info','sistema',jsonb_build_object('post_id',NEW.id));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_uid := OLD.user_id;
    SELECT username INTO v_username FROM profiles WHERE id = v_uid;
    INSERT INTO admin_logs (action,details,category,actor_id,actor_username,severity,admin_username,metadata)
    VALUES ('content_post_deleted',
      format('Post "%s" excluído (autor: @%s)', COALESCE(OLD.title,'sem título'), COALESCE(v_username,'?')),
      'content',v_uid,COALESCE(v_username,'?'),'info','sistema',
      jsonb_build_object('post_id',OLD.id,'category',OLD.category));
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ─── get_user_xp ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_xp(p_user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_post_count int := 0; v_total_likes int := 0; v_comment_count int := 0;
  v_live_count int := 0; v_profile_bonus int := 0; v_xp int; v_profile profiles%rowtype;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  SELECT COUNT(*), COALESCE(SUM(likes), 0) INTO v_post_count, v_total_likes FROM posts WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_comment_count FROM comments WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_live_count FROM posts WHERE user_id = p_user_id AND was_live = true;
  IF v_profile.bio IS NOT NULL AND length(trim(v_profile.bio)) > 0 THEN v_profile_bonus := v_profile_bonus + 50; END IF;
  IF v_profile.avatar_url  IS NOT NULL THEN v_profile_bonus := v_profile_bonus + 30; END IF;
  IF v_profile.platform    IS NOT NULL THEN v_profile_bonus := v_profile_bonus + 15; END IF;
  IF v_profile.discord     IS NOT NULL THEN v_profile_bonus := v_profile_bonus + 15; END IF;
  IF v_profile.twitch      IS NOT NULL THEN v_profile_bonus := v_profile_bonus + 15; END IF;
  IF v_profile.youtube     IS NOT NULL THEN v_profile_bonus := v_profile_bonus + 15; END IF;
  v_xp := (v_post_count * 20) + (v_total_likes * 5) + (v_comment_count * 3) + (v_live_count * 30) + v_profile_bonus;
  RETURN jsonb_build_object('xp', v_xp, 'posts', v_post_count, 'likes', v_total_likes,
    'comments', v_comment_count, 'lives', v_live_count, 'profile_bonus', v_profile_bonus);
END;
$function$;

-- ─── check_login_status ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_login_status(p_email text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_attempts integer := 0; v_blocked_until timestamptz; v_permanent boolean := false;
BEGIN
  SELECT attempts, blocked_until, permanent INTO v_attempts, v_blocked_until, v_permanent
    FROM public.login_attempts WHERE email = lower(trim(p_email));
  v_attempts := COALESCE(v_attempts, 0); v_permanent := COALESCE(v_permanent, false);
  RETURN jsonb_build_object('attempts', v_attempts,
    'blocked', v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now()),
    'permanent', v_permanent, 'blocked_until', v_blocked_until);
END;
$function$;

-- ─── register_login_attempt ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_login_attempt(p_email text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(p_email));
  v_attempts integer := 0; v_blocked_until timestamptz; v_permanent boolean := false; v_username text;
BEGIN
  SELECT attempts, blocked_until, permanent INTO v_attempts, v_blocked_until, v_permanent
    FROM public.login_attempts WHERE email = v_email;
  v_attempts := COALESCE(v_attempts, 0); v_permanent := COALESCE(v_permanent, false);
  IF v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now()) THEN
    RETURN jsonb_build_object('attempts', v_attempts, 'blocked', true,
      'permanent', v_permanent, 'blocked_until', v_blocked_until);
  END IF;
  v_attempts := v_attempts + 1;
  IF v_attempts >= 10 THEN
    v_permanent := true;  v_blocked_until := NULL;
  ELSIF v_attempts >= 5 THEN
    v_permanent := false; v_blocked_until := now() + INTERVAL '15 minutes';
  ELSE
    v_permanent := false; v_blocked_until := NULL;
  END IF;
  INSERT INTO public.login_attempts (email, attempts, blocked_until, permanent, updated_at)
  VALUES (v_email, v_attempts, v_blocked_until, v_permanent, now())
  ON CONFLICT (email) DO UPDATE
    SET attempts = EXCLUDED.attempts, blocked_until = EXCLUDED.blocked_until,
        permanent = EXCLUDED.permanent, updated_at = EXCLUDED.updated_at;
  IF v_permanent OR v_blocked_until IS NOT NULL THEN
    SELECT p.username INTO v_username FROM auth.users au JOIN public.profiles p ON p.id = au.id WHERE au.email = v_email;
    INSERT INTO public.admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
    VALUES (
      CASE WHEN v_permanent THEN 'auth_permanent_block' ELSE 'auth_rate_limited' END,
      CASE WHEN v_permanent
        THEN 'Login de ' || v_email || COALESCE(' (@' || v_username || ')', '') || ' BLOQUEADO PERMANENTEMENTE após ' || v_attempts || ' tentativas'
        ELSE 'Login de ' || v_email || COALESCE(' (@' || v_username || ')', '') || ' bloqueado por 15 min após ' || v_attempts || ' tentativas'
      END,
      'security', NULL, COALESCE(v_username,'sistema'),
      CASE WHEN v_permanent THEN 'critical' ELSE 'warning' END,
      jsonb_build_object('email', v_email, 'attempts', v_attempts, 'permanent', v_permanent, 'blocked_until', v_blocked_until),
      NULL, 'sistema');
    INSERT INTO public.admin_notifications (type, title, message, audience, metadata)
    VALUES (
      'security_alert',
      CASE WHEN v_permanent THEN 'Conta bloqueada permanentemente' ELSE 'Conta bloqueada temporariamente' END,
      CASE WHEN v_permanent
        THEN 'A conta ' || v_email || ' foi bloqueada por segurança e precisa de revisão de um super admin.'
        ELSE 'A conta ' || v_email || ' foi bloqueada temporariamente por segurança.'
      END,
      'all_admins', jsonb_build_object('email', v_email, 'permanent', v_permanent));
  END IF;
  RETURN jsonb_build_object('attempts', v_attempts,
    'blocked', v_permanent OR (v_blocked_until IS NOT NULL AND v_blocked_until > now()),
    'permanent', v_permanent, 'blocked_until', v_blocked_until);
END;
$function$;

-- ─── reset_login_attempts ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_login_attempts()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.login_attempts WHERE email = lower((SELECT email FROM auth.users WHERE id = auth.uid()));
END;
$function$;

-- ─── record_banned_login_attempt ─────────────────────────────
CREATE OR REPLACE FUNCTION public.record_banned_login_attempt(p_email text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_email text := lower(trim(p_email)); v_username text;
BEGIN
  SELECT p.username INTO v_username FROM auth.users au JOIN public.profiles p ON p.id = au.id WHERE au.email = v_email;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auth_banned_attempt', 'Conta banida tentou fazer login: ' || COALESCE('@' || v_username, v_email),
    'security', NULL, 'sistema', 'warning',
    jsonb_build_object('email', v_email, 'username', v_username), NULL, 'sistema');
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('banned_login_attempt', 'Tentativa de acesso de banido',
    'Uma conta banida' || COALESCE(' (@' || v_username || ')', '') || ' tentou fazer login.',
    'all_admins', jsonb_build_object('email', v_email, 'username', v_username));
END;
$function$;

-- ─── get_blocked_logins ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_blocked_logins()
 RETURNS TABLE(email text, attempts integer, blocked_until timestamptz, permanent boolean,
               currently_blocked boolean, updated_at timestamptz, username text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  RETURN QUERY
  SELECT la.email, la.attempts, la.blocked_until, la.permanent, true, la.updated_at, p.username
  FROM public.login_attempts la
  LEFT JOIN auth.users   au ON au.email = la.email
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE la.permanent OR (la.blocked_until IS NOT NULL AND la.blocked_until > now())
  ORDER BY la.permanent DESC, la.updated_at DESC;
END;
$function$;

-- ─── admin_unlock_login ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_unlock_login(p_email text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Access denied: super_admin required';
  END IF;
  UPDATE public.login_attempts SET blocked_until = NULL, permanent = false, updated_at = now()
  WHERE email = lower(trim(p_email));
END;
$function$;

-- ─── delete_own_account ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_own_account()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$function$;

-- ─── ban_user ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_reason text, p_details text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  SELECT role, username INTO v_target_role, v_target_username FROM profiles WHERE id = p_user_id;
  IF role_rank(v_caller_role) <= 1 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN RAISE EXCEPTION 'Access denied: cannot ban equal or higher role'; END IF;
  UPDATE profiles SET banned = true, ban_reason = p_reason, ban_details = p_details,
    banned_by = v_caller_id, banned_by_username = v_caller_username, banned_at = now(), ban_count = ban_count + 1
  WHERE id = p_user_id;
  DELETE FROM posts WHERE user_id = p_user_id;
  DELETE FROM comments WHERE user_id = p_user_id;
  DELETE FROM community_posts WHERE user_id = p_user_id;
  DELETE FROM live_chat WHERE user_id = p_user_id;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_ban', '@' || v_target_username || ' foi banido por @' || v_caller_username || '. Motivo: ' || p_reason || COALESCE(' — ' || p_details, ''),
    'security', v_caller_id, v_caller_username, 'warning',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_target_username, 'reason', p_reason, 'details', p_details),
    v_caller_id, v_caller_username);
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_banned', 'Usuário banido',
    '@' || v_target_username || ' foi banido por @' || v_caller_username || '. Motivo: ' || p_reason,
    'all_admins', jsonb_build_object('target_username', v_target_username, 'reason', p_reason));
END;
$function$;

-- ─── unban_user ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unban_user(p_user_id uuid, p_note text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text; v_target_username text;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin','owner') THEN RAISE EXCEPTION 'Access denied: super_admin required'; END IF;
  SELECT username INTO v_target_username FROM profiles WHERE id = p_user_id;
  UPDATE profiles SET banned = false, ban_reason = NULL, ban_details = NULL,
    banned_by = NULL, banned_by_username = NULL, banned_at = NULL WHERE id = p_user_id;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban', '@' || v_target_username || ' foi desbanido por @' || v_caller_username || COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_target_username, 'note', p_note),
    v_caller_id, v_caller_username);
END;
$function$;

-- ─── request_unban ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_unban(p_user_id uuid, p_reason text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text; v_target_username text;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('admin') THEN RAISE EXCEPTION 'Access denied: admin only'; END IF;
  SELECT username INTO v_target_username FROM profiles WHERE id = p_user_id;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND banned = true) THEN RAISE EXCEPTION 'User is not banned'; END IF;
  IF EXISTS (SELECT 1 FROM unban_requests WHERE target_user_id = p_user_id AND status = 'pending') THEN RAISE EXCEPTION 'Already has a pending request'; END IF;
  INSERT INTO unban_requests (target_user_id, target_username, requesting_admin_id, requesting_admin_username, reason)
  VALUES (p_user_id, v_target_username, v_caller_id, v_caller_username, p_reason);
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_requested', 'Admin @' || v_caller_username || ' solicitou desbanimento de @' || v_target_username || '. Motivo: ' || p_reason,
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_target_username, 'reason', p_reason), v_caller_id, v_caller_username);
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('unban_request', 'Solicitação de desbanimento',
    'Admin @' || v_caller_username || ' pediu o desbanimento de @' || v_target_username,
    'super_admin', jsonb_build_object('target_username', v_target_username, 'admin_username', v_caller_username));
END;
$function$;

-- ─── approve_unban_request ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_unban_request(p_request_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text; v_req unban_requests;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin','owner') THEN RAISE EXCEPTION 'Access denied: super_admin required'; END IF;
  SELECT * INTO v_req FROM unban_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;
  UPDATE profiles SET banned = false, ban_reason = NULL, ban_details = NULL,
    banned_by = NULL, banned_by_username = NULL, banned_at = NULL WHERE id = v_req.target_user_id;
  UPDATE unban_requests SET status = 'approved', reviewed_by = v_caller_id,
    reviewed_by_username = v_caller_username, reviewed_at = now() WHERE id = p_request_id;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_approved',
    'Super admin @' || v_caller_username || ' aprovou desbanimento de @' || v_req.target_username ||
      ' (solicitado por @' || v_req.requesting_admin_username || ')',
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_req.target_username, 'requesting_admin', v_req.requesting_admin_username),
    v_caller_id, v_caller_username);
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('unban_approved', 'Desbanimento aprovado', '@' || v_req.target_username || ' foi desbanido pelo super admin.',
    'all_admins', jsonb_build_object('target_username', v_req.target_username));
END;
$function$;

-- ─── deny_unban_request ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deny_unban_request(p_request_id uuid, p_note text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text; v_req unban_requests;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin','owner') THEN RAISE EXCEPTION 'Access denied: super_admin required'; END IF;
  SELECT * INTO v_req FROM unban_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;
  UPDATE unban_requests SET status = 'denied', reviewed_by = v_caller_id,
    reviewed_by_username = v_caller_username, reviewed_at = now(), review_note = p_note WHERE id = p_request_id;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('admin_unban_denied',
    'Super admin @' || v_caller_username || ' negou desbanimento de @' || v_req.target_username ||
      ' (solicitado por @' || v_req.requesting_admin_username || ')' || COALESCE('. Nota: ' || p_note, ''),
    'security', v_caller_id, v_caller_username, 'info',
    jsonb_build_object('target_username', v_req.target_username, 'note', p_note), v_caller_id, v_caller_username);
END;
$function$;

-- ─── apply_suspension ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_suspension(p_user_id uuid, p_days integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text; v_caller_username text; v_target_role text; v_target_username text;
  v_until timestamptz := now() + (p_days || ' days')::interval;
BEGIN
  SELECT role, username INTO v_caller_role, v_caller_username FROM profiles WHERE id = auth.uid();
  SELECT role, username INTO v_target_role, v_target_username FROM profiles WHERE id = p_user_id;
  IF role_rank(v_caller_role) <= 1 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;
  IF role_rank(v_caller_role) <= role_rank(v_target_role) THEN RAISE EXCEPTION 'Access denied: cannot suspend equal or higher role'; END IF;
  UPDATE profiles SET suspended_until = v_until WHERE id = p_user_id;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('user_suspended', '@' || v_target_username || ' suspenso por ' || p_days || ' dia(s) por @' || v_caller_username,
    'security', auth.uid(), v_caller_username, 'warning',
    jsonb_build_object('target_id', p_user_id, 'days', p_days, 'until', v_until), auth.uid(), v_caller_username);
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('user_suspended', 'Usuário suspenso',
    '@' || v_target_username || ' foi suspenso por ' || p_days || ' dia(s) por @' || v_caller_username,
    'all_admins', jsonb_build_object('target_username', v_target_username, 'days', p_days));
END;
$function$;

-- ─── admin_set_role ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id uuid, p_new_role text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text;
  v_target_role text; v_target_username text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  select role, username into v_target_role, v_target_username from profiles where id = p_user_id;
  if v_target_role is null then raise exception 'Usuário não encontrado'; end if;
  if role_rank(v_caller_role) < 2 then raise exception 'Acesso negado: admin necessário'; end if;
  if p_user_id = v_caller_id then raise exception 'Não é possível alterar a própria role'; end if;
  if p_new_role not in ('user','admin','super_admin') then raise exception 'Role inválida: %', p_new_role; end if;
  if v_target_role = 'owner' then raise exception 'Não é possível alterar a role do fundador'; end if;
  if role_rank(v_caller_role) <= role_rank(v_target_role) then raise exception 'Acesso negado: cargo igual ou superior'; end if;
  if role_rank(v_caller_role) < role_rank(p_new_role) then raise exception 'Acesso negado: cargo acima do seu'; end if;
  update profiles set role = p_new_role, role_changed_at = now() where id = p_user_id;
  insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'admin_role_changed',
    'Role de @'||v_target_username||' alterada para '||p_new_role||' por @'||v_caller_username, 'admin', 'info');
end;
$function$;

-- ─── owner_set_role ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_set_role(p_target_user_id uuid, p_new_role text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_owner_username TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN RAISE EXCEPTION 'Acesso negado — apenas o fundador pode alterar roles.'; END IF;
  IF p_target_user_id = auth.uid() THEN RAISE EXCEPTION 'Não é possível alterar a própria role.'; END IF;
  IF p_new_role NOT IN ('user','admin','super_admin') THEN RAISE EXCEPTION 'Role inválida: %', p_new_role; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_target_user_id AND role = 'owner') THEN RAISE EXCEPTION 'Não é possível alterar a role do fundador.'; END IF;
  SELECT username INTO v_owner_username FROM profiles WHERE id = auth.uid();
  UPDATE profiles SET role = p_new_role, role_changed_at = now() WHERE id = p_target_user_id;
  INSERT INTO admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  SELECT auth.uid(), v_owner_username, auth.uid(), v_owner_username, 'set_role',
    'Role alterada para ' || p_new_role || ' pelo fundador', 'admin', 'info';
END;
$function$;

-- ─── owner_set_site_config ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_set_site_config(p_key text, p_value text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  INSERT INTO site_config (key, value, updated_at, updated_by) VALUES (p_key, p_value, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = p_value, updated_at = now(), updated_by = auth.uid();
END;
$function$;

-- ─── owner_get_stats ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_stats()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result JSONB; daily_signups JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT jsonb_agg(jsonb_build_object('date', to_char(d.dt,'YYYY-MM-DD'), 'count', COALESCE(c.cnt,0)) ORDER BY d.dt) INTO daily_signups
  FROM generate_series((CURRENT_DATE - INTERVAL '13 days')::timestamp, CURRENT_DATE::timestamp, '1 day'::interval) AS d(dt)
  LEFT JOIN (SELECT DATE(created_at) AS dt, COUNT(*)::int AS cnt FROM profiles WHERE created_at >= CURRENT_DATE - INTERVAL '13 days' GROUP BY DATE(created_at)) c ON DATE(d.dt) = c.dt;
  SELECT jsonb_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles), 'admins', (SELECT COUNT(*) FROM profiles WHERE role IN ('admin','super_admin')),
    'super_admins', (SELECT COUNT(*) FROM profiles WHERE role = 'super_admin'), 'banned_users', (SELECT COUNT(*) FROM profiles WHERE banned = true),
    'total_posts', (SELECT COUNT(*) FROM posts), 'posts_today', (SELECT COUNT(*) FROM posts WHERE created_at >= CURRENT_DATE),
    'posts_week', (SELECT COUNT(*) FROM posts WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'posts_30d', (SELECT COUNT(*) FROM posts WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'total_comments', (SELECT COUNT(*) FROM comments), 'total_keys', (SELECT COUNT(*) FROM game_keys WHERE is_promo = false),
    'keys_today', (SELECT COUNT(*) FROM game_keys WHERE created_at >= CURRENT_DATE),
    'active_lives', (SELECT COUNT(*) FROM posts WHERE is_live = true),
    'total_community', (SELECT COUNT(*) FROM community_posts),
    'users_today', (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE),
    'users_week', (SELECT COUNT(*) FROM profiles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'daily_signups', daily_signups) INTO result;
  RETURN result;
END;
$function$;

-- ─── owner_get_users ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_users()
 RETURNS TABLE(id uuid, username text, email text, role text, banned boolean, ban_count integer,
               ban_reason text, ban_details text, banned_by_username text, banned_at timestamptz,
               created_at timestamptz, post_count bigint, comment_count bigint, xp bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT p.id, p.username::TEXT, COALESCE(u.email,'')::TEXT, p.role::TEXT, COALESCE(p.banned,false),
    COALESCE(p.ban_count,0), p.ban_reason::TEXT, p.ban_details::TEXT, p.banned_by_username::TEXT, p.banned_at, p.created_at,
    COALESCE(pc.post_count,0)::BIGINT, COALESCE(cc.comment_count,0)::BIGINT,
    (COALESCE(pc.regular_posts,0)*20 + COALESCE(pc.live_posts,0)*50 + COALESCE(lc.like_count,0)*5 + COALESCE(cc.comment_count,0)*3
     + CASE WHEN p.bio IS NOT NULL AND p.bio <> '' THEN 10 ELSE 0 END
     + CASE WHEN p.avatar_url IS NOT NULL THEN 15 ELSE 0 END
     + CASE WHEN p.platform   IS NOT NULL THEN 5  ELSE 0 END
     + CASE WHEN p.discord    IS NOT NULL AND p.discord  <> '' THEN 10 ELSE 0 END
     + CASE WHEN p.twitch     IS NOT NULL AND p.twitch   <> '' THEN 10 ELSE 0 END
     + CASE WHEN p.youtube    IS NOT NULL AND p.youtube  <> '' THEN 10 ELSE 0 END)::BIGINT
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN (SELECT user_id, COUNT(*) AS post_count, COUNT(*) FILTER (WHERE NOT was_live) AS regular_posts, COUNT(*) FILTER (WHERE was_live) AS live_posts FROM posts GROUP BY user_id) pc ON pc.user_id = p.id
  LEFT JOIN (SELECT po.user_id, COUNT(*) AS like_count FROM post_likes l JOIN posts po ON po.id = l.post_id GROUP BY po.user_id) lc ON lc.user_id = p.id
  LEFT JOIN (SELECT user_id, COUNT(*) AS comment_count FROM comments GROUP BY user_id) cc ON cc.user_id = p.id
  ORDER BY p.created_at DESC;
END;
$function$;

-- ─── owner_get_audit_logs ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_audit_logs(
  p_limit integer DEFAULT 30, p_offset integer DEFAULT 0,
  p_category text DEFAULT NULL, p_severity text DEFAULT NULL)
 RETURNS TABLE(id uuid, actor_username text, action text, details text, category text, severity text, metadata jsonb, created_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT l.id, COALESCE(l.actor_username, l.admin_username)::TEXT, l.action, l.details, l.category, l.severity, l.metadata, l.created_at
  FROM admin_logs l
  WHERE (p_category IS NULL OR l.category = p_category) AND (p_severity IS NULL OR l.severity = p_severity)
  ORDER BY l.created_at DESC LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- ─── owner_get_notifications ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_notifications(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, kind text, actor text, action text, body text, severity text, category text, metadata jsonb, created_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT * FROM (
    (SELECT l.id,
      CASE WHEN l.action='admin_ban' THEN 'ban' WHEN l.action='admin_unban' THEN 'unban'
           WHEN l.action='set_role' THEN 'role_change' WHEN l.severity='critical' THEN 'alert'
           WHEN l.action ILIKE '%delete%' THEN 'delete' ELSE 'activity' END::TEXT,
      COALESCE(l.actor_username,l.admin_username,'sistema')::TEXT, l.action::TEXT, l.details::TEXT,
      l.severity::TEXT, l.category::TEXT, l.metadata, l.created_at
    FROM admin_logs l
    WHERE l.action IN ('admin_ban','admin_unban','set_role') OR l.severity='critical'
       OR (l.severity='warning' AND l.category='security')
    ORDER BY l.created_at DESC LIMIT 40)
    UNION ALL
    (SELECT n.id, n.type::TEXT,
      CASE WHEN n.type='staff_alert' THEN COALESCE(n.metadata->>'sender_username','staff') ELSE 'sistema' END::TEXT,
      n.type::TEXT, n.message::TEXT,
      CASE WHEN n.type='staff_alert' THEN 'warning' ELSE 'info' END::TEXT,
      'notification'::TEXT, n.metadata, n.created_at
    FROM admin_notifications n
    WHERE n.type IN ('new_user','new_live','live_ended','user_banned','staff_alert')
    ORDER BY n.created_at DESC LIMIT 20)
  ) combined ORDER BY combined.created_at DESC LIMIT p_limit;
END;
$function$;

-- ─── owner_get_metrics ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.owner_get_metrics()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE result JSONB; top_posts JSONB; top_users JSONB; active_count BIGINT; inactive_count BIGINT; total_xp BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT jsonb_agg(t) INTO top_posts FROM (
    SELECT jsonb_build_object('id',po.id,'title',po.title,'likes',po.likes,'username',pr.username,'created_at',po.created_at) AS t
    FROM posts po JOIN profiles pr ON pr.id = po.user_id
    WHERE po.created_at >= CURRENT_DATE - INTERVAL '7 days' ORDER BY po.likes DESC LIMIT 10) sub;
  SELECT jsonb_agg(t) INTO top_users FROM (
    SELECT jsonb_build_object('username',p.username,'role',p.role,'post_count',COALESCE(pc.post_count,0),
      'xp',(COALESCE(pc.regular_posts,0)*20+COALESCE(pc.live_posts,0)*50+COALESCE(lc.like_count,0)*5+COALESCE(cc.comment_count,0)*3
            +CASE WHEN p.bio IS NOT NULL AND p.bio!='' THEN 10 ELSE 0 END+CASE WHEN p.avatar_url IS NOT NULL THEN 15 ELSE 0 END
            +CASE WHEN p.platform IS NOT NULL THEN 5 ELSE 0 END+CASE WHEN p.discord IS NOT NULL AND p.discord!='' THEN 10 ELSE 0 END
            +CASE WHEN p.twitch IS NOT NULL AND p.twitch!='' THEN 10 ELSE 0 END+CASE WHEN p.youtube IS NOT NULL AND p.youtube!='' THEN 10 ELSE 0 END)) AS t
    FROM profiles p
    LEFT JOIN (SELECT user_id,COUNT(*) AS post_count,COUNT(*) FILTER(WHERE NOT was_live) AS regular_posts,COUNT(*) FILTER(WHERE was_live) AS live_posts FROM posts GROUP BY user_id) pc ON pc.user_id=p.id
    LEFT JOIN (SELECT po.user_id,COUNT(*) AS like_count FROM post_likes l JOIN posts po ON po.id=l.post_id GROUP BY po.user_id) lc ON lc.user_id=p.id
    LEFT JOIN (SELECT user_id,COUNT(*) AS comment_count FROM comments GROUP BY user_id) cc ON cc.user_id=p.id
    WHERE p.role!='owner' ORDER BY 1 DESC LIMIT 10) sub;
  SELECT COUNT(DISTINCT uid) INTO active_count FROM (SELECT user_id AS uid FROM posts WHERE created_at>=CURRENT_DATE-INTERVAL '7 days' UNION SELECT user_id FROM comments WHERE created_at>=CURRENT_DATE-INTERVAL '7 days') acts;
  SELECT COUNT(*) INTO inactive_count FROM profiles p WHERE p.created_at<CURRENT_DATE-INTERVAL '30 days' AND p.role!='owner'
    AND NOT EXISTS(SELECT 1 FROM posts WHERE user_id=p.id AND created_at>=CURRENT_DATE-INTERVAL '30 days')
    AND NOT EXISTS(SELECT 1 FROM comments WHERE user_id=p.id AND created_at>=CURRENT_DATE-INTERVAL '30 days');
  RETURN jsonb_build_object('top_posts',COALESCE(top_posts,'[]'::jsonb),'top_users',COALESCE(top_users,'[]'::jsonb),
    'active_7d',active_count,'inactive_30d',inactive_count,'total_xp',total_xp);
END;
$function$;

-- ─── notify_admin_new_user ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admin_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO admin_notifications (type, title, message, audience)
  VALUES ('new_user', 'Novo usuário cadastrado', format('"%s" acabou de criar uma conta', NEW.username), 'all_admins');
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, admin_username)
  VALUES ('auth_register', format('Novo usuário registrado: @%s', NEW.username), 'auth', NEW.id, NEW.username, 'info', 'sistema');
  RETURN NEW;
END;
$function$;

-- ─── notify_admin_new_live ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_admin_new_live()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE actor_name TEXT; actor_id UUID;
BEGIN
  BEGIN
    actor_id := (current_setting('request.jwt.claims', true)::json->>'sub')::UUID;
    SELECT username INTO actor_name FROM profiles WHERE id = actor_id;
  EXCEPTION WHEN OTHERS THEN actor_id := NULL; actor_name := NULL;
  END;
  IF TG_OP = 'INSERT' AND NEW.is_live = true THEN
    INSERT INTO admin_notifications (type, title, message, audience, metadata)
    VALUES ('new_live', 'Live iniciada', '"' || NEW.title || '" foi iniciada' || COALESCE(' por ' || actor_name, ''), 'all_admins', jsonb_build_object('post_id', NEW.id));
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_live = false AND NEW.is_live = true THEN
    INSERT INTO admin_notifications (type, title, message, audience, metadata)
    VALUES ('live_reactivated', 'Live reativada', '"' || NEW.title || '" foi reativada' || COALESCE(' por ' || actor_name, ''), 'all_admins', jsonb_build_object('post_id', NEW.id));
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_live = true AND NEW.is_live = false THEN
    INSERT INTO admin_notifications (type, title, message, audience, metadata)
    VALUES ('live_ended', 'Live encerrada', '"' || NEW.title || '" foi encerrada' || CASE WHEN actor_name IS NOT NULL THEN ' por ' || actor_name ELSE ' automaticamente' END, 'all_admins', jsonb_build_object('post_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── notify_admin_reactivation_request ───────────────────────
CREATE OR REPLACE FUNCTION public.notify_admin_reactivation_request()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('reactivation_request', 'Solicitação de Reativação',
    NEW.admin_username || ' pediu para reativar "' || NEW.post_title || '"', 'super_admin',
    jsonb_build_object('request_id', NEW.id, 'post_id', NEW.post_id));
  RETURN NEW;
END;
$function$;

-- ─── notify_post_like ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_post_like()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
end;
$function$;

-- ─── notify_post_comment ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_post_comment()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_target uuid; v_commenter text; v_notif boolean; v_is_reply boolean;
begin
  v_is_reply := NEW.parent_id is not null;
  if v_is_reply then select user_id into v_target from comments where id = NEW.parent_id;
  else select user_id into v_target from posts where id = NEW.post_id; end if;
  if v_target is null or v_target = NEW.user_id then return NEW; end if;
  select coalesce(notif_comments, true) into v_notif from profiles where id = v_target;
  if not v_notif then return NEW; end if;
  select username into v_commenter from profiles where id = NEW.user_id;
  insert into notifications (user_id, type, message)
  values (v_target, 'comment', coalesce(v_commenter,'Alguém') || (case when v_is_reply then ' respondeu seu comentário' else ' comentou no seu post' end));
  return NEW;
end;
$function$;

-- ─── notify_comment_like ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_comment_like()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_author uuid; v_liker text; v_notif boolean;
begin
  select user_id into v_author from comments where id = NEW.comment_id;
  if v_author is null or v_author = NEW.user_id then return NEW; end if;
  select coalesce(notif_likes, true) into v_notif from profiles where id = v_author;
  if not v_notif then return NEW; end if;
  select username into v_liker from profiles where id = NEW.user_id;
  insert into notifications (user_id, type, message)
  values (v_author, 'like', coalesce(v_liker,'Alguém')||' curtiu seu comentário');
  return NEW;
end;
$function$;

-- ─── notify_owner ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_owner(p_message text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role text; v_username text;
BEGIN
  SELECT role, username INTO v_role, v_username FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin','super_admin') THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF length(trim(coalesce(p_message,''))) < 10 THEN RAISE EXCEPTION 'Descreva o problema com pelo menos 10 caracteres.'; END IF;
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('staff_alert', 'Alerta de @' || v_username, trim(p_message), 'owner',
    jsonb_build_object('sender_id', auth.uid(), 'sender_username', v_username, 'sender_role', v_role));
END;
$function$;

-- ─── notify_user ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_user(p_user_id uuid, p_type text, p_message text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN RAISE EXCEPTION 'Access denied: admin required'; END IF;
  INSERT INTO notifications (user_id, type, message) VALUES (p_user_id, p_type, p_message);
END;
$function$;

-- ─── soft_delete_post ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_post(p_post_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_owner uuid; v_rank int;
BEGIN
  SELECT user_id INTO v_owner FROM posts WHERE id = p_post_id;
  SELECT role_rank(role) INTO v_rank FROM profiles WHERE id = (SELECT auth.uid());
  IF (SELECT auth.uid()) <> v_owner AND v_rank < 2 THEN RAISE EXCEPTION 'Sem permissão para excluir este post'; END IF;
  UPDATE posts SET deleted_at = now() WHERE id = p_post_id AND deleted_at IS NULL;
END;
$function$;

-- ─── restore_post ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_post(p_post_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_rank int;
BEGIN
  SELECT role_rank(role) INTO v_rank FROM profiles WHERE id = (SELECT auth.uid());
  IF v_rank < 2 THEN RAISE EXCEPTION 'Apenas admins podem restaurar posts'; END IF;
  UPDATE posts SET deleted_at = null WHERE id = p_post_id;
END;
$function$;

-- ─── handle_report_auto_hide ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_report_auto_hide()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_count int; v_threshold int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM reports WHERE content_type = NEW.content_type AND content_id = NEW.content_id;
  SELECT COALESCE(value::int, 3) INTO v_threshold FROM site_config WHERE key = 'mod_report_threshold';
  IF v_count >= v_threshold THEN
    IF NOT EXISTS (SELECT 1 FROM moderation_queue WHERE content_type = NEW.content_type AND content_id = NEW.content_id AND status = 'pending') THEN
      INSERT INTO moderation_queue (content_type, content_id, trigger_type) VALUES (NEW.content_type, NEW.content_id, 'report');
      IF    NEW.content_type = 'post'    THEN UPDATE posts            SET hidden_at = now() WHERE id = NEW.content_id AND hidden_at IS NULL;
      ELSIF NEW.content_type = 'comment' THEN UPDATE comments         SET hidden_at = now() WHERE id = NEW.content_id AND hidden_at IS NULL;
      ELSIF NEW.content_type = 'mural'   THEN UPDATE community_posts  SET hidden_at = now() WHERE id = NEW.content_id AND hidden_at IS NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── apply_mod_auto_ban ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_mod_auto_ban(p_user_id uuid, p_points integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_username text;
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND banned = true) THEN RETURN; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = p_user_id;
  UPDATE profiles SET banned = true,
    ban_reason = 'Banimento automático — limite de infrações atingido (' || p_points || ' pontos)',
    banned_by_username = 'Sistema', banned_at = now(), ban_count = ban_count + 1
  WHERE id = p_user_id;
  UPDATE posts SET deleted_at = now() WHERE user_id = p_user_id AND deleted_at IS NULL;
  DELETE FROM comments WHERE user_id = p_user_id;
  DELETE FROM community_posts WHERE user_id = p_user_id;
  DELETE FROM live_chat WHERE user_id = p_user_id;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auto_ban', '@' || v_username || ' banido automaticamente pelo sistema (' || p_points || ' pontos de infrações)',
    'security', NULL, 'Sistema', 'critical',
    jsonb_build_object('target_id', p_user_id, 'target_username', v_username, 'points', p_points), NULL, 'Sistema');
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('auto_ban', 'Banimento automático', '@' || v_username || ' foi banido automaticamente pelo sistema (' || p_points || ' pontos).',
    'all_admins', jsonb_build_object('target_username', v_username, 'points', p_points));
END;
$function$;

-- ─── apply_mod_auto_suspend ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_mod_auto_suspend(p_user_id uuid, p_points integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_username text; v_until timestamptz := now() + interval '7 days';
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND (banned = true OR (suspended_until IS NOT NULL AND suspended_until > now()))) THEN RETURN; END IF;
  SELECT username INTO v_username FROM profiles WHERE id = p_user_id;
  UPDATE profiles SET suspended_until = v_until WHERE id = p_user_id;
  INSERT INTO admin_logs (action, details, category, actor_id, actor_username, severity, metadata, admin_id, admin_username)
  VALUES ('auto_suspend', '@' || v_username || ' suspenso automaticamente pelo sistema (' || p_points || ' pontos)',
    'security', NULL, 'Sistema', 'warning',
    jsonb_build_object('target_id', p_user_id, 'points', p_points, 'until', v_until), NULL, 'Sistema');
  INSERT INTO admin_notifications (type, title, message, audience, metadata)
  VALUES ('auto_suspend', 'Suspensão automática', '@' || v_username || ' foi suspenso automaticamente pelo sistema (' || p_points || ' pontos).',
    'all_admins', jsonb_build_object('target_username', v_username, 'points', p_points));
END;
$function$;

-- ─── handle_violation_escalation ────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_violation_escalation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_total int; v_ban_thr int; v_sus_thr int;
BEGIN
  SELECT COALESCE(SUM(points), 0) INTO v_total FROM violations WHERE user_id = NEW.user_id;
  SELECT COALESCE(value::int, 15) INTO v_ban_thr FROM site_config WHERE key = 'mod_ban_threshold';
  SELECT COALESCE(value::int, 8)  INTO v_sus_thr FROM site_config WHERE key = 'mod_suspend_threshold';
  IF v_total >= v_ban_thr THEN PERFORM apply_mod_auto_ban(NEW.user_id, v_total);
  ELSIF v_total >= v_sus_thr THEN PERFORM apply_mod_auto_suspend(NEW.user_id, v_total);
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── apply_ai_moderation ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_ai_moderation(
  p_content_type text, p_content_id uuid, p_score double precision,
  p_threshold_key text DEFAULT 'mod_ai_text_threshold')
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_enabled boolean; v_threshold float;
BEGIN
  SELECT COALESCE(value::boolean, false) INTO v_enabled FROM site_config WHERE key = 'mod_ai_enabled';
  IF NOT v_enabled THEN RETURN; END IF;
  SELECT COALESCE(value::float, 0.7) INTO v_threshold FROM site_config WHERE key = p_threshold_key;
  IF p_score < v_threshold THEN RETURN; END IF;
  IF    p_content_type = 'post'    THEN UPDATE posts           SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  ELSIF p_content_type = 'comment' THEN UPDATE comments        SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  ELSIF p_content_type = 'mural'   THEN UPDATE community_posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM moderation_queue WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending') THEN
    INSERT INTO moderation_queue (content_type, content_id, trigger_type, metadata)
    VALUES (p_content_type, p_content_id, 'ai', jsonb_build_object('ai_score', p_score));
  END IF;
END;
$function$;

-- ─── apply_link_moderation ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_link_moderation(p_content_type text, p_content_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM site_config WHERE key = 'mod_ai_enabled' AND value = 'true') THEN RETURN; END IF;
  IF    p_content_type = 'post'    THEN UPDATE posts           SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  ELSIF p_content_type = 'comment' THEN UPDATE comments        SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  ELSIF p_content_type = 'mural'   THEN UPDATE community_posts SET hidden_at = now() WHERE id = p_content_id AND hidden_at IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM moderation_queue WHERE content_type = p_content_type AND content_id = p_content_id AND status = 'pending') THEN
    INSERT INTO moderation_queue (content_type, content_id, trigger_type) VALUES (p_content_type, p_content_id, 'links');
  END IF;
END;
$function$;

-- ─── check_staff_eligibility ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_staff_eligibility(p_user_id uuid, p_target_role text DEFAULT 'admin')
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_profile profiles%rowtype; v_xp int; v_account_age_days int;
  v_rank_ok boolean; v_ban_ok boolean; v_ban_reason text;
  v_admin_tenure_days int := null; v_tenure_ok boolean := true; v_eligible boolean;
begin
  if p_target_role not in ('admin','super_admin') then raise exception 'Cargo inválido: %', p_target_role; end if;
  select * into v_profile from profiles where id = p_user_id;
  if v_profile.id is null then raise exception 'Usuário não encontrado'; end if;
  v_account_age_days := floor(extract(epoch from now() - v_profile.created_at) / 86400);
  v_xp := coalesce((get_user_xp(p_user_id)->>'xp')::int, 0);
  v_rank_ok := v_xp >= 1000;
  if coalesce(v_profile.ban_count, 0) = 0 then
    v_ban_ok := true; v_ban_reason := null;
  elsif v_profile.ban_count = 1 then
    if v_profile.banned_at is not null and now() - v_profile.banned_at >= interval '6 months' then
      v_ban_ok := true; v_ban_reason := null;
    else v_ban_ok := false; v_ban_reason := 'cooldown_6_meses'; end if;
  else v_ban_ok := false; v_ban_reason := 'multiplos_banimentos'; end if;
  if p_target_role = 'super_admin' then
    if v_profile.role <> 'admin' then v_tenure_ok := false;
    else
      v_admin_tenure_days := floor(extract(epoch from now() - v_profile.role_changed_at) / 86400);
      v_tenure_ok := v_admin_tenure_days >= 365;
    end if;
  end if;
  v_eligible := (v_account_age_days >= 60) and v_rank_ok and v_ban_ok and v_tenure_ok and coalesce(v_profile.banned, false) = false;
  return jsonb_build_object('eligible', v_eligible, 'target_role', p_target_role, 'account_age_days', v_account_age_days,
    'account_age_ok', v_account_age_days >= 60, 'xp', v_xp, 'rank_ok', v_rank_ok,
    'ban_count', coalesce(v_profile.ban_count,0), 'ban_ok', v_ban_ok, 'ban_reason', v_ban_reason,
    'currently_banned', coalesce(v_profile.banned,false), 'admin_tenure_days', v_admin_tenure_days, 'tenure_ok', v_tenure_ok);
end;
$function$;

-- ─── nominate_staff ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.nominate_staff(p_candidate_id uuid, p_target_role text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_caller_id uuid := auth.uid(); v_caller_role text; v_candidate_role text;
  v_is_self boolean; v_eligibility jsonb; v_id uuid;
begin
  if p_target_role not in ('admin','super_admin') then raise exception 'Cargo inválido: %', p_target_role; end if;
  select role into v_caller_role from profiles where id = v_caller_id;
  select role into v_candidate_role from profiles where id = p_candidate_id;
  if v_candidate_role is null then raise exception 'Usuário não encontrado'; end if;
  v_is_self := (v_caller_id = p_candidate_id);
  if p_target_role = 'admin' then
    if v_candidate_role <> 'user' then raise exception 'Usuário já possui cargo de staff'; end if;
    if not v_is_self and role_rank(v_caller_role) < 2 then raise exception 'Acesso negado: apenas admins (ou o próprio usuário) podem indicar para admin'; end if;
  else
    if v_is_self then raise exception 'Não é possível se autoindicar para super admin'; end if;
    if v_caller_role <> 'super_admin' then raise exception 'Acesso negado: apenas super admins podem indicar para super admin'; end if;
    if v_candidate_role <> 'admin' then raise exception 'Candidato precisa já ser admin para ser indicado a super admin'; end if;
  end if;
  if exists (select 1 from staff_nominations where candidate_id = p_candidate_id and status in ('pending','trial_active')) then
    raise exception 'Já existe uma indicação em andamento para este usuário'; end if;
  v_eligibility := check_staff_eligibility(p_candidate_id, p_target_role);
  if not (v_eligibility->>'eligible')::boolean then raise exception 'Candidato não atende aos critérios de elegibilidade no momento'; end if;
  insert into staff_nominations (candidate_id, nominated_by, target_role, status, eligibility_snapshot)
  values (p_candidate_id, case when v_is_self then null else v_caller_id end, p_target_role, 'pending', v_eligibility)
  returning id into v_id;
  return v_id;
end;
$function$;

-- ─── review_staff_nomination ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_staff_nomination(
  p_nomination_id uuid, p_decision text, p_notes text DEFAULT NULL, p_trial_days integer DEFAULT 45)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text;
  v_nom staff_nominations%rowtype; v_candidate_username text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  if role_rank(v_caller_role) < 3 then raise exception 'Acesso negado: apenas super admins ou o fundador podem analisar indicações'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Decisão inválida: %', p_decision; end if;
  if p_trial_days is null or p_trial_days < 1 then raise exception 'Duração do trial inválida'; end if;
  select * into v_nom from staff_nominations where id = p_nomination_id for update;
  if v_nom.id is null then raise exception 'Indicação não encontrada'; end if;
  if v_nom.status <> 'pending' then raise exception 'Indicação já foi analisada'; end if;
  if v_nom.nominated_by is not null and v_nom.nominated_by = v_caller_id then raise exception 'Acesso negado: você não pode analisar uma indicação que você mesmo fez'; end if;
  if v_nom.target_role = 'super_admin' and v_caller_role <> 'owner' then raise exception 'Acesso negado: indicações para super admin só podem ser decididas pelo fundador'; end if;
  select username into v_candidate_username from profiles where id = v_nom.candidate_id;
  if p_decision = 'reject' then
    update staff_nominations set status='rejected', reviewed_by=v_caller_id, review_notes=p_notes, decided_at=now() where id=p_nomination_id;
    insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
    values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_nomination_rejected',
      'Indicação de @'||v_candidate_username||' para '||v_nom.target_role||' rejeitada por @'||v_caller_username, 'admin', 'info');
    return;
  end if;
  update staff_nominations set status='trial_active', reviewed_by=v_caller_id, review_notes=p_notes, decided_at=now(),
    trial_started_at=now(), trial_review_date=now()+(p_trial_days||' days')::interval where id=p_nomination_id;
  update profiles set role=v_nom.target_role, role_changed_at=now() where id=v_nom.candidate_id;
  insert into admin_logs (admin_id, admin_username, actor_id, actor_username, action, details, category, severity)
  values (v_caller_id, v_caller_username, v_caller_id, v_caller_username, 'staff_nomination_approved',
    'Indicação de @'||v_candidate_username||' para '||v_nom.target_role||' aprovada por @'||v_caller_username||
    ' — período de avaliação de '||p_trial_days||' dias iniciado', 'admin', 'info');
end;
$function$;

-- ─── decide_staff_trial ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decide_staff_trial(
  p_nomination_id uuid, p_decision text, p_notes text DEFAULT NULL, p_extend_days integer DEFAULT 15)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text;
  v_nom staff_nominations%rowtype; v_candidate_username text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  if role_rank(v_caller_role) < 3 then raise exception 'Acesso negado: apenas super admins ou o fundador podem decidir sobre avaliações'; end if;
  if p_decision not in ('confirm','extend','revert') then raise exception 'Decisão inválida: %', p_decision; end if;
  select * into v_nom from staff_nominations where id = p_nomination_id for update;
  if v_nom.id is null then raise exception 'Avaliação não encontrada'; end if;
  if v_nom.status <> 'trial_active' then raise exception 'Esta indicação não está em período de avaliação'; end if;
  if v_nom.nominated_by is not null and v_nom.nominated_by = v_caller_id then raise exception 'Acesso negado: você não pode decidir sobre uma avaliação que você mesmo indicou'; end if;
  if v_nom.target_role = 'super_admin' and v_caller_role <> 'owner' then raise exception 'Acesso negado: avaliação de super admin só pode ser decidida pelo fundador'; end if;
  select username into v_candidate_username from profiles where id = v_nom.candidate_id;
  if p_decision = 'extend' then
    if p_extend_days is null or p_extend_days < 1 then raise exception 'Extensão inválida'; end if;
    update staff_nominations set trial_review_date=trial_review_date+(p_extend_days||' days')::interval,
      review_notes=coalesce(review_notes||E'\n','')||'[Extensão +'||p_extend_days||'d por @'||v_caller_username||'] '||coalesce(p_notes,'')
    where id=p_nomination_id;
    insert into admin_logs (admin_id,admin_username,actor_id,actor_username,action,details,category,severity)
    values (v_caller_id,v_caller_username,v_caller_id,v_caller_username,'staff_trial_extended',
      'Avaliação de @'||v_candidate_username||' estendida em '||p_extend_days||' dias por @'||v_caller_username,'admin','info');
    return;
  end if;
  if p_decision = 'confirm' then
    update staff_nominations set status='confirmed',final_decided_by=v_caller_id,final_decision_notes=p_notes,final_decided_at=now() where id=p_nomination_id;
    insert into admin_logs (admin_id,admin_username,actor_id,actor_username,action,details,category,severity)
    values (v_caller_id,v_caller_username,v_caller_id,v_caller_username,'staff_trial_confirmed',
      'Avaliação de @'||v_candidate_username||' confirmada — cargo de '||v_nom.target_role||' efetivado por @'||v_caller_username,'admin','info');
    return;
  end if;
  update staff_nominations set status='reverted',final_decided_by=v_caller_id,final_decision_notes=p_notes,final_decided_at=now() where id=p_nomination_id;
  update profiles set role='user', role_changed_at=now() where id=v_nom.candidate_id;
  insert into admin_logs (admin_id,admin_username,actor_id,actor_username,action,details,category,severity)
  values (v_caller_id,v_caller_username,v_caller_id,v_caller_username,'staff_trial_reverted',
    'Avaliação de @'||v_candidate_username||' revertida — cargo removido por @'||v_caller_username||coalesce('. Motivo: '||p_notes,''),'admin','warning');
end;
$function$;

-- ─── request_role_demotion ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_role_demotion(p_target_id uuid, p_proposed_role text, p_reason text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_caller_id uuid := auth.uid(); v_caller_role text; v_target_role text; v_id uuid;
begin
  select role into v_caller_role from profiles where id = v_caller_id;
  select role into v_target_role from profiles where id = p_target_id;
  if v_target_role is null then raise exception 'Usuário não encontrado'; end if;
  if role_rank(v_caller_role) < 2 then raise exception 'Acesso negado: admin necessário'; end if;
  if p_target_id = v_caller_id then raise exception 'Não é possível solicitar rebaixamento da própria conta'; end if;
  if v_target_role = 'owner' then raise exception 'Não é possível alterar a role do fundador'; end if;
  if p_proposed_role not in ('user','admin') then raise exception 'Cargo proposto inválido: %', p_proposed_role; end if;
  if role_rank(p_proposed_role) >= role_rank(v_target_role) then raise exception 'O cargo proposto precisa ser inferior ao cargo atual'; end if;
  if role_rank(v_caller_role) <= role_rank(v_target_role) then raise exception 'Acesso negado: cargo igual ou superior ao do alvo'; end if;
  if p_reason is null or length(trim(p_reason)) < 10 then raise exception 'É necessário informar um motivo (mínimo 10 caracteres)'; end if;
  if exists (select 1 from role_change_requests where target_id = p_target_id and status = 'pending') then raise exception 'Já existe uma solicitação de rebaixamento pendente para este usuário'; end if;
  insert into role_change_requests (target_id, requested_by, previous_role, proposed_role, reason, status)
  values (p_target_id, v_caller_id, v_target_role, p_proposed_role, trim(p_reason), 'pending')
  returning id into v_id;
  return v_id;
end;
$function$;

-- ─── decide_role_demotion ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decide_role_demotion(p_request_id uuid, p_decision text, p_notes text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_caller_id uuid := auth.uid(); v_caller_role text; v_caller_username text;
  v_req role_change_requests%rowtype; v_target_username text;
begin
  select role, username into v_caller_role, v_caller_username from profiles where id = v_caller_id;
  if role_rank(v_caller_role) < 3 then raise exception 'Acesso negado: apenas super admins ou o fundador podem decidir rebaixamentos'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Decisão inválida: %', p_decision; end if;
  select * into v_req from role_change_requests where id = p_request_id for update;
  if v_req.id is null then raise exception 'Solicitação não encontrada'; end if;
  if v_req.status <> 'pending' then raise exception 'Solicitação já foi analisada'; end if;
  if v_req.requested_by = v_caller_id then raise exception 'Acesso negado: você não pode decidir uma solicitação que você mesmo fez'; end if;
  select username into v_target_username from profiles where id = v_req.target_id;
  if p_decision = 'reject' then
    update role_change_requests set status='rejected', reviewed_by=v_caller_id, review_notes=p_notes, decided_at=now() where id=p_request_id;
    insert into admin_logs (admin_id,admin_username,actor_id,actor_username,action,details,category,severity)
    values (v_caller_id,v_caller_username,v_caller_id,v_caller_username,'demotion_rejected',
      'Solicitação de rebaixamento de @'||v_target_username||' rejeitada por @'||v_caller_username,'admin','info');
    return;
  end if;
  update role_change_requests set status='approved', reviewed_by=v_caller_id, review_notes=p_notes, decided_at=now() where id=p_request_id;
  update profiles set role=v_req.proposed_role, role_changed_at=now() where id=v_req.target_id;
  insert into admin_logs (admin_id,admin_username,actor_id,actor_username,action,details,category,severity)
  values (v_caller_id,v_caller_username,v_caller_id,v_caller_username,'demotion_approved',
    'Rebaixamento de @'||v_target_username||' de '||v_req.previous_role||' para '||v_req.proposed_role||
    ' aprovado por @'||v_caller_username||'. Motivo original: '||v_req.reason,'admin','warning');
end;
$function$;


-- ============================================================
-- SECTION 6 — MIGRATIONS HISTORY (reference only)
-- ============================================================
-- 20260521104641  remove_unnecessary_realtime
-- 20260526011737  add_post_media_table
-- 20260528172355  add_post_audio_columns
-- 20260530115952  add_audio_name_column
-- 20260530125521  make_content_nullable
-- 20260530150020  add_embed_url_column
-- 20260530152757  add_expires_at_column
-- 20260530152838  add_is_live_column
-- 20260530155650  add_cron_cleanup_expired_posts
-- 20260530160100  set_twitch_posts_live
-- 20260530160337  create_live_chat_table
-- 20260530161824  add_live_moderation
-- 20260530162538  add_live_chat_moderation
-- 20260531144528  fix_live_chat_user_fk
-- 20260531150119  fix_live_post_is_live
-- 20260531151655  fix_live_chat_realtime
-- 20260602174545  add_update_policy_live_chat_timeouts
-- 20260602195116  fix_live_chat_timeouts_user_id_fk_to_profiles
-- 20260602202232  auto_expire_lives_cron
-- 20260602202707  add_was_live_column
-- 20260603005935  live_reactivation_and_admin_logs
-- 20260603011108  admin_notifications_system
-- 20260603011930  auto_delete_ended_lives
-- 20260603020733  notify_live_status_changes
-- 20260603022031  fix_rls_security_holes
-- 20260603025849  audit_logs_expanded
-- 20260603114950  delete_own_account_rpc
-- 20260603115017  fix_admin_logs_nullable_admin_id
-- 20260603115048  fix_admin_logs_actor_id_no_fk
-- 20260603204936  auto_expire_lives_cron
-- 20260604003712  server_side_rate_limiting
-- 20260604011659  expand_profiles_and_admin_unblock
-- 20260604025052  admin_set_login_block
-- 20260604030202  fix_record_login_failure_accumulate_attempts
-- 20260604140854  super_admin_read_login_rate_limits
-- 20260604143810  fix_blocked_logins_visibility_and_realtime
-- 20260604144606  remove_login_rate_limiting_completely
-- 20260604145443  create_login_attempts_panel_backend
-- 20260604145908  login_attempts_write_functions
-- 20260604151326  login_attempts_accumulative_unlock
-- 20260604152152  blocked_logins_only_currently_blocked
-- 20260604210414  login_block_log_and_notification
-- 20260604212406  add_ban_columns_to_profiles
-- 20260604212419  create_unban_requests_table
-- 20260604212442  create_function_ban_user
-- 20260604212458  create_function_unban_user
-- 20260604212515  create_function_request_unban
-- 20260604212537  create_function_approve_unban_request
-- 20260604212725  ban_system_columns_and_table
-- 20260604212804  ban_system_functions
-- 20260604214654  ban_user_cascade_delete
-- 20260604215328  enable_realtime_profiles
-- 20260604220510  profiles_replica_identity_full
-- 20260605182046  ban_full_activity_and_history
-- 20260605195002  get_user_xp_function
-- 20260605200740  add_owner_role
-- 20260605204548  owner_dashboard_setup
-- 20260606024330  owner_dashboard_v2_fixes
-- 20260606033250  fix_ambiguous_id_in_owner_functions
-- 20260606120404  fix_profiles_privilege_escalation
-- 20260606120741  harden_rls_and_functions
-- 20260606120757  performance_indexes
-- 20260606121706  notifications_via_triggers
-- 20260606122349  optimize_rls_auth_initplan
-- 20260606123302  consolidate_rls_policies_and_fix_banned_insert
-- 20260606164513  fix_admin_notifications_rls_include_owner
-- 20260606173503  site_config_consolidate_select_policies
-- 20260606173604  storage_restrict_public_bucket_listing
-- 20260606173630  revoke_anon_execute_on_privileged_functions
-- 20260607130034  allow_owner_review_unban_requests
-- 20260607141118  add_comment_likes
-- 20260607141307  add_comment_replies
-- 20260607173140  staff_promotion_schema
-- 20260607173209  staff_promotion_eligibility_fn
-- 20260607173239  staff_promotion_nomination_fns
-- 20260607173318  staff_promotion_trial_and_demotion_fns
-- 20260607173354  staff_role_changed_at_tracking
-- 20260607180650  staff_alert_owner_notifications
-- 20260607183544  fix_staff_self_review_loophole
-- 20260608141023  mural_media_and_likes
-- 20260609002305  add_live_kind_to_posts
-- 20260610025658  fix_moderation_hierarchy_on_delete
-- 20260610115538  moderation_phase1
-- 20260610122003  moderation_temp_suspension
-- 20260610135200  moderation_ai_phase2
-- 20260610172854  soft_delete_and_image_moderation
-- 20260610183825  enable_realtime_moderation_queue
-- 20260610190230  phase5_link_moderation_and_escalation_fix
-- 20260611013201  notify_user_rpc
-- 20260611014711  fix_security_grants_new_functions


-- ============================================================
-- SECTION 7 — STORAGE BUCKETS
-- ============================================================
-- Recreate via Supabase dashboard or CLI:
--
-- bucket: avatars    (public=true, file_size_limit=5MB,  allowed_mime: image/*)
-- bucket: post-media (public=true, file_size_limit=50MB, allowed_mime: image/*, video/*, audio/*)
--
-- Storage RLS policies (set via Supabase dashboard):
--   avatars:
--     SELECT: true (public read)
--     INSERT: auth.uid()::text = (storage.foldername(name))[1]
--     UPDATE: auth.uid()::text = (storage.foldername(name))[1]
--     DELETE: auth.uid()::text = (storage.foldername(name))[1]
--   post-media:
--     SELECT: true (public read)
--     INSERT: auth.uid() IS NOT NULL
--     DELETE: auth.uid()::text = (storage.foldername(name))[1]
--
-- cacheControl on post-media uploads: '31536000' (1 year, safe — unique paths)


-- ============================================================
-- SECTION 8 — REALTIME PUBLICATIONS
-- ============================================================
-- Tables with supabase_realtime publication:
--   posts, post_media, profiles, community_posts,
--   live_chat, live_chat_timeouts, admin_logs,
--   admin_notifications, site_config, moderation_queue
--
-- profiles uses REPLICA IDENTITY FULL (required for realtime ban detection).
-- ALTER TABLE public.profiles REPLICA IDENTITY FULL;


-- ============================================================
-- END OF SCHEMA BACKUP
-- ============================================================
