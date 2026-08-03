// Undo-instead-of-confirm: the UI reacts immediately, the destructive request
// is held behind a grace period, and a toast offers a one-click reversal.
import { showToast } from '../components/toast.js';

const GRACE_MS = 6000;

/**
 * @param {object} options
 * @param {string} options.title      Toast headline, e.g. "Message deleted".
 * @param {string} [options.message]  Secondary line.
 * @param {Function} options.apply    Performs the real destructive request.
 * @param {Function} [options.optimistic] Hides the item right away.
 * @param {Function} [options.revert] Restores the UI if the user undoes.
 * @param {Function} [options.onDone] Runs after the request actually lands.
 */
export function withUndo({ title, message = '', apply, optimistic, revert, onDone }) {
  let undone = false;

  if (typeof optimistic === 'function') optimistic();

  const timer = setTimeout(async () => {
    if (undone) return;
    try {
      await apply();
      if (typeof onDone === 'function') onDone();
    } catch (err) {
      // The request failed after we already hid it — put it back and say so.
      if (typeof revert === 'function') revert();
      showToast({
        title: 'Could not complete that',
        message: err?.message || 'The change was rolled back.',
        type: 'error'
      });
    }
  }, GRACE_MS);

  showToast({
    title,
    message,
    type: 'info',
    duration: GRACE_MS,
    actionLabel: 'Undo',
    onAction: () => {
      undone = true;
      clearTimeout(timer);
      if (typeof revert === 'function') revert();
    }
  });
}
