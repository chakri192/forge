-- 001_initial_schema.sql
-- Foundational schema for Forge app

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'leader', 'member', 'DEV_STEALTH', 'OPERATIVE', 'VANGUARD', 'STUDENT_LEADER', 'TEACHER')),
  tag TEXT,
  bio TEXT,
  skills TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_leader_rotations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  term_start DATETIME NOT NULL,
  term_end DATETIME NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  captain_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  task_id TEXT,
  is_active INTEGER DEFAULT 1,
  status TEXT DEFAULT 'ACTIVE',
  dissolved_at DATETIME,
  dissolution_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  total_points INTEGER NOT NULL DEFAULT 50,
  task_type TEXT NOT NULL DEFAULT 'TEAM_TASK' CHECK(task_type IN ('TEAM_TASK', 'CHALLENGE')),
  mode TEXT NOT NULL DEFAULT 'CHOICE' CHECK(mode IN ('SOLO', 'TEAM', 'CHOICE')),
  is_marketplace INTEGER DEFAULT 0,
  assigned_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  assigned_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  requires_proof INTEGER DEFAULT 1,
  due_date DATETIME,
  status TEXT DEFAULT 'OPEN',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_upvotes (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  custom_point_share REAL NOT NULL DEFAULT 1.0,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, team_id)
);

CREATE TABLE IF NOT EXISTS task_submissions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  submitted_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proof_url TEXT,
  proof_notes TEXT,
  status TEXT DEFAULT 'PENDING',
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hall_of_fame_titles (
  id TEXT PRIMARY KEY,
  title_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Academics',
  awarded_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  awarded_to_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  season TEXT NOT NULL DEFAULT 'Season 1',
  awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO system_settings (key, value) VALUES ('signup_enabled', '1');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('max_capacity', '50');
