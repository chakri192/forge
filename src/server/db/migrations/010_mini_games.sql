-- Mini games replace the quiz feature. Scores are kept per attempt rather than
-- as a single "best" column so history survives and bests can be recomputed.
CREATE TABLE IF NOT EXISTS game_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL CHECK(game IN ('hex', 'sprint', 'sequence')),
  score INTEGER NOT NULL CHECK(score >= 0),
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON game_scores(game, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id, game);
