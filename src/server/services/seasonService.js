import { SeasonModel } from '../models/Season.js';
import { LeaderboardModel, SEASONAL_METRICS } from '../models/Leaderboard.js';
import { NotificationService } from './notification.js';
import { db } from '../db/database.js';

export const SeasonService = {
  list() {
    return SeasonModel.list();
  },

  active() {
    return SeasonModel.active();
  },

  create({ name, startsAt, endsAt }) {
    return SeasonModel.create({ name, startsAt, endsAt });
  },

  /**
   * Closes a season, freezing every seasonal metric's standings, then tells
   * everyone who placed where they finished.
   */
  archive(id) {
    const season = SeasonModel.archive(id, (s) => {
      const byMetric = {};
      for (const metric of SEASONAL_METRICS) {
        byMetric[metric] = LeaderboardModel.standings({ metric, season: s })
          // A row of zeroes is not a placing. Storing them would bloat the
          // archive with everyone who never took part.
          .filter((row) => row.score > 0)
          .map((row) => ({ userId: row.id, rank: row.rank, score: row.score }));
      }
      return byMetric;
    });

    this.announce(season);
    return season;
  },

  /** Best-effort: a failed notification must not undo an archived season. */
  announce(season) {
    try {
      const placed = SeasonModel.standings(season.id, 'xp');
      for (const row of placed) {
        NotificationService.createNotification({
          userId: row.id,
          title: `${season.name} has ended`,
          message: `You finished #${row.rank} with ${row.score} XP.`,
          type: 'SEASON',
          link: '#/leaderboard'
        });
      }
    } catch (_) {
      /* the archive itself is already committed */
    }
  },

  standings(seasonId, metric) {
    const season = SeasonModel.getById(seasonId);
    if (!season) throw { status: 404, message: 'Season not found' };
    if (season.status !== 'ARCHIVED') {
      throw { status: 409, message: 'That season is still running — read the live leaderboard instead' };
    }
    return { season, standings: SeasonModel.standings(seasonId, metric) };
  },

  /**
   * A member's placings across every archived season, for their profile.
   * Reads the frozen rows rather than recomputing, so a later XP correction
   * cannot rewrite a result they have already been told about.
   */
  historyFor(userId) {
    return db
      .prepare(
        `SELECT s.id AS season_id, s.name, s.starts_at, s.ends_at, st.rank, st.score
         FROM season_standings st
         JOIN seasons s ON s.id = st.season_id
         WHERE st.user_id = ? AND st.metric = 'xp'
         ORDER BY s.starts_at DESC`
      )
      .all(userId);
  }
};
