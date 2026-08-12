-- Meeting notes for the collaboration hub.
--
-- These live in SQLite rather than Discord on purpose. A note is a structured
-- document that gets edited — titled, revised, referred back to. A chat backend
-- has no concept of editing a document, and storing one as a message would mean
-- the "current" version is whatever was posted last and scrolled past.

CREATE TABLE IF NOT EXISTS meeting_notes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_task
  ON meeting_notes (task_id, updated_at DESC);
