/**
 * Discord credentials and readiness.
 *
 * The bridge is optional. Forge runs without it — every call degrades to a
 * no-op and says so — because a missing token should not stop the rest of the
 * app booting. isReady() is the single check the rest of the code uses.
 */
const REQUIRED = {
  system: 'DISCORD_SYSTEM_BOT_TOKEN',
  admin: 'DISCORD_ADMIN_BOT_TOKEN',
  messenger: 'DISCORD_MESSENGER_BOT_TOKEN'
};

export function tokenFor(bot) {
  return process.env[REQUIRED[bot]] || null;
}

export function guildId() {
  return process.env.DISCORD_GUILD_ID || null;
}

/** Static channel ids, e.g. DISCORD_CHANNEL_GENERAL=123 -> { general: '123' } */
export function staticChannels() {
  const out = {};
  for (const [key, value] of Object.entries(process.env)) {
    const match = /^DISCORD_CHANNEL_([A-Z0-9_]+)$/.exec(key);
    if (match && value) out[match[1].toLowerCase()] = value;
  }
  return out;
}

export function missing() {
  const gaps = Object.values(REQUIRED).filter((name) => !process.env[name]);
  if (!guildId()) gaps.push('DISCORD_GUILD_ID');
  return gaps;
}

export function isReady() {
  return missing().length === 0;
}

/** One line at boot, so an unconfigured bridge is obvious rather than silent. */
export function readinessMessage() {
  if (isReady()) return 'Discord bridge: configured';
  return `Discord bridge: disabled (missing ${missing().join(', ')})`;
}
