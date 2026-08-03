import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();
const startedAt = Date.now();

/**
 * Liveness: is the process up at all. Deliberately touches nothing, so a
 * slow database cannot cause an orchestrator to kill a healthy process.
 */
router.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
});

/**
 * Readiness: can this instance actually serve traffic. Checks the database
 * round trip, so a deploy with a broken volume fails the check instead of
 * silently accepting requests it cannot fulfil.
 */
router.get('/readyz', (_req, res) => {
  try {
    const row = db.prepare('SELECT COUNT(*) AS n FROM users').get();
    res.json({
      status: 'ready',
      database: 'ok',
      users: row.n,
      journalMode: db.pragma('journal_mode', { simple: true })
    });
  } catch (err) {
    res.status(503).json({ status: 'unavailable', database: 'error', error: err.message });
  }
});

export default router;
