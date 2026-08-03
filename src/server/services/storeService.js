import { db } from '../db/database.js';
import { WalletModel } from '../models/Wallet.js';
import { CosmeticModel, KINDS, isSafeColour } from '../models/Cosmetic.js';

export const StoreService = {
  /** The catalogue as this viewer sees it: owned, equipped, affordable. */
  catalogue(user) {
    const balance = WalletModel.balanceFor(user.id);
    const owned = new Map(CosmeticModel.ownedBy(user.id).map((r) => [r.cosmetic_id, r.equipped === 1]));

    const items = CosmeticModel.all()
      .filter((c) => isSafeColour(c.value))
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        kind: c.kind,
        kindLabel: KINDS[c.kind]?.label || c.kind,
        cost: c.cost,
        value: c.value,
        owned: owned.has(c.id),
        equipped: owned.get(c.id) === true,
        affordable: c.cost <= balance
      }));

    return {
      balance,
      earned: WalletModel.earnedFor(user.id),
      kinds: Object.entries(KINDS).map(([id, k]) => ({ id, ...k })),
      items
    };
  },

  /**
   * Buy an item. The balance check and the debit happen inside one
   * transaction, so two requests racing cannot both pass the check and
   * overdraw the wallet.
   */
  buy(user, cosmeticId) {
    const item = CosmeticModel.byId(cosmeticId);
    if (!item) throw { status: 404, message: 'That item is not in the store' };
    if (CosmeticModel.owns(user.id, cosmeticId)) {
      throw { status: 409, message: 'You already own this' };
    }

    const purchase = db.transaction(() => {
      const balance = WalletModel.balanceFor(user.id);
      if (balance < item.cost) {
        throw { status: 400, message: `Not enough points — this costs ${item.cost}, you have ${balance}` };
      }
      WalletModel.record({
        userId: user.id,
        amount: -item.cost,
        reason: `Bought ${item.name}`,
        sourceType: 'STORE',
        sourceId: cosmeticId
      });
      CosmeticModel.grant(user.id, cosmeticId);
      // Nothing is equipped automatically: buying a thing and wearing it are
      // separate decisions.
    });
    purchase();

    return { bought: item.id, balance: WalletModel.balanceFor(user.id) };
  },

  equip(user, cosmeticId, equipped) {
    const item = CosmeticModel.byId(cosmeticId);
    if (!item) throw { status: 404, message: 'That item is not in the store' };
    if (!CosmeticModel.owns(user.id, cosmeticId)) {
      throw { status: 403, message: 'You do not own this yet' };
    }

    if (equipped) CosmeticModel.equip(user.id, cosmeticId, item.kind);
    else CosmeticModel.unequip(user.id, cosmeticId);

    return { equipped: CosmeticModel.equippedFor(user.id) };
  },

  wallet(user) {
    return {
      balance: WalletModel.balanceFor(user.id),
      earned: WalletModel.earnedFor(user.id),
      history: WalletModel.historyFor(user.id, 20)
    };
  }
};
