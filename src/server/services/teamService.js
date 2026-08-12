import { TeamModel } from '../models/Team.js';
import { sanitizeUser } from '../utils/sanitize.js';
import { ActivityService } from './activity.js';
import { TeamWorkspace } from './teamWorkspace.js';

export const TeamService = {
  getTeams() {
    const teams = TeamModel.getAllActive();
    return teams.map(team => ({
      ...team,
      members: team.members.map(sanitizeUser)
    }));
  },

  createTeam({ name, captain_id, member_ids, task_id, created_by }, currentUser) {
    if (!name) {
      throw { status: 400, message: 'Team name required' };
    }
    const teamId = `t_${Date.now()}`;
    TeamModel.create({ id: teamId, name, captain_id, member_ids, task_id });

    // A team without somewhere to talk is a list of names. Created here so it
    // exists the moment the team does, rather than on first visit.
    TeamWorkspace.create({ teamId, teamName: name, taskId: task_id || null });

    const user = currentUser || (created_by ? { id: created_by, name: 'User' } : null);
    ActivityService.logTeamChange(user, 'TEAM_CREATE', { id: teamId, name });
    return teamId;
  },

  overridePoints(teamId, userId, customPointShare, currentUser) {
    if (!teamId || !userId || typeof customPointShare !== 'number' || !isFinite(customPointShare) || customPointShare < 0) {
      throw { status: 400, message: 'Team ID, User ID, and valid custom_point_share required' };
    }
    const team = TeamModel.getById(teamId);
    if (!team) {
      return;
    }

    TeamModel.updateCustomPointShare(teamId, userId, customPointShare);
    ActivityService.logTeamChange(currentUser, 'TEAM_OVERRIDE', { id: teamId, name: team.name });
  },

  dissolveTeam(teamId, reason = 'MANUAL', currentUser) {
    const team = TeamModel.getById(teamId);
    if (!team) {
      throw { status: 404, message: 'Team not found' };
    }
    TeamModel.dissolve(teamId, reason);
    ActivityService.logTeamChange(currentUser, 'TEAM_DISSOLVE', { id: teamId, name: team.name, reason });
    return teamId;
  }
};
