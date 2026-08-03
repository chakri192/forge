import { Router } from 'express';
import { TeamService } from '../services/teamService.js';
import { requirePermission, verifyTeamAccess, requireAuth } from '../middleware/auth.js';
import { validate, teamSchemas } from '../middleware/validation.js';

const router = Router();

router.get('/teams', requireAuth, validate({}), (_req, res, next) => {
  try {
    res.json(TeamService.getTeams());
  } catch (err) {
    next(err);
  }
});

function createTeamHandler(req, res, next) {
  try {
    const teamId = TeamService.createTeam(req.body, req.user);
    res.json({ success: true, teamId });
  } catch (err) {
    next(err);
  }
}

router.post('/teams', requirePermission('TEAM_MANAGE'), validate(teamSchemas.create), createTeamHandler);
router.post('/teams/create', requirePermission('TEAM_MANAGE'), validate(teamSchemas.create), createTeamHandler);

router.post('/teams/:id/points/override', validate(teamSchemas.pointOverride), verifyTeamAccess('id'), (req, res, next) => {
  try {
    const { user_id, custom_point_share } = req.body;
    TeamService.overridePoints(req.params.id, user_id, custom_point_share, req.user);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/teams/redistribute-points', validate(teamSchemas.pointOverride), verifyTeamAccess('team_id'), (req, res, next) => {
  try {
    const { team_id, user_id, custom_point_share } = req.body;
    TeamService.overridePoints(team_id, user_id, custom_point_share, req.user);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/teams/:id/dissolve', requirePermission('TEAM_MANAGE'), validate(teamSchemas.dissolve), (req, res, next) => {
  try {
    const teamId = TeamService.dissolveTeam(req.params.id, req.body.reason, req.user);
    res.json({ success: true, teamId, is_active: 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
