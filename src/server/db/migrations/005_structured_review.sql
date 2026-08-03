-- Structured submission review
-- Replaces a single free-text verdict with a rubric, per-criterion scores,
-- and a threaded conversation between reviewer and submitter.

CREATE TABLE IF NOT EXISTS rubric_criteria (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  max_score INTEGER NOT NULL DEFAULT 5,
  weight REAL NOT NULL DEFAULT 1.0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- One score per criterion per reviewer, so a second reviewer adds a column
-- of opinion rather than overwriting the first.
CREATE TABLE IF NOT EXISTS review_scores (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES task_submissions(id) ON DELETE CASCADE,
  criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  score INTEGER NOT NULL,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, criterion_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS review_comments (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES task_submissions(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_resolution INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rubric_criteria_task ON rubric_criteria(task_id);
CREATE INDEX IF NOT EXISTS idx_review_scores_submission ON review_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_submission ON review_comments(submission_id);
