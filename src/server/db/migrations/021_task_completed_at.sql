-- When a task actually finished.
--
-- The team-workspace sweep archives a channel a grace period after its task
-- completes, and there was no timestamp to measure that from: tasks carry
-- created_at and a status, but nothing recording when the status last moved.
--
-- Backfilled from the newest reviewed submission, which is the closest thing to
-- a completion time for work that finished before this column existed.

ALTER TABLE tasks ADD COLUMN completed_at DATETIME;

UPDATE tasks
SET completed_at = (
  SELECT MAX(COALESCE(s.reviewed_at, s.created_at))
  FROM task_submissions s
  WHERE s.task_id = tasks.id
)
WHERE UPPER(status) IN ('COMPLETED', 'ARCHIVED') AND completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks (status, completed_at);
