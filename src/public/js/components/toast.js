// Toast Notification Component System
let container = null;

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

export function showToast({ title, message = '', type = 'info', duration = 4000 }) {
  const toastContainer = getToastContainer();

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
      type === 'warning' ? 'text-amber-400' : 'text-royal-slate-blue'
    }">${iconName}</span>
    <div class="flex-1 min-w-0 pr-4">
      ${title ? `<h4 class="text-xs font-bold text-white leading-snug">${title}</h4>` : ''}
      ${message ? `<p class="text-xs text-outline leading-snug mt-0.5">${message}</p>` : ''}
    </div>
    <button class="toast-close-btn p-1 text-outline hover:text-white rounded transition-colors">
      <span class="material-symbols-outlined text-sm">close</span>
    </button>
    <div class="forge-toast-progress" style="animation-duration: ${duration}ms"></div>
  `;

  const closeBtn = toast.querySelector('.toast-close-btn');
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  };

  closeBtn.addEventListener('click', dismiss);

  const timer = setTimeout(dismiss, duration);

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
