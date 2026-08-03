import { PERMISSIONS, ROLES } from '../config/constants.js';

// Map legacy role names to new standardized roles for smooth transition / compatibility
const LEGACY_ROLE_MAP = {
  OPERATIVE: ROLES.MEMBER,
  VANGUARD: ROLES.MEMBER,
  STUDENT_LEADER: ROLES.LEADER,
  TEACHER: ROLES.TEACHER
};

export function normalizeRole(role) {
  if (!role) return ROLES.MEMBER;
  return LEGACY_ROLE_MAP[role] || role;
}

export function hasRole(user, allowedRoles) {
  if (!user || !user.role) return false;
  // DEV_STEALTH is a superadmin overlay: has all roles
  if (user.role === ROLES.DEV_STEALTH || user.is_stealth) return true;

  const normalized = normalizeRole(user.role);
  const allowedList = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return allowedList.some(r => r === user.role || r === normalized);
}

export function hasPermission(user, permissionKey) {
  if (!user || !user.role) return false;
  // DEV_STEALTH is a superadmin overlay: has all permissions
  if (user.role === ROLES.DEV_STEALTH || user.is_stealth) return true;

  const allowedRoles = PERMISSIONS[permissionKey];
  if (!allowedRoles) return false;

  const normalized = normalizeRole(user.role);
  return allowedRoles.includes(normalized) || allowedRoles.includes(user.role);
}

export function requireRole(allowedRoles) {
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!hasRole(req.user, rolesArray)) {
      return res.status(403).json({
        error: `Access denied: requires ${rolesArray.filter(r => r !== 'DEV_STEALTH').join(' or ')} authority`
      });
    }
    next();
  };
}

export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!hasPermission(req.user, permissionKey)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}
