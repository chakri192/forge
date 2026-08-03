// Loading Spinner & Skeleton Screen Components

export function renderSpinner(size = 'md', className = '') {
  const sizeClass = size === 'sm' ? 'forge-spinner-sm' : size === 'lg' ? 'forge-spinner-lg' : 'forge-spinner-md';
  return `<span class="forge-spinner ${sizeClass} ${className}"></span>`;
}

export function renderSkeleton(type = 'text', options = {}) {
  const { width = '100%', height = '1rem', className = '' } = options;

  if (type === 'circle') {
    const diameter = height || '40px';
    return `<div class="forge-skeleton ${className}" style="width: ${diameter}; height: ${diameter}; border-radius: 50%;"></div>`;
  }

  if (type === 'card') {
    return `
      <div class="glass-card p-6 space-y-4 ${className}">
        <div class="flex items-center gap-3">
          <div class="forge-skeleton" style="width: 40px; height: 40px; border-radius: 50%;"></div>
          <div class="space-y-2 flex-1">
            <div class="forge-skeleton" style="width: 60%; height: 14px;"></div>
            <div class="forge-skeleton" style="width: 40%; height: 10px;"></div>
          </div>
        </div>
        <div class="forge-skeleton" style="width: 100%; height: 60px;"></div>
        <div class="flex justify-between items-center pt-2">
          <div class="forge-skeleton" style="width: 80px; height: 24px; border-radius: 9999px;"></div>
          <div class="forge-skeleton" style="width: 60px; height: 24px;"></div>
        </div>
      </div>
    `;
  }

  return `<div class="forge-skeleton ${className}" style="width: ${width}; height: ${height};"></div>`;
}
