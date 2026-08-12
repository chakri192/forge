-- Notification preferences.
--
-- Until now every notification reached everyone it applied to, with no way to
-- turn any of it down. In a cohort of fifty that is how people end up ignoring
-- the bell entirely, which costs you the notifications that actually mattered.
--
-- Preferences are stored sparsely: a row exists only where someone has changed
-- something from the default. An absent row means "on", so a new member starts
-- with everything enabled and no backfill is needed.

CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences (user_id);

-- Muting one busy channel is a different need from switching off a whole
-- category, and the common one — people want the cohort chatter quiet without
-- losing review requests.
--
-- A mute silences the channel but never a direct mention of you. That is the
-- convention everywhere else, and a mute that swallowed someone calling your
-- name would make the feature untrustworthy.
CREATE TABLE IF NOT EXISTS muted_channels (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  muted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_muted_channels_user ON muted_channels (user_id);
