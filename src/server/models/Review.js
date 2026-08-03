import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

export const RubricModel = {
  add(taskId, { label, description = null, maxScore = 5, weight = 1.0 }) {
    const id = genId('rbc');
    const next = db
      .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM rubric_criteria WHERE task_id = ?`)
      .get(taskId).next;
    db.prepare(`
      INSERT INTO rubric_criteria (id, task_id, label, description, max_score, weight, position)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, taskId, label, description, maxScore, weight, next);
    return this.getById(id);
  },

  getById(id) {
    return db.prepare(`SELECT * FROM rubric_criteria WHERE id = ?`).get(id) ?? null;
  },

  forTask(taskId) {
    return db
      .prepare(`SELECT * FROM rubric_criteria WHERE task_id = ? ORDER BY position ASC, id ASC`)
      .all(taskId);
  },

  remove(id) {
    return db.prepare(`DELETE FROM rubric_criteria WHERE id = ?`).run(id).changes > 0;
  }
};

export const ReviewModel = {
  /** Upsert so a reviewer can revise a score without creating duplicates. */
  score({ submissionId, criterionId, reviewerId, score, note = null }) {
    db.prepare(`
      INSERT INTO review_scores (id, submission_id, criterion_id, reviewer_id, score, note)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(submission_id, criterion_id, reviewer_id)
      DO UPDATE SET score = excluded.score, note = excluded.note
    `).run(genId('rsc'), submissionId, criterionId, reviewerId, score, note);
  },

  scoresFor(submissionId) {
    return db
      .prepare(`
        SELECT s.*, c.label, c.max_score, c.weight, u.name AS reviewer_name
        FROM review_scores s
        JOIN rubric_criteria c ON c.id = s.criterion_id
        LEFT JOIN users u ON u.id = s.reviewer_id
        WHERE s.submission_id = ?
        ORDER BY c.position ASC
      `)
      .all(submissionId);
  },

  /**
   * Weighted percentage across the rubric. Averages multiple reviewers on the
   * same criterion so a peer round and a teacher round combine sensibly.
   */
  weightedResult(submissionId) {
    const rows = db
      .prepare(`
        SELECT c.id AS criterion_id, c.max_score, c.weight, AVG(s.score) AS avg_score
        FROM review_scores s
        JOIN rubric_criteria c ON c.id = s.criterion_id
        WHERE s.submission_id = ?
        GROUP BY c.id
      `)
      .all(submissionId);

    if (!rows.length) return { percent: 0, scored: 0 };

    let earned = 0;
    let possible = 0;
    for (const row of rows) {
      earned += (row.avg_score / row.max_score) * row.weight;
      possible += row.weight;
    }
    return {
      percent: possible > 0 ? Math.round((earned / possible) * 100) : 0,
      scored: rows.length
    };
  },

  comment({ submissionId, authorId, body, isResolution = false }) {
    const id = genId('rcm');
    db.prepare(`
      INSERT INTO review_comments (id, submission_id, author_id, body, is_resolution)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, submissionId, authorId, body, isResolution ? 1 : 0);
    return db
      .prepare(`
        SELECT c.*, u.name AS author_name, u.role AS author_role
        FROM review_comments c LEFT JOIN users u ON u.id = c.author_id
        WHERE c.id = ?
      `)
      .get(id);
  },

  commentsFor(submissionId) {
    return db
      .prepare(`
        SELECT c.*, u.name AS author_name, u.role AS author_role
        FROM review_comments c
        LEFT JOIN users u ON u.id = c.author_id
        WHERE c.submission_id = ?
        ORDER BY c.created_at ASC
      `)
      .all(submissionId);
  },

  submissionById(id) {
    return db
      .prepare(`
        SELECT s.*, t.title AS task_title, t.id AS task_id, u.name AS submitter_name
        FROM task_submissions s
        JOIN tasks t ON t.id = s.task_id
        LEFT JOIN users u ON u.id = s.submitted_by
        WHERE s.id = ?
      `)
      .get(id) ?? null;
  },

  setStatus(submissionId, status, reviewerId) {
    db.prepare(`
      UPDATE task_submissions
      SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, reviewerId, submissionId);
  },

  /** The teacher review queue, oldest first so nothing is left waiting. */
  queue({ limit = 50 } = {}) {
    return db
      .prepare(`
        SELECT s.*, t.title AS task_title, u.name AS submitter_name,
               (SELECT COUNT(*) FROM review_comments rc WHERE rc.submission_id = s.id) AS comment_count
        FROM task_submissions s
        JOIN tasks t ON t.id = s.task_id
        LEFT JOIN users u ON u.id = s.submitted_by
        WHERE UPPER(s.status) IN ('PENDING', 'CHANGES_REQUESTED')
        ORDER BY s.created_at ASC
        LIMIT ?
      `)
      .all(limit);
  }
};
