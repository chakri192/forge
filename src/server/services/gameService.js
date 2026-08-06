import { GameModel, GAMES } from '../models/Game.js';
import { XpModel } from '../models/Xp.js';
import { db } from '../db/database.js';

/** XP is awarded for beating your own best, not for playing. */
const XP_PER_GAME = { snake: 12, memory: 12, pop: 12, sequence: 12 };

export const GameService = {
  catalogue(user) {
    const bests = GameModel.bestsFor(user.id);
    return {
      games: Object.entries(GAMES).map(([id, g]) => ({
        id,
        label: g.label,
        blurb: g.blurb,
        unit: g.unit,
        best: bests[id] || 0,
        top: GameModel.topFor(id, 5)
      }))
    };
  },

  submit(user, game, score, detail = null) {
    const spec = GAMES[game];
    if (!spec) throw { status: 400, message: 'Unknown game' };

    const value = Number(score);
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw { status: 400, message: 'Score must be a whole number' };
    }
    // The games run in the browser, so treat the score as an untrusted claim.
    if (value > spec.max) {
      throw { status: 400, message: `Score above the maximum for ${spec.label}` };
    }

    const previousBest = GameModel.bestFor(user.id, game);
    const improved = value > previousBest;

    // Record and award in one transaction so a crash cannot leave XP granted
    // for a score that was never stored.
    const run = db.transaction(() => {
      GameModel.record({ userId: user.id, game, score: value, detail });
      if (improved) {
        XpModel.award({
          userId: user.id,
          amount: XP_PER_GAME[game],
          sourceType: 'GAME',
          sourceId: game,
          description: `New best in ${spec.label}: ${value} ${spec.unit}`
        });
      }
    });
    run();

    return {
      game,
      score: value,
      previousBest,
      best: improved ? value : previousBest,
      improved,
      xpAwarded: improved ? XP_PER_GAME[game] : 0,
      top: GameModel.topFor(game, 5)
    };
  }
};
