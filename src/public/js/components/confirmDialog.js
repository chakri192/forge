// Confirmation Dialog & Modal Component with Focus Trap

export function showConfirmDialog({
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false
}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'forge-modal-backdrop';

    backdrop.innerHTML = `
      <div class="forge-modal-card" role="dialog" aria-modal="true">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full ${danger ? 'bg-red-500/20 text-red-400' : 'bg-royal-slate-blue/20 text-royal-slate-blue'} flex items-center justify-center">
            <span class="material-symbols-outlined text-xl">${danger ? 'warning' : 'help_outline'}</span>
          </div>
          <h3 class="text-base font-bold text-white">${title}</h3>
        </div>
        <p class="text-xs text-outline leading-relaxed mb-6">${message}</p>
        <div class="flex justify-end items-center gap-3">
          <button class="modal-cancel-btn px-4 py-2 rounded-xl text-xs font-semibold text-outline hover:text-white hover:bg-white/10 transition-all">
            ${cancelText}
          </button>
          <button class="modal-confirm-btn px-4 py-2 rounded-xl text-xs font-bold text-white ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-royal-slate-blue hover:opacity-90'} transition-all shadow-md">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Trigger open animation
    requestAnimationFrame(() => backdrop.classList.add('open'));

    const cancelBtn = backdrop.querySelector('.modal-cancel-btn');
    const confirmBtn = backdrop.querySelector('.modal-confirm-btn');

    // Focus trap implementation
    const focusable = backdrop.querySelectorAll('button');
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    firstFocusable.focus();

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        close(false);
      } else if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    const close = (confirmed) => {
      document.removeEventListener('keydown', handleKeydown);
      backdrop.classList.remove('open');
      setTimeout(() => {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        document.dispatchEvent(new CustomEvent(confirmed ? 'forge:modal-confirm' : 'forge:modal-cancel', {
          detail: { title, confirmed }
        }));
        resolve(confirmed);
      }, 250);
    };

    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
    });

    document.addEventListener('keydown', handleKeydown);

    document.dispatchEvent(new CustomEvent('forge:modal-open', { detail: { title } }));
  });
}
