<div align="center">

<img src="docs/forge.svg" width="840" alt="" />

# Forge

**A community platform for private learning cohorts.**

Members take on tasks and challenges, submit work for review, earn progression toward levels and badges, and participate in a voting forum. Teachers receive the analytics required to identify who is falling behind.

<p>
  <img alt="Node" src="https://img.shields.io/badge/Node-ESM-1c1c1e?style=flat-square&logo=nodedotjs&logoColor=339933" />
  <img alt="Express" src="https://img.shields.io/badge/Express-4-1c1c1e?style=flat-square&logo=express&logoColor=white" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-better--sqlite3-1c1c1e?style=flat-square&logo=sqlite&logoColor=003B57" />
  <img alt="Frontend" src="https://img.shields.io/badge/frontend-vanilla%20ES%20modules-1c1c1e?style=flat-square" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-351%20passing-1c1c1e?style=flat-square" />
  <img alt="Size" src="https://img.shields.io/badge/~21k-lines-1c1c1e?style=flat-square" />
</p>

</div>

---

## Overview

Forge is an Express API over SQLite with a vanilla ES-module single-page client. There is no frontend framework and no build step; the client is served as authored.

Approximately 21,000 lines across 24 route modules, 22 services, 25 models, 23 versioned migrations, and 23 client views.

## Requirements

Node.js with ES module support. All dependencies install through npm; `better-sqlite3` compiles a native binding during installation.

## Quick start

```sh
npm install
npm run seed
npm run dev
```

The application runs at `http://localhost:3000`. Seeding creates demonstration accounts, tasks, squads, and channels.

```sh
npm test
```

### Configuration

All settings are optional in development and read from the environment.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port. Defaults to `3000` |
| `JWT_SECRET` | Session token signing key. Required in production, where a value shorter than 32 characters aborts startup |
| `TENOR_API_KEY` | Enables GIF search in the message composer. Without it the composer still accepts pasted GIF links |

## Features

### Work

**Tasks and challenges** progress through a defined lifecycle — draft, active, in progress, pending review, completed — with subtask checklists, inline proof submission, and a single-action review queue for teachers.

**Squads** provide roster management, per-member point-share overrides, and automatic dissolution once their work completes.

**Calendar** merges scheduled events with upcoming task deadlines into one agenda. Team events remain visible only to that team.

### Community

**Messaging** delivers public and team-private channels over Server-Sent Events, with optimistic send, edit and delete, per-channel unread counts, and drafts that survive a reload.

Messages support emoji reactions drawn from a server-side allowlist, up and down votes, and inline images and GIFs. Reaction and vote counts propagate to everyone in the channel over the same event stream. Embedded media is restricted to a short list of known image hosts over HTTPS and loaded with `referrerpolicy` set to `no-referrer`, since an embed discloses every viewer's IP address to whoever serves it. Links outside the allowlist render as plain links.

**Announcements** carry priority levels, role-targeted audiences, and expiry dates, with live notification delivery to everyone in the audience.

**Forum** provides threaded discussion with voting, accepted answers, moderation controls, and hot, new, and top ranking.

**Marketplace** allows members to propose work. The community votes, leaders promote successful proposals into tasks, and the proposer receives progression credit.

**Themes** ship five presets and a three-colour custom accent picker. Any selected colour is measured against the active background before application: the text variant is lightened or darkened until it satisfies WCAG AA, and the button fill is adjusted separately so its label remains legible. A user-selected colour is never rendered as unreadable text.

### Progression

**Experience and levels.** An XP ledger with levels derived on read, daily activity streaks, and a ninety-day contribution graph. Each award is a single atomic transaction covering XP, streak, and badges together.

**Achievements** are evaluated by a declarative rules engine whose evaluators read durable history rather than counting forward, so an achievement introduced today is immediately awarded to anyone who already satisfies it.

**Two currencies.** XP represents progression: a ledger spent only when staked in a duel, and the sole basis for leaderboard ranking. Points function as a wallet, earned by completing hosted challenges and spent in the cosmetics store.

**Duels** are between two members. The challenger sets the stake and the challenged party selects the topic, so neither side determines both what is contested and what it is worth. Stakes are escrowed as ledger rows on commitment, refunded in full if declined, and awarded to the participant a leader or above declares the winner.

**The store** sells avatar rings, titles, and profile banners. Cosmetics store a colour value and nothing else, validated as hexadecimal on input and again before reaching a style attribute. One item per category may be equipped.

**Mini games** are four approximately one-minute games: Snake, Memory Match, Bubble Pop, and Colour Sequence. Improving on a personal best awards XP, so the reward is improvement rather than repetition. Scores are capped per game server-side, since a game executing in the browser can only ever submit a claim.

**Hall of Fame** ranks by XP with medals for the top three, a season toggle, and awarded titles.

### Administration

**Analytics** derives cohort health from existing history: completion rates, review-latency percentiles, weekly activity, and automatic at-risk detection for members who have become inactive, submitted nothing, accumulated repeated rejections, or broken an established streak.

**Search** indexes tasks, discussions, and announcements in a SQLite FTS5 table maintained by triggers, and applies the same visibility rules as the rest of the application.

**Review** provides each submission with a weighted rubric, per-criterion scores, and a threaded conversation, including a `changes_requested` state that returns work to the submitter.

**Public profiles** are opt-in and revocable portfolio pages at `/p/:slug`, served through a dedicated allowlist serialiser so that no private field can be exposed.

**Access control** enforces four roles — member, leader, teacher, admin — through middleware and per-resource checks, hardened against insecure direct object reference and privilege escalation.

## Technology

| Layer | Choice |
|---|---|
| API | Node.js (ES modules), Express |
| Database | SQLite via `better-sqlite3`, with versioned SQL migrations |
| Authentication | JWT (`jsonwebtoken`), `bcryptjs`, `zod` validation, rate limiting |
| Real-time | Server-Sent Events |
| Frontend | Vanilla ES modules, custom CSS tokens, Tailwind utilities |
| Testing | Node's built-in runner, `supertest`, `jsdom` |

## Architecture

**Layering.** Routes handle HTTP concerns and validation, services contain business logic and permission decisions, and models own SQL. No layer is bypassed.

**Transactions.** `better-sqlite3` is synchronous, so progression awards wrap XP, streak, and achievement writes in a single `db.transaction`. Notifications are dispatched only after commit; dispatching inside the transaction would announce rewards that a rollback subsequently removes.

**Idempotency.** XP awards are keyed on a source identifier, so re-approving the same submission cannot pay out twice. Badge grants rely on a unique constraint, which makes "newly earned" a reliable signal for notification.

**Real-time transport.** A single SSE endpoint carries every event type, so adding one requires no transport work. `EventSource` cannot set headers, so the stream authenticates by query token.

**Game scores are claims, not measurements.** The games execute entirely in the browser, so every score is validated against a per-game ceiling before recording, and XP is granted only for improving on a personal best.

### The ledger invariant

Balances are never stored as a column. Every balance is summed from signed ledger rows on read, so an interrupted purchase cannot leave an item without its corresponding debit — there is no second value that can diverge from the first.

The affordability check and the debit share a single transaction. Separating them allows two concurrent requests to read the same balance and both succeed, which is the standard way a wallet becomes negative without any arithmetic error.

Duels neither create nor destroy currency: two stakes are escrowed and two stakes are paid out.

## Testing

```sh
npm test
```

351 tests across 54 suites on Node's built-in runner, completing in approximately six seconds. `npm test` discovers every `*.test.js` recursively.

Coverage concentrates on behaviour that fails silently rather than loudly: progression transaction rollback and retry, streak behaviour across month and year boundaries, mini-game score validation, ledger balances under concurrent spending, and access-control rejections on every protected route.

That last category is deliberate. A permission check that nothing asserts against can cease to function without any test failing, so each protected route has a rejection case as well as a success case.

## Project structure

```
src/
├── public/                 Frontend single-page application
│   ├── css/                Design tokens and component styles
│   └── js/
│       ├── components/     Modals, toasts, command palette, drawer, notifications
│       ├── router/         Tab router and hash routing
│       ├── services/       API client, SSE stream, session, theme, shortcuts
│       ├── utils/          Shared helpers
│       └── views/          One module per screen
└── server/
    ├── config/             Roles, permissions, constants
    ├── db/                 Migrations, schema, seeds
    ├── middleware/         Authentication, access control, validation, errors, uploads
    ├── models/             Data access
    ├── routes/             REST endpoints
    └── services/           Business logic

tests/                      Unit, integration, access-control matrix, and end-to-end suites
```

> The original and considerably smaller implementation of this concept is [forge](https://github.com/chakri192/forge) — Express over a JSON file, three dependencies, approximately 2,500 lines.

## Credits

Built on the open-source Forge project by [@aaroninplayz](https://github.com/aaroninplayz/glowing-computing-machine).

| | |
|---|---|
| [chakri192](https://github.com/chakri192) | Author |
| [aider](https://github.com/Aider-AI/aider) | AI pair programmer |

## License

Private and proprietary.
