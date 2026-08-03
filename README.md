# Forge

A community platform for private learning cohorts. Members take on tasks and
challenges, submit work for review, earn XP toward levels and badges, discuss in
a voting forum, play mini games, and track their progress — while teachers get the
analytics to see who is falling behind.

Built without a frontend framework: an Express API over SQLite, and a vanilla
ES-module single-page app.

---

## Quick start

```bash
npm install
npm run seed
npm run dev
```

The app runs at `http://localhost:3000`. The seed creates demo accounts, tasks,
squads, and channels.

### Configuration

All settings are optional in development and read from the environment.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port. Defaults to `3000`. |
| `JWT_SECRET` | Signing key for session tokens. Required in production, where a value shorter than 32 characters aborts startup. |
| `TENOR_API_KEY` | Enables GIF search in the message composer. Without it the composer still accepts pasted GIF links; only search is disabled. |

```bash
npm test
```

---

## Features

### Work

**Tasks and challenges** move through a full lifecycle — draft, active, in
progress, pending review, completed — with subtask checklists, inline proof
submission, and a one-click review queue for teachers.

**Squads** handle roster management, per-member point-share overrides, and
automatic dissolution when their work completes.

**Calendar** merges scheduled events with upcoming task deadlines into a single
agenda. Team events stay visible only to that team.

### Community

**Messaging** delivers public and team-private channels over Server-Sent Events,
with optimistic send, edit and delete, per-channel unread counts, and drafts
that survive a reload.

Messages carry emoji reactions from a fixed server-side allowlist, up and down
votes, and inline images and GIFs. Reaction and vote counts stream to everyone
in the channel over the same event stream. Embedded media is restricted to a
short list of known image hosts over HTTPS and loaded with `referrerpolicy`
set to `no-referrer`, since an embed reveals every viewer's IP address to
whoever serves it. A link the allowlist does not cover renders as a plain link
rather than an image.

**Announcements** carry priority levels, role-targeted audiences, and expiry
dates, with live notification fan-out to everyone in the audience.

**Forum** provides threaded discussion with up and down voting, accepted
answers, moderation controls, and hot, new, and top ranking.

**Marketplace** lets members propose the work they want to exist. The community
votes, leaders promote the winners into real tasks, and the proposer earns XP.

**Themes** ship five built-in presets and a three-colour custom accent picker.
Any chosen colour is measured against the active background before it is
applied: the text variant is lightened or darkened until it clears WCAG AA, and
the button fill is nudged separately so its label stays readable. A colour the
user picks is never rendered as unreadable text.

### Growth

**Progression** tracks an XP ledger with levels derived on read, daily activity
streaks, and a ninety-day contribution graph. Every award is a single atomic
transaction covering XP, streak, and badges together.

**Achievements** run on a declarative rules engine whose evaluators read durable
history rather than counting forward, so an achievement added today is
immediately earned by anyone who already qualified.

**Two currencies.** XP is progression — a ledger that is only spent when
it is put on the line in a duel, and the only thing the leaderboard ranks on. Points are a wallet:
earned by completing challenges an admin has hosted, spent in the cosmetics
store. The balance is always derived from signed ledger rows rather than kept
as a column, so a crash can never leave a purchase without its debit, and the
balance check and the debit share one transaction so two requests racing
cannot both overdraw.

**Duels** are one on one. The challenger sets the stake and the person
challenged chooses the topic, so neither side picks both what is fought over
and what it is worth. Stakes are escrowed as ledger rows the moment someone
commits, refunded in full if the challenge is declined, and the whole pot goes
to whoever a leader or above declares the winner. Nothing is minted or burned:
two stakes go in and two stakes come out.

Dev-assigned challenges are a separate thing — an admin hosts a challenge with
its own XP and point rewards, and whoever completes it is paid.

**The store** sells avatar rings, titles, and profile banners. Cosmetics store
a colour and nothing else, validated as a hex on the way in and again before
it reaches a style attribute. One item per kind can be worn at a time.

**Mini games** are four classics, each about a minute long: Snake, Memory
Match, Bubble Pop, and Colour Sequence. Beating your own previous best awards
XP, so the reward is improvement rather than repetition. Scores are capped
per game server-side, since a game running in the browser can only ever
submit a claim.

**Hall of Fame** ranks by XP with medals for the top three, a season toggle, and
awarded titles.

**Journal** gives each member a private space for reflections, with mood and
tags. Entries never leave the owner's account.

### Manage

**Analytics** derives cohort health from existing history: completion rates,
review-latency percentiles, weekly activity, and automatic at-risk detection for
members who have gone inactive, submitted nothing, hit repeated rejections, or
broken a long streak.

**Search** indexes tasks, discussions, and announcements in a SQLite
FTS5 table kept current by triggers, and respects the same visibility rules as
the rest of the app — a member never finds a teachers-only announcement.

**Review** gives each submission a weighted rubric, per-criterion scores, and a
threaded conversation, with a `changes_requested` state that returns work to
the submitter.

**Public profiles** are opt-in, revocable portfolio pages at `/p/:slug`,
served by a dedicated allowlist serializer so no private field can leak.

**Access control** enforces four roles — member, leader, teacher, admin —
through middleware and per-resource checks, hardened against IDOR and privilege
escalation.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| API | Node.js (ES modules), Express |
| Database | SQLite via `better-sqlite3`, with versioned SQL migrations |
| Auth | JWT (`jsonwebtoken`), `bcryptjs`, `zod` validation, rate limiting |
| Real-time | Server-Sent Events (no WebSocket dependency) |
| Frontend | Vanilla ES modules, custom CSS tokens, Tailwind utilities |
| Tests | Node's built-in runner, `supertest`, `jsdom` |

---

## Architecture notes

**Layering.** Routes handle HTTP and validation, services hold business logic
and permission decisions, models own SQL. Nothing skips a layer.

**Transactions.** `better-sqlite3` is synchronous, so progression awards wrap
XP, streak, and achievement writes in one `db.transaction`. Notifications fire
only after commit — pushing them inside would announce rewards a rollback later
erased.

**Idempotency.** XP awards are keyed on a source id, so re-approving the same
submission cannot pay out twice. Badge grants rely on a unique constraint, which
makes "newly earned" a reliable signal for notifications.

**Real-time.** One SSE endpoint carries every event type (`message`,
`notification`, `vote`, `xp`). Adding an event type needs no transport work.
`EventSource` cannot set headers, so the stream authenticates by query token.

**Game scores are claims, not measurements.** The games run entirely in the
browser, so every score is validated against a per-game ceiling before it is
recorded, and XP is granted only for beating a personal best.

## Project layout

```
src/
  public/                Frontend SPA
    css/                 Design tokens and component styles
    js/
      components/        Modals, toasts, command palette, drawer, bell
      router/            Tab router and hash routing
      services/          API client, SSE stream, session, theme, shortcuts
      utils/             Shared helpers (dom, drafts, labels, undo)
      views/             One module per screen
    assets/              Branding and media
  server/
    config/              Roles, permissions, constants
    db/                  Migrations, schema, seeds
    middleware/          Auth, RBAC, validation, errors, uploads
    models/              Data access
    routes/              REST endpoints
    services/            Business logic
tests/                   Unit, integration, RBAC matrix, and E2E suites
```

---

## Testing

224 tests run under Node's built-in test runner. `npm test` discovers every
`*.test.js` recursively.

Coverage focuses on the parts most likely to break quietly: progression
transaction rollback and retry, streak behaviour across month and year
boundaries, mini-game score validation and XP awards, the journal privacy
boundary, and RBAC rejections on every protected route.

---

## Credits

Built on the open-source Forge project by
[@aaroninplayz](https://github.com/aaroninplayz/glowing-computing-machine).

## License

Private and proprietary.
