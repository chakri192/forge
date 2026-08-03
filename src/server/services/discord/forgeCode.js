import { db } from '../../db/database.js';

/**
 * A short, stable, human-quotable id shown on every relayed message.
 *
 * The role letter is baked in at issue time so a code stays constant even if
 * someone is promoted — a code that changed would break every message that
 * already carries it.
 */
const ROLE_LETTER = {
  admin: 'A',
  DEV_STEALTH: 'A',
  teacher: 'T',
  TEACHER: 'T',
  leader: 'L',
  STUDENT_LEADER: 'L',
  member: 'M'
};

export function letterFor(role) {
  return ROLE_LETTER[role] || 'M';
}

export function formatCode(role, sequence) {
  return `FRG-${letterFor(role)}${String(sequence).padStart(3, '0')}`;
}

/** Issue once and reuse; never reissued for the same user. */
export function ensureCodeFor(user) {
  const existing = db
    .prepare(`SELECT forge_code FROM discord_user_map WHERE user_id = ?`)
    .get(user.id);
  if (existing) return existing.forge_code;

  const letter = letterFor(user.role);
  const taken = db
    .prepare(`SELECT forge_code FROM discord_user_map WHERE forge_code LIKE ?`)
    .all(`FRG-${letter}%`)
    .map((r) => Number(r.forge_code.slice(5)))
    .filter((n) => Number.isFinite(n));
  const next = taken.length ? Math.max(...taken) + 1 : 1;

  const code = formatCode(user.role, next);
  db.prepare(
    `INSERT OR IGNORE INTO discord_user_map (user_id, forge_code, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`
  ).run(user.id, code);
  return code;
}

export function codeFor(userId) {
  return db.prepare(`SELECT forge_code FROM discord_user_map WHERE user_id = ?`).get(userId)?.forge_code || null;
}
