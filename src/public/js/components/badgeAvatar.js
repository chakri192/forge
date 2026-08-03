// Badge/Tag & Avatar Components

export function renderBadge({ text, variant = 'info', icon = '', className = '' }) {
  const variantClass = `forge-badge-${variant}`;
  return `
    <span class="forge-badge ${variantClass} ${className}">
      ${icon ? `<span class="material-symbols-outlined text-xs">${icon}</span>` : ''}
      <span>${text}</span>
    </span>
  `;
}

export function renderAvatar({
  src = '',
  name = 'User',
  size = 'md',
  status = '',
  className = ''
} = {}) {
  const sizeClass = size === 'sm' ? 'forge-avatar-sm' : size === 'lg' ? 'forge-avatar-lg' : 'forge-avatar-md';
  const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const statusClass = status ? `forge-avatar-status forge-avatar-status-${status}` : '';

  if (src) {
    return `
      <div class="forge-avatar ${sizeClass} ${className}">
        <img src="${src}" alt="${name}" class="w-full h-full rounded-full object-cover" onerror="this.outerHTML='<span>${initials}</span>'" />
        ${status ? `<span class="${statusClass}"></span>` : ''}
      </div>
    `;
  }

  return `
    <div class="forge-avatar ${sizeClass} ${className}">
      <span>${initials}</span>
      ${status ? `<span class="${statusClass}"></span>` : ''}
    </div>
  `;
}

export function renderAvatarGroup({ users = [], max = 4, size = 'sm' }) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  const avatarsHtml = visible.map(u => renderAvatar({ name: u.name, src: u.avatar_url, size })).join('');
  const remainingHtml = remaining > 0 ? `
    <div class="forge-avatar ${size === 'sm' ? 'forge-avatar-sm' : 'forge-avatar-md'} bg-white/10 border-2 border-deep-obsidian">
      <span class="text-[10px]">+${remaining}</span>
    </div>
  ` : '';

  return `
    <div class="forge-avatar-group">
      ${avatarsHtml}
      ${remainingHtml}
    </div>
  `;
}
