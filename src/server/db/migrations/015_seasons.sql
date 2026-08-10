-- Seasons.
--
-- A season is a window over xp_history, not a reset. Nothing is deleted when
-- one ends: the live leaderboard simply stops counting XP earned before the
-- current season started. That keeps a member's full history intact for their
-- profile while letting someone who joined in month six still compete.
--
-- Points and cosmetics are deliberately absent from this file. They are a
-- separate currency and survive every season — the leaderboard runs on XP,
-- the store runs on points.

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  archived_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- At most one season may be open at a time. Enforced here rather than in the
-- service, because two active seasons would make "the current standings" an
-- unanswerable question and no amount of application care prevents a race.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_one_active
  ON seasons (status) WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_seasons_window ON seasons (starts_at, ends_at);

-- Final standings, frozen at the moment a season is archived.
--
-- Derived from xp_history, but stored rather than recomputed: a later
-- correction to someone's XP must not silently rewrite who won a season that
-- has already been celebrated.
CREATE TABLE IF NOT EXISTS season_standings (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (season_id, metric, user_id)
);

CREATE INDEX IF NOT EXISTS idx_season_standings_lookup
  ON season_standings (season_id, metric, rank);

-- xp_history is read by season window on every leaderboard request.
CREATE INDEX IF NOT EXISTS idx_xp_history_created ON xp_history (created_at);
