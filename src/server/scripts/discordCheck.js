/**
 * Verifies Discord setup without starting Forge.
 *
 * Run after filling in .env. It reports what is present, what each bot can
 * actually see, and which permissions are missing — so a misconfigured bot is
 * found here rather than by a message silently failing to post later.
 *
 *   npm run discord:check
 */
import 'dotenv/config';
import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

const BOTS = [
  {
    key: 'system',
    name: 'System Bot',
    env: 'DISCORD_SYSTEM_BOT_TOKEN',
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
    needs: ['ManageChannels', 'ManageRoles', 'ViewChannel', 'ReadMessageHistory']
  },
  {
    key: 'admin',
    name: 'Admin Bot',
    env: 'DISCORD_ADMIN_BOT_TOKEN',
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    needs: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'ManageMessages', 'ReadMessageHistory']
  },
  {
    key: 'messenger',
    name: 'Messenger Bot',
    env: 'DISCORD_MESSENGER_BOT_TOKEN',
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    needs: ['ViewChannel', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'ReadMessageHistory'],
    mustNotHave: ['ManageMessages']
  }
];

const tick = (ok) => (ok ? '  ok  ' : ' FAIL ');
let problems = 0;

async function checkBot(spec, guildId) {
  const token = process.env[spec.env];
  if (!token) {
    console.log(`${tick(false)} ${spec.name}: ${spec.env} is not set`);
    problems += 1;
    return;
  }

  const client = new Client({ intents: spec.intents });
  try {
    await client.login(token);
    await new Promise((resolve, reject) => {
      client.once('clientReady', resolve);
      setTimeout(() => reject(new Error('did not become ready within 15s')), 15000);
    });

    console.log(`${tick(true)} ${spec.name}: connected as ${client.user.tag}`);

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      console.log(`${tick(false)} ${spec.name}: not a member of guild ${guildId} — invite it`);
      problems += 1;
      return;
    }

    const me = await guild.members.fetchMe();
    const missing = spec.needs.filter((p) => !me.permissions.has(PermissionFlagsBits[p]));
    if (missing.length) {
      console.log(`${tick(false)} ${spec.name}: missing permissions — ${missing.join(', ')}`);
      problems += 1;
    } else {
      console.log(`${tick(true)} ${spec.name}: has every permission it needs`);
    }

    // The Messenger Bot must not be able to pin; that separation is the point.
    for (const p of spec.mustNotHave || []) {
      if (me.permissions.has(PermissionFlagsBits[p])) {
        console.log(`${tick(false)} ${spec.name}: has ${p} but should not — members could pin`);
        problems += 1;
      }
    }
  } catch (err) {
    console.log(`${tick(false)} ${spec.name}: ${err.message}`);
    problems += 1;
  } finally {
    await client.destroy();
  }
}

async function main() {
  const guildId = process.env.DISCORD_GUILD_ID;
  console.log('\nDiscord setup check\n');

  if (!guildId) {
    console.log(`${tick(false)} DISCORD_GUILD_ID is not set`);
    problems += 1;
  } else {
    console.log(`${tick(true)} DISCORD_GUILD_ID = ${guildId}`);
  }

  for (const spec of BOTS) {
    if (guildId) await checkBot(spec, guildId);
  }

  const channels = Object.keys(process.env).filter((k) => k.startsWith('DISCORD_CHANNEL_') && process.env[k]);
  console.log(`${tick(channels.length > 0)} ${channels.length} static channel id(s) configured`);
  if (!channels.length) problems += 1;

  console.log(
    problems === 0
      ? '\nAll checks passed. Start Forge and the bridge will come up.\n'
      : `\n${problems} problem(s) above. Fix them and run this again.\n`
  );
  process.exit(problems === 0 ? 0 : 1);
}

main();
