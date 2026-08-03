// Toast Notification Component System
let container = null;

// Identical toasts raised close together collapse into one counted toast
// instead of stacking (e.g. three parallel requests failing the same way).
const liveToasts = new Map();

function getToastContainer() {
  if (!container) {
    container = document.getElementById('forgeToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'forgeToastContainer';
      container.className = 'forge-toast-container';
      document.body.appendChild(container);
    }
  }
  return container;
}

export function showToast({ title, message = '', type = 'info', duration = 4000, actionLabel, onAction }) {
  const toastContainer = getToastContainer();
  const dedupeKey = `${type}|${title}|${message}`;

  // Collapse a repeat of a live toast into a count badge rather than stacking.
  const existing = liveToasts.get(dedupeKey);
  if (existing && existing.el.isConnected && !actionLabel) {
    existing.count += 1;
    clearTimeout(existing.timer);
    let badge = existing.el.querySelector('.toast-count');
    if (!badge) {
      badge = document.createElement('span');
      badge.className =
        'toast-count shrink-0 px-1.5 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-bold';
      existing.el.querySelector('.toast-body')?.appendChild(badge);
    }
    badge.textContent = `×${existing.count}`;
    existing.timer = setTimeout(existing.dismiss, duration);
    return existing.el;
  }

  const toast = document.createElement('div');
  toast.className = `forge-toast forge-toast-${type}`;

  const iconMap = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info'
  };

  const iconName = iconMap[type] || 'info';

  toast.innerHTML = `
    <span class="material-symbols-outlined text-xl ${
      type === 'success' ? 'text-emerald-400' :
      type === 'error' ? 'text-red-400' :
      type === 'warning' ? 'text-amber-400' : 'text-accent-text'
    }">${iconName}</span>
    <div class="toast-body flex-1 min-w-0 pr-4 flex items-center gap-2">
      <span class="flex-1 min-w-0">
        ${title ? `<h4 class="text-xs font-bold text-white leading-snug">${title}</h4>` : ''}
        ${message ? `<p class="text-xs text-outline leading-snug mt-0.5">${message}</p>` : ''}
      </span>
      ${
        actionLabel
          ? `<button class="toast-action-btn shrink-0 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-colors">${actionLabel}</button>`
          : ''
      }
    </div>
    <button class="toast-close-btn p-1 text-outline hover:text-white rounded transition-colors" aria-label="Dismiss notification">
      <span class="material-symbols-outlined text-sm" aria-hidden="true">close</span>
    </button>
    <div class="forge-toast-progress" style="animation-duration: ${duration}ms"></div>
  `;

  // Mirror the toast into the live region so screen readers announce it
  const liveRegion = document.getElementById('forgeLiveRegion');
  if (liveRegion) liveRegion.textContent = [title, message].filter(Boolean).join('. ');

  const closeBtn = toast.querySelector('.toast-close-btn');
  const dismiss = () => {
    liveToasts.delete(dedupeKey);
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  };

  closeBtn.addEventListener('click', dismiss);

  const actionBtn = toast.querySelector('.toast-action-btn');
  if (actionBtn && typeof onAction === 'function') {
    actionBtn.addEventListener('click', () => {
      onAction();
      dismiss();
    });
  }

  const timer = setTimeout(dismiss, duration);
  liveToasts.set(dedupeKey, { el: toast, count: 1, timer, dismiss });

  toast.addEventListener('mouseenter', () => {
    const progress = toast.querySelector('.forge-toast-progress');
    if (progress) progress.style.animationPlayState = 'paused';
  });

  toast.addEventListener('mouseleave', () => {
    const progress = toast.querySelector('.forge-toast-progress');
    if (progress) progress.style.animationPlayState = 'running';
  });

  toastContainer.appendChild(toast);

  // Dispatch custom DOM event
  document.dispatchEvent(new CustomEvent('forge:toast', {
    detail: { title, message, type, duration }
  }));

  return toast;
}
