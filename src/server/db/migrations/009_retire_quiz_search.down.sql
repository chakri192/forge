CREATE TRIGGER IF NOT EXISTS trg_search_quiz_ins AFTER INSERT ON quizzes BEGIN
  INSERT INTO search_index (kind, ref_id, title, body)
  VALUES ('quiz', NEW.id, NEW.title, COALESCE(NEW.description, ''));
END;
CREATE TRIGGER IF NOT EXISTS trg_search_quiz_del AFTER DELETE ON quizzes BEGIN
  DELETE FROM search_index WHERE kind = 'quiz' AND ref_id = OLD.id;
END;
INSERT INTO search_index (kind, ref_id, title, body)
  SELECT 'quiz', id, title, COALESCE(description, '') FROM quizzes;
