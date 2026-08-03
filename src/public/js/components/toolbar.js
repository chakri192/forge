// Toolbar: one place for a screen's actions, grouped by purpose.
//
// Actions are declared as data rather than markup so the same definition drives
// both the visible bar and the overflow menu. Anything marked collapsible moves
// into the overflow below the breakpoint instead of wrapping or being dropped.
import { escapeHtml } from '../utils/dom.js';

/**
 * @typedef {object} Action
 * @property {string}  id        used to wire the handler
 * @property {string}  label     always present; hidden visually for icon-only
 * @property {string}  [icon]    material symbol name
 * @property {'primary'|'default'|'danger'} [variant]
 * @property {boolean} [iconOnly] show the icon alone, label via aria-label
 * @property {boolean} [pressed]  renders the active state
 * @property {boolean} [disabled]
 * @property {string}  [title]    tooltip; defaults to the label
 */

/**
 * @param {object} config
 * @param {Array<{id?: string, collapsible?: boolean, actions: Action[]}>} config.groups
 * @param {boolean} [config.bare]  drop the container chrome
 * @returns {string} markup
 */
export function renderToolbar({ groups = [], bare = false } = {}) {
  const visible = groups.filter((g) => g.actions?.length);
  if (!visible.length) return '';

  // Only collapsible groups fold away, so the primary action always stays put.
  const collapsible = visible.filter((g) => g.collapsible);
  const hasOverflow = collapsible.length > 0;

  const parts = [];
  visible.forEach((group, index) => {
    if (index > 0) {
      parts.push(
        `<span class="toolbar__divider" role="separator"
           ${group.collapsible ? "data-collapse='true'" : ''}></span>`
      );
    }
    parts.push(`
      <div class="toolbar__group" ${group.collapsible ? "data-collapse='true'" : ''}>
        ${group.actions.map(actionHtml).join('')}
      </div>`);
  });

  return `
    <div class="toolbar ${bare ? 'toolbar--bare' : ''}" role="toolbar">
      ${parts.join('')}
      ${
        hasOverflow
          ? `<span class="toolbar__spacer"></span>
             <div class="toolbar__overflow" data-only-small="true">
               <button class="tool tool--icon" data-overflow-toggle
                 aria-haspopup="true" aria-expanded="false" aria-label="More actions" title="More actions">
                 <span class="material-symbols-outlined" aria-hidden="true">more_horiz</span>
               </button>
               <div class="overflow-menu" data-overflow-menu hidden>
                 ${collapsible
                   .map((g) => g.actions.map((a) => actionHtml({ ...a, iconOnly: false })).join(''))
                   .join('<span class="toolbar__divider" role="separator"></span>')}
               </div>
             </div>`
          : ''
      }
    </div>`;
}

function actionHtml(action) {
  const variant =
    action.variant === 'primary' ? ' tool--primary'
    : action.variant === 'danger' ? ' tool--danger'
    : '';
  const label = escapeHtml(action.label);
  return `
    <button type="button"
      class="tool${variant}${action.iconOnly ? ' tool--icon' : ''}"
      data-action="${escapeHtml(action.id)}"
      title="${escapeHtml(action.title || action.label)}"
      ${action.iconOnly ? `aria-label="${label}"` : ''}
      ${action.pressed !== undefined ? `aria-pressed="${action.pressed}"` : ''}
      ${action.disabled ? 'disabled' : ''}>
      ${action.icon ? `<span class="material-symbols-outlined" aria-hidden="true">${escapeHtml(action.icon)}</span>` : ''}
      <span class="tool__label">${label}</span>
    </button>`;
}

/**
 * Wire a rendered toolbar. Handlers are keyed by action id, so the same handler
 * serves the bar and the overflow copy of an action without extra plumbing.
 *
 * @param {HTMLElement} root     element containing the toolbar
 * @param {Record<string, (event: MouseEvent) => void>} handlers
 */
export function attachToolbar(root, handlers = {}) {
  if (!root) return;

  root.querySelectorAll('[data-action]').forEach((btn) => {
    const handler = handlers[btn.dataset.action];
    if (!handler) return;
    btn.addEventListener('click', (event) => {
      closeAllMenus(root);
      handler(event);
    });
  });

  root.querySelectorAll('[data-overflow-toggle]').forEach((toggle) => {
    const menu = toggle.parentElement.querySelector('[data-overflow-menu]');
    if (!menu) return;

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = !menu.hidden;
      closeAllMenus(root);
      if (open) return;
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      menu.querySelector('.tool')?.focus();
    });
  });

  // One document listener per toolbar, removed when the view is replaced.
  const onOutside = (event) => {
    if (!root.contains(event.target)) closeAllMenus(root);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') closeAllMenus(root);
  };
  document.addEventListener('click', onOutside);
  document.addEventListener('keydown', onKey);

  // Views re-render by replacing innerHTML, which does not fire any teardown,
  // so the listeners are dropped once the toolbar leaves the document.
  const observer = new MutationObserver(() => {
    if (!document.contains(root)) {
      document.removeEventListener('click', onOutside);
      document.removeEventListener('keydown', onKey);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function closeAllMenus(root) {
  root.querySelectorAll('[data-overflow-menu]').forEach((menu) => {
    menu.hidden = true;
    menu.parentElement.querySelector('[data-overflow-toggle]')?.setAttribute('aria-expanded', 'false');
  });
}
