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
    banner.className = 'conn-banner';
    banner.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:15px" aria-hidden="true">sync_problem</span>
      <span>Reconnecting to live updates…</span>`;
    document.body.appendChild(banner);
  }
  return banner;
}

function show() {
  ensureBanner().dataset.show = 'true';
}

function hide() {
  ensureBanner().dataset.show = 'false';
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
