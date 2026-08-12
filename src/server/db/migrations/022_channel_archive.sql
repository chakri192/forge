-- Forge-side channel archive.
--
-- 019 bolted a forge_channel_id onto discord_channel_archive, which was the
-- wrong call: that table requires a discord_channel_id, and a workspace that
-- was never mirrored to Discord — because the bridge was off, or the guild was
-- unreachable when the team formed — has none.
--
-- The two records are about different things. discord_channel_archive is what
-- happened to Discord's copy. This is what happened to ours, and it must exist
-- whether or not Discord was ever involved.

CREATE TABLE IF NOT EXISTS channel_archive (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  reference_id TEXT,
  name TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_archive_ref ON channel_archive (reference_id);
