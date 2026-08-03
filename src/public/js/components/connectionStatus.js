// Slim banner that appears only while the realtime stream is interrupted.
import { STREAM_STATUS, getStreamStatus } from '../services/stream.js';

const BANNER_ID = 'forgeConnectionBanner';
// Brief drops are normal during navigation; only bother the user if it persists.
const GRACE_MS = 2500;

let graceTimer = null;

function ensureBanner() {
  let banner = document.getElementById(BANNER_ID);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'status');
    banner.className =
      'fixed top-16 left-0 right-0 z-30 flex items-center justify-center gap-2 py-1.5 ' +
      'text-[11px] font-semibold text-amber-200 bg-amber-500/15 border-b border-amber-500/30 ' +
      'backdrop-blur-md transition-transform duration-300 -translate-y-full lg:pl-64';
    banner.innerHTML = `
      <span class="material-symbols-outlined text-sm animate-spin" aria-hidden="true">progress_activity</span>
      <span>Reconnecting to live updates…</span>`;
    document.body.appendChild(banner);
  }
  return banner;
}

function show() {
  ensureBanner().classList.remove('-translate-y-full');
}

function hide() {
  ensureBanner().classList.add('-translate-y-full');
}

function apply(status) {
  clearTimeout(graceTimer);
  if (status === STREAM_STATUS.DOWN) {
    graceTimer = setTimeout(show, GRACE_MS);
  } else {
    hide();
  }
}

export function initConnectionStatus() {
  ensureBanner();
  apply(getStreamStatus());
  document.addEventListener('forge:stream-status', (event) => apply(event.detail.status));
}
