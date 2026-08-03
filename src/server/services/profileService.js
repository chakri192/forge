import { db } from '../db/database.js';
import { toPublicProfile, slugify } from '../utils/publicProfile.js';
import { XpModel, levelFromXp } from '../models/Xp.js';
import { BadgeModel } from '../models/Badge.js';
import { OWNER_ID } from '../config/constants.js';

/**
 * The hardcoded owner account is declared invisible on every public-facing
 * surface. A public profile is exactly such a surface, so it is excluded here
 * regardless of its own privacy flag.
 */
function isExcluded(user) {
  return !user || user.role === 'DEV_STEALTH' || user.id === OWNER_ID;
}

export const ProfileService = {
  /**
   * Look up a published profile by slug.
   * Returns null both for "no such user" and "not published" — distinguishing
   * them would turn this endpoint into a membership oracle.
   */
  publicBySlug(slug) {
    if (!slug) return null;
    const user = db
      .prepare(`SELECT * FROM users WHERE public_slug = ? OR (public_slug IS NULL AND username = ?)`)
      .get(slug, slug);

    if (isExcluded(user) || !user.is_public) return null;

    const xp = XpModel.totalFor(user.id);
    const work = db
      .prepare(`
        SELECT t.title, t.difficulty, t.task_type, s.reviewed_at
        FROM task_submissions s
        JOIN tasks t ON t.id = s.task_id
        WHERE s.submitted_by = ? AND UPPER(s.status) = 'APPROVED'
        ORDER BY s.reviewed_at DESC
        LIMIT 30
      `)
      .all(user.id);

    const titles = db
      .prepare(`SELECT title_name, category FROM hall_of_fame_titles WHERE awarded_to_user_id = ?`)
      .all(user.id);

    return toPublicProfile(user, {
      xp,
      level: levelFromXp(xp).level,
      badges: BadgeModel.listForUser(user.id),
      titles,
      contributions: XpModel.dailyTotals(user.id, 365),
      work
    });
  },

  /** The signed-in user's own privacy settings. */
  settingsFor(userId) {
    const user = db.prepare(`SELECT id, name, username, is_public, public_slug FROM users WHERE id = ?`).get(userId);
    if (!user) throw { status: 404, message: 'User not found' };
    return {
      is_public: Boolean(user.is_public),
      slug: user.public_slug || user.username,
      url: `/p/${user.public_slug || user.username}`
    };
  },

  /**
   * Publish or unpublish. Slug uniqueness is enforced by a unique index, so a
   * collision surfaces as a clear 409 rather than a constraint stack trace.
   */
  updateSettings(user, { isPublic, slug }) {
    const current = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id);
    if (!current) throw { status: 404, message: 'User not found' };
    if (isExcluded(current)) {
      throw { status: 403, message: 'This account cannot be published' };
    }

    let nextSlug = current.public_slug;
    if (slug !== undefined && slug !== null && slug !== '') {
      nextSlug = slugify(slug, current.username);
      const taken = db
        .prepare(`SELECT 1 FROM users WHERE public_slug = ? AND id != ? LIMIT 1`)
        .get(nextSlug, user.id);
      if (taken) throw { status: 409, message: 'That profile address is already taken' };
    } else if (!nextSlug) {
      nextSlug = slugify(current.username, current.id);
    }

    db.prepare(`UPDATE users SET is_public = ?, public_slug = ? WHERE id = ?`)
      .run(isPublic ? 1 : 0, nextSlug, user.id);

    return this.settingsFor(user.id);
  }
};
