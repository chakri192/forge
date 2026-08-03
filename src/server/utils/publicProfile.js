/**
 * Serializer for the one unauthenticated surface in the application.
 *
 * This deliberately does NOT reuse sanitizeUser, which returns email, phone
 * and the raw role. It is an allowlist rather than a denylist: a column added
 * to `users` later cannot silently become public, because it simply will not
 * appear here.
 */
export function toPublicProfile(user, { xp, level, badges, titles, contributions, work }) {
  return {
    handle: user.public_slug || user.username,
    name: user.name,
    tag: user.tag ?? null,
    bio: user.bio ?? null,
    skills: user.skills ?? null,
    links: {
      github: user.github_url ?? null,
      portfolio: user.portfolio_url ?? null
    },
    level,
    xp,
    badges: badges.map((b) => ({
      name: b.name,
      description: b.description,
      icon: b.icon,
      rarity: b.rarity,
      awarded_at: b.awarded_at
    })),
    titles: titles.map((t) => ({ name: t.title_name, category: t.category })),
    contributions,
    work: work.map((w) => ({
      title: w.title,
      difficulty: w.difficulty,
      task_type: w.task_type,
      completed_at: w.reviewed_at
    }))
  };
}

/** URL-safe slug derived from a display name, with a stable fallback. */
export function slugify(value, fallback = 'member') {
  const slug = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '');
  return slug || fallback;
}
