CREATE TABLE IF NOT EXISTS game_scores_prev (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL CHECK(game IN ('hex', 'sprint', 'sequence')),
  score INTEGER NOT NULL CHECK(score >= 0),
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO game_scores_prev SELECT id, user_id, game, score, detail, created_at
  FROM game_scores WHERE game = 'sequence';
DROP TABLE game_scores;
ALTER TABLE game_scores_prev RENAME TO game_scores;
CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON game_scores(game, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id, game);
