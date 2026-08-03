// Human-facing labels for database enums. Users should never read schema.
const OVERRIDES = {
  TEAM_TASK: 'Team task',
  CHALLENGE: 'Challenge',
  MARKETPLACE: 'Marketplace',
  IN_PROGRESS: 'In progress',
  PENDING_REVIEW: 'Pending review',
  PENDING_APPROVAL: 'Pending approval',
  DEV_STEALTH: 'Owner',
  STUDENT_LEADER: 'Leader',
  OPERATIVE: 'Member',
  VANGUARD: 'Member',
  URGENT: 'Urgent',
  NORMAL: 'Normal',
  ASSIGNMENT: 'Assignment',
  ANNOUNCEMENT: 'Announcement',
  MENTION: 'Mention',
  DEADLINE: 'Deadline',
  REVIEW: 'Review',
  INFO: 'Info'
};

/** "IN_PROGRESS" -> "In progress"; unknown values are sentence-cased. */
export function label(value) {
  if (value === null || value === undefined || value === '') return '';
  const raw = String(value);
  const key = raw.toUpperCase();
  if (OVERRIDES[key]) return OVERRIDES[key];
  const words = raw.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Same as `label` but for places where the design calls for caps styling. */
export function labelUpper(value) {
  return label(value).toUpperCase();
}
