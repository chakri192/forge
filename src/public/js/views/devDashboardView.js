import { fetchDevSettings, updateDevSettings, fetchAllUsers, updateUserProfile, deleteUser } from '../services/api.js';
import { renderActivityFeed, attachActivityFeedEvents } from '../components/activityFeed.js';

export function renderDevDashboardView(state) {
  return `
    <div class="space-y-8 max-w-6xl mx-auto">
      <!-- Header Banner -->
      <div class="glass-card p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase bg-purple-500/20 text-purple-400 border border-purple-500/40">
                Dev Stealth Privileges
              </span>
            </div>
            <h1 class="text-3xl font-black text-white uppercase tracking-tight mt-1">Developer Command Center</h1>
            <p class="text-xs text-outline mt-0.5">Control public sign-up registration status, capacity limits, and member accounts.</p>
          </div>

          <span class="text-xs font-bold px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-ice-blue">
            Admin Account: Aaron (Dev / Owner)
          </span>
        </div>
      </div>

      <!-- Controls Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Sign Up Status & Capacity Control -->
        <div class="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <h2 class="text-base font-bold text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-royal-slate-blue accent-target">how_to_reg</span>
              Sign-Up Registration Controls
            </h2>
            <span id="devStatusBadge" class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Loading...
            </span>
          </div>

          <div class="space-y-4">
            <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
              <div>
                <span class="text-xs font-bold text-white block">Enable Public Sign-Ups</span>
                <span class="text-[10px] text-outline">Allow new users to create accounts</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="devToggleSignup" class="sr-only peer" />
                <div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-royal-slate-blue"></div>
              </label>
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider">Max Community User Capacity</label>
              <div class="flex gap-2">
                <input type="number" id="devMaxCapacity" min="1" max="1000" class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2 text-sm text-white focus:border-royal-slate-blue focus:outline-none" />
                <button id="btnSaveCapacity" class="px-4 py-2 bg-royal-slate-blue hover:bg-royal-slate-blue/80 text-white font-bold text-xs rounded-xl shadow transition-all whitespace-nowrap">
                  Save Cap
                </button>
              </div>
            </div>

            <div class="text-xs text-outline pt-2 flex justify-between">
              <span>Current Registered Users: <strong id="devUserCount" class="text-white">0</strong></span>
              <span>Capacity Cap: <strong id="devCapDisplay" class="text-white">50</strong></span>
            </div>
          </div>
        </div>

        <!-- Quick System Status -->
        <div class="glass-card p-6 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
          <div>
            <h2 class="text-base font-bold text-white flex items-center gap-2 pb-3 border-b border-white/10">
              <span class="material-symbols-outlined text-purple-400">shield</span>
              System Security & Role Integrity
            </h2>
            <p class="text-xs text-outline mt-3 leading-relaxed">
              Your account <strong>Aaron (Dev / Owner)</strong> holds absolute owner privileges (`DEV_STEALTH`). It cannot be deleted or modified by any public API endpoint. You hold full authority over member role promotions and capacity locking.
            </p>
          </div>

          <div class="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200">
            🔒 Full System Control Active
          </div>
        </div>
      </div>

      <!-- Member Roster Management Table -->
      <div class="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
        <h2 class="text-base font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
          <span class="material-symbols-outlined text-royal-slate-blue accent-target">group</span>
          Member Roster & Role Management
        </h2>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-outline">
            <thead class="bg-white/5 text-white uppercase text-[10px] tracking-wider border-b border-white/10">
              <tr>
                <th class="p-3">User</th>
                <th class="p-3">Email</th>
                <th class="p-3">Role</th>
                <th class="p-3">Specialty Tag</th>
                <th class="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="devUsersTableBody" class="divide-y divide-white/5">
              <tr>
                <td colspan="5" class="p-4 text-center">Loading registered members...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Global Activity Audit Log Feed -->
      ${renderActivityFeed({ containerId: 'adminActivityFeed', title: 'Global Platform Activity Feed', isGlobal: true })}
    </div>
  `;
}

export function attachDevDashboardEvents(state, reloadDataCallback) {
  loadDevData();
  attachActivityFeedEvents({ containerId: 'adminActivityFeed', isGlobal: true });

  async function loadDevData() {
    try {
      const [settings, users] = await Promise.all([
        fetchDevSettings(),
        fetchAllUsers()
      ]);

      const toggle = document.getElementById('devToggleSignup');
      const capacityInput = document.getElementById('devMaxCapacity');
      const statusBadge = document.getElementById('devStatusBadge');
      const userCount = document.getElementById('devUserCount');
      const capDisplay = document.getElementById('devCapDisplay');

      if (toggle) toggle.checked = settings.signup_enabled;
      if (capacityInput) capacityInput.value = settings.max_capacity;
      if (userCount) userCount.textContent = settings.total_users;
      if (capDisplay) capDisplay.textContent = settings.max_capacity;

      if (statusBadge) {
        if (settings.signup_enabled && settings.total_users < settings.max_capacity) {
          statusBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
          statusBadge.textContent = 'Sign-Ups Active';
        } else {
          statusBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30';
          statusBadge.textContent = 'Sign-Ups Locked';
        }
      }

      // Render Users Table
      const tbody = document.getElementById('devUsersTableBody');
      if (tbody) {
        if (!users || users.length === 0) {
          tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">No other members registered yet.</td></tr>`;
          return;
        }

        tbody.innerHTML = users.map(u => `
          <tr class="hover:bg-white/5 transition-colors">
            <td class="p-3 font-bold text-white">
              ${u.name} <span class="text-[10px] text-outline font-normal">(@${u.username})</span>
            </td>
            <td class="p-3">${u.email}</td>
            <td class="p-3">
              <select class="dev-role-select bg-white/5 border border-white/15 rounded px-2 py-1 text-xs text-white cursor-pointer" data-id="${u.id}">
                <option value="member" ${u.role === 'member' || u.role === 'OPERATIVE' ? 'selected' : ''}>Member</option>
                <option value="leader" ${u.role === 'leader' || u.role === 'STUDENT_LEADER' ? 'selected' : ''}>Leader</option>
                <option value="teacher" ${u.role === 'teacher' || u.role === 'TEACHER' ? 'selected' : ''}>Teacher</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>

            </td>
            <td class="p-3">${u.tag || u.skills || 'Member'}</td>
            <td class="p-3 text-right">
              <button class="dev-btn-delete px-2.5 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-300 font-bold text-[11px] rounded border border-red-500/30 transition-all" data-id="${u.id}">
                Delete
              </button>
            </td>
          </tr>
        `).join('');

        // Attach Role Change Handlers
        tbody.querySelectorAll('.dev-role-select').forEach(sel => {
          sel.addEventListener('change', async (e) => {
            const uid = e.target.getAttribute('data-id');
            const newRole = e.target.value;
            try {
              await updateUserProfile(uid, { role: newRole });
              loadDevData();
            } catch (err) {
              console.error('Role update failed:', err);
            }
          });
        });

        // Attach Delete Handlers
        tbody.querySelectorAll('.dev-btn-delete').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const uid = e.target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this user account?')) {
              try {
                await deleteUser(uid);
                loadDevData();
                if (reloadDataCallback) reloadDataCallback();
              } catch (err) {
                console.error('Delete user failed:', err);
              }
            }
          });
        });
      }
    } catch (err) {
      console.error('Failed to load dev settings:', err);
    }
  }

  // Toggle Listener
  const toggle = document.getElementById('devToggleSignup');
  if (toggle) {
    toggle.addEventListener('change', async (e) => {
      try {
        await updateDevSettings({ signup_enabled: e.target.checked });
        loadDevData();
      } catch (err) {
        console.error('Failed to update toggle:', err);
      }
    });
  }

  // Save Capacity Listener
  const saveCapBtn = document.getElementById('btnSaveCapacity');
  if (saveCapBtn) {
    saveCapBtn.addEventListener('click', async () => {
      const input = document.getElementById('devMaxCapacity');
      const val = parseInt(input.value, 10);
      if (val && val > 0) {
        try {
          await updateDevSettings({ max_capacity: val });
          loadDevData();
        } catch (err) {
          console.error('Failed to update capacity:', err);
        }
      }
    });
  }
}
