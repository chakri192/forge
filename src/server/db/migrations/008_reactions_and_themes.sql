-- Reactions, message voting, and per-user theme preferences.

-- Emoji reactions. UNIQUE gives toggle semantics for free: reacting with the
-- same emoji twice removes it, and one user can hold several distinct
-- reactions on the same message.
CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

-- Extend the votes CHECK constraint to cover messages. SQLite cannot alter a
-- CHECK in place, so the table is rebuilt and its rows copied across.
CREATE TABLE IF NOT EXISTS votes_next (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK(target_type IN ('FORUM_THREAD', 'FORUM_POST', 'SUGGESTION', 'MESSAGE')),
  target_id TEXT NOT NULL,
  vote_value INTEGER NOT NULL CHECK(vote_value IN (-1, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, target_type, target_id)
);

INSERT INTO votes_next (id, user_id, target_type, target_id, vote_value, created_at)
  SELECT id, user_id, target_type, target_id, vote_value, created_at FROM votes;

DROP TABLE votes;
ALTER TABLE votes_next RENAME TO votes;

CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);

-- Theme preference travels with the account rather than one browser.
ALTER TABLE users ADD COLUMN theme_preset TEXT;
ALTER TABLE users ADD COLUMN theme_accents TEXT;
