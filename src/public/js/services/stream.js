// SSE client: single EventSource shared app-wide. Listeners receive parsed
// payloads ({ type: 'connected' | 'message' | 'notification' | 'vote', ... }).
let source = null;
const listeners = new Set();

export const STREAM_STATUS = { CONNECTING: 'connecting', OPEN: 'open', DOWN: 'down', OFF: 'off' };

let status = STREAM_STATUS.OFF;

export function getStreamStatus() {
  return status;
}

function setStatus(next) {
  if (status === next) return;
  status = next;
  document.dispatchEvent(new CustomEvent('forge:stream-status', { detail: { status: next } }));
}

export function onStreamEvent(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function connectStream() {
  disconnectStream();
  const token = localStorage.getItem('forge_jwt_token');
  if (!token) return;

  setStatus(STREAM_STATUS.CONNECTING);
  source = new EventSource(`/api/stream?token=${encodeURIComponent(token)}`);

  source.onopen = () => setStatus(STREAM_STATUS.OPEN);

  // EventSource retries on its own; surface the gap so "Live" never lies.
  source.onerror = () => {
    setStatus(source && source.readyState === EventSource.CLOSED ? STREAM_STATUS.OFF : STREAM_STATUS.DOWN);
  };

  source.onmessage = (event) => {
    setStatus(STREAM_STATUS.OPEN);
    let parsed;
    try {
      parsed = JSON.parse(event.data);
    } catch (_) {
      return;
    }
    for (const listener of listeners) {
      try {
        listener(parsed);
      } catch (err) {
        console.error('Stream listener error:', err);
      }
    }
  };
}

export function disconnectStream() {
  if (source) {
    source.close();
    source = null;
  }
  setStatus(STREAM_STATUS.OFF);
}
