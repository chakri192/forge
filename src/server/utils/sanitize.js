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



const ADMINISH = new Set(['admin', 'DEV_STEALTH', 'teacher', 'TEACHER']);

/**
 * A user as they appear in a list to someone else.
 *
 * sanitizeUser only removes the password hash, so email, phone and the real
 * role all survive it — fine for the account's own payload, not for a
 * directory. This drops contact details unless the viewer is that person or an
 * admin, and never reveals the unmasked role.
 */
export function directoryUser(u, viewer = null) {
  if (!u) return null;
  const isSelf = viewer?.id === u.id;
  const isAdmin = ADMINISH.has(viewer?.role);

  const base = {
    id: u.id,
    name: u.name,
    username: u.username,
    tag: u.tag,
    role: maskRole(u.role),
    public_role: maskRole(u.role),
    bio: u.bio ?? null,
    skills: u.skills ?? null,
    github_url: u.github_url ?? null,
    portfolio_url: u.portfolio_url ?? null,
    created_at: u.created_at
  };

  // Contact details are only ever the person's own business, or an admin's.
  if (isSelf || isAdmin) {
    base.email = u.email;
    base.phone = u.phone;
  }
  // Only an admin sees what a stealth account really is.
  if (isAdmin) base.role = u.role;

  return base;
}

/** Stealth accounts are absent from directories, not merely masked. */
export function visibleToDirectory(users, viewer = null) {
  const isAdmin = ADMINISH.has(viewer?.role);
  return users.filter((u) => isAdmin || u.id === viewer?.id || u.role !== 'DEV_STEALTH');
}
