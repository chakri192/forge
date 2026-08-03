// Session lifecycle: token storage, expiry recovery, and last-view memory.
import { store } from '../state/store.js';
import { disconnectStream } from './stream.js';

const TOKEN_KEY = 'forge_jwt_token';
const USER_KEY = 'forge_user_session';
const LAST_VIEW_KEY = 'forge_last_view';
const RETURN_TO_KEY = 'forge_return_to';

const PUBLIC_TABS = new Set(['login', 'signup']);

let expiryHandled = false;

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  expiryHandled = false;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Remember the last meaningful view so reloads land where the user left off. */
export function rememberView(tab) {
  if (!tab || PUBLIC_TABS.has(tab)) return;
  localStorage.setItem(LAST_VIEW_KEY, tab);
}

export function lastView() {
  const tab = localStorage.getItem(LAST_VIEW_KEY);
  return tab && !PUBLIC_TABS.has(tab) ? tab : null;
}

/**
 * Called on the first 401 of a dead session. Tears the session down once —
 * further 401s from in-flight requests are swallowed so the user sees a single
 * calm explanation instead of a toast per failed request.
 */
export function handleSessionExpired() {
  if (expiryHandled) return true;
  expiryHandled = true;

  const currentTab = store.getState().activeTab;
  if (currentTab && !PUBLIC_TABS.has(currentTab)) {
    sessionStorage.setItem(RETURN_TO_KEY, currentTab);
  }

  clearSession();
  disconnectStream();
  document.dispatchEvent(new CustomEvent('forge:session-expired'));
  store.setState({ currentUser: null, activeTab: 'login' });
  return false;
}

/** True when a 401 has already torn down the session (suppress duplicate noise). */
export function isSessionExpiredHandled() {
  return expiryHandled;
}

export function resetSessionExpiry() {
  expiryHandled = false;
}

/** Where to send the user after a successful sign-in. */
export function consumeReturnTo() {
  const tab = sessionStorage.getItem(RETURN_TO_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
  if (tab && !PUBLIC_TABS.has(tab)) return tab;
  return lastView() || 'dashboard';
}

export function hasPendingReturn() {
  return Boolean(sessionStorage.getItem(RETURN_TO_KEY));
}
