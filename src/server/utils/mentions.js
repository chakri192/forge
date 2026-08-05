import { db } from '../db/database.js';

/**
 * `@username` mentions.
 *
 * Usernames are matched against the users table rather than trusted from the
 * text, so a message can claim to mention anyone and only real accounts are
 * ever notified.
 */

// Mirrors the username rules used at signup. The trailing boundary stops
// "@alice." or "@bob's" swallowing the punctuation into the name.
const MENTION_RE = /(^|[^\w@])@([a-zA-Z0-9_]{2,32})\b/g;

/** More than this in one message is a broadcast, not a conversation. */
const MAX_MENTIONS = 10;

/** @returns {string[]} distinct lowercased usernames, in order of appearance */
export function parseMentions(content) {
  const found = [];
  const seen = new Set();
  for (const match of String(content || '').matchAll(MENTION_RE)) {
    const name = match[2].toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    found.push(name);
    if (found.length >= MAX_MENTIONS) break;
  }
  return found;
}

/**
 * Resolves parsed names to real accounts.
 *
 * @param {string} content
 * @param {(userId: string) => boolean} canSee  gate for the surrounding channel
 * @param {string} authorId
 * @returns {Array<{ id: string, username: string, name: string }>}
 */
export function resolveMentions(content, canSee, authorId) {
  const names = parseMentions(content);
  if (!names.length) return [];

  const placeholders = names.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT id, username, name FROM users
       WHERE LOWER(username) IN (${placeholders}) AND role != 'DEV_STEALTH'`
    )
    .all(...names);

  return rows.filter((row) => {
    // Notifying yourself is noise, and notifying someone who cannot open the
    // channel would leak its existence and a slice of its content.
    if (row.id === authorId) return false;
    return canSee(row.id);
  });
}
