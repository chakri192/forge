/**
 * Prints every ID Forge needs, as .env lines ready to paste.
 *
 * Needs only DISCORD_SYSTEM_BOT_TOKEN. The guild ID is discovered from the
 * bot's own membership, so the one ID you would otherwise copy by hand is not
 * needed either.
 *
 *   npm run discord:ids
 */
import 'dotenv/config';
import { Client, GatewayIntentBits, ChannelType } from 'discord.js';

const token = process.env.DISCORD_SYSTEM_BOT_TOKEN;
if (!token) {
  console.error('\nDISCORD_SYSTEM_BOT_TOKEN is not set in .env.\n');
  process.exit(1);
}

/** DISCORD_CHANNEL_OFF_TOPIC from "off-topic" */
const envName = (prefix, name) =>
  `${prefix}${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  const guilds = [...client.guilds.cache.values()];

  if (!guilds.length) {
    console.error('\nThis bot is not in any server yet — open its invite link first.\n');
    await client.destroy();
    process.exit(1);
  }

  for (const partial of guilds) {
    const guild = await partial.fetch();
    const channels = [...(await guild.channels.fetch()).values()].filter(Boolean);

    console.log(`\n# ${guild.name}`);
    console.log(`DISCORD_GUILD_ID=${guild.id}`);

    const categories = channels.filter((c) => c.type === ChannelType.GuildCategory);
    const names = categories.map((c) => c.name.toLowerCase());
    if (categories.length) {
      console.log('\n# Categories');
      for (const c of categories.sort((a, b) => a.rawPosition - b.rawPosition)) {
        console.log(`${envName('DISCORD_CATEGORY_', c.name)}=${c.id}`);
      }
    }
    // The bridge creates channels inside these two, so they must be
    // categories. A text channel of the same name will not do.
    for (const required of ['teams', 'direct-messages']) {
      if (!names.some((n) => n.replace(/\s+/g, '-') === required)) {
        console.log(`# MISSING CATEGORY "${required.toUpperCase()}" — create it as a category, not a channel`);
      }
    }

    const text = channels.filter((c) => c.type === ChannelType.GuildText);
    if (text.length) {
      console.log('\n# Text channels');
      for (const c of text.sort((a, b) => a.rawPosition - b.rawPosition)) {
        const parent = c.parent ? `  # under ${c.parent.name}` : '';
        console.log(`${envName('DISCORD_CHANNEL_', c.name)}=${c.id}${parent}`);
      }
    }

    const forums = channels.filter((c) => c.type === ChannelType.GuildForum);
    if (forums.length) {
      console.log('\n# Forum channels');
      for (const c of forums.sort((a, b) => a.rawPosition - b.rawPosition)) {
        console.log(`${envName('DISCORD_FORUM_', c.name)}=${c.id}`);
      }
    } else {
      console.log('\n# No forum channels found — milestone 3.4 needs eight of them.');
    }
  }

  console.log('\n# Copy the lines above into .env, then run: npm run discord:check\n');
  await client.destroy();
  process.exit(0);
});

client.on('error', (err) => {
  console.error(`\nDiscord error: ${err.message}\n`);
  process.exit(1);
});

client.login(token).catch((err) => {
  console.error(`\nCould not log in: ${err.message}`);
  console.error('If the token was reset, update .env with the new one.\n');
  process.exit(1);
});
