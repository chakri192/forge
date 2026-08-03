/** Mask DEV_STEALTH to member in any user-facing payload and normalize legacy role names */
export function maskRole(role) {
  if (role === 'DEV_STEALTH') return 'member';
  if (role === 'OPERATIVE' || role === 'VANGUARD') return 'member';
  if (role === 'STUDENT_LEADER') return 'leader';
  if (role === 'TEACHER') return 'teacher';
  return role;
}

/** Sanitize a user row for public API responses */
export function sanitizeUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  const publicRole = maskRole(u.role);
  return { ...rest, role: u.role, public_role: publicRole };
}


