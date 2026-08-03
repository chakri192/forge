-- The first three games leaned on hex codes and code snippets, which is
-- homework rather than play. Swapping them for classics changes the allowed
-- values, and SQLite cannot alter a CHECK constraint in place, so the table
-- is rebuilt.
CREATE TABLE IF NOT EXISTS game_scores_next (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game TEXT NOT NULL CHECK(game IN ('snake', 'memory', 'pop', 'sequence')),
  score INTEGER NOT NULL CHECK(score >= 0),
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Only Sequence survives the change. Scores from the retired games have no
-- honest home in the new set, so they are left behind rather than relabelled.
INSERT INTO game_scores_next (id, user_id, game, score, detail, created_at)
  SELECT id, user_id, game, score, detail, created_at
  FROM game_scores WHERE game = 'sequence';

DROP TABLE game_scores;
ALTER TABLE game_scores_next RENAME TO game_scores;

CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON game_scores(game, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id, game);
