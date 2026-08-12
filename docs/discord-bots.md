# The three Discord bots

Forge mirrors its messaging into a Discord server. Three separate bot
applications do that work, and the split is deliberate: each one holds only the
permissions its job needs, so a leaked token costs you the least possible.

None of them are optional-but-broken. The bridge is optional *cleanly* — with no
tokens set, every bridge call becomes a no-op that says so, and the rest of Forge
boots and runs normally. `isReady()` in
[`config.js`](../src/server/services/discord/config.js) is the single check the
rest of the code uses.

## At a glance

| Bot | Job | Posts user content? | Extra permission | Token |
|---|---|---|---|---|
| **System Bot** | Creates, maps and archives channels; reads guild members | No | `ManageChannels`, `GuildMembers` intent | `DISCORD_SYSTEM_BOT_TOKEN` |
| **Admin Bot** | Posts for admins, teachers and leaders | Yes | `ManageMessages` (so it can pin) | `DISCORD_ADMIN_BOT_TOKEN` |
| **Messenger Bot** | Posts for members | Yes | none — deliberately cannot pin | `DISCORD_MESSENGER_BOT_TOKEN` |

Plus `DISCORD_GUILD_ID` for the server itself.

### Why three and not one

A single bot would need channel management *and* message posting *and* member
reading, all at once, for every message any member sends. Splitting them means
the bot handling ordinary member chatter — the one doing the most work and
therefore the most exposed — cannot create a channel, cannot delete a message,
and cannot pin anything.

The Admin/Messenger split is the same idea applied to voice: an announcement
from a teacher and a message from a member are visibly different in Discord
because different applications posted them, which cannot be spoofed by anyone
who only holds the Messenger token.

## Intents

Defined in [`botClient.js`](../src/server/services/discord/botClient.js):

```js
system:  [Guilds, GuildMessages, GuildMembers]
poster:  [Guilds, GuildMessages]
```

**`GuildMembers` and `MessageContent` are privileged.** They must be switched on
in the Discord Developer Portal under *Bot → Privileged Gateway Intents*, per
application. Miss them and the failure is quiet and confusing: the bot connects,
looks healthy, fires events — and the message content and embeds arrive empty.
If relayed messages are showing up blank, check this first.

## How a message reaches Discord

1. Someone posts in Forge. The message is saved and delivered to Forge clients
   over SSE **first**.
2. `MessageRelay.relay()` is called, not awaited, and never allowed to throw. A
   Discord outage must not fail the request or lose a message that is already
   stored and delivered.
3. The relay picks a bot by the author's role
   ([`messageRelay.js`](../src/server/services/discord/messageRelay.js)):

   ```js
   const ADMIN_VOICE = new Set(['admin', 'DEV_STEALTH', 'teacher', 'TEACHER',
                                'leader', 'STUDENT_LEADER']);
   ```

   Everyone in that set posts through the Admin Bot. Everyone else goes through
   the Messenger Bot.
4. The bot posts an embed carrying the author's name, role badge, and Forge
   code.

### Forge codes

Every user gets a short, stable, quotable id — `FRG-M001`, `FRG-T004` — issued
once and never reissued. The letter is the role *at the time of issue*:

| Letter | Roles |
|---|---|
| `A` | `admin`, `DEV_STEALTH` |
| `T` | `teacher`, `TEACHER` |
| `L` | `leader`, `STUDENT_LEADER` |
| `M` | `member` (and anything unrecognised) |

The letter is frozen at issue deliberately. If it tracked the current role, a
promotion would silently change the code printed on every message the person had
already sent, and the id would stop being a way to find anything.

The code appears in the embed footer, which is also how the bridge recognises
its own posts coming back the other way. Anything without a parseable
`· FRG-X000` footer is treated as a human posting in Discord directly, not
guessed at.

## Setup

Three applications, one per bot, at
<https://discord.com/developers/applications>.

For each:

1. **New Application** → name it (System Bot / Admin Bot / Messenger Bot)
2. **Bot** → *Reset Token*, copy it. This is the only time it is shown.
3. **Bot → Privileged Gateway Intents** → enable **Message Content**. On the
   System Bot also enable **Server Members**.
4. **OAuth2 → URL Generator** → scopes `bot`, then permissions:
   - System Bot: `Manage Channels`, `View Channels`, `Send Messages`, `Read Message History`
   - Admin Bot: `View Channels`, `Send Messages`, `Read Message History`, `Manage Messages`, `Embed Links`
   - Messenger Bot: `View Channels`, `Send Messages`, `Read Message History`, `Embed Links`
5. Open the generated URL and invite the bot to the server.

Then put the three tokens and the guild id in `.env`:

```
DISCORD_GUILD_ID=
DISCORD_SYSTEM_BOT_TOKEN=
DISCORD_ADMIN_BOT_TOKEN=
DISCORD_MESSENGER_BOT_TOKEN=
```

Two commands help from there:

```bash
npm run discord:ids
```

Prints every channel id in the server as ready-to-paste `.env` lines.

```bash
npm run discord:check
```

Connects each bot in turn and reports what it can actually see and do. Run it
after any change to tokens or permissions.

### Handling the tokens

A bot token is a full credential: anyone holding it can act as that bot in your
server. Treat it like a password.

- `.env` is gitignored. Keep it that way.
- Never paste a token into chat, an issue, a screenshot, or a message to anyone —
  including me. If one is exposed, reset it in the Developer Portal
  immediately; the old value stops working the moment you do.
- The three tokens are separate on purpose. Resetting one does not disturb the
  other two.

## What is *not* private

A conversation mirrored into a Discord channel is readable by both posting bots,
by every administrator of that Discord server, and by Discord itself. Forge says
this in the UI rather than implying otherwise — the wording lives in
`DISCORD_VISIBILITY_NOTE` in
[`conversationService.js`](../src/server/services/conversationService.js) and
appears in the conversation list, the new-conversation dialog, and the thread
header.

If you need something genuinely private, it must not go through the bridge.

## Failure modes worth recognising

| Symptom | Cause |
|---|---|
| Bot online, messages relay, embeds arrive empty | Message Content intent not enabled |
| System Bot cannot create channels | Missing `Manage Channels`, or the role sits below the target category in the role list |
| Nothing relays, no errors | No token set — the bridge is a deliberate no-op. `npm run discord:check` will say so |
| Messages relay but nothing pins | Expected for members: the Messenger Bot has no `ManageMessages` |
| `401 Unauthorized` on boot | Token reset in the portal and not updated in `.env` |
