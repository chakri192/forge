/**
 * The forum's shape.
 *
 * Fixed in code rather than a table: these are a product decision, and a
 * categories table would invite a half-built admin screen to manage eight rows
 * that nobody should be editing casually.
 */

export const FORUM_CATEGORIES = [
  { id: 'general', label: 'General Discussion', description: 'Anything that does not fit elsewhere.', icon: 'forum' },
  { id: 'academic', label: 'Academic', description: 'Coursework, theory, and study.', icon: 'school' },
  { id: 'hackathons', label: 'Hackathons', description: 'Teams, ideas, and post-mortems.', icon: 'bolt' },
  { id: 'resources', label: 'Resources', description: 'Links, tools, and things worth keeping.', icon: 'bookmark' },
  { id: 'ideas', label: 'Ideas', description: 'Half-formed thoughts welcome.', icon: 'lightbulb' },
  { id: 'social', label: 'Social', description: 'The non-work channel.', icon: 'celebration' },
  { id: 'qa', label: 'Q&A', description: 'Ask, answer, and mark what worked.', icon: 'help', answerable: true },
  { id: 'feedback', label: 'Feedback', description: 'On Forge, the cohort, or how it is run.', icon: 'rate_review' }
];

export const CATEGORY_IDS = FORUM_CATEGORIES.map((c) => c.id);
export const DEFAULT_CATEGORY = 'general';

/**
 * A short, closed set. Free-form tags become a thousand near-duplicates within
 * a month and stop being useful for filtering, which is the only reason they
 * exist.
 */
export const FORUM_TAGS = [
  { id: 'question', label: 'Question' },
  { id: 'discussion', label: 'Discussion' },
  { id: 'announcement', label: 'Announcement', restricted: true },
  { id: 'solved', label: 'Solved' },
  { id: 'help-wanted', label: 'Help wanted' },
  { id: 'showcase', label: 'Showcase' }
];

export const TAG_IDS = FORUM_TAGS.map((t) => t.id);

/** Tags anyone may apply. `announcement` is reserved so it keeps meaning something. */
export const OPEN_TAG_IDS = FORUM_TAGS.filter((t) => !t.restricted).map((t) => t.id);

/** Legacy free-text categories map onto the fixed set rather than disappearing. */
export function normaliseCategory(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (CATEGORY_IDS.includes(key)) return key;
  const aliases = {
    engineering: 'academic',
    tech: 'academic',
    technical: 'academic',
    offtopic: 'social',
    random: 'social',
    help: 'qa',
    questions: 'qa',
    q: 'qa'
  };
  return aliases[key] || DEFAULT_CATEGORY;
}

/**
 * @param {unknown} raw
 * @param {boolean} canUseRestricted
 * @returns {string[]} valid, deduped, capped
 */
export function sanitiseTags(raw, canUseRestricted = false) {
  const allowed = canUseRestricted ? TAG_IDS : OPEN_TAG_IDS;
  const list = Array.isArray(raw) ? raw : [];
  return [...new Set(list.map((t) => String(t).toLowerCase()))]
    .filter((t) => allowed.includes(t))
    .slice(0, 3);
}
