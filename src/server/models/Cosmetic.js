import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

export const KINDS = {
  frame: { label: 'Avatar ring', blurb: 'A coloured ring around your avatar.' },
  title: { label: 'Title', blurb: 'A short label shown beside your name.' },
  banner: { label: 'Profile banner', blurb: 'The wash across your profile header.' }
};

/** Colours are the only thing stored, and only ever as a validated hex. */
export function isSafeColour(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ''));
}

export const CosmeticModel = {
  all() {
    return db
      .prepare(`SELECT * FROM cosmetics WHERE is_active = 1 ORDER BY sort_order ASC, cost ASC`)
      .all();
  },

  byId(id) {
    return db.prepare(`SELECT * FROM cosmetics WHERE id = ? AND is_active = 1`).get(id);
  },

  ownedBy(userId) {
    return db
      .prepare(`SELECT cosmetic_id, equipped FROM user_cosmetics WHERE user_id = ?`)
      .all(userId);
  },

  owns(userId, cosmeticId) {
    return Boolean(
      db.prepare(`SELECT 1 FROM user_cosmetics WHERE user_id = ? AND cosmetic_id = ?`).get(userId, cosmeticId)
    );
  },

  grant(userId, cosmeticId) {
    db.prepare(
      `INSERT OR IGNORE INTO user_cosmetics (id, user_id, cosmetic_id, equipped, acquired_at)
       VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)`
    ).run(genId('uc'), userId, cosmeticId);
  },

  /** One item equipped per kind, so equipping unequips its siblings. */
  equip(userId, cosmeticId, kind) {
    db.prepare(
      `UPDATE user_cosmetics SET equipped = 0
       WHERE user_id = ?
         AND cosmetic_id IN (SELECT id FROM cosmetics WHERE kind = ?)`
    ).run(userId, kind);
    db.prepare(`UPDATE user_cosmetics SET equipped = 1 WHERE user_id = ? AND cosmetic_id = ?`)
      .run(userId, cosmeticId);
  },

  unequip(userId, cosmeticId) {
    db.prepare(`UPDATE user_cosmetics SET equipped = 0 WHERE user_id = ? AND cosmetic_id = ?`)
      .run(userId, cosmeticId);
  },

  /** What a viewer should actually render for a user, keyed by kind. */
  equippedFor(userId) {
    const rows = db
      .prepare(
        `SELECT c.kind, c.name, c.value
         FROM user_cosmetics uc
         JOIN cosmetics c ON c.id = uc.cosmetic_id
         WHERE uc.user_id = ? AND uc.equipped = 1`
      )
      .all(userId);
    const out = {};
    for (const row of rows) {
      if (isSafeColour(row.value)) out[row.kind] = { name: row.name, value: row.value };
    }
    return out;
  }
};
