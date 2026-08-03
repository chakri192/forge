-- 002_expand_specification_schema.sql
-- Complete specification systems schema for Forge

-- 1. Channels Table
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'voice', 'announcement', 'team')),
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  is_private INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  attachments TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Forum Threads Table
CREATE TABLE IF NOT EXISTS forum_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_pinned INTEGER DEFAULT 0,
  is_locked INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Forum Posts Table
CREATE TABLE IF NOT EXISTS forum_posts (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_answer INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  location TEXT,
  event_type TEXT DEFAULT 'EVENT' CHECK(event_type IN ('EVENT', 'DEADLINE', 'WORKSHOP', 'MEETING')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Todos Table
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed INTEGER DEFAULT 0,
  due_date DATETIME,
  priority TEXT DEFAULT 'MEDIUM' CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Badges Table
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  category TEXT DEFAULT 'GENERAL',
  rarity TEXT DEFAULT 'COMMON' CHECK(rarity IN ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY')),
  xp_bonus INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. User Badges Table
CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  awarded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(user_id, badge_id)
);

-- 10. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'INFO',
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Activity Log Table
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'NORMAL' CHECK(priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  target_role TEXT,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Votes Table
CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK(target_type IN ('FORUM_THREAD', 'FORUM_POST', 'SUGGESTION')),
  target_id TEXT NOT NULL,
  vote_value INTEGER NOT NULL CHECK(vote_value IN (-1, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, target_type, target_id)
);

-- 14. Subtasks Table
CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed INTEGER DEFAULT 0,
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. XP History Table
CREATE TABLE IF NOT EXISTS xp_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. Streaks Table
CREATE TABLE IF NOT EXISTS streaks (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 17. Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  criteria_type TEXT NOT NULL,
  criteria_value INTEGER DEFAULT 1,
  badge_id TEXT REFERENCES badges(id) ON DELETE SET NULL,
  xp_reward INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 18. Marketplace Suggestions Table
CREATE TABLE IF NOT EXISTS marketplace_suggestions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED')),
  upvotes_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance & quick foreign key lookups
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_forum_threads_author ON forum_threads(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON forum_threads(category);
CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_team ON calendar_events(team_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON calendar_events(created_by);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);

CREATE INDEX IF NOT EXISTS idx_todos_user_completed ON todos(user_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user ON journal_entries(user_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

CREATE INDEX IF NOT EXISTS idx_xp_history_user ON xp_history(user_id);
CREATE INDEX IF NOT EXISTS idx_streaks_user ON streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_team ON tasks(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
