import { LeaderboardModel, METRICS, DEFAULT_METRIC } from '../models/Leaderboard.js';
import { ROLES } from '../config/constants.js';

const TOP_N = 25;

export const LeaderboardService = {
  /**
   * Standings for one metric, trimmed to a readable page.
   *
   * The viewer's own row is always returned even when they place below the
   * cut, because "where am I" is the first question anyone asks — and a
   * leaderboard that only shows the top 25 cannot answer it.
   */
  get(user, { metric = DEFAULT_METRIC, limit = TOP_N } = {}) {
    const key = METRICS[metric] ? metric : DEFAULT_METRIC;

    // A stealth account sees itself; nobody else does.
    const standings = LeaderboardModel.standings({
      metric: key,
      includeHidden: user?.role === ROLES.DEV_STEALTH
    });

    const top = standings.slice(0, limit);
    const mine = standings.find((row) => row.id === user?.id) || null;

    return {
      metric: key,
      metrics: Object.entries(METRICS).map(([id, m]) => ({ id, ...m })),
      total: standings.length,
      leaders: top,
      // Only set when the viewer is off the visible page, so the client does
      // not render their row twice.
      viewer: mine && !top.some((row) => row.id === mine.id) ? mine : null,
      viewerRank: mine ? mine.rank : null
    };
  }
};
