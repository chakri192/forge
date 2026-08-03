# Forge

A community platform for private learning cohorts. Members take on tasks and
challenges, submit work for review, earn XP toward levels and badges, discuss in
a voting forum, take quizzes, and track their progress — while teachers get the
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
squads, quizzes, and puzzles.

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

**Announcements** carry priority levels, role-targeted audiences, and expiry
dates, with live notification fan-out to everyone in the audience.

**Forum** provides threaded discussion with up and down voting, accepted
answers, moderation controls, and hot, new, and top ranking.

**Marketplace** lets members propose the work they want to exist. The community
votes, leaders promote the winners into real tasks, and the proposer earns XP.

### Growth

**Progression** tracks an XP ledger with levels derived on read, daily activity
streaks, and a ninety-day contribution graph. Every award is a single atomic
transaction covering XP, streak, and badges together.

**Achievements** run on a declarative rules engine whose evaluators read durable
history rather than counting forward, so an achievement added today is
immediately earned by anyone who already qualified.

**Quizzes and puzzles** support five question types — multiple choice,
multi-select, true or false, short answer, and code output. Grading happens
entirely server-side, a Puzzle of the Day rotates on a schedule, and every
review explains why an answer was right or wrong.

**Hall of Fame** ranks by XP with medals for the top three, a season toggle, and
awarded titles.

**Journal** gives each member a private space for reflections, with mood and
tags. Entries never leave the owner's account.

### Manage

**Analytics** derives cohort health from existing history: completion rates,
review-latency percentiles, weekly activity, and automatic at-risk detection for
members who have gone inactive, submitted nothing, hit repeated rejections, or
broken a long streak.

**Search** indexes tasks, discussions, announcements, and quizzes in a SQLite
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

**Quiz integrity.** The play endpoint strips correct answers and explanations
from its payload; a test asserts the serialized response does not even contain
the string `correct_answer`. Answers appear only in a grading result.

---

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
boundaries, quiz grading for all five question types, the journal privacy
boundary, and RBAC rejections on every protected route.

---

## Credits

Built on the open-source Forge project by
[@aaroninplayz](https://github.com/aaroninplayz/glowing-computing-machine).

## License

Private and proprietary.
