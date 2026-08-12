# Forge API

99 endpoints. Everything is under `/api` except the two health checks. JSON in, JSON out.

The client that ships with Forge is a plain ES-module SPA talking to this same
API — there is no private surface. Anything the web app can do, a script can do.

## Authenticating

Sign in once, then send the token as a bearer header on everything else.

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier": "alex_r", "password": "pass123"}'
```

```json
{ "success": true, "token": "eyJhbGciOiJIUzI1NiIs…", "user": { "id": "u_op1", "…": "…" } }
```

`identifier` accepts a username or an email.

```bash
curl -s http://localhost:3000/api/tasks -H "Authorization: Bearer $TOKEN"
```

Tokens are HS256 JWTs carrying `{ id, username, role }` and expire after **24h**
(`JWT_EXPIRES_IN`). There is no refresh endpoint — sign in again.

`POST` and `PATCH` bodies **must** carry `Content-Type: application/json`.
Without it Express does not parse the body and validation rejects the request as
if the fields were missing.

## Responses

Success shapes vary by endpoint — some return a bare object, some a named
collection (`{ "tasks": [...] }`, `{ "conversations": [...] }`).

Errors are consistent:

```json
{ "success": false, "error": "A season must end after it starts" }
```

Validation failures add `details`. Auth failures are the one exception, returning
a bare `{ "error": "Unauthorized" }` from the middleware before the handler runs.

| Status | Meaning here |
|---|---|
| `400` | Validation failed, or the request is coherent but wrong (end before start) |
| `401` | No token, expired token, or a bad one |
| `403` | Signed in, not allowed |
| `404` | Missing — **also** used where a `403` would confirm something exists (see below) |
| `409` | Conflicts with current state (two open seasons, archiving twice) |
| `429` | Rate limited |
| `502` | An upstream we proxy (GIF search) failed |

### 404 where you might expect 403

Private conversations, other people's uploads, and stealth accounts answer `404`
to anyone not entitled to them. A `403` would confirm the thing exists, which is
itself the disclosure — that two particular people are talking, or that a given
account is real.

## Rate limits

Per IP, from [`rateLimit.js`](../src/server/middleware/rateLimit.js):

| Scope | Limit |
|---|---|
| `/api/auth/*` | 15 per 15 minutes |
| Any mutation under `/api` | 120 per minute |
| Quiz attempts | 12 per minute |
| Public/proxied reads | 60 per minute |

## Roles

`member` · `leader` · `teacher` · `admin`, plus `DEV_STEALTH` — an account that
is deliberately invisible: absent from the directory, not mentionable, and not
reachable by direct message. Legacy uppercase forms (`TEACHER`, `STUDENT_LEADER`)
are accepted alongside the lowercase ones.

Permission groups live in [`constants.js`](../src/server/config/constants.js);
`TASK_APPROVE` (`admin`, `teacher`, `leader`) gates most cohort-running actions,
including seasons.

---

## Endpoints

### Auth

| | |
|---|---|
| `POST /api/auth/signup` | Create an account |
| `POST /api/auth/login` | Exchange credentials for a token |
| `GET /api/auth/me` | The signed-in user |
| `POST /api/auth/change-password` | |

### Tasks and review

| | |
|---|---|
| `GET /api/tasks` · `GET /api/tasks/:id` | |
| `POST /api/tasks` · `PATCH /api/tasks/:id` · `DELETE /api/tasks/:id` | Needs `TASK_CREATE` |
| `PATCH /api/tasks/:id/status` | Move through the lifecycle |
| `POST /api/tasks/:id/submit` | Multipart; the file field is `proof_file` |
| `GET /api/tasks/:id/subtasks` · `PATCH /api/subtasks/:id` · `DELETE /api/subtasks/:id` | |
| `GET /api/tasks/:id/rubric` · `DELETE /api/rubric-criteria/:id` | |
| `GET /api/reviews/queue` | Submissions awaiting a look. `403` for members |
| `GET /api/submissions/:id/review` · `POST /api/submissions/:id/review` | |
| `POST /api/tasks/:id/approve` · `POST /api/tasks/:id/complete` | |

### Messaging

| | |
|---|---|
| `GET /api/channels` | Channels you can see. Conversations are **not** included |
| `GET /api/channels/:id/messages` · `POST /api/channels/:id/messages` | |
| `DELETE /api/messages/:id` | Author only |
| `POST /api/messages/:id/reactions` | Body `{ emoji }`, from the 56-emoji allowlist |
| `POST /api/messages/:id/vote` | `{ value: 1 \| -1 }`; repeating clears |
| `GET /api/reactions/available` | The allowlist |
| `GET /api/stream` | Server-sent events: messages, reactions, notifications |

Writing `@username` in a message notifies that person, provided they can open
the channel. Ten mentions per message maximum.

### Conversations (DMs and groups)

| | |
|---|---|
| `GET /api/conversations` | Yours, plus `visibilityNote` |
| `POST /api/conversations/direct` | `{ userId }` — reuses the existing thread |
| `POST /api/conversations/group` | `{ title, memberIds }` — three people minimum |
| `GET /api/conversations/:id` · `GET /api/conversations/:id/messages` | |
| `POST /api/conversations/:id/members` · `POST /api/conversations/:id/leave` | Groups only |

Post into a conversation through its channel: `POST /api/channels/:channel_id/messages`.

**These are mirrored to Discord**, where server admins can read them. Every
response carries `visibilityNote` saying so; show it.

### Leaderboard and seasons

| | |
|---|---|
| `GET /api/leaderboard?metric=xp\|tasks\|streak&limit=` | Includes the viewer's own row when they fall below the cut |
| `GET /api/seasons` | |
| `POST /api/seasons` | `{ name, startsAt, endsAt }` ISO 8601. One open at a time |
| `POST /api/seasons/:id/archive` | Freezes standings, notifies everyone placed |
| `GET /api/seasons/:id/standings?metric=` | Archived seasons only |
| `GET /api/seasons/history/:userId` | Someone's past placings |

A season windows XP by date. Nothing is deleted when one ends, and points and
cosmetics are never touched.

### Progression, economy, games

| | |
|---|---|
| `GET /api/progression/me` · `GET /api/progression/:userId` | XP, level, streak |
| `GET /api/progression/badges` · `GET /api/progression/achievements` | |
| `GET /api/wallet` | XP and points balances |
| `GET /api/store` · `POST /api/store/:id/buy` | Cosmetics, bought with points |
| `GET /api/games` · `POST /api/games/:id/score` | |
| `GET /api/duels` · `POST /api/duels/:id/cancel` · `POST /api/duels/:id/decline` | |
| `GET /api/hall-of-fame` · `POST /api/hall-of-fame/award` | |

### Community

| | |
|---|---|
| `GET /api/forum/threads` · `GET /api/forum/threads/:id` · `POST /api/forum/threads` | |
| `POST /api/forum/threads/:id/posts` · `POST /api/forum/threads/:id/accept/:postId` | |
| `GET /api/announcements` · `POST /api/announcements` | |
| `GET /api/calendar?from=&to=` · `POST /api/calendar` · `PATCH`/`DELETE /api/calendar/:id` | ISO 8601 |
| `GET /api/teams` · `GET /api/users` · `GET /api/users/:id` | |
| `GET /api/marketplace` · `POST /api/marketplace` | |

### Search, notifications, files

| | |
|---|---|
| `GET /api/search?q=` | FTS5 across tasks, threads, announcements |
| `GET /api/notifications` · `GET /api/notifications/count` | |
| `GET /api/uploads/:file` | Submitter and reviewers only |
| `GET /api/gifs/search?q=&limit=` | Proxied; the provider key stays server-side |

### Ops

Mounted at the root, **not** under `/api`, so a load balancer can reach them
without knowing about the API prefix. Both are unauthenticated.

| | |
|---|---|
| `GET /healthz` | Liveness |
| `GET /readyz` | Readiness, including the database |

---

## Two things that will bite you

**Uploads are not static.** `GET /api/uploads/:file` requires a bearer token and
checks that you either submitted the file or review submissions. A plain
`<img src>` will not work, because the browser does not attach the header —
fetch it and use a blob. `/uploads/...` without the `/api` prefix is gone.

**SSE needs the token too.** `GET /api/stream` is an `EventSource`-style
endpoint but authenticated like everything else.

## A worked example

```bash
BASE=http://localhost:3000/api

TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"prof_vance","password":"adminpass"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

# Open a season
curl -s -X POST $BASE/seasons \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Spring","startsAt":"2026-08-01T00:00:00.000Z","endsAt":"2026-09-30T23:59:59.000Z"}'

# Read the board it now scopes
curl -s "$BASE/leaderboard?metric=xp&limit=5" -H "Authorization: Bearer $TOKEN"
```

Seed accounts for a local run: `alex_r` / `pass123` (member), `sarah_j` /
`pass123` (leader), `prof_vance` / `adminpass` (teacher).
