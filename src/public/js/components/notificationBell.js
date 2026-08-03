// Notification Bell & Dropdown Component
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../services/api.js';
import { renderEmptyState } from './emptyState.js';
import { renderSpinner } from './spinner.js';

let pollingInterval = null;
let currentUnreadCount = 0;

export function renderNotificationBell() {
  return `
    <div class="relative" id="notificationBellContainer">
      <button id="notificationBellBtn" class="flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-outline hover:text-white transition-all cursor-pointer relative" title="Notifications">
        <span class="material-symbols-outlined text-xl">notifications</span>
        <span id="notificationUnreadBadge" class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white font-bold text-[10px] flex items-center justify-center border-2 border-deep-obsidian shadow-lg scale-0 transition-transform duration-200">0</span>
      </button>

      <div id="notificationDropdownPanel" class="forge-notification-dropdown">
        <div class="p-3 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-base text-royal-slate-blue">notifications_active</span>
            <h3 class="text-xs font-bold text-white uppercase tracking-wider">Notifications</h3>
          </div>
          <button id="markAllReadBtn" class="text-[11px] font-semibold text-royal-slate-blue hover:underline cursor-pointer">
            Mark all read
          </button>
        </div>

        <div id="notificationListContainer" class="max-h-80 overflow-y-auto divide-y divide-white/5">
          <div class="p-6 text-center text-outline text-xs">
            ${renderSpinner('sm')}
          </div>
        </div>

        <div class="p-2 border-t border-white/10 text-center bg-white/[0.02]">
          <span class="text-[10px] text-outline">Real-time polling active (10s interval)</span>
        </div>
      </div>
    </div>
  `;
}

export function initNotificationBell() {
  const container = document.getElementById('notificationBellContainer');
  if (!container) return;

  const bellBtn = document.getElementById('notificationBellBtn');
  const dropdown = document.getElementById('notificationDropdownPanel');
  const badge = document.getElementById('notificationUnreadBadge');
  const listContainer = document.getElementById('notificationListContainer');
  const markAllBtn = document.getElementById('markAllReadBtn');

  if (!bellBtn || !dropdown) return;

  const toggleDropdown = async (show) => {
    const isOpen = show !== undefined ? show : !dropdown.classList.contains('open');
    if (isOpen) {
      dropdown.classList.add('open');
      await loadNotifications();
    } else {
      dropdown.classList.remove('open');
    }
  };

  bellBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      toggleDropdown(false);
    }
  });

  if (markAllBtn) {
    markAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await markAllNotificationsAsRead();
        updateBadge(0);
        await loadNotifications();
      } catch (err) {
        console.error('Error marking all as read:', err);
      }
    });
  }

  // Start initial check and setup 10-second polling
  refreshUnreadCount();
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(refreshUnreadCount, 10000);
}

export async function refreshUnreadCount() {
  const badge = document.getElementById('notificationUnreadBadge');
  const token = localStorage.getItem('forge_jwt_token');
  if (!token || !badge) return;

  try {
    const data = await fetchUnreadNotificationCount();
    updateBadge(data.count || 0);
  } catch (err) {
    // Ignore polling errors when logged out
  }
}

function updateBadge(count) {
  const badge = document.getElementById('notificationUnreadBadge');
  if (!badge) return;
  currentUnreadCount = count;
  badge.textContent = count > 99 ? '99+' : count;

  if (count > 0) {
    badge.classList.remove('scale-0');
    badge.classList.add('scale-100', 'animate-pulse');
  } else {
    badge.classList.remove('scale-100', 'animate-pulse');
    badge.classList.add('scale-0');
  }
}

async function loadNotifications() {
  const listContainer = document.getElementById('notificationListContainer');
  if (!listContainer) return;

  listContainer.innerHTML = `<div class="p-6 text-center text-outline text-xs">${renderSpinner('sm')}</div>`;

  try {
    const notifications = await fetchNotifications(false);

    if (!notifications || notifications.length === 0) {
      listContainer.innerHTML = renderEmptyState({
        icon: 'notifications_off',
        title: 'No Notifications',
        description: 'You are all caught up! No recent notifications.'
      });
      return;
    }

    const typeIcons = {
      ASSIGNMENT: 'assignment_ind',
      REVIEW: 'rate_review',
      MENTION: 'alternate_email',
      DEADLINE: 'timer',
      ANNOUNCEMENT: 'campaign',
      INFO: 'info'
    };

    listContainer.innerHTML = notifications.map(n => `
      <div class="forge-notification-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" data-link="${n.link || ''}">
        <div class="flex items-start gap-3">
          <div class="w-7 h-7 rounded-lg ${n.is_read ? 'bg-white/5 text-outline' : 'bg-royal-slate-blue/20 text-royal-slate-blue'} flex items-center justify-center shrink-0 mt-0.5">
            <span class="material-symbols-outlined text-base">${typeIcons[n.type] || 'notifications'}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1 mb-0.5">
              <h4 class="text-xs font-bold text-white truncate">${n.title}</h4>
              <span class="text-[10px] text-outline shrink-0">${formatTimeAgo(n.created_at)}</span>
            </div>
            <p class="text-xs text-outline leading-snug break-words">${n.message}</p>
          </div>
        </div>
      </div>
    `).join('');

    listContainer.querySelectorAll('.forge-notification-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        const link = item.dataset.link;

        try {
          await markNotificationAsRead(id);
          refreshUnreadCount();
        } catch (e) {
          console.error(e);
        }

        if (link && link.startsWith('#')) {
          const tab = link.substring(1);
          window.location.hash = link;
          document.dispatchEvent(new CustomEvent('forge:navigate', { detail: { tab } }));
        }
      });
    });
  } catch (err) {
    listContainer.innerHTML = `<div class="p-4 text-center text-xs text-red-400">Failed to load notifications</div>`;
  }
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
