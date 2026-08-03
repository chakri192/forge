// Interactive Component Library & Notification Engine Test View
import {
  showToast,
  renderSpinner,
  renderSkeleton,
  renderEmptyState,
  renderDropdown,
  attachDropdownEvents,
  renderTabs,
  attachTabsEvents,
  renderDataTable,
  attachDataTableEvents,
  renderBadge,
  renderAvatar,
  renderAvatarGroup,
  renderDateTimePicker,
  attachDateTimePickerEvents,
  renderRichTextEditor,
  attachRichTextEditorEvents,
  renderFileUpload,
  attachFileUploadEvents,
  showConfirmDialog,
  initTooltips
} from '../components/index.js';
import { triggerTestNotification, markAllNotificationsAsRead } from '../services/api.js';
import { refreshUnreadCount } from '../components/notificationBell.js';

let currentTablePage = 1;
let currentSortKey = 'name';
let currentSortDir = 'asc';

const sampleTableData = [
  { id: '1', name: 'Alpha Component', category: 'UI Core', status: 'Active', points: 150 },
  { id: '2', name: 'Beta Toast Engine', category: 'Feedback', status: 'Active', points: 300 },
  { id: '3', name: 'Gamma Data Grid', category: 'Data', status: 'Pending', points: 450 },
  { id: '4', name: 'Delta File Drop', category: 'Forms', status: 'Active', points: 200 },
  { id: '5', name: 'Epsilon Modal', category: 'Overlays', status: 'Draft', points: 120 },
  { id: '6', name: 'Zeta Rich Text', category: 'Editors', status: 'Active', points: 500 },
  { id: '7', name: 'Eta Skeleton', category: 'Feedback', status: 'Active', points: 80 }
];

export function renderComponentsTestView(state) {
  return `
    <div class="space-y-8 animate-fadeIn">
      <!-- Page Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-black text-white uppercase tracking-wider">UI Component Showcase</h1>
            ${renderBadge({ text: 'v0.5 Component Suite', variant: 'info' })}
          </div>
          <p class="text-xs text-outline mt-1">Interactive sandbox for testing standard vanilla JS SPA components and Notification Engine integration.</p>
        </div>
        <div class="flex items-center gap-3">
          <button id="testThemeToggleBtn" class="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all flex items-center gap-2" data-tooltip="Toggle Light/Dark Theme" data-tooltip-pos="left">
            <span class="material-symbols-outlined text-base">contrast</span>
            <span>Toggle Theme</span>
          </button>
        </div>
      </div>

      <!-- Grid Layout for Components -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        <!-- 1. Toast Notifications & Notification Engine Triggers -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center gap-2 border-b border-white/10 pb-3">
            <span class="material-symbols-outlined text-royal-slate-blue text-xl">notifications_active</span>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider">1. Notifications & Toasts</h2>
          </div>
          <p class="text-xs text-outline">Test toast alerts and backend Notification Engine polling.</p>
          
          <div class="grid grid-cols-2 gap-2">
            <button id="btnToastSuccess" class="px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition-all">Success Toast</button>
            <button id="btnToastError" class="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition-all">Error Toast</button>
            <button id="btnToastWarning" class="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold transition-all">Warning Toast</button>
            <button id="btnToastInfo" class="px-3 py-2 bg-royal-slate-blue/20 hover:bg-royal-slate-blue/30 text-royal-slate-blue border border-royal-slate-blue/30 rounded-xl text-xs font-semibold transition-all">Info Toast</button>
          </div>

          <div class="pt-3 border-t border-white/10 space-y-2">
            <h4 class="text-xs font-bold text-white">Backend Notification Engine API Trigger</h4>
            <div class="flex items-center gap-2">
              <button id="btnBackendNotif" class="px-4 py-2 bg-royal-slate-blue hover:opacity-90 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2">
                <span class="material-symbols-outlined text-sm">send</span>
                <span>Insert Backend Notification</span>
              </button>
              <button id="btnBackendMarkAll" class="px-3 py-2 bg-white/5 hover:bg-white/10 text-outline hover:text-white font-semibold text-xs rounded-xl border border-white/10 transition-all">
                Mark All Read
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Badges & Avatars -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center gap-2 border-b border-white/10 pb-3">
            <span class="material-symbols-outlined text-royal-slate-blue text-xl">badge</span>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider">2. Badges & Avatars</h2>
          </div>
          
          <div class="space-y-3">
            <h4 class="text-xs font-bold text-white">Status Badges</h4>
            <div class="flex flex-wrap items-center gap-2">
              ${renderBadge({ text: 'Completed', variant: 'success', icon: 'check_circle' })}
              ${renderBadge({ text: 'Critical Bug', variant: 'error', icon: 'error' })}
              ${renderBadge({ text: 'In Review', variant: 'warning', icon: 'schedule' })}
              ${renderBadge({ text: 'Architecture', variant: 'info', icon: 'label' })}
            </div>

            <h4 class="text-xs font-bold text-white pt-2">User Avatars & Groups</h4>
            <div class="flex items-center gap-4">
              ${renderAvatar({ name: 'Aaron Dev', size: 'sm', status: 'online' })}
              ${renderAvatar({ name: 'Sarah Tech', size: 'md', status: 'away' })}
              ${renderAvatar({ name: 'Marcus Lead', size: 'lg', status: 'offline' })}
              <div class="pl-4 border-l border-white/10">
                ${renderAvatarGroup({
                  users: [
                    { name: 'Alice Smith' },
                    { name: 'Bob Jones' },
                    { name: 'Charlie Ray' },
                    { name: 'Diana Prince' },
                    { name: 'Eve Adams' }
                  ],
                  max: 3
                })}
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Dropdown Menus & Tab Bars -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center gap-2 border-b border-white/10 pb-3">
            <span class="material-symbols-outlined text-royal-slate-blue text-xl">tab</span>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider">3. Dropdown & Tabs</h2>
          </div>

          <div class="space-y-4">
            <div>
              <h4 class="text-xs font-bold text-white mb-2">Dropdown Component</h4>
              ${renderDropdown({
                id: 'demoDropdown',
                triggerText: 'Select Filter Action',
                items: [
                  { label: 'Filter by High Priority', value: 'high_priority', icon: 'flag' },
                  { label: 'Sort by Date Created', value: 'sort_date', icon: 'sort' },
                  { label: 'Export Report', value: 'export', icon: 'download' }
                ]
              })}
            </div>

            <div>
              <h4 class="text-xs font-bold text-white mb-2">Tab Bar Component</h4>
              ${renderTabs({
                id: 'demoTabs',
                tabs: [
                  { id: 'tab1', label: 'All Tasks', icon: 'list', count: 12 },
                  { id: 'tab2', label: 'Assigned', icon: 'person', count: 4 },
                  { id: 'tab3', label: 'Completed', icon: 'check', count: 8 }
                ],
                activeTabId: 'tab1'
              })}
            </div>
          </div>
        </div>

        <!-- 4. Modals & Confirmation Dialogs -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center gap-2 border-b border-white/10 pb-3">
            <span class="material-symbols-outlined text-royal-slate-blue text-xl">web_asset</span>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider">4. Confirmation Modal & Tooltips</h2>
          </div>
          <p class="text-xs text-outline">Test focus-trapped dialogs and declarative tooltip hover bubbles.</p>

          <div class="flex flex-wrap items-center gap-3">
            <button id="btnOpenStandardModal" class="px-4 py-2 bg-royal-slate-blue hover:opacity-90 text-white font-bold text-xs rounded-xl transition-all shadow-md">
              Standard Dialog
            </button>
            <button id="btnOpenDangerModal" class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition-all">
              Destructive Prompt
            </button>
            <span class="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white cursor-help" data-tooltip="This tooltip appears automatically!" data-tooltip-pos="top">
              Hover for Tooltip (Top)
            </span>
          </div>
        </div>

        <!-- 5. Spinners & Skeleton Loaders -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center gap-2 border-b border-white/10 pb-3">
            <span class="material-symbols-outlined text-royal-slate-blue text-xl">autorenew</span>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider">5. Spinners & Skeleton Screens</h2>
          </div>
          
          <div class="flex items-center gap-6">
            <div class="flex items-center gap-2">
              ${renderSpinner('sm')} <span class="text-xs text-outline">Small</span>
            </div>
            <div class="flex items-center gap-2">
              ${renderSpinner('md')} <span class="text-xs text-outline">Medium</span>
            </div>
            <div class="flex items-center gap-2">
              ${renderSpinner('lg')} <span class="text-xs text-outline">Large</span>
            </div>
          </div>

          <div class="pt-2">
            <h4 class="text-xs font-bold text-white mb-2">Skeleton Screen Component</h4>
            ${renderSkeleton('card')}
          </div>
        </div>

        <!-- 6. Empty State Component -->
        <div class="glass-card p-6 space-y-4">
          <div class="flex items-center gap-2 border-b border-white/10 pb-3">
            <span class="material-symbols-outlined text-royal-slate-blue text-xl">block</span>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider">6. Empty State Component</h2>
          </div>
          ${renderEmptyState({
            icon: 'folder_off',
            title: 'No Documents Uploaded',
            description: 'Get started by creating a new document or importing existing files.',
            actionText: 'Create Document',
            actionId: 'btnEmptyStateAction'
          })}
        </div>

        <!-- 7. Date/Time Picker & Rich Text Editor -->
        <div class="glass-card p-6 space-y-4 md:col-span-2">
          <div class="flex items-center gap-2 border-b border-white/10 pb-3">
            <span class="material-symbols-outlined text-royal-slate-blue text-xl">edit_note</span>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider">7. Date Picker & Rich Text Editor</h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-1">
              ${renderDateTimePicker({
                id: 'demoDatePicker',
                label: 'Task Due Date & Time',
                value: '2026-08-05T14:30'
              })}
            </div>
            <div class="md:col-span-2">
              ${renderRichTextEditor({
                id: 'demoRichTextEditor',
                label: 'Task Specification Notes',
                value: '<p>Standardize <b>UI components</b> across all views with glassmorphism theme support.</p>'
              })}
            </div>
          </div>
        </div>

        <!-- 8. File Upload Component -->
        <div class="glass-card p-6 space-y-4 md:col-span-2">
          <div class="flex items-center gap-2 border-b border-white/10 pb-3">
            <span class="material-symbols-outlined text-royal-slate-blue text-xl">cloud_upload</span>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider">8. Drag & Drop File Upload</h2>
          </div>
          ${renderFileUpload({
            id: 'demoFileUpload',
            label: 'Attach Submission Assets',
            accept: 'image/*,.pdf,.zip'
          })}
        </div>

        <!-- 9. Data Table with Sorting & Pagination -->
        <div class="glass-card p-6 space-y-4 md:col-span-2">
          <div class="flex items-center gap-2 border-b border-white/10 pb-3">
            <span class="material-symbols-outlined text-royal-slate-blue text-xl">table_chart</span>
            <h2 class="text-sm font-bold text-white uppercase tracking-wider">9. Data Table Component</h2>
          </div>
          
          <div id="demoDataTableContainer">
            ${renderTableHtml()}
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderTableHtml() {
  return renderDataTable({
    id: 'demoDataTable',
    columns: [
      { key: 'name', label: 'Component Name', sortable: true },
      { key: 'category', label: 'Category', sortable: true },
      { key: 'status', label: 'Status', sortable: true, render: (val) => renderBadge({ text: val, variant: val === 'Active' ? 'success' : 'warning' }) },
      { key: 'points', label: 'Weight (XP)', sortable: true, render: (val) => `<strong class="text-white">${val} XP</strong>` }
    ],
    data: sampleTableData,
    pageSize: 3,
    currentPage: currentTablePage,
    sortKey: currentSortKey,
    sortDir: currentSortDir
  });
}

export function attachComponentsTestEvents(state, reloadDataFn) {
  initTooltips();

  // Toast events
  document.getElementById('btnToastSuccess')?.addEventListener('click', () => showToast({ title: 'Operation Successful', message: 'The component state has been persisted.', type: 'success' }));
  document.getElementById('btnToastError')?.addEventListener('click', () => showToast({ title: 'Validation Failed', message: 'Unable to process the request.', type: 'error' }));
  document.getElementById('btnToastWarning')?.addEventListener('click', () => showToast({ title: 'Storage Limit Warning', message: 'You are approaching capacity limits.', type: 'warning' }));
  document.getElementById('btnToastInfo')?.addEventListener('click', () => showToast({ title: 'System Notice', message: 'New update version v0.5 available.', type: 'info' }));

  // Backend notification triggers
  document.getElementById('btnBackendNotif')?.addEventListener('click', async () => {
    try {
      await triggerTestNotification('Task Assigned', 'You have been assigned to standardise the UI component library.', 'ASSIGNMENT');
      showToast({ title: 'Notification Inserted', message: 'Check notification bell icon in top header.', type: 'success' });
      refreshUnreadCount();
    } catch (e) {
      showToast({ title: 'Error', message: e.message, type: 'error' });
    }
  });

  document.getElementById('btnBackendMarkAll')?.addEventListener('click', async () => {
    try {
      await markAllNotificationsAsRead();
      showToast({ title: 'Marked All Read', message: 'Unread badge updated.', type: 'info' });
      refreshUnreadCount();
    } catch (e) {
      showToast({ title: 'Error', message: e.message, type: 'error' });
    }
  });

  // Theme Toggle
  document.getElementById('testThemeToggleBtn')?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      showToast({ title: 'Light Theme Activated', type: 'info' });
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      showToast({ title: 'Dark Theme Activated', type: 'info' });
    }
  });

  // Modal Dialog events
  document.getElementById('btnOpenStandardModal')?.addEventListener('click', async () => {
    const confirmed = await showConfirmDialog({
      title: 'Save Changes?',
      message: 'Are you sure you want to apply these component settings?'
    });
    showToast({ title: 'Dialog Result', message: `User chose: ${confirmed ? 'Confirmed' : 'Cancelled'}`, type: confirmed ? 'success' : 'info' });
  });

  document.getElementById('btnOpenDangerModal')?.addEventListener('click', async () => {
    const confirmed = await showConfirmDialog({
      title: 'Delete Component Item?',
      message: 'This will permanently remove the component item from the database.',
      confirmText: 'Delete Permanently',
      danger: true
    });
    showToast({ title: 'Dialog Result', message: `User chose: ${confirmed ? 'Confirmed Delete' : 'Cancelled'}`, type: confirmed ? 'error' : 'info' });
  });

  // Attach interactive sub-component listeners
  attachDropdownEvents('demoDropdown', (val) => {
    showToast({ title: 'Dropdown Selected', message: `Value: ${val}`, type: 'info' });
  });

  attachTabsEvents('demoTabs', (tabId) => {
    showToast({ title: 'Tab Switched', message: `Active Tab: ${tabId}`, type: 'info' });
  });

  attachDateTimePickerEvents('demoDatePicker', (val) => {
    showToast({ title: 'Date Selected', message: `Selected: ${val}`, type: 'info' });
  });

  attachRichTextEditorEvents('demoRichTextEditor', (content) => {
    console.log('Rich text content updated:', content);
  });

  attachFileUploadEvents('demoFileUpload', (files) => {
    showToast({ title: 'Files Received', message: `${files.length} file(s) ready for upload.`, type: 'success' });
  });

  document.getElementById('btnEmptyStateAction')?.addEventListener('click', () => {
    showToast({ title: 'Action Triggered', message: 'Empty state button clicked.', type: 'success' });
  });

  // Attach Table Events
  const attachTable = () => {
    attachDataTableEvents('demoDataTable', {
      onSort: (key) => {
        if (currentSortKey === key) {
          currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          currentSortKey = key;
          currentSortDir = 'asc';
        }
        updateTableContainer();
      },
      onPageChange: (action) => {
        if (action === 'prev') currentTablePage--;
        if (action === 'next') currentTablePage++;
        updateTableContainer();
      }
    });
  };

  const updateTableContainer = () => {
    const container = document.getElementById('demoDataTableContainer');
    if (container) {
      container.innerHTML = renderTableHtml();
      attachTable();
    }
  };

  attachTable();
}
