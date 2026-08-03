import { updateUserProfile, changePassword } from '../services/api.js';
import { store } from '../state/store.js';
import { renderActivityFeed, attachActivityFeedEvents } from '../components/activityFeed.js';

export function renderSettingsView(state) {
  const user = state.currentUser || {};

  return `
    <div class="max-w-2xl mx-auto space-y-8">
      <!-- Header -->
      <div class="flex items-center gap-3 pb-4 border-b border-white/10">
        <div class="w-12 h-12 rounded-xl bg-royal-slate-blue/20 border border-royal-slate-blue/40 flex items-center justify-center text-royal-slate-blue accent-target">
          <span class="material-symbols-outlined text-2xl">settings</span>
        </div>
        <div>
          <h1 class="text-2xl font-black text-white uppercase tracking-tight">Account Settings</h1>
          <p class="text-xs text-outline">Manage your profile bio, skills, and security settings</p>
        </div>
      </div>

      <!-- Settings Form Card -->
      <div class="glass-card p-8 rounded-2xl border border-white/10 shadow-2xl space-y-6">
        <form id="settingsForm" class="space-y-4">
          <div id="settingsAlert" class="hidden p-3 rounded-xl text-xs font-semibold"></div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Full Name</label>
              <input type="text" id="settingsName" value="${user.name || ''}" required
                class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:border-royal-slate-blue focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Username</label>
              <input type="text" id="settingsUsername" value="${user.username || ''}" required readonly
                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-outline cursor-not-allowed" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Specialty Tag / Skills</label>
            <input type="text" id="settingsSkills" value="${user.skills || user.tag || ''}" placeholder="e.g. Frontend Architect, UI/UX, Data Pipelines" 
              class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none" />
          </div>

          <div>
            <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Bio / Profile Description</label>
            <textarea id="settingsBio" rows="3" placeholder="Tell the cohort about yourself and your technical goals..." 
              class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none">${user.bio || ''}</textarea>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">GitHub Profile URL</label>
              <input type="url" id="settingsGithub" value="${user.github_url || ''}" placeholder="https://github.com/username" 
                class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Portfolio / Personal Link</label>
              <input type="url" id="settingsPortfolio" value="${user.portfolio_url || ''}" placeholder="https://yourportfolio.dev" 
                class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none" />
            </div>
          </div>

          <button type="submit" id="btnSaveSettings" class="py-3 px-6 bg-gradient-to-r from-royal-slate-blue to-ice-blue/80 hover:from-royal-slate-blue hover:to-royal-slate-blue text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer text-xs">
            <span class="material-symbols-outlined text-sm">save</span>
            <span>Save Profile Settings</span>
          </button>
        </form>
      </div>

      <!-- Password Change Card -->
      <div class="glass-card p-8 rounded-2xl border border-white/10 shadow-2xl space-y-6">
        <div class="flex items-center gap-3 border-b border-white/10 pb-4">
          <span class="material-symbols-outlined text-xl text-royal-slate-blue accent-target">lock</span>
          <h2 class="text-lg font-bold text-white uppercase tracking-tight">Security & Password</h2>
        </div>
        <form id="changePasswordForm" class="space-y-4">
          <div id="changePasswordAlert" class="hidden p-3 rounded-xl text-xs font-semibold"></div>

          <div>
            <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Current Password</label>
            <input type="password" id="currentPassword" required placeholder="••••••••" 
              class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:border-royal-slate-blue focus:outline-none" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">New Password</label>
              <input type="password" id="newPassword" required placeholder="••••••••" 
                class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:border-royal-slate-blue focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Confirm New Password</label>
              <input type="password" id="confirmPassword" required placeholder="••••••••" 
                class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:border-royal-slate-blue focus:outline-none" />
            </div>
          </div>

          <button type="submit" id="btnChangePassword" class="py-3 px-6 bg-gradient-to-r from-royal-slate-blue to-ice-blue/80 hover:from-royal-slate-blue hover:to-royal-slate-blue text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer text-xs">
            <span class="material-symbols-outlined text-sm">key</span>
            <span>Update Password</span>
          </button>
        </form>
      </div>

      <!-- User Personal Activity History -->
      ${user.id ? renderActivityFeed({ containerId: 'userActivityFeed', title: 'My Activity History', isGlobal: false, userId: user.id }) : ''}
    </div>
  `;
}

export function attachSettingsEvents(state, reloadDataCallback) {
  if (state.currentUser && state.currentUser.id) {
    attachActivityFeedEvents({ containerId: 'userActivityFeed', isGlobal: false, userId: state.currentUser.id });
  }

  const form = document.getElementById('settingsForm');
  const passwordForm = document.getElementById('changePasswordForm');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertEl = document.getElementById('settingsAlert');
      const user = state.currentUser;
      if (!user) return;

      const name = document.getElementById('settingsName').value.trim();
      const skills = document.getElementById('settingsSkills').value.trim();
      const bio = document.getElementById('settingsBio').value.trim();
      const github_url = document.getElementById('settingsGithub').value.trim();
      const portfolio_url = document.getElementById('settingsPortfolio').value.trim();

      try {
        const res = await updateUserProfile(user.id, { name, tag: skills, skills, bio, github_url, portfolio_url });
        if (res && res.user) {
          localStorage.setItem('forge_user_session', JSON.stringify(res.user));
          store.setState({ currentUser: res.user });
          showAlert(alertEl, 'Profile settings saved successfully!', false);
          if (reloadDataCallback) reloadDataCallback();
        }
      } catch (err) {
        showAlert(alertEl, err.message || 'Failed to save settings', true);
      }
    });
  }

  if (passwordForm) {
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertEl = document.getElementById('changePasswordAlert');
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (newPassword !== confirmPassword) {
        showAlert(alertEl, 'New passwords do not match', true);
        return;
      }

      try {
        await changePassword(currentPassword, newPassword);
        showAlert(alertEl, 'Password updated successfully!', false);
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
      } catch (err) {
        showAlert(alertEl, err.message || 'Failed to change password', true);
      }
    });
  }
}

function showAlert(el, msg, isError) {
  if (!el) return;
  el.classList.remove('hidden', 'bg-red-500/20', 'text-red-300', 'border-red-500/30', 'bg-emerald-500/20', 'text-emerald-300', 'border-emerald-500/30');
  if (isError) {
    el.classList.add('bg-red-500/20', 'text-red-300', 'border', 'border-red-500/30');
  } else {
    el.classList.add('bg-emerald-500/20', 'text-emerald-300', 'border', 'border-emerald-500/30');
  }
  el.textContent = msg;
}
