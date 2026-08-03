-- Quizzes were removed from the product in favour of mini games. The tables
-- stay so existing rows are not destroyed, but they must stop feeding search:
-- results that cannot be opened are worse than no results.
DROP TRIGGER IF EXISTS trg_search_quiz_ins;
DROP TRIGGER IF EXISTS trg_search_quiz_del;
DELETE FROM search_index WHERE kind = 'quiz';
