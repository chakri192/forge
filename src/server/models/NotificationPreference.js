import { db } from '../db/database.js';
import { genId, nowIso } from '../utils/genId.js';

/**
 * What a member can turn down, and what each switch covers.
 *
 * Grouped by the reason someone would silence it, not by the type strings the
 * code happens to use — nobody wants to reason about the difference between
 * INFO and SUCCESS.
 */
export const CATEGORIES = {
  mentions: {
    label: 'Mentions',
    description: 'When someone writes your @handle.',
    // Deliberately not mutable to "off" by a channel mute; see MUTE_PIERCING.
    types: ['MENTION']
  },
  messages: {
    label: 'Direct messages',
    description: 'New conversations and people adding you to a group.',
    types: []
  },
  review: {
    label: 'Tasks and review',
    description: 'Assignments, deadlines, and submissions needing a look.',
    types: ['REVIEW', 'ASSIGNMENT', 'DEADLINE']
  },
  progress: {
    label: 'Progress',
    description: 'Levels, badges, streaks, and season results.',
    types: ['SUCCESS', 'SEASON']
  },
  forum: {
    label: 'Forum',
    description: 'Replies to your posts.',
    types: []
  },
  announcements: {
    label: 'Announcements',
    description: 'Cohort-wide posts from leaders and teachers.',
    types: ['ANNOUNCEMENT']
  }
};

/** A channel mute quiets everything except someone calling your name. */
export const MUTE_PIERCING = new Set(['mentions']);

const TYPE_TO_CATEGORY = Object.entries(CATEGORIES).reduce((map, [key, meta]) => {
  for (const type of meta.types) map[type] = key;
  return map;
}, {});

/** Falls back to `review`, the category a stray notification most likely is. */
export function categoryForType(type) {
  return TYPE_TO_CATEGORY[type] || 'review';
}

export const NotificationPreferenceModel = {
  /** Every category, with the member's setting applied over the default. */
  forUser(userId) {
    const rows = db
      .prepare(`SELECT category, enabled FROM notification_preferences WHERE user_id = ?`)
      .all(userId);
    const overrides = new Map(rows.map((r) => [r.category, Boolean(r.enabled)]));

    return Object.entries(CATEGORIES).map(([id, meta]) => ({
      id,
      label: meta.label,
      description: meta.description,
      // Absent means on, so a new member needs no backfill.
      enabled: overrides.has(id) ? overrides.get(id) : true
    }));
  },

  isEnabled(userId, category) {
    const row = db
      .prepare(`SELECT enabled FROM notification_preferences WHERE user_id = ? AND category = ?`)
      .get(userId, category);
    return row ? Boolean(row.enabled) : true;
  },

  set(userId, category, enabled) {
    if (!CATEGORIES[category]) {
      throw { status: 400, message: 'Unknown notification category' };
    }
    db.prepare(
      `INSERT INTO notification_preferences (id, user_id, category, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, category) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at`
    ).run(genId('npref'), userId, category, enabled ? 1 : 0, nowIso());
    return this.forUser(userId);
  },

  /* --- channel mutes ----------------------------------------------------- */

  mutedChannelIds(userId) {
    return db
      .prepare(`SELECT channel_id FROM muted_channels WHERE user_id = ?`)
      .all(userId)
      .map((r) => r.channel_id);
  },

  isMuted(userId, channelId) {
    if (!channelId) return false;
    return Boolean(
      db
        .prepare(`SELECT 1 FROM muted_channels WHERE user_id = ? AND channel_id = ?`)
        .get(userId, channelId)
    );
  },

  mute(userId, channelId) {
    db.prepare(
      `INSERT OR IGNORE INTO muted_channels (id, user_id, channel_id) VALUES (?, ?, ?)`
    ).run(genId('mute'), userId, channelId);
  },

  unmute(userId, channelId) {
    db.prepare(`DELETE FROM muted_channels WHERE user_id = ? AND channel_id = ?`).run(
      userId,
      channelId
    );
  }
};
