import { HallOfFameModel } from '../models/HallOfFame.js';

export const HallOfFameService = {
  getHallOfFameData() {
    const leaderboard = HallOfFameModel.getLeaderboard();
    const titles = HallOfFameModel.getTitles();
    return { allTime: leaderboard, season1: leaderboard, titles };
  },

  awardTitle({ title_name, category, awarded_to_user_id, awarded_to_team_id, season }) {
    if (!title_name) {
      throw { status: 400, message: 'Title name required' };
    }
    const titleId = `hof_${Date.now()}`;
    HallOfFameModel.awardTitle({
      id: titleId,
      title_name,
      category,
      awarded_to_user_id,
      awarded_to_team_id,
      season
    });
    return titleId;
  }
};
