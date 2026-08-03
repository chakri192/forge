// Local draft persistence so a reload or misclick never eats typed text.
const PREFIX = 'forge_draft:';
const SAVE_DEBOUNCE_MS = 400;

const timers = new Map();

export function saveDraft(key, value) {
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      try {
        if (value && String(value).trim()) {
          localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } else {
          localStorage.removeItem(PREFIX + key);
        }
      } catch (_) {
        /* storage full or unavailable — drafts are best-effort */
      }
    }, SAVE_DEBOUNCE_MS)
  );
}

export function readDraft(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function clearDraft(key) {
  clearTimeout(timers.get(key));
  timers.delete(key);
  localStorage.removeItem(PREFIX + key);
}

/**
 * Wire a set of fields to a draft slot. Returns true if a draft was restored.
 * `fields` maps a name to an element; values are stored as a plain object.
 */
export function bindDraft(key, fields, { onRestore } = {}) {
  const saved = readDraft(key);
  let restored = false;

  if (saved && typeof saved === 'object') {
    for (const [name, el] of Object.entries(fields)) {
      if (!el || saved[name] === undefined) continue;
      if (el.type === 'checkbox') el.checked = Boolean(saved[name]);
      else el.value = saved[name];
      if (saved[name]) restored = true;
    }
    if (restored && typeof onRestore === 'function') onRestore();
  }

  const capture = () => {
    const snapshot = {};
    for (const [name, el] of Object.entries(fields)) {
      if (!el) continue;
      snapshot[name] = el.type === 'checkbox' ? el.checked : el.value;
    }
    const hasContent = Object.values(snapshot).some(
      (v) => typeof v === 'string' && v.trim().length > 0
    );
    saveDraft(key, hasContent ? snapshot : '');
  };

  for (const el of Object.values(fields)) {
    if (!el) continue;
    el.addEventListener('input', capture);
    el.addEventListener('change', capture);
  }

  return restored;
}
