-- Forum categories and tags (milestone 3.4).
--
-- `category` was free text, so it drifted: one thread filed under "Engineering"
-- and nothing to browse by. The eight categories are fixed in code rather than
-- a table — they are a product decision, not data someone edits, and a table
-- would invite a half-built admin screen to manage six rows.
--
-- Tags are stored as a JSON array on the thread. They are a small, bounded set
-- validated against a fixed list on write, so a join table would buy nothing
-- but a second query on every read.

ALTER TABLE forum_threads ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_forum_threads_category
  ON forum_threads (category, is_pinned DESC, updated_at DESC);
