import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { db, initSchema } from '../src/server/db/database.js';
import { buildMessageEmbed, parseMessageEmbed, badgeFor } from '../src/server/services/discord/embed.js';
import { botKeyForRole, canPin, MessageRelay } from '../src/server/services/discord/messageRelay.js';
import { formatCode, letterFor, ensureCodeFor } from '../src/server/services/discord/forgeCode.js';
import { DiscordMap } from '../src/server/models/DiscordMap.js';
import { isReady, missing } from '../src/server/services/discord/config.js';

describe('Discord bridge — role routing', () => {
  it('sends elevated roles through the Admin Bot', () => {
    for (const role of ['admin', 'DEV_STEALTH', 'teacher', 'TEACHER', 'leader', 'STUDENT_LEADER']) {
      assert.equal(botKeyForRole(role), 'admin', `${role} should use the Admin Bot`);
    }
  });

  it('sends members through the Messenger Bot', () => {
    assert.equal(botKeyForRole('member'), 'messenger');
  });

  it('treats an unknown role as a member rather than granting admin', () => {
    assert.equal(botKeyForRole('something_new'), 'messenger');
    assert.equal(botKeyForRole(undefined), 'messenger');
  });

  it('allows pinning only for roles the Admin Bot speaks for', () => {
    assert.equal(canPin('teacher'), true);
    assert.equal(canPin('member'), false, 'the Messenger Bot has no ManageMessages');
  });
});

describe('Discord bridge — embeds', () => {
  const author = { name: 'Alex Rivera', role: 'member' };

  it('carries the author, badge, code and timestamp', () => {
    const at = new Date('2026-01-02T03:04:05.000Z');
    const embed = buildMessageEmbed({ author, forgeCode: 'FRG-M004', content: 'hello', sentAt: at });
    assert.match(embed.author.name, /Alex Rivera$/);
    assert.equal(embed.description, 'hello');
    assert.equal(embed.color, badgeFor('member').colour);
    assert.equal(embed.footer.text, 'Member · FRG-M004');
    assert.equal(embed.timestamp, at.toISOString());
  });

  it('gives each role a distinct badge colour', () => {
    const colours = ['admin', 'teacher', 'leader', 'member'].map((r) => badgeFor(r).colour);
    assert.equal(new Set(colours).size, 4);
  });

  it('truncates rather than exceeding the Discord description limit', () => {
    const embed = buildMessageEmbed({ author, forgeCode: 'FRG-M001', content: 'x'.repeat(9000) });
    assert.ok(embed.description.length <= 4001, `got ${embed.description.length}`);
    assert.ok(embed.description.endsWith('…'));
  });

  it('round-trips a Forge embed back into a message', () => {
    const embed = buildMessageEmbed({ author, forgeCode: 'FRG-M004', content: 'round trip' });
    const parsed = parseMessageEmbed(embed);
    assert.equal(parsed.content, 'round trip');
    assert.equal(parsed.forgeCode, 'FRG-M004');
    assert.equal(parsed.fromForge, true);
    assert.equal(parsed.authorName, 'Alex Rivera');
  });

  it('marks anything without a forge code as not from Forge', () => {
    const parsed = parseMessageEmbed({ description: 'posted in Discord directly', footer: { text: 'nope' } });
    assert.equal(parsed.fromForge, false);
    assert.equal(parsed.forgeCode, null);
  });

  it('handles a missing embed', () => {
    assert.equal(parseMessageEmbed(null), null);
  });
});

describe('Discord bridge — forge codes', () => {
  before(() => {
    initSchema();
    db.prepare(`DELETE FROM discord_user_map WHERE user_id LIKE 'u_fc_%'`).run();
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, 'x', ?, 'Member')
    `);
    insert.run('u_fc_1', 'Code One', 'fc_one', 'fc1@forge.local', 'member');
    insert.run('u_fc_2', 'Code Two', 'fc_two', 'fc2@forge.local', 'member');
    insert.run('u_fc_3', 'Code Adm', 'fc_adm', 'fc3@forge.local', 'admin');
  });

  it('formats codes with the role letter and three digits', () => {
    assert.equal(formatCode('member', 4), 'FRG-M004');
    assert.equal(formatCode('admin', 12), 'FRG-A012');
    assert.equal(letterFor('teacher'), 'T');
    assert.equal(letterFor('leader'), 'L');
  });

  it('issues a code once and returns the same one afterwards', () => {
    const first = ensureCodeFor({ id: 'u_fc_1', role: 'member' });
    const again = ensureCodeFor({ id: 'u_fc_1', role: 'member' });
    assert.equal(first, again, 'a code must never be reissued');
  });

  it('does not hand the same code to two people', () => {
    const a = ensureCodeFor({ id: 'u_fc_1', role: 'member' });
    const b = ensureCodeFor({ id: 'u_fc_2', role: 'member' });
    assert.notEqual(a, b);
  });

  it('keeps a code stable even if the role later changes', () => {
    const before = ensureCodeFor({ id: 'u_fc_1', role: 'member' });
    const after = ensureCodeFor({ id: 'u_fc_1', role: 'admin' });
    assert.equal(after, before, 'a promotion must not rewrite history');
  });
});

describe('Discord bridge — degrades without credentials', () => {
  it('reports exactly which variables are missing', () => {
    if (isReady()) return; // a configured environment has nothing to report
    const gaps = missing();
    assert.ok(gaps.length > 0);
    assert.ok(gaps.every((g) => g.startsWith('DISCORD_')));
  });

  it('refuses to relay rather than throwing when unconfigured', async () => {
    if (isReady()) return;
    const result = await MessageRelay.relay({
      user: { id: 'u_fc_1', name: 'Code One', role: 'member' },
      discordChannelId: '123',
      content: 'hello'
    });
    assert.equal(result.delivered, false);
    assert.equal(result.reason, 'discord_not_configured');
  });
});

describe('Discord bridge — channel mapping', () => {
  before(() => {
    initSchema();
    db.prepare(`DELETE FROM discord_channel_map WHERE discord_channel_id LIKE 'test_%'`).run();
    db.prepare(`DELETE FROM discord_dm_participants WHERE discord_channel_id LIKE 'test_%'`).run();
  });

  it('maps a channel and finds it by reference', () => {
    DiscordMap.upsertChannel({
      discordChannelId: 'test_ch_1', type: 'team_chat', referenceId: 'task_9', name: 'task-9-chat'
    });
    const found = DiscordMap.channelForReference('team_chat', 'task_9');
    assert.equal(found.discord_channel_id, 'test_ch_1');
  });

  it('upserts rather than duplicating a channel', () => {
    DiscordMap.upsertChannel({ discordChannelId: 'test_ch_1', type: 'team_chat', referenceId: 'task_9', name: 'renamed' });
    const rows = db.prepare(`SELECT * FROM discord_channel_map WHERE discord_channel_id = 'test_ch_1'`).all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'renamed');
  });

  it('tracks who is in a private conversation', () => {
    DiscordMap.upsertChannel({ discordChannelId: 'test_dm_1', type: 'private_dm', name: 'dm' });
    DiscordMap.addDmParticipant('test_dm_1', 'u_fc_1');
    DiscordMap.addDmParticipant('test_dm_1', 'u_fc_2');
    assert.deepEqual(DiscordMap.participantsOf('test_dm_1').sort(), ['u_fc_1', 'u_fc_2']);
    assert.equal(DiscordMap.isParticipant('test_dm_1', 'u_fc_1'), true);
    assert.equal(DiscordMap.isParticipant('test_dm_1', 'u_fc_3'), false, 'outsiders are not participants');
  });

  it('does not add the same participant twice', () => {
    DiscordMap.addDmParticipant('test_dm_1', 'u_fc_1');
    assert.equal(DiscordMap.participantsOf('test_dm_1').filter((u) => u === 'u_fc_1').length, 1);
  });

  it('deactivates a channel without deleting the record', () => {
    DiscordMap.deactivateChannel('test_ch_1');
    assert.equal(DiscordMap.channelForReference('team_chat', 'task_9'), null, 'no longer listed as active');
    assert.ok(DiscordMap.channelByDiscordId('test_ch_1'), 'but the mapping is kept for the archive');
  });
});
