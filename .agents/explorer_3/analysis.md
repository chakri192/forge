# Package & Build Tooling Analysis Report — Forge Stack Transition

## Executive Summary
This report analyzes the dependency structure, npm script configuration, and testing strategy for transitioning the Forge platform from a React/Vite architecture to a pure Vanilla HTML/CSS/ES-Module JS frontend backed by a Node.js Express server.

While `package.json` in `p:\projects\Forge\package.json` has already had React dependencies removed from its top-level declaration, `package-lock.json` and local `node_modules` still retain legacy build tooling and React packages (`react`, `react-dom`, `lucide-react`, `framer-motion`, `vite`, `@vitejs/plugin-react`). This report provides exact recommendations to finalize the dependency cleanup, optimize `npm run dev`, and set up a zero-overhead testing runner.

---

## 1. Observations

### 1.1 `package.json` Direct Observations (`p:\projects\Forge\package.json`)
```json
{
  "name": "forge",
  "version": "1.0.0",
  "private": true,
  "description": "Operating system for private learning community (Vanilla HTML/JS/CSS Edition)",
  "type": "module",
  "scripts": {
    "dev": "node src/server/index.js",
    "seed": "node src/server/db/seed.js",
    "start": "node src/server/index.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "multer": "^1.4.5-lts.1"
  }
}
```
* **Line 6**: `"type": "module"` is configured, enabling native ES Modules (`import`/`export`) across backend and frontend.
* **Lines 7–11**: Current npm scripts launch Node.js directly (`node src/server/index.js`).
* **Lines 12–17**: Active runtime dependencies are strictly server-side: `better-sqlite3`, `cors`, `express`, `multer`.

### 1.2 `package-lock.json` Direct Observations (`p:\projects\Forge\package-lock.json`)
Inspection of `package-lock.json` reveals lingering lock metadata from the prior React/Vite template:
* **Line 14**: `"framer-motion": "^12.4.2"`
* **Line 15**: `"lucide-react": "^0.475.0"`
* **Line 17**: `"react": "^19.0.0"`
* **Line 18**: `"react-dom": "^19.0.0"`
* **Line 21**: `"@vitejs/plugin-react": "^4.3.4"`
* **Line 22**: `"concurrently": "^9.1.2"`
* **Line 23**: `"vite": "^6.1.0"`

### 1.3 Server & Static File Hosting Observations (`p:\projects\Forge\src\server\index.js`)
```javascript
// Line 21-23 of src/server/index.js
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
```
* The Express server natively serves all files inside `src/public` (`index.html`, `/css/style.css`, `/js/app.js`, etc.) as static assets. No client-side bundler or dev server proxy is required.

---

## 2. Dependency Audit & Clean-up Recommendations

### 2.1 Dependencies to Remove / Purge
The following packages (present in `package-lock.json` and `node_modules/`) must be purged to ensure zero React/Vite residue:

| Package | Category | Reason for Removal |
|---|---|---|
| `react` | Dependency | Replaced by standard DOM API and ES Modules |
| `react-dom` | Dependency | Replaced by native HTML/JS |
| `lucide-react` | Dependency | Icons converted to inline SVG or SVG files |
| `framer-motion` | Dependency | Animations handled via CSS transitions/animations |
| `vite` | devDependency | Bundler not required for native ES Modules |
| `@vitejs/plugin-react` | devDependency | React JSX plugin not needed |
| `concurrently` | devDependency | Single process running Express serves frontend & API |

### 2.2 Server Dependencies to Retain
| Package | Version | Purpose |
|---|---|---|
| `express` | `^4.21.2` | Core web server, REST API router, and static asset server |
| `better-sqlite3` | `^11.8.1` | Fast, synchronous SQLite database interface |
| `cors` | `^2.8.5` | Handles cross-origin requests for local dev / testing |
| `multer` | `^1.4.5-lts.1` | Multipart form-data handling for file/proof uploads |

### 2.3 Recommended devDependencies to Add
| Package | Suggested Version | Purpose |
|---|---|---|
| `dotenv` | `^16.4.7` | Loads environment variables (`PORT`, `DB_PATH`, `NODE_ENV`) |
| `nodemon` | `^3.1.9` | (Optional) Automatic server restart on backend file changes. Alternatively, native `node --watch` can be used. |
| `supertest` | `^7.0.0` | HTTP assertion library for integration testing API endpoints |

---

## 3. Target `package.json` Configuration Proposal

```json
{
  "name": "forge",
  "version": "1.0.0",
  "private": true,
  "description": "Operating system for private learning community (Vanilla HTML/JS/CSS Edition)",
  "type": "module",
  "scripts": {
    "start": "node src/server/index.js",
    "dev": "node --watch src/server/index.js",
    "seed": "node src/server/db/seed.js",
    "test": "node --test tests/**/*.test.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

---

## 4. `npm run dev` & Static Serving Setup Plan

### 4.1 Process Architecture
```
+-------------------------------------------------------------+
| Single Node.js Process (Express Server)                     |
|                                                             |
|  +---------------------------+  +------------------------+  |
|  | Static File Server        |  | REST API Endpoints     |  |
|  | Serves src/public/        |  | Handles /api/*         |  |
|  | - index.html              |  | - Auth, Tasks, Teams   |  |
|  | - css/style.css           |  | - Hall of Fame         |  |
|  | - js/app.js (ES Modules)  |  |                        |  |
|  +---------------------------+  +------------------------+  |
|                                                             |
|  Listens on http://localhost:3001                           |
+-------------------------------------------------------------+
```

### 4.2 Dev Command Behavior (`npm run dev`)
1. Executing `npm run dev` invokes `node --watch src/server/index.js`.
2. Node's built-in `--watch` flag monitors `src/server/**/*.js` and restarts the process seamlessly upon code changes without external dependencies.
3. On server startup:
   - `initSchema()` executes in `src/server/db/database.js`, ensuring SQLite tables exist.
   - `express.static(path.join(__dirname, '../public'))` mounts `src/public` at route `/`.
   - `express.static(path.join(__dirname, '../../uploads'))` mounts file uploads directory at `/uploads`.
   - REST API routes are mounted under `/api/*`.
4. Navigating to `http://localhost:3001/` in the browser loads `src/public/index.html` directly.

---

## 5. Unit & Integration Testing Recommendation

### 5.1 Test Runner Comparison & Choice

| Criteria | Node Native Test Runner (`node --test`) | Jest | Vitest |
|---|---|---|---|
| **ESM Compatibility** | Native (Zero config required) | Requires Babel / Experimental VM flags | Native, but heavy Vite dependency |
| **Dependencies** | 0 external packages | High (~50+ packages) | High (~30+ packages) |
| **Execution Speed** | Extremely fast (Instant boot) | Slower | Fast |
| **Assertion Library** | Native `node:assert/strict` | Custom `expect` | Custom `expect` |

**Recommendation**: Use **Node.js Native Test Runner (`node --test`)** + **`supertest`**.

### 5.2 Test File Structure Plan
Create `tests/` at project root:
```
tests/
├── auth.test.js      # Auth API endpoints (/api/auth/login)
├── tasks.test.js     # Task marketplace & assignment endpoints
├── teams.test.js     # Team point overrides & dissolution
└── static.test.js    # Serves index.html and static assets
```

### 5.3 Example Integration Test (`tests/static.test.js`)
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Static Server Verification', () => {
  it('should serve index.html with HTML5 doctype', async () => {
    const app = express();
    app.use(express.static(path.join(__dirname, '../src/public')));

    const res = await supertest(app).get('/');
    assert.equal(res.status, 200);
    assert.match(res.text, /<!DOCTYPE html>/i);
    assert.match(res.text, /FORGE/);
  });
});
```

---

## 6. Handoff Protocol (5 Components)

### 6.1 Observation
* `p:\projects\Forge\package.json`: Lines 12-17 list `better-sqlite3`, `cors`, `express`, `multer`. No React dependencies present in top-level JSON file.
* `p:\projects\Forge\package-lock.json`: Lines 14-24 contain locked versions of `react`, `react-dom`, `lucide-react`, `framer-motion`, `@vitejs/plugin-react`, `vite`, `concurrently`.
* `p:\projects\Forge\src\server\index.js`: Line 23 serves `src/public` via Express static middleware on PORT 3001.

### 6.2 Logic Chain
1. The project mandate requires completely eliminating React and Vite build tooling in favor of standard Vanilla HTML/JS/CSS served statically via Express.
2. `package.json` already excludes React dependencies, but `package-lock.json` and installed `node_modules` retain React and Vite packages.
3. Therefore, regenerating `package-lock.json` via a clean `npm install` (after deleting `node_modules` and `package-lock.json` or running `npm prune`) will completely purge legacy dependencies.
4. Express static middleware in `src/server/index.js` allows `npm run dev` to serve the entire app from a single process without needing Vite or proxy servers.
5. Using Node.js native `--watch` flag for `npm run dev` and native `node --test` for testing guarantees zero unnecessary build overhead and 100% ESM compliance.

### 6.3 Caveats
* Node.js version must be 18.11+ to use native `node --watch`. If running on older Node versions, `nodemon` can be substituted.
* `package-lock.json` must be regenerated on an environment with internet access or clean npm registry access if dependencies like `dotenv` or `supertest` are added.

### 6.4 Conclusion
The current `package.json` is clean at the root specification level, but requires adding `dotenv` and `supertest`, updating `npm run dev` to use `node --watch`, adding an `npm test` script, and regenerating `package-lock.json` to eliminate legacy React packages.

### 6.5 Verification Method
1. **Dependency Audit**: Inspect `package.json` and ensure no React/Vite packages exist.
2. **Clean Lockfile Generation**: Run `rm -rf node_modules package-lock.json && npm install`. Confirm `package-lock.json` has 0 references to `react` or `vite`.
3. **Dev Server Verification**: Run `npm run dev`, open `http://localhost:3001/`, verify HTTP status 200 and dynamic Vanilla JS UI rendering.
4. **Test Verification**: Run `npm test` and verify zero-failure execution of test suite.
