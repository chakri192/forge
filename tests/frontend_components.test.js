import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Setup JSDOM global browser environment before importing DOM components
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost:3000'
});

global.window = dom.window;
global.document = dom.window.document;
global.CustomEvent = dom.window.CustomEvent;
global.HTMLElement = dom.window.HTMLElement;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);

try {
  Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator,
    writable: true,
    configurable: true
  });
} catch (_) {}

// Dynamically import frontend vanilla JS components after DOM setup
const { showToast } = await import('../src/public/js/components/toast.js');
const { openModal, closeModal } = await import('../src/public/js/components/modal.js');
const { showConfirmDialog } = await import('../src/public/js/components/confirmDialog.js');
const { renderBadge, renderAvatar, renderAvatarGroup } = await import('../src/public/js/components/badgeAvatar.js');
const { renderActivityFeed } = await import('../src/public/js/components/activityFeed.js');
const { renderEmptyState } = await import('../src/public/js/components/emptyState.js');
const { renderTabs, attachTabsEvents } = await import('../src/public/js/components/tabs.js');
const { renderSpinner, renderSkeleton } = await import('../src/public/js/components/spinner.js');

test('Frontend Vanilla JS Components Suite (JSDOM Environment)', async (t) => {

  await t.test('1. Toast Component - Container Creation & Toast Display', () => {
    let toastEventFired = false;
    document.addEventListener('forge:toast', (e) => {
      if (e.detail.title === 'Test Toast') toastEventFired = true;
    });

    const toast = showToast({ title: 'Test Toast', message: 'Toast Message', type: 'success' });
    
    assert.ok(toast);
    const container = document.getElementById('forgeToastContainer');
    assert.ok(container);
    assert.ok(toast.innerHTML.includes('Test Toast'));
    assert.ok(toast.innerHTML.includes('Toast Message'));
    assert.equal(toastEventFired, true);
  });

  await t.test('2. Toast Component - Manual Dismiss Button', () => {
    const toast = showToast({ title: 'Dismissable Toast', message: 'Click to close', type: 'info' });
    const closeBtn = toast.querySelector('.toast-close-btn');
    assert.ok(closeBtn);

    closeBtn.click();
    assert.equal(toast.style.opacity, '0');
  });

  await t.test('3. Modal Component - Open and Close Lifecycle', () => {
    openModal({
      title: 'Test Modal',
      contentHtml: '<p id="modalBody">Modal Body Text</p>'
    });

    const overlay = document.getElementById('forgeModalOverlay');
    assert.ok(overlay);
    assert.ok(overlay.querySelector('h3').textContent.includes('Test Modal'));
    assert.ok(overlay.querySelector('#modalBody'));

    closeModal();
    assert.equal(document.getElementById('forgeModalOverlay'), null);
  });

  await t.test('4. Modal Component - Confirm Callback Execution', async () => {
    let confirmed = false;
    openModal({
      title: 'Confirm Test',
      contentHtml: '<span>Confirm Me</span>',
      onConfirm: async () => {
        confirmed = true;
        return true;
      }
    });

    const overlay = document.getElementById('forgeModalOverlay');
    const confirmBtn = overlay.querySelector('#modalConfirmBtn');
    confirmBtn.click();

    await new Promise(r => setTimeout(r, 10));
    assert.equal(confirmed, true);
    assert.equal(document.getElementById('forgeModalOverlay'), null);
  });

  await t.test('5. Confirm Dialog Component - User Choice Promise Resolution', async () => {
    const dialogPromise = showConfirmDialog({
      title: 'Delete Team?',
      message: 'Action cannot be undone.',
      confirmText: 'Yes Delete',
      danger: true
    });

    const card = document.querySelector('.forge-modal-card');
    assert.ok(card);
    assert.ok(card.innerHTML.includes('Delete Team?'));

    const confirmBtn = document.querySelector('.modal-confirm-btn');
    confirmBtn.click();

    const result = await dialogPromise;
    assert.equal(result, true);
  });

  await t.test('6. Badge Component - HTML Output Generation', () => {
    const badgeHtml = renderBadge({ text: 'Active Task', variant: 'success', icon: 'check' });
    assert.ok(badgeHtml.includes('forge-badge-success'));
    assert.ok(badgeHtml.includes('Active Task'));
    assert.ok(badgeHtml.includes('check'));
  });

  await t.test('7. Avatar Component - Initials Calculation & Status Indicator', () => {
    const avatarHtml = renderAvatar({ name: 'Aaron Dev', status: 'online', size: 'lg' });
    assert.ok(avatarHtml.includes('AD'));
    assert.ok(avatarHtml.includes('forge-avatar-lg'));
    assert.ok(avatarHtml.includes('forge-avatar-status-online'));
  });

  await t.test('8. Avatar Group Component - Overflow Counter Rendering', () => {
    const users = [
      { name: 'User 1' }, { name: 'User 2' }, { name: 'User 3' },
      { name: 'User 4' }, { name: 'User 5' }, { name: 'User 6' }
    ];

    const groupHtml = renderAvatarGroup({ users, max: 4 });
    assert.ok(groupHtml.includes('forge-avatar-group'));
    assert.ok(groupHtml.includes('+2'));
  });

  await t.test('9. Activity Feed Component - Structure Rendering', () => {
    const feedHtml = renderActivityFeed({ containerId: 'testFeed', title: 'Test Activity Log', isGlobal: true });
    assert.ok(feedHtml.includes('testFeed'));
    assert.ok(feedHtml.includes('Test Activity Log'));
    assert.ok(feedHtml.includes('testFeed_filterType'));
    assert.ok(feedHtml.includes('testFeed_filterUser'));
    assert.ok(feedHtml.includes('testFeed_timeline'));
  });

  await t.test('10. Empty State Component - HTML Output & Action Button', () => {
    const emptyHtml = renderEmptyState({
      icon: 'folder_off',
      title: 'No Tasks Found',
      description: 'Create your first task now',
      actionText: 'Create Task',
      actionId: 'btnCreateTask'
    });

    assert.ok(emptyHtml.includes('folder_off'));
    assert.ok(emptyHtml.includes('No Tasks Found'));
    assert.ok(emptyHtml.includes('id="btnCreateTask"'));
  });

  await t.test('11. Tabs Component - Rendering & Tab Switch Events', () => {
    const tabsHtml = renderTabs({
      id: 'myTabBar',
      tabs: [
        { id: 'tab1', label: 'Tab 1', count: 5 },
        { id: 'tab2', label: 'Tab 2', count: 0 }
      ],
      activeTabId: 'tab1'
    });

    document.body.innerHTML = tabsHtml;
    let switchedTab = null;

    attachTabsEvents('myTabBar', (newTabId) => {
      switchedTab = newTabId;
    });

    const tab2Btn = document.querySelector('[data-tab-id="tab2"]');
    assert.ok(tab2Btn);

    tab2Btn.click();
    assert.equal(switchedTab, 'tab2');
    assert.ok(tab2Btn.classList.contains('active'));
  });

  await t.test('12. Spinner & Skeleton Component - DOM Rendering', () => {
    const spinnerHtml = renderSpinner('lg');
    assert.ok(spinnerHtml.includes('forge-spinner-lg'));

    const textSkeleton = renderSkeleton('text', { width: '50%' });
    assert.ok(textSkeleton.includes('width: 50%'));

    const cardSkeleton = renderSkeleton('card');
    assert.ok(cardSkeleton.includes('glass-card'));
  });
});
