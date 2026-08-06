-- Two currencies with different rules.
--
-- XP is progression: an append-only ledger that is never spent, and the only
-- thing the leaderboard ranks on. It already exists as xp_history.
--
-- Points are a wallet: earned from challenges, spent in the cosmetics store.
-- A balance has to be derived from signed entries rather than kept as a column
-- so that a crash can never leave a purchase without its debit.
CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,            -- positive earns, negative spends
  reason TEXT NOT NULL,
  source_type TEXT,
  source_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_point_tx_user ON point_transactions(user_id);
-- Guards double-crediting the same challenge for the same person.
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_tx_source
  ON point_transactions(user_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL AND amount > 0;

-- Challenges carry their own point reward. total_points is the task's weight
-- for review scoring and is a separate idea from spendable currency.
ALTER TABLE tasks ADD COLUMN point_reward INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS cosmetics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('frame', 'title', 'banner')),
  cost INTEGER NOT NULL CHECK(cost >= 0),
  -- Colours only, validated on the way in and on the way out. Nothing from
  -- this column is ever interpolated into a stylesheet as raw text.
  value TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_cosmetics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
  equipped INTEGER DEFAULT 0,
  acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, cosmetic_id)
);
CREATE INDEX IF NOT EXISTS idx_user_cosmetics_user ON user_cosmetics(user_id);

INSERT OR IGNORE INTO cosmetics (id, name, description, kind, cost, value, sort_order) VALUES
  ('frame_slate',   'Slate Ring',      'A quiet steel ring around your avatar.',      'frame',  0,   '#8a9099', 1),
  ('frame_ember',   'Ember Ring',      'Warm orange, hard to miss in a list.',        'frame',  120, '#e2703a', 2),
  ('frame_mint',    'Mint Ring',       'Cool green with a soft edge.',                'frame',  120, '#3fbf82', 3),
  ('frame_violet',  'Violet Ring',     'Deep purple for the long-haul contributors.', 'frame',  260, '#8b5cf6', 4),
  ('frame_gold',    'Gold Ring',       'The expensive one. Everyone knows.',          'frame',  600, '#d4a015', 5),
  ('title_builder', 'Builder',         'A plain, honest label.',                      'title',  80,  '#6f9ff0', 6),
  ('title_night',   'Night Owl',       'For the late commits.',                       'title',  180, '#a78bfa', 7),
  ('title_veteran', 'Veteran',         'Earned by sticking around.',                  'title',  420, '#e2703a', 8),
  ('banner_dawn',   'Dawn Banner',     'A soft warm wash on your profile header.',    'banner', 200, '#f0a35e', 9),
  ('banner_deep',   'Deep Banner',     'Cool blue, low key.',                         'banner', 200, '#3f6fbf', 10),
  ('banner_forest', 'Forest Banner',   'Green, calm, easy on the eye.',               'banner', 340, '#2f8f5b', 11);
