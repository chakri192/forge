-- 003_expand_task_schema.sql
-- Expand tasks table schema to support detailed task management and lifecycle

ALTER TABLE tasks ADD COLUMN instructions TEXT;
ALTER TABLE tasks ADD COLUMN resources TEXT;
ALTER TABLE tasks ADD COLUMN deadline DATETIME;
ALTER TABLE tasks ADD COLUMN difficulty TEXT DEFAULT 'MEDIUM';
ALTER TABLE tasks ADD COLUMN xp_reward INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN badge_reward TEXT;
ALTER TABLE tasks ADD COLUMN proof_requirements TEXT;
