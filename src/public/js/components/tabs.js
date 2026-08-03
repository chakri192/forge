// Reusable Tab Bar Component

export function renderTabs({
  id,
  tabs = [],
  activeTabId,
  className = ''
}) {
  const currentActive = activeTabId || (tabs[0] && tabs[0].id);

  const tabsHtml = tabs.map(tab => {
    const isActive = tab.id === currentActive;
    return `
      <button class="forge-tab-button ${isActive ? 'active' : ''}" data-tab-id="${tab.id}">
        ${tab.icon ? `<span class="material-symbols-outlined text-base">${tab.icon}</span>` : ''}
        <span>${tab.label}</span>
        ${tab.count !== undefined ? `<span class="px-1.5 py-0.5 text-[10px] rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-outline'}">${tab.count}</span>` : ''}
      </button>
    `;
  }).join('');

  return `
    <div class="forge-tab-bar ${className}" id="${id}">
      ${tabsHtml}
    </div>
  `;
}

export function attachTabsEvents(tabBarId, onTabChange) {
  const tabBar = document.getElementById(tabBarId);
  if (!tabBar) return;

  const buttons = tabBar.querySelectorAll('.forge-tab-button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const selectedId = btn.dataset.tabId;
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.dispatchEvent(new CustomEvent('forge:tab-change', {
        detail: { tabBarId, tabId: selectedId }
      }));

      if (typeof onTabChange === 'function') {
        onTabChange(selectedId);
      }
    });
  });
}
