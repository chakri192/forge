# ⚡ Forge — Private Learning Community OS

> **Forge** is a high-performance, gamified Operating System designed for private learning communities, squads, and dev collectives. Built with zero framework bloat using Node.js, Express, SQLite, and pure Vanilla JS/CSS.

---

## ✨ Features

**Work**
- **🎯 Tasks & Challenges**: Full lifecycle (`draft → active → in_progress → pending_review → completed`) with subtask checklists, inline proof submission, a teacher review queue, and deadline tracking.
- **🤝 Squads**: Roster management, per-member point-share overrides, and auto-dissolve on completion.
- **📅 Cohort Calendar**: Events, workshops, and task deadlines merged into one agenda; team events are visible only to their members.

**Community**
- **💬 Real-Time Messaging**: Public and team-private channels delivered live over Server-Sent Events, with optimistic send, edit/delete, per-channel unread counts, and drafts.
- **📣 Announcements**: Priority levels (LOW → URGENT), role-targeted audiences, and expiry.
- **💡 Forum**: Threaded Q&A with up/down voting, accepted answers, pinning and locking, and hot/new/top ranking.
- **🏪 Task Marketplace**: Members propose work, the community votes, and leaders promote the winners into real tasks.

**Growth**
- **⚡ Progression Engine**: An XP ledger with derived levels, daily activity streaks, and a 90-day contribution graph. Every award is one atomic transaction.
- **🏅 Badges & Achievements**: A declarative rules engine over durable history — new achievements backfill for members who already qualified.
- **🧩 Quizzes & Puzzles**: Five question types (multiple choice, multi-select, true/false, short answer, and code-output), graded server-side, with a scheduled Puzzle of the Day and explanations on every review.
- **🏆 Hall of Fame**: XP-ranked leaderboard with medals, season toggle, and awarded titles.
- **📓 Reflection Journal**: Private per-member retros with mood and tags.

**Manage**
- **📊 Cohort Analytics**: Completion rates, review-latency percentiles, weekly activity, and automatic at-risk detection (inactive, no submissions, repeated rejections, broken streak).
- **🛡️ RBAC**: Strict `member` / `leader` / `teacher` / `admin` enforcement in middleware and per-resource checks, hardened against IDOR and privilege escalation.
- **🔔 Notifications**: Live bell driven by SSE, with session-expiry recovery and a connection-status indicator.

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Node.js (ES Modules), Express.js, `better-sqlite3` |
| **Security** | JWT Authentication (`jsonwebtoken`), `bcryptjs`, `zod` schema validation, `express-rate-limit` |
| **Frontend** | Vanilla HTML5, Custom CSS Tokens (Glassmorphism), Vanilla JS Component Architecture & SPA Router |
| **Testing** | Node.js native test runner (`node --test`), `supertest`, `jsdom` |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)

### 1. Installation & Setup
```bash
# Install dependencies
npm install

# Run initial database migrations and seed demo data
npm run seed
```

### 2. Running the Application
```bash
# Start the server (Default port: 3000)
npm start

# Or run in developer watch mode
npm run dev
```

> 💡 **Windows Users**: You can also double-click `start_forge.bat` or run `run.bat` for one-click initialization and startup!

---

## 🧪 Testing

188 automated tests across unit, integration, RBAC-matrix, and E2E suites.

```bash
npm test
```

`node --test` discovers every `*.test.js` under `tests/` recursively. Coverage
includes progression atomicity (a failed award rolls back and stays retryable),
streak date boundaries, quiz grading for all five question types, and the
guarantee that quiz answers are never serialised to a player.

---

## 📁 Repository Structure

```
Forge/
├── docs/                 # Product specifications, architectural guides & design assets
├── src/
│   ├── public/           # Frontend SPA (Vanilla JS, CSS Tokens, Component Library)
│   │   ├── css/          # Glassmorphism styling and custom property tokens
│   │   ├── js/
│   │   │   ├── components/  # Reusable UI (modals, toasts, palette, drawer, bell)
│   │   │   ├── router/      # Tab router + hash routing for shareable URLs
│   │   │   ├── services/    # API client, SSE stream, session, theme, shortcuts
│   │   │   ├── utils/       # Shared helpers (dom, drafts, labels, undo)
│   │   │   └── views/       # One module per screen
│   │   └── assets/       # Static branding and media assets
│   └── server/           # Backend API (Express application & SQLite database)
│       ├── config/       # Environment & global configuration constants
│       ├── db/           # SQLite migrations, schema definitions, and seed scripts
│       ├── middleware/   # RBAC, auth verification, validation, rate-limiting & error handlers
│       ├── models/       # Data models & query interfaces
│       ├── routes/       # RESTful API route definitions
│       └── services/     # Core business logic layer
└── tests/                # Automated test runner suites (RBAC, API, E2E, Components)
```

---

## 📜 License

Private & Proprietary — Learning Community Operating System.
