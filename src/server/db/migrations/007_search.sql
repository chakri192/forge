-- Full-text search
-- One external-content FTS5 index over everything worth finding. Triggers
-- keep it in step with the source tables, so there is no rebuild step and no
-- risk of the index drifting from reality.

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  kind UNINDEXED,      -- task | forum | message | announcement | quiz
  ref_id UNINDEXED,    -- primary key in the source table
  title,
  body,
  tokenize = 'porter unicode61'
);

-- Tasks -------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_search_tasks_ins AFTER INSERT ON tasks BEGIN
  INSERT INTO search_index (kind, ref_id, title, body)
  VALUES ('task', NEW.id, NEW.title, COALESCE(NEW.description, ''));
END;
CREATE TRIGGER IF NOT EXISTS trg_search_tasks_upd AFTER UPDATE ON tasks BEGIN
  DELETE FROM search_index WHERE kind = 'task' AND ref_id = OLD.id;
  INSERT INTO search_index (kind, ref_id, title, body)
  VALUES ('task', NEW.id, NEW.title, COALESCE(NEW.description, ''));
END;
CREATE TRIGGER IF NOT EXISTS trg_search_tasks_del AFTER DELETE ON tasks BEGIN
  DELETE FROM search_index WHERE kind = 'task' AND ref_id = OLD.id;
END;

-- Forum threads -----------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_search_threads_ins AFTER INSERT ON forum_threads BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('forum', NEW.id, NEW.title, '');
END;
CREATE TRIGGER IF NOT EXISTS trg_search_threads_upd AFTER UPDATE ON forum_threads BEGIN
  DELETE FROM search_index WHERE kind = 'forum' AND ref_id = OLD.id;
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('forum', NEW.id, NEW.title, '');
END;
CREATE TRIGGER IF NOT EXISTS trg_search_threads_del AFTER DELETE ON forum_threads BEGIN
  DELETE FROM search_index WHERE kind = 'forum' AND ref_id = OLD.id;
END;

-- Forum posts are indexed against their thread, so a match on a reply
-- surfaces the discussion it belongs to.
CREATE TRIGGER IF NOT EXISTS trg_search_posts_ins AFTER INSERT ON forum_posts BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('forum', NEW.thread_id, '', NEW.content);
END;
CREATE TRIGGER IF NOT EXISTS trg_search_posts_del AFTER DELETE ON forum_posts BEGIN
  DELETE FROM search_index WHERE kind = 'forum' AND ref_id = OLD.thread_id AND title = '';
END;

-- Announcements -----------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_search_ann_ins AFTER INSERT ON announcements BEGIN
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('announcement', NEW.id, NEW.title, NEW.content);
END;
CREATE TRIGGER IF NOT EXISTS trg_search_ann_upd AFTER UPDATE ON announcements BEGIN
  DELETE FROM search_index WHERE kind = 'announcement' AND ref_id = OLD.id;
  INSERT INTO search_index (kind, ref_id, title, body) VALUES ('announcement', NEW.id, NEW.title, NEW.content);
END;
CREATE TRIGGER IF NOT EXISTS trg_search_ann_del AFTER DELETE ON announcements BEGIN
  DELETE FROM search_index WHERE kind = 'announcement' AND ref_id = OLD.id;
END;

-- Quizzes -----------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_search_quiz_ins AFTER INSERT ON quizzes BEGIN
  INSERT INTO search_index (kind, ref_id, title, body)
  VALUES ('quiz', NEW.id, NEW.title, COALESCE(NEW.description, ''));
END;
CREATE TRIGGER IF NOT EXISTS trg_search_quiz_del AFTER DELETE ON quizzes BEGIN
  DELETE FROM search_index WHERE kind = 'quiz' AND ref_id = OLD.id;
END;

-- Backfill anything that already exists.
INSERT INTO search_index (kind, ref_id, title, body)
  SELECT 'task', id, title, COALESCE(description, '') FROM tasks;
INSERT INTO search_index (kind, ref_id, title, body)
  SELECT 'forum', id, title, '' FROM forum_threads;
INSERT INTO search_index (kind, ref_id, title, body)
  SELECT 'forum', thread_id, '', content FROM forum_posts;
INSERT INTO search_index (kind, ref_id, title, body)
  SELECT 'announcement', id, title, content FROM announcements;
INSERT INTO search_index (kind, ref_id, title, body)
  SELECT 'quiz', id, title, COALESCE(description, '') FROM quizzes;
