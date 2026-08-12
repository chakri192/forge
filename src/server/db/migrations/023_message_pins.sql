-- Pinned messages (milestone 3.2).
--
-- Its own table rather than a flag on messages: a pin has an author and a time,
-- and "who pinned this and when" is exactly the question asked when a pin turns
-- out to be wrong. A boolean column would answer none of it.
--
-- discord_pinned_messages already exists but keys on Discord ids, which a
-- message that was never mirrored does not have. Same split as the channel
-- archive: that table records what happened to Discord's copy, this one is ours.

CREATE TABLE IF NOT EXISTS message_pins (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  pinned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS idx_message_pins_channel ON message_pins (channel_id, pinned_at DESC);

-- Unread counts read this constantly.
CREATE INDEX IF NOT EXISTS idx_messages_channel_time ON messages (channel_id, created_at);
