// Dropdown Menu Component

export function renderDropdown({
  id,
  triggerText = 'Options',
  triggerIcon = 'arrow_drop_down',
  items = [],
  className = ''
}) {
  const itemsHtml = items.map(item => `
    <button class="forge-dropdown-item" data-value="${item.value}">
      ${item.icon ? `<span class="material-symbols-outlined text-sm text-outline">${item.icon}</span>` : ''}
      <span>${item.label}</span>
    </button>
  `).join('');

  return `
    <div class="forge-dropdown ${className}" id="${id}">
      <button class="forge-dropdown-trigger flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all">
        <span>${triggerText}</span>
        <span class="material-symbols-outlined text-sm text-outline transition-transform duration-200 trigger-arrow">${triggerIcon}</span>
      </button>
      <div class="forge-dropdown-menu">
        ${itemsHtml}
      </div>
    </div>
  `;
}

export function attachDropdownEvents(containerId, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const trigger = container.querySelector('.forge-dropdown-trigger');
  const menu = container.querySelector('.forge-dropdown-menu');
  const arrow = container.querySelector('.trigger-arrow');

  if (!trigger || !menu) return;

  const toggle = (show) => {
    const isOpen = show !== undefined ? show : !menu.classList.contains('open');
    if (isOpen) {
      menu.classList.add('open');
      if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
      menu.classList.remove('open');
      if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  menu.querySelectorAll('.forge-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = item.dataset.value;
      toggle(false);
      
      document.dispatchEvent(new CustomEvent('forge:dropdown-select', {
        detail: { dropdownId: containerId, value: val }
      }));

      if (typeof onSelect === 'function') onSelect(val);
    });
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      toggle(false);
    }
  });

  // Close on Escape
  container.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggle(false);
  });
}
