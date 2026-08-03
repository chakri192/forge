export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  LEADER: 'leader',
  MEMBER: 'member',
  DEV_STEALTH: 'DEV_STEALTH'
};

export const PERMISSIONS = {
  USER_MANAGE: ['admin', 'teacher'],
  ROLE_ASSIGN: ['admin'],
  SETTINGS_MANAGE: ['admin', 'teacher'],
  TASK_CREATE: ['admin', 'teacher', 'leader'],
  TASK_ASSIGN: ['admin', 'teacher', 'leader'],
  TASK_APPROVE: ['admin', 'teacher', 'leader'],
  TASK_SUGGEST: ['admin', 'teacher', 'leader', 'member'],
  TASK_UPVOTE: ['admin', 'teacher', 'leader', 'member'],
  TASK_SUBMIT: ['admin', 'teacher', 'leader', 'member'],
  TEAM_CREATE: ['admin', 'teacher', 'leader'],
  TEAM_MANAGE: ['admin', 'teacher', 'leader'],
  HOF_AWARD: ['admin', 'teacher', 'leader'],
  LEADER_ROTATE: ['admin', 'teacher']
};

export const PRIVILEGED_ROLES = ['leader', 'teacher', 'admin', 'DEV_STEALTH', 'STUDENT_LEADER', 'TEACHER'];
export const ADMIN_ROLES = ['teacher', 'admin', 'DEV_STEALTH', 'TEACHER'];

// Hardcoded owner — this account cannot be deleted, modified, or have its role changed via any API.
// It is completely invisible in all public-facing endpoints (user lists, team members, leaderboards).
export const OWNER_ID = 'u_dev';

export const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.zip', '.md', '.json', '.csv', '.doc', '.docx'
]);

