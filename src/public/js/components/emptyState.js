// Empty State Component

export function renderEmptyState({
  icon = 'inbox',
  title = 'No Items Found',
  description = 'There are no records to display right now.',
  actionText = '',
  actionId = '',
  className = ''
} = {}) {
  return `
    <div class="forge-empty-state ${className}">
      <span class="material-symbols-outlined forge-empty-icon">${icon}</span>
      <h3 class="text-base font-bold text-white mb-1">${title}</h3>
      <p class="text-xs text-outline max-w-sm mb-4 leading-relaxed">${description}</p>
      ${actionText ? `
        <button id="${actionId}" class="px-4 py-2 bg-royal-slate-blue hover:opacity-90 text-white rounded-xl font-bold text-xs transition-all shadow-md">
          ${actionText}
        </button>
      ` : ''}
    </div>
  `;
}
