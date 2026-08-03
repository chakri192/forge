import { db } from '../db/database.js';
import { genId } from '../utils/genId.js';

export const BadgeModel = {
  create({ id, name, description, icon = null, category = 'GENERAL', rarity = 'COMMON', xpBonus = 0 }) {
    const badgeId = id || genId('bdg');
    db.prepare(`
      INSERT OR IGNORE INTO badges (id, name, description, icon, category, rarity, xp_bonus, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(badgeId, name, description, icon, category, rarity, xpBonus);
    return this.getByName(name);
  },

  getById(id) {
    return db.prepare(`SELECT * FROM badges WHERE id = ?`).get(id) ?? null;
  },

  getByName(name) {
    return db.prepare(`SELECT * FROM badges WHERE name = ?`).get(name) ?? null;
  },

  list() {
    return db.prepare(`SELECT * FROM badges ORDER BY rarity, name`).all();
  },

  /**
   * Idempotent: UNIQUE(user_id, badge_id) makes a repeat award a no-op, so
   * `changes > 0` is a reliable "newly earned" signal for notifications.
   */
  awardToUser(userId, badgeId, awardedBy = null) {
    const result = db
      .prepare(`
        INSERT OR IGNORE INTO user_badges (id, user_id, badge_id, awarded_at, awarded_by)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
      `)
      .run(genId('ubd'), userId, badgeId, awardedBy);
    return result.changes > 0;
  },

  listForUser(userId) {
    return db
      .prepare(`
        SELECT b.*, ub.awarded_at, ub.awarded_by
        FROM user_badges ub
        JOIN badges b ON b.id = ub.badge_id
        WHERE ub.user_id = ?
        ORDER BY ub.awarded_at DESC
      `)
      .all(userId);
  },

  countsForAll() {
    return db
      .prepare(`SELECT user_id, COUNT(*) AS total FROM user_badges GROUP BY user_id`)
      .all();
  }
};

export const AchievementModel = {
  create({ id, title, description, criteriaType, criteriaValue = 1, badgeId = null, xpReward = 0 }) {
    const achievementId = id || genId('ach');
    db.prepare(`
      INSERT OR IGNORE INTO achievements (id, title, description, criteria_type, criteria_value, badge_id, xp_reward, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(achievementId, title, description, criteriaType, criteriaValue, badgeId, xpReward);
    return db.prepare(`SELECT * FROM achievements WHERE id = ?`).get(achievementId);
  },

  list() {
    return db.prepare(`SELECT * FROM achievements ORDER BY criteria_value ASC`).all();
  },

  getById(id) {
    return db.prepare(`SELECT * FROM achievements WHERE id = ?`).get(id) ?? null;
  }
};
