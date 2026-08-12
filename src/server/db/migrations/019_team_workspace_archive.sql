-- Team workspace lifecycle (milestone 3.3).
--
-- A team channel is created when the team forms and archived a grace period
-- after the task finishes. Archiving is not deletion: the transcript is often
-- the only record of why a decision was made, so the Forge channel stays and
-- only stops accepting new messages. Discord's copy is what gets removed.

ALTER TABLE channels ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_channels_archived ON channels (is_archived, team_id);

-- The existing discord_channel_archive keys on a Discord id, which is wrong for
-- us: the record must survive whether or not the channel was ever mirrored, and
-- must point at the Forge channel that holds the transcript.
ALTER TABLE discord_channel_archive ADD COLUMN forge_channel_id TEXT;

CREATE INDEX IF NOT EXISTS idx_channel_archive_forge
  ON discord_channel_archive (forge_channel_id);
