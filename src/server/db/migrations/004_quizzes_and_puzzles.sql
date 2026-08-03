-- Quizzes & Puzzles
-- A quiz is an ordered set of questions. A puzzle is a quiz with kind='PUZZLE'
-- and (usually) a single question — the daily brain-teaser surface.

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  kind TEXT NOT NULL DEFAULT 'QUIZ' CHECK(kind IN ('QUIZ', 'PUZZLE')),
  difficulty TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(difficulty IN ('EASY', 'MEDIUM', 'HARD', 'EXPERT')),
  time_limit_seconds INTEGER,
  xp_reward INTEGER NOT NULL DEFAULT 50,
  pass_percent INTEGER NOT NULL DEFAULT 70,
  max_attempts INTEGER,
  -- A puzzle scheduled for a specific day powers the "daily puzzle" surface.
  scheduled_for DATE,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'MCQ'
    CHECK(question_type IN ('MCQ', 'MULTI', 'TRUE_FALSE', 'SHORT_ANSWER', 'CODE_OUTPUT')),
  -- JSON array of choice strings for MCQ/MULTI; NULL otherwise.
  options TEXT,
  -- JSON: a string, or an array of strings for MULTI / accepted short answers.
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  code_snippet TEXT,
  hint TEXT,
  points INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  percent INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  -- JSON map of question_id -> submitted answer, kept for review screens.
  answers TEXT,
  duration_seconds INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_scheduled ON quizzes(scheduled_for);
