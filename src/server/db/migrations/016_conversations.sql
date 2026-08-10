-- Direct messages and group conversations.
--
-- A conversation is a thin record beside a normal private channel rather than a
-- new channel type. Two reasons:
--
--   1. channels.type carries a CHECK constraint, and SQLite cannot alter one
--      without rebuilding the table — a rebuild of a table that messages FKs
--      into, inside the migrator's transaction, is not worth the risk for a
--      label.
--   2. Sitting on a real channel means DMs inherit reactions, @mentions, edit
--      and delete, SSE delivery and the Discord relay with no new code paths.
--
-- The channel row is created with type 'text' and is_private = 1; membership is
-- decided here, not by team.

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL UNIQUE REFERENCES channels(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('dm', 'group')),
  -- Null for a dm, where the title is the other person's name.
  title TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_conversations_recent ON conversations (last_message_at DESC);

CREATE TABLE IF NOT EXISTS conversation_participants (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Unread is derived by comparing this with last_message_at, so there is no
  -- counter that can drift out of step with the messages themselves.
  last_read_at DATETIME,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user
  ON conversation_participants (user_id, conversation_id);

-- A one-to-one conversation must be unique per pair, or "message Sarah" would
-- open a different empty thread every time. The key is the two user ids sorted
-- and joined, computed by the application and stored here so the database can
-- enforce it rather than trusting a read-then-write.
CREATE TABLE IF NOT EXISTS dm_pairs (
  pair_key TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE
);
