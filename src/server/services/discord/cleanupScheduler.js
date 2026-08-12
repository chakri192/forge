import { TeamWorkspace } from '../teamWorkspace.js';
import { logger } from '../../utils/logger.js';

/**
 * Hourly sweep for team workspaces whose task finished long enough ago.
 *
 * An interval rather than a cron dependency: the job is idempotent and the
 * exact minute does not matter, so the only real requirement is that it runs
 * again if a sweep is missed — which an interval satisfies on the next tick.
 */

const HOUR = 60 * 60 * 1000;
const GRACE_HOURS = Number(process.env.TEAM_CHANNEL_GRACE_HOURS || 48);

let timer = null;

function sweep() {
  try {
    const result = TeamWorkspace.sweep(GRACE_HOURS);
    // Only worth a line when something actually happened; an hourly "nothing to
    // do" would bury everything else in the log.
    if (result.archived > 0) logger.info('team_workspace_sweep', result);
  } catch (err) {
    logger.warn('team_workspace_sweep_failed', { message: err.message });
  }
}

export function startCleanupScheduler() {
  if (timer) return timer;

  // Not on boot: a restart loop would otherwise sweep on every start, and
  // nothing here is urgent enough to justify that.
  timer = setInterval(sweep, HOUR);
  // Node should be able to exit without waiting for this.
  timer.unref?.();

  logger.info('cleanup_scheduler_started', { everyHours: 1, graceHours: GRACE_HOURS });
  return timer;
}

export function stopCleanupScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

/** Exposed so the sweep can be triggered deliberately, in tests or by an admin. */
export function runSweepNow(graceHours = GRACE_HOURS) {
  return TeamWorkspace.sweep(graceHours);
}
