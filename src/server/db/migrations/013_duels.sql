-- A duel is one challenger against one opponent.
--
-- The two sides control different variables on purpose: the challenger sets
-- the stake, and the person challenged chooses the topic. Neither gets to pick
-- both what is fought over and what it is worth.
CREATE TABLE IF NOT EXISTS duels (
  id TEXT PRIMARY KEY,
  challenger_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stake_points INTEGER NOT NULL DEFAULT 0 CHECK(stake_points >= 0),
  stake_xp INTEGER NOT NULL DEFAULT 0 CHECK(stake_xp >= 0),
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING', 'ACTIVE', 'RESOLVED', 'DECLINED', 'CANCELLED')),
  winner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_duels_status ON duels(status);
CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels(challenger_id);

CREATE TABLE IF NOT EXISTS duel_participants (
  id TEXT PRIMARY KEY,
  duel_id TEXT NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK(side IN ('CHALLENGER', 'OPPONENT')),
  accepted INTEGER NOT NULL DEFAULT 0,
  -- The challenged person's topic. Recorded per participant rather than only
  -- on the duel so the choice stays attributable to whoever made it.
  topic_choice TEXT,
  staked INTEGER NOT NULL DEFAULT 0,
  UNIQUE(duel_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_duel_participants_user ON duel_participants(user_id);
