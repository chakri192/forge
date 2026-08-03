import { PRIVILEGED_ROLES, ADMIN_ROLES } from '../config/constants.js';
import { UserModel } from '../models/User.js';
import { TeamModel } from '../models/Team.js';
import { verifyToken } from '../utils/jwt.js';
import { requireRole, requirePermission, hasRole, hasPermission } from './rbac.js';

export { requireRole, requirePermission, hasRole, hasPermission };

export function authenticateUser(req, _res, next) {
  let token = null;

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded && decoded.id) {
      const user = UserModel.getByIdOrUsername(decoded.id);
      if (user) {
        req.user = user;
        return next();
      }
    }
  }

  req.user = null;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export const requireLeaderOrTeacher = requireRole(['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER']);
export const requireTeacher = requireRole(['teacher', 'admin', 'DEV_STEALTH', 'TEACHER']);

export function verifyTeamAccess(teamIdParam = 'id') {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (hasRole(req.user, PRIVILEGED_ROLES) || hasPermission(req.user, 'TEAM_MANAGE')) return next();

    const teamId = req.params[teamIdParam] || req.body.team_id;
    if (!teamId) return res.status(400).json({ error: 'Team ID required' });

    const team = TeamModel.getById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.captain_id !== req.user.id && !TeamModel.checkMembership(teamId, req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: you do not belong to this team.' });
    }
    next();
  };
}

