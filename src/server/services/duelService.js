import { db } from '../db/database.js';
import { DuelModel, TOPICS } from '../models/Duel.js';
import { WalletModel } from '../models/Wallet.js';
import { XpModel } from '../models/Xp.js';
import { hasRole } from '../middleware/rbac.js';
import { NotificationService } from './notification.js';

const JUDGE_ROLES = ['leader', 'teacher', 'admin'];
const OPPONENT_COUNT = 2;
const MAX_STAKE = 5000;

function totals(userId) {
  return { points: WalletModel.balanceFor(userId), xp: XpModel.totalFor(userId) };
}

/**
 * Take one participant's stake. Points and XP are both moved as ledger rows so
 * the escrow is visible in the same history as everything else — a stake that
 * only existed as a flag on the duel could not be reconciled against a balance.
 */
function holdStake(duel, userId) {
  if (duel.stake_points > 0) {
    WalletModel.record({
      userId,
      amount: -duel.stake_points,
      reason: 'Duel stake held',
      sourceType: 'DUEL_STAKE',
      sourceId: duel.id
    });
  }
  if (duel.stake_xp > 0) {
    XpModel.award({
      userId,
      amount: -duel.stake_xp,
      sourceType: 'DUEL_STAKE',
      sourceId: duel.id,
      description: 'Duel stake held'
    });
  }
  DuelModel.markStaked(duel.id, userId);
}

/** Give a stake back untouched, used when a duel never happens. */
function refundStake(duel, userId) {
  if (duel.stake_points > 0) {
    WalletModel.record({
      userId,
      amount: duel.stake_points,
      reason: 'Duel cancelled — stake returned',
      sourceType: 'DUEL_REFUND',
      sourceId: duel.id
    });
  }
  if (duel.stake_xp > 0) {
    XpModel.award({
      userId,
      amount: duel.stake_xp,
      sourceType: 'DUEL_REFUND',
      sourceId: duel.id,
      description: 'Duel cancelled — stake returned'
    });
  }
}

export const DuelService = {
  topics: () => TOPICS,

  list(user) {
    const mine = DuelModel.forUser(user.id);
    // A judge who is not in the duel still has to be able to reach it, or
    // canJudge is a flag on a screen nobody can get to.
    const seen = new Set(mine.map((d) => d.id));
    const toJudge = hasRole(user, JUDGE_ROLES)
      ? DuelModel.activeForJudge().filter((d) => !seen.has(d.id))
      : [];

    return {
      topics: TOPICS,
      wallet: totals(user.id),
      duels: [...mine, ...toJudge].map((duel) => this.present(duel, user))
    };
  },

  present(duel, viewer) {
    const participants = DuelModel.participants(duel.id);
    const opponents = participants.filter((p) => p.side === 'OPPONENT');
    const me = participants.find((p) => p.user_id === viewer.id) || null;

    return {
      id: duel.id,
      status: duel.status,
      topic: duel.topic,
      stake: { points: duel.stake_points, xp: duel.stake_xp },
      // The whole pot, so the reward is obvious before anyone commits.
      pot: {
        points: duel.stake_points * participants.length,
        xp: duel.stake_xp * participants.length
      },
      createdAt: duel.created_at,
      winnerId: duel.winner_id,
      participants: participants.map((p) => ({
        id: p.user_id,
        name: p.name,
        username: p.username,
        side: p.side,
        accepted: p.accepted === 1,
        topicChoice: p.topic_choice,
        isWinner: duel.winner_id === p.user_id
      })),
      viewer: me
        ? { side: me.side, accepted: me.accepted === 1, topicChoice: me.topic_choice }
        : null,
      canJudge: hasRole(viewer, JUDGE_ROLES) && duel.status === 'ACTIVE',
      // Shown while opponents are still disagreeing, so the hold-up is visible.
      awaitingTopic:
        duel.status === 'PENDING' &&
        opponents.every((o) => o.accepted === 1) &&
        new Set(opponents.map((o) => o.topic_choice)).size > 1
    };
  },

  create(user, { opponentIds, stakePoints = 0, stakeXp = 0 }) {
    const unique = [...new Set(opponentIds || [])].filter((id) => id && id !== user.id);
    if (unique.length !== OPPONENT_COUNT) {
      throw { status: 400, message: 'A duel is you against exactly two other people' };
    }
    if (stakePoints < 0 || stakeXp < 0 || stakePoints > MAX_STAKE || stakeXp > MAX_STAKE) {
      throw { status: 400, message: `Stakes must be between 0 and ${MAX_STAKE}` };
    }
    if (!stakePoints && !stakeXp) {
      throw { status: 400, message: 'Put something on it — set a points or XP stake' };
    }

    const known = db
      .prepare(`SELECT id FROM users WHERE id IN (${unique.map(() => '?').join(',')})`)
      .all(...unique);
    if (known.length !== OPPONENT_COUNT) {
      throw { status: 400, message: 'One of those people does not exist' };
    }

    // The challenger has to cover their own stake before anyone is invited.
    const mine = totals(user.id);
    if (mine.points < stakePoints) {
      throw { status: 400, message: `You only have ${mine.points} points to stake` };
    }
    if (mine.xp < stakeXp) {
      throw { status: 400, message: `You only have ${mine.xp} XP to stake` };
    }

    let duelId;
    db.transaction(() => {
      duelId = DuelModel.create({
        challengerId: user.id,
        opponentIds: unique,
        stakePoints,
        stakeXp
      });
      holdStake(DuelModel.byId(duelId), user.id);
    })();

    for (const opponentId of unique) {
      NotificationService.createNotification({
        userId: opponentId,
        title: 'You have been challenged',
        message: `${user.name} staked ${stakePoints} points and ${stakeXp} XP. Pick a topic to accept.`,
        type: 'INFO'
      });
    }

    return this.present(DuelModel.byId(duelId), user);
  },

  /**
   * An opponent accepts and names the topic they want. The duel only goes
   * active once both opponents have accepted *and* named the same topic —
   * that agreement is what "the two of them choose it" means.
   */
  accept(user, duelId, topic) {
    const duel = DuelModel.byId(duelId);
    if (!duel) throw { status: 404, message: 'Duel not found' };
    if (duel.status !== 'PENDING') throw { status: 409, message: 'This duel is no longer open' };

    const participants = DuelModel.participants(duelId);
    const me = participants.find((p) => p.user_id === user.id);
    if (!me) throw { status: 403, message: 'You are not part of this duel' };
    if (me.side !== 'OPPONENT') throw { status: 403, message: 'Only the challenged pick the topic' };

    const choice = String(topic || '').trim();
    if (!choice || choice.length > 80) {
      throw { status: 400, message: 'Choose a topic of 1 to 80 characters' };
    }

    const mine = totals(user.id);
    if (mine.points < duel.stake_points) {
      throw { status: 400, message: `You need ${duel.stake_points} points to match this stake` };
    }
    if (mine.xp < duel.stake_xp) {
      throw { status: 400, message: `You need ${duel.stake_xp} XP to match this stake` };
    }

    db.transaction(() => {
      DuelModel.setAccepted(duelId, user.id, choice);
      // Stake is taken once, on first acceptance, even if they change topic later.
      if (me.staked !== 1) holdStake(duel, user.id);

      const opponents = DuelModel.participants(duelId).filter((p) => p.side === 'OPPONENT');
      const allIn = opponents.every((o) => o.accepted === 1);
      const agreed = new Set(opponents.map((o) => o.topic_choice));
      if (allIn && agreed.size === 1) {
        DuelModel.setStatus(duelId, 'ACTIVE', { topic: [...agreed][0] });
      }
    })();

    const after = DuelModel.byId(duelId);
    if (after.status === 'ACTIVE') {
      for (const p of DuelModel.participants(duelId)) {
        NotificationService.createNotification({
          userId: p.user_id,
          title: 'Duel is on',
          message: `Topic agreed: ${after.topic}`,
          type: 'SUCCESS'
        });
      }
    }
    return this.present(after, user);
  },

  decline(user, duelId) {
    const duel = DuelModel.byId(duelId);
    if (!duel) throw { status: 404, message: 'Duel not found' };
    if (duel.status !== 'PENDING') throw { status: 409, message: 'This duel is no longer open' };

    const participants = DuelModel.participants(duelId);
    const me = participants.find((p) => p.user_id === user.id);
    if (!me || me.side !== 'OPPONENT') throw { status: 403, message: 'You are not being challenged here' };

    // One refusal ends it, and everyone who paid in gets their stake back.
    db.transaction(() => {
      for (const p of participants.filter((x) => x.staked === 1)) refundStake(duel, p.user_id);
      DuelModel.setStatus(duelId, 'DECLINED');
    })();

    NotificationService.createNotification({
      userId: duel.challenger_id,
      title: 'Duel declined',
      message: `${user.name} turned it down. Your stake has been returned.`,
      type: 'INFO'
    });
    return this.present(DuelModel.byId(duelId), user);
  },

  cancel(user, duelId) {
    const duel = DuelModel.byId(duelId);
    if (!duel) throw { status: 404, message: 'Duel not found' };
    if (duel.challenger_id !== user.id) throw { status: 403, message: 'Only the challenger can cancel' };
    if (duel.status !== 'PENDING') throw { status: 409, message: 'Too late to cancel' };

    db.transaction(() => {
      for (const p of DuelModel.participants(duelId).filter((x) => x.staked === 1)) {
        refundStake(duel, p.user_id);
      }
      DuelModel.setStatus(duelId, 'CANCELLED');
    })();
    return this.present(DuelModel.byId(duelId), user);
  },

  /** A leader or above calls it, and the winner takes the whole pot. */
  resolve(user, duelId, winnerId) {
    if (!hasRole(user, JUDGE_ROLES)) {
      throw { status: 403, message: 'Only leaders, teachers and admins can call a duel' };
    }
    const duel = DuelModel.byId(duelId);
    if (!duel) throw { status: 404, message: 'Duel not found' };
    if (duel.status !== 'ACTIVE') throw { status: 409, message: 'Only an active duel can be called' };

    const participants = DuelModel.participants(duelId);
    if (!participants.some((p) => p.user_id === winnerId)) {
      throw { status: 400, message: 'The winner has to be one of the three' };
    }

    const potPoints = duel.stake_points * participants.length;
    const potXp = duel.stake_xp * participants.length;

    db.transaction(() => {
      if (potPoints > 0) {
        WalletModel.record({
          userId: winnerId,
          amount: potPoints,
          reason: `Won a duel on ${duel.topic}`,
          sourceType: 'DUEL_WIN',
          sourceId: duel.id
        });
      }
      if (potXp > 0) {
        XpModel.award({
          userId: winnerId,
          amount: potXp,
          sourceType: 'DUEL_WIN',
          sourceId: duel.id,
          description: `Won a duel on ${duel.topic}`
        });
      }
      DuelModel.setStatus(duelId, 'RESOLVED', { winnerId, resolvedBy: user.id });
    })();

    for (const p of participants) {
      NotificationService.createNotification({
        userId: p.user_id,
        title: p.user_id === winnerId ? 'You won the duel' : 'Duel called',
        message:
          p.user_id === winnerId
            ? `You take ${potPoints} points and ${potXp} XP.`
            : `${participants.find((x) => x.user_id === winnerId)?.name} took the pot.`,
        type: p.user_id === winnerId ? 'SUCCESS' : 'INFO'
      });
    }

    return this.present(DuelModel.byId(duelId), user);
  }
};
