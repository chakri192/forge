# Frontend SPA Authentication & API Handling Analysis

## Executive Summary
This document details the findings of the read-only investigation into the Forge frontend SPA (`src/public/js/`) authentication mechanism, header usage, credential submissions, user session management, and API handling.

The current implementation relies heavily on an insecure `x-user-id` header (with a hardcoded `'u_dev'` fallback) sent with every HTTP request. While `/api/auth/login` and `/api/auth/signup` endpoints are invoked by the login/signup views, the returned JWT `token` is completely ignored—only `res.user` is persisted in `localStorage`. Additionally, there is no existing logout mechanism in the application drawer or top navigation.

To complete Milestone 3 (Frontend SPA Updates), the frontend must be refactored to store the JWT token in `localStorage`, attach it as `Authorization: Bearer <token>` in `src/public/js/services/api.js`, eliminate all `x-user-id` headers and `u_dev` fallbacks across all frontend services and views, implement an explicit logout workflow, and add password change capability in account settings.

---

## Current State Analysis

### 1. Header Usage & `x-user-id` Insecurities
- **Location**: `src/public/js/services/api.js` (lines 5–11)
- **Current `getHeaders` Implementation**:
  ```javascript
  function getHeaders(userId = null, customHeaders = {}) {
    const headers = { ...customHeaders };
    if (userId) {
      headers['x-user-id'] = userId;
    }
    return headers;
  }
  ```
- **Affected `api.js` Methods**:
  - `fetchCurrentUser(userId = null)` (line 13)
  - `fetchDevSettings(userId = 'u_dev')` (line 41)
  - `updateDevSettings(settings, userId = 'u_dev')` (line 47)
  - `fetchAllUsers(userId = 'u_dev')` (line 58)
  - `updateUserProfile(targetUserId, profileData, currentUserId = null)` (line 64)
  - `deleteUser(targetUserId, currentUserId = 'u_dev')` (line 75)
  - `fetchTasks(userId = null)` (line 85)
  - `suggestTask({ title, description, total_points, task_type, mode, user_id })` (line 91)
  - `upvoteTask(taskId, userId = null)` (line 101)
  - `assignTask(taskId, { team_id, user_id, task_type, assigned_by })` (line 111)
  - `submitTaskProof(taskId, formData, userId = null)` (line 121)
  - `approveTask(taskId, { submission_id, reviewed_by } = {})` (line 131)
  - `fetchTeams(userId = null)` (line 141)
  - `createTeam({ name, captain_id, member_ids, task_id, created_by })` (line 147)
  - `overridePoints(teamId, userId, customPointShare, currentUserId = null)` (line 157)
  - `dissolveTeam(teamId, reason = 'MANUAL', currentUserId = null)` (line 167)
  - `fetchHallOfFame(userId = null)` (line 177)
  - `awardTitle(data, userId = null)` (line 183)

### 2. Hardcoded `'u_dev'` Fallbacks across Frontend Codebase
A grep search across `src/public/js/` revealed 18 instances of hardcoded `'u_dev'` fallbacks:
- `app.js` (lines 58, 68): Default session load falls back to `fetchCurrentUser('u_dev')` and `const userId = currentUser ? currentUser.id : 'u_dev'`.
- `userBadges.js` (line 16): Dev link check `user.id === 'u_dev'`.
- `api.js` (lines 41, 47, 58, 75): Default argument `userId = 'u_dev'`.
- `challengesView.js` (lines 155, 172): Fallback `state.currentUser?.id || 'u_dev'`.
- `devDashboardView.js` (lines 122, 123, 183, 197, 217, 233): Calls `fetchDevSettings('u_dev')`, `fetchAllUsers('u_dev')`, `updateUserProfile(..., 'u_dev')`, etc.
- `tasksView.js` (line 168): `const currentUserId = state.currentUser ? state.currentUser.id : 'u_dev'`.
- `teamsView.js` (lines 53, 132): `const currentUserId = currentUser ? currentUser.id : 'u_dev'`.

### 3. Login & Signup Forms & Response Handling
- **Login (`src/public/js/views/loginView.js`)**:
  - `form.addEventListener('submit', ...)` calls `loginUser(identifier, password)`.
  - Lines 68–69 & 97–98:
    ```javascript
    localStorage.setItem('forge_user_session', JSON.stringify(res.user));
    store.setState({ currentUser: res.user, activeTab: 'dashboard' });
    ```
  - **Issue**: `res.token` returned by `POST /api/auth/login` is discarded and not saved to `localStorage`.
- **Signup (`src/public/js/views/signUpView.js`)**:
  - `form.addEventListener('submit', ...)` calls `registerUser({ name, username, email, password, role: 'OPERATIVE' })`.
  - Line 122:
    ```javascript
    localStorage.setItem('forge_user_session', JSON.stringify(res.user));
    ```
  - **Issue**: `res.token` returned by `POST /api/auth/signup` is discarded.

### 4. App Initialization & Session Restoration (`src/public/js/app.js`)
- `initUserSession()` (lines 43–63): Reads `localStorage.getItem('forge_user_session')`.
  - If present, sets `store.setState({ currentUser: user })`.
  - If absent/corrupt, calls `fetchCurrentUser('u_dev')`.
- `loadAllData()` (lines 65–88): Reads `userId = currentUser ? currentUser.id : 'u_dev'` and passes it to `fetchTasks`, `fetchTeams`, `fetchHallOfFame`.
- **Issue**: Session initialization does not validate the stored token against `GET /api/auth/me` with `Authorization: Bearer <token>`.

### 5. Absence of Logout Functionality
- Neither `index.html`, `drawer.js`, nor any view provides a Logout action.
- The sidebar drawer shows static navigation links ("Sign In", "Sign Up") regardless of authentication state.
- `forge_user_session` remains stored indefinitely unless manually cleared from browser dev tools.

---

## Recommended Strategy & Design Proposals

### A. JWT Token Management & Header Attachment Strategy
1. **Token Storage**:
   - Use `localStorage` key `'forge_jwt_token'` (or `'forge_token'`) to store the JWT string upon successful login/signup.
   - Retain `localStorage.getItem('forge_user_session')` as a cache of the current user profile.
2. **Centralized Header & Token Management in `api.js`**:
   - Add utility functions to `api.js`:
     ```javascript
     export function setAuthToken(token) {
       if (token) localStorage.setItem('forge_jwt_token', token);
       else localStorage.removeItem('forge_jwt_token');
     }
     export function getAuthToken() {
       return localStorage.getItem('forge_jwt_token');
     }
     export function clearAuthSession() {
       localStorage.removeItem('forge_jwt_token');
       localStorage.removeItem('forge_user_session');
     }
     ```
   - Update `getHeaders(customHeaders = {})` to remove `userId` parameter and automatically attach `Authorization: Bearer <token>`:
     ```javascript
     function getHeaders(customHeaders = {}) {
       const headers = { ...customHeaders };
       const token = getAuthToken();
       if (token) {
         headers['Authorization'] = `Bearer ${token}`;
       }
       return headers;
     }
     ```
   - Remove `headers['x-user-id']` completely.
   - Remove `userId` / `currentUserId` parameters from all `api.js` methods (`fetchTasks()`, `fetchTeams()`, `fetchDevSettings()`, etc.).

3. **Global 401 Unauthorized Interceptor in `api.js`**:
   - Wrap fetch response checking in a helper or handle HTTP 401:
     ```javascript
     if (res.status === 401) {
       clearAuthSession();
       store.setState({ currentUser: null, activeTab: 'login' });
       throw new Error('Session expired or unauthorized');
     }
     ```

### B. Login & Signup Workflow Updates
- **`loginView.js` & `signUpView.js`**:
  - Update submission handlers to store both token and user:
    ```javascript
    const res = await loginUser(identifier, password);
    if (res && res.token && res.user) {
      setAuthToken(res.token);
      localStorage.setItem('forge_user_session', JSON.stringify(res.user));
      store.setState({ currentUser: res.user, activeTab: 'dashboard' });
      if (reloadDataCallback) reloadDataCallback();
    }
    ```

### C. App Session Bootstrapping (`app.js`)
- Update `initUserSession()`:
  ```javascript
  export async function initUserSession() {
    const token = getAuthToken();
    if (!token) {
      store.setState({ currentUser: null });
      return;
    }

    try {
      // Validate token with backend /api/auth/me
      const res = await fetchCurrentUser();
      if (res && res.user) {
        localStorage.setItem('forge_user_session', JSON.stringify(res.user));
        store.setState({ currentUser: res.user });
      } else {
        clearAuthSession();
        store.setState({ currentUser: null });
      }
    } catch (err) {
      console.warn('Token validation failed:', err);
      clearAuthSession();
      store.setState({ currentUser: null });
    }
  }
  ```

### D. Logout & Navigation UI Refactoring
- **Drawer Nav (`index.html` & `drawer.js`)**:
  - Dynamic display:
    - If `currentUser` is set: show "Account Settings", "Logout" button, hide "Sign In" / "Sign Up".
    - If `currentUser` is null: show "Sign In", "Sign Up", hide authenticated actions.
  - Implement `handleLogout()`:
    ```javascript
    export function handleLogout() {
      clearAuthSession();
      store.setState({ currentUser: null, activeTab: 'login' });
    }
    ```

### E. Password Change UI Integration
- In `settingsView.js`, add a "Security & Password Change" card/form.
- On submit, gather `currentPassword` and `newPassword`, call `changePassword(currentPassword, newPassword)` (`POST /api/auth/change-password` with `Authorization: Bearer <token>`).

---

## Proposed Code Changes Snippets

### 1. `src/public/js/services/api.js`
```javascript
// BEFORE
function getHeaders(userId = null, customHeaders = {}) {
  const headers = { ...customHeaders };
  if (userId) {
    headers['x-user-id'] = userId;
  }
  return headers;
}

export async function fetchCurrentUser(userId = null) {
  const res = await fetch(`${BASE_URL}/auth/me`, { headers: getHeaders(userId) });
  ...
}

// AFTER
export function getAuthToken() {
  return localStorage.getItem('forge_jwt_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('forge_jwt_token', token);
  } else {
    localStorage.removeItem('forge_jwt_token');
  }
}

export function clearAuthSession() {
  localStorage.removeItem('forge_jwt_token');
  localStorage.removeItem('forge_user_session');
}

function getHeaders(customHeaders = {}) {
  const headers = { ...customHeaders };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchCurrentUser() {
  const res = await fetch(`${BASE_URL}/auth/me`, { headers: getHeaders() });
  if (res.status === 401) {
    clearAuthSession();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error('Failed to fetch user profile');
  return res.json();
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ currentPassword, newPassword })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Password change failed');
  return data;
}
```

---

## Summary of Affected Files
1. `src/public/js/services/api.js` — Replace `x-user-id` with `Authorization: Bearer <token>`, remove `userId` params, add `changePassword()`.
2. `src/public/js/app.js` — Update `initUserSession()` to validate token against `/api/auth/me`, remove `u_dev` fallbacks.
3. `src/public/js/views/loginView.js` — Store JWT token (`res.token`) on login.
4. `src/public/js/views/signUpView.js` — Store JWT token (`res.token`) on registration.
5. `src/public/js/views/settingsView.js` — Add change password form and remove `currentUserId` pass-throughs.
6. `src/public/js/views/devDashboardView.js` — Remove `'u_dev'` arguments from API service calls.
7. `src/public/js/views/tasksView.js`, `teamsView.js`, `challengesView.js` — Remove `u_dev` fallbacks when invoking `api.js`.
8. `src/public/js/components/drawer.js` & `index.html` — Add logout button handler and toggle login/logout navigation options.
