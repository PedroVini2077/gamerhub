ALTER TABLE posts ADD COLUMN IF NOT EXISTS was_live boolean NOT NULL DEFAULT false;

-- Backfill: posts que tinham live_chat (foram lives de verdade)
UPDATE posts SET was_live = true
WHERE id IN (SELECT DISTINCT post_id FROM live_chat);

-- Backfill: posts que ainda estão como is_live=true
UPDATE posts SET was_live = true WHERE is_live = true;

-- Backfill: posts que tinham expires_at definido (só lives usam isso)
UPDATE posts SET was_live = true WHERE expires_at IS NOT NULL;
;
