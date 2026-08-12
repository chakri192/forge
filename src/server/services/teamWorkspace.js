import { db } from '../db/database.js';
import { genId, nowIso } from '../utils/genId.js';
import { ChannelManager } from './discord/channelManager.js';
import { DiscordMap } from '../models/DiscordMap.js';
import { NotificationService } from './notification.js';
import { logger } from '../utils/logger.js';

/**
 * A team's workspace channel, from formation to archive.
 *
 * Forge owns the channel; Discord mirrors it. That order matters — the Forge
 * channel is created synchronously and the Discord side is attempted after,
 * never awaited and never fatal. A team that cannot chat because Discord is
 * having a bad afternoon would be a worse outcome than one whose messages are
 * not mirrored for an hour.
 */

/** Discord channel names: lowercase, hyphenated, no runs, capped. */
function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'team';
}

export const TeamWorkspace = {
  /**
   * Called when a team is formed. Idempotent: a team that somehow already has
   * a channel keeps the one it has rather than accumulating duplicates.
   */
  create({ teamId, teamName, taskId = null }) {
    const existing = db.prepare(`SELECT id FROM channels WHERE team_id = ?`).get(teamId);
    if (existing) return existing;

    const name = taskId ? `${slug(teamName)}-${slug(taskId)}` : `${slug(teamName)}-team`;
    const channelId = genId('chn');

    db.prepare(
      `INSERT INTO channels (id, name, type, is_private, team_id) VALUES (?, ?, 'team', 1, ?)`
    ).run(channelId, name, teamId);

    this.mirrorToDiscord({ channelId, name, teamId, taskId }).catch(() => {});

    logger.info('team_workspace_created', { teamId, channelId, taskId });
    return { id: channelId, name };
  },

  /** Best effort, and deliberately separate so a failure here is inspectable. */
  async mirrorToDiscord({ channelId, name, teamId, taskId }) {
    // Both posting bots need sight of the channel, or the relay has a channel
    // it cannot write to.
    const result = await ChannelManager.createPrivateChannel({
      name,
      type: 'team_chat',
      referenceId: taskId || teamId,
      memberBotIds: ChannelManager.posterBotIds()
    });
    if (!result?.created) {
      logger.info('team_workspace_discord_skipped', { teamId, reason: result?.reason || 'unknown' });
      return null;
    }
    // Link the Forge channel to the Discord one so the relay can find it.
    DiscordMap.upsertChannel({
      discordChannelId: result.discordChannelId,
      type: 'team_chat',
      referenceId: channelId,
      name
    });
    return result;
  },

  /**
   * Tasks whose work is long finished and whose channel is still sitting there.
   *
   * A channel is kept for a grace period rather than deleted on completion:
   * teams keep talking after they submit, and the review may still bounce back.
   */
  dueForArchive(graceHours = 48) {
    const cutoff = new Date(Date.now() - graceHours * 3600 * 1000).toISOString();
    return db
      .prepare(
        `SELECT t.id AS task_id, t.title, t.assigned_team_id AS team_id,
                c.id AS channel_id, c.name AS channel_name, t.completed_at
         FROM tasks t
         JOIN channels c ON c.team_id = t.assigned_team_id
         WHERE UPPER(t.status) IN ('COMPLETED', 'ARCHIVED')
           AND t.completed_at IS NOT NULL
           AND t.completed_at < ?
           AND c.is_archived = 0`
      )
      .all(cutoff);
  },

  /**
   * Archives one workspace: the transcript is kept, the channel stops being a
   * live place to post, and the Discord side is deleted.
   *
   * Nothing is deleted on the Forge side. The conversation is often the only
   * record of why a decision was made, and it costs almost nothing to keep.
   */
  archive({ taskId, teamId, channelId, channelName }) {
    const messages = db
      .prepare(`SELECT COUNT(*) AS n FROM messages WHERE channel_id = ?`)
      .get(channelId).n;

    db.transaction(() => {
      db.prepare(
        `INSERT OR REPLACE INTO channel_archive (id, channel_id, reference_id, name, message_count, archived_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(genId('arch'), channelId, taskId, channelName, messages, nowIso());

      db.prepare(`UPDATE channels SET is_archived = 1 WHERE id = ?`).run(channelId);
    })();

    // Discord's copy goes; ours stays.
    const mapped = DiscordMap.channelForReference('team_chat', channelId);
    if (mapped?.discord_channel_id) {
      ChannelManager.deleteChannel(mapped.discord_channel_id).catch(() => {});
      DiscordMap.deactivateChannel(mapped.discord_channel_id);
    }

    // Tell the people who were in it, so an archived channel is never a surprise.
    try {
      const members = db
        .prepare(`SELECT user_id FROM team_memberships WHERE team_id = ?`)
        .all(teamId);
      for (const { user_id } of members) {
        NotificationService.createNotification({
          userId: user_id,
          title: 'Team workspace archived',
          message: `#${channelName} is read-only now. The conversation is kept.`,
          type: 'INFO',
          link: `#/messages/${channelId}`
        });
      }
    } catch (_) {
      /* the archive is already committed */
    }

    logger.info('team_workspace_archived', { taskId, channelId, messages });
    return { channelId, messages };
  },

  /** One sweep. Returns what it did, so the scheduler can log a real number. */
  sweep(graceHours = 48) {
    const due = this.dueForArchive(graceHours);
    const archived = [];
    for (const row of due) {
      try {
        // The query returns SQL's snake_case; archive() takes camelCase.
        archived.push(
          this.archive({
            taskId: row.task_id,
            teamId: row.team_id,
            channelId: row.channel_id,
            channelName: row.channel_name
          })
        );
      } catch (err) {
        logger.warn('team_workspace_archive_failed', { taskId: row.task_id, message: err.message });
      }
    }
    return { considered: due.length, archived: archived.length };
  }
};
