import express from 'express';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth.js';
import { uploadsDir } from '../middleware/upload.js';
import { db } from '../db/database.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const REVIEW_ROLES = new Set(['admin', 'teacher', 'leader', 'DEV_STEALTH', 'TEACHER', 'STUDENT_LEADER']);

/** Uploads are named `<uuid>.<ext>` by the upload middleware; nothing else is
 *  a legitimate request, so anything shaped differently is rejected outright
 *  rather than normalised. */
const FILENAME = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-z0-9]{1,8}$/i;

/** Only images are safe to hand the browser inline. Everything else downloads,
 *  so an uploaded document can never render as a page on our own origin. */
const INLINE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif'
};

/**
 * Who may read a given upload.
 *
 * A file is reachable only through the submission that points at it: the person
 * who submitted it, and the people who review submissions. Being signed in is
 * not on its own a reason to read someone else's coursework.
 */
function mayRead(user, storedPath) {
  if (REVIEW_ROLES.has(user.role)) return true;
  const row = db
    .prepare('SELECT submitted_by FROM task_submissions WHERE proof_url = ?')
    .get(storedPath);
  // An orphan file — uploaded but never attached to a submission — has no
  // owner to check against, so nobody but a reviewer gets it.
  return Boolean(row && row.submitted_by === user.id);
}

/**
 * Serves an upload to someone entitled to it.
 *
 * This used to be `express.static` mounted ahead of the auth middleware, which
 * made every file world-readable to anyone holding the URL — and once messages
 * relay to Discord, those URLs travel.
 */
router.get('/uploads/:file', requireAuth, (req, res) => {
  const name = req.params.file;
  if (!FILENAME.test(name)) {
    return res.status(400).json({ error: 'Not a valid attachment.' });
  }

  const resolved = path.resolve(uploadsDir, name);
  // Belt and braces: the pattern above already forbids separators, but a path
  // that escapes the directory must never be served whatever the reason.
  if (resolved !== path.join(uploadsDir, name)) {
    logger.warn('upload_path_escape', { requestId: req.requestId, name });
    return res.status(400).json({ error: 'Not a valid attachment.' });
  }

  if (!mayRead(req.user, `/uploads/${name}`)) {
    // 404, not 403: a 403 confirms the file exists, which is itself a leak.
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'Attachment not found.' });
  }

  const ext = path.extname(name).toLowerCase();
  const inlineType = INLINE_TYPES[ext];

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader(
    'Content-Disposition',
    inlineType ? `inline; filename="${name}"` : `attachment; filename="${name}"`
  );
  if (inlineType) res.type(inlineType);
  else res.type('application/octet-stream');

  res.sendFile(resolved);
});

export default router;
