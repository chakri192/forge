import { db } from '../db/database.js';
import { XpModel } from '../models/Xp.js';
import { StreakModel } from '../models/Streak.js';

const INACTIVE_DAYS_WARN = 7;
const INACTIVE_DAYS_CRITICAL = 14;

/**
 * Cohort analytics derived entirely from existing history — no rollup tables,
 * no background jobs. If these queries ever get slow, the fix is a nightly
 * materialized snapshot, not a schema change.
 */
export const AnalyticsService = {
  overview() {
    const totals = db
      .prepare(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE role != 'DEV_STEALTH') AS members,
          (SELECT COUNT(*) FROM tasks WHERE UPPER(status) NOT IN ('ARCHIVED')) AS tasks,
          (SELECT COUNT(*) FROM tasks WHERE UPPER(status) = 'COMPLETED') AS completed,
          (SELECT COUNT(*) FROM task_submissions) AS submissions,
          (SELECT COUNT(*) FROM task_submissions WHERE status = 'PENDING') AS pending_review,
          (SELECT COUNT(*) FROM teams) AS teams,
          (SELECT COALESCE(SUM(amount), 0) FROM xp_history) AS xp_awarded
      `)
      .get();

    const completionRate = totals.tasks > 0 ? Math.round((totals.completed / totals.tasks) * 100) : 0;
    return { ...totals, completion_rate: completionRate };
  },

  /** Weekly activity for the last N weeks, for sparkline rendering. */
  activityTrend(weeks = 12) {
    return db
      .prepare(`
        SELECT strftime('%Y-%W', created_at) AS week,
               COUNT(*) AS events,
               COUNT(DISTINCT user_id) AS active_users
        FROM activity_log
        WHERE created_at >= date('now', ?)
        GROUP BY week
        ORDER BY week ASC
      `)
      .all(`-${Math.max(1, weeks) * 7} days`);
  },

  /** Median-ish latency between submission and review, in hours. */
  reviewLatency() {
    const rows = db
      .prepare(`
        SELECT (julianday(reviewed_at) - julianday(created_at)) * 24 AS hours
        FROM task_submissions
        WHERE reviewed_at IS NOT NULL AND created_at IS NOT NULL
      `)
      .all()
      .map((r) => r.hours)
      .filter((h) => Number.isFinite(h) && h >= 0)
      .sort((a, b) => a - b);

    if (!rows.length) return { count: 0, median_hours: null, p90_hours: null };
    const at = (q) => rows[Math.min(rows.length - 1, Math.floor(rows.length * q))];
    return {
      count: rows.length,
      median_hours: Math.round(at(0.5) * 10) / 10,
      p90_hours: Math.round(at(0.9) * 10) / 10
    };
  },

  /** Per-member participation, ordered by how much attention they need. */
  memberBreakdown() {
    const members = db
      .prepare(`SELECT id, name, username, role, tag FROM users WHERE role != 'DEV_STEALTH'`)
      .all();

    const xpTotals = Object.fromEntries(XpModel.totalsForAll().map((r) => [r.user_id, r.total]));

    const lastSeen = Object.fromEntries(
      db
        .prepare(
          `SELECT user_id, MAX(created_at) AS last_at FROM activity_log WHERE user_id IS NOT NULL GROUP BY user_id`
        )
        .all()
        .map((r) => [r.user_id, r.last_at])
    );

    const submissionStats = Object.fromEntries(
      db
        .prepare(`
          SELECT submitted_by AS user_id,
                 COUNT(*) AS total,
                 SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
                 SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected
          FROM task_submissions
          WHERE submitted_by IS NOT NULL
          GROUP BY submitted_by
        `)
        .all()
        .map((r) => [r.user_id, r])
    );

    const now = Date.now();
    return members
      .map((member) => {
        const stats = submissionStats[member.id] || { total: 0, approved: 0, rejected: 0 };
        const last = lastSeen[member.id] || null;
        const daysSince = last ? Math.floor((now - new Date(last).getTime()) / 86400000) : null;
        const streak = StreakModel.currentFor(member.id);

        const risks = [];
        if (daysSince === null) risks.push('never_active');
        else if (daysSince >= INACTIVE_DAYS_CRITICAL) risks.push('inactive_critical');
        else if (daysSince >= INACTIVE_DAYS_WARN) risks.push('inactive_warning');
        if (stats.total === 0) risks.push('no_submissions');
        if (stats.rejected >= 2 && stats.rejected > stats.approved) risks.push('repeated_rejections');
        if ((streak.longest_streak || 0) >= 5 && (streak.current_streak || 0) === 0) {
          risks.push('streak_broken');
        }

        return {
          ...member,
          xp: xpTotals[member.id] || 0,
          submissions: stats.total,
          approved: stats.approved || 0,
          rejected: stats.rejected || 0,
          last_active_at: last,
          days_since_active: daysSince,
          current_streak: streak.current_streak || 0,
          risks,
          risk_level: risks.includes('inactive_critical') || risks.includes('never_active')
            ? 'high'
            : risks.length
              ? 'medium'
              : 'none'
        };
      })
      .sort((a, b) => {
        const order = { high: 0, medium: 1, none: 2 };
        return order[a.risk_level] - order[b.risk_level] || b.xp - a.xp;
      });
  },

  atRisk() {
    return this.memberBreakdown().filter((m) => m.risk_level !== 'none');
  },

  full() {
    return {
      overview: this.overview(),
      trend: this.activityTrend(),
      review_latency: this.reviewLatency(),
      members: this.memberBreakdown()
    };
  }
};
