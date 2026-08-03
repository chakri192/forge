/**
 * The embed a bot posts on a user's behalf.
 *
 * Kept as a pure function returning a plain object so the format can be tested
 * without a Discord connection — the shape is what discord.js expects, but
 * nothing here talks to the network.
 */

/** Badge colour per role, as the integer Discord expects. */
export const ROLE_BADGE = {
  admin:          { label: 'Admin',   marker: '🔴', colour: 0xd94c4c },
  DEV_STEALTH:    { label: 'Admin',   marker: '🔴', colour: 0xd94c4c },
  teacher:        { label: 'Teacher', marker: '🟠', colour: 0xe08a3c },
  TEACHER:        { label: 'Teacher', marker: '🟠', colour: 0xe08a3c },
  leader:         { label: 'Leader',  marker: '🔵', colour: 0x3c7fe0 },
  STUDENT_LEADER: { label: 'Leader',  marker: '🔵', colour: 0x3c7fe0 },
  member:         { label: 'Member',  marker: '🟢', colour: 0x3faf72 }
};

export function badgeFor(role) {
  return ROLE_BADGE[role] || ROLE_BADGE.member;
}

const MAX_DESCRIPTION = 4000; // Discord's limit is 4096; leave room for the ellipsis.

/**
 * @param {object} input
 * @param {{name: string, role: string}} input.author
 * @param {string} input.forgeCode
 * @param {string} input.content
 * @param {Date}   [input.sentAt]
 */
export function buildMessageEmbed({ author, forgeCode, content, sentAt = new Date() }) {
  const badge = badgeFor(author.role);
  const body = String(content ?? '');

  return {
    author: { name: `${badge.marker} ${author.name}` },
    description: body.length > MAX_DESCRIPTION ? `${body.slice(0, MAX_DESCRIPTION)}…` : body,
    color: badge.colour,
    footer: { text: `${badge.label} · ${forgeCode}` },
    timestamp: sentAt.toISOString()
  };
}

/**
 * Turn a relayed embed back into a Forge message. The bridge is the only writer
 * of these embeds, so anything without a recognisable footer came from a human
 * posting in Discord directly and is returned as such rather than guessed at.
 */
export function parseMessageEmbed(embed) {
  if (!embed) return null;
  const footer = embed.footer?.text || '';
  const match = /·\s*(FRG-[A-Z]\d{3})$/.exec(footer.trim());
  return {
    authorName: (embed.author?.name || '').replace(/^\S+\s/, '') || null,
    forgeCode: match ? match[1] : null,
    content: embed.description || '',
    sentAt: embed.timestamp || null,
    fromForge: Boolean(match)
  };
}
