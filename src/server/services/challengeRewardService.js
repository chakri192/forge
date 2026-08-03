import { TaskModel } from '../models/Task.js';
import { XpModel } from '../models/Xp.js';
import { WalletModel } from '../models/Wallet.js';

/**
 * A challenge hosted by an admin carries its own rewards. Whoever completes it
 * is paid — the host is not, since hosting is the job rather than the
 * achievement.
 *
 * Both awards are guarded by source so re-reviewing a submission, or approving
 * a resubmission of the same challenge, cannot pay twice.
 */
export const ChallengeRewardService = {
  payOut(submission) {
    const task = TaskModel.getById(submission.task_id);
    if (!task || String(task.task_type).toUpperCase() !== 'CHALLENGE') return null;

    const userId = submission.submitted_by;
    const xp = Number(task.xp_reward) || 0;
    const points = Number(task.point_reward) || 0;
    if (!userId || (!xp && !points)) return null;

    const awarded = { xp: 0, points: 0 };

    if (xp > 0 && !XpModel.hasAward(userId, 'CHALLENGE', task.id)) {
      XpModel.award({
        userId,
        amount: xp,
        sourceType: 'CHALLENGE',
        sourceId: task.id,
        description: `Completed challenge: ${task.title}`
      });
      awarded.xp = xp;
    }

    if (points > 0 && !WalletModel.hasEarned(userId, 'CHALLENGE', task.id)) {
      WalletModel.record({
        userId,
        amount: points,
        reason: `Completed challenge: ${task.title}`,
        sourceType: 'CHALLENGE',
        sourceId: task.id
      });
      awarded.points = points;
    }

    return awarded.xp || awarded.points ? awarded : null;
  }
};
