-- Discord bridge mapping tables.
--
-- These map Forge's own identifiers onto Discord's. Nothing here stores
-- message content: the point of the mapping is that Forge can find the Discord
-- object for one of its own records, and back again.

-- Forge channel  <->  Discord channel.
CREATE TABLE IF NOT EXISTS discord_channel_map (
  id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL UNIQUE,
  discord_parent_id TEXT,
  forge_channel_type TEXT NOT NULL
    CHECK(forge_channel_type IN ('public', 'team_chat', 'private_dm', 'group', 'forum', 'system')),
  forge_reference_id TEXT,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dcm_type ON discord_channel_map(forge_channel_type, is_active);
CREATE INDEX IF NOT EXISTS idx_dcm_ref ON discord_channel_map(forge_reference_id);

-- Forge user <-> their forge code, and their Discord account if they ever link
-- one. Messages are posted by bots on a user's behalf, so a Discord account is
-- not required to use Forge.
CREATE TABLE IF NOT EXISTS discord_user_map (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  forge_code TEXT NOT NULL UNIQUE,
  discord_user_id TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discord_dm_participants (
  id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Unread is derived by comparing this against the newest message, so there
  -- is no counter to drift out of step.
  last_read_message_id TEXT,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ddp_user ON discord_dm_participants(user_id);

-- Files live on this server. Discord CDN links expire, so the Discord URL is
-- recorded for reference only and never served to a user.
CREATE TABLE IF NOT EXISTS discord_files (
  id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL,
  discord_message_id TEXT,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  local_path TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  discord_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dfiles_channel ON discord_files(discord_channel_id);

CREATE TABLE IF NOT EXISTS discord_pinned_messages (
  id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL,
  discord_message_id TEXT NOT NULL,
  pinned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  pinned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(discord_channel_id, discord_message_id)
);

-- What was kept when a team channel was deleted.
CREATE TABLE IF NOT EXISTS discord_channel_archive (
  id TEXT PRIMARY KEY,
  discord_channel_id TEXT NOT NULL,
  forge_reference_id TEXT,
  name TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  archive_path TEXT,
  archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
