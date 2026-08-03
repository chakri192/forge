import { registerUser, fetchDevSettings } from '../services/api.js';
import { store } from '../state/store.js';

export function renderSignUpView(state) {
  return `
    <div class="max-w-xl mx-auto py-6 px-4">
      <div class="glass-card p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
        <!-- Background Ambient Accent Glow -->
        <div class="absolute -top-24 -right-24 w-64 h-64 bg-royal-slate-blue/20 rounded-full blur-3xl pointer-events-none"></div>

        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 rounded-xl bg-royal-slate-blue/20 border border-royal-slate-blue/40 flex items-center justify-center text-royal-slate-blue shadow-lg accent-target">
            <span class="material-symbols-outlined text-2xl">person_add</span>
          </div>
          <div>
            <h2 class="text-2xl font-black tracking-tight text-white uppercase">Join <span class="text-royal-slate-blue accent-target">FORGE</span></h2>
            <p class="text-xs text-outline">Create your operative account to access tasks, teams, & challenges</p>
          </div>
        </div>

        <div id="signUpClosedNotice" class="hidden p-4 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold mb-4 space-y-1">
          <div class="flex items-center gap-2 text-sm font-bold text-red-200">
            <span class="material-symbols-outlined">lock</span> Registrations Currently Closed
          </div>
          <p id="signUpClosedReason">New sign-ups have been paused by the administrator or maximum community user capacity has been reached.</p>
        </div>

        <form id="signUpForm" class="space-y-4">
          <div id="signUpAlert" class="hidden p-3 rounded-xl text-xs font-semibold"></div>

          <div>
            <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Full Name</label>
            <input type="text" id="signUpName" required placeholder="e.g. John Smith" 
              class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none transition-all" />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Username</label>
              <input type="text" id="signUpUsername" required placeholder="e.g. john_smith" 
                class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none transition-all" />
            </div>
            <div>
              <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Email Address</label>
              <input type="email" id="signUpEmail" required placeholder="john@forge.local" 
                class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none transition-all" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Password</label>
            <input type="password" id="signUpPassword" required placeholder="••••••••" 
              class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none transition-all" />
          </div>

          <button type="submit" id="signUpSubmitBtn" class="w-full py-3 mt-4 bg-gradient-to-r from-royal-slate-blue to-ice-blue/80 hover:from-royal-slate-blue hover:to-royal-slate-blue text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer">
            <span>Complete Registration</span>
            <span class="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        </form>

        <div class="mt-6 pt-4 border-t border-white/10 text-center text-xs text-outline">
          <span>Already have an account?</span>
          <button class="nav-drawer-item text-royal-slate-blue hover:underline font-bold ml-1 accent-target" data-tab="login">
            Sign In →
          </button>
        </div>
      </div>
    </div>
  `;
}

export function attachSignUpEvents(state, reloadDataCallback) {
  const form = document.getElementById('signUpForm');
  const closedNotice = document.getElementById('signUpClosedNotice');
  const closedReason = document.getElementById('signUpClosedReason');
  const submitBtn = document.getElementById('signUpSubmitBtn');

  // Check system settings for sign-up status
  fetchDevSettings().then(settings => {
    if (settings && (!settings.signup_enabled || settings.total_users >= settings.max_capacity)) {
      if (closedNotice) closedNotice.classList.remove('hidden');
      if (closedReason) {
        if (!settings.signup_enabled) {
          closedReason.textContent = 'Sign-ups are currently disabled by the administrator.';
        } else if (settings.total_users >= settings.max_capacity) {
          closedReason.textContent = `Community user capacity limit (${settings.max_capacity} members) has been reached.`;
        }
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
  }).catch(() => {});

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('signUpAlert');

    const name = document.getElementById('signUpName').value.trim();
    const username = document.getElementById('signUpUsername').value.trim();
    const email = document.getElementById('signUpEmail').value.trim();
    const password = document.getElementById('signUpPassword').value;

    if (!name || !username || !email || !password) {
      showAlert(alertEl, 'Please fill in all required fields.', true);
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="material-symbols-outlined animate-spin text-sm">progress_activity</span>
        <span>Registering...</span>
      `;

      const res = await registerUser({ name, username, email, password, role: 'member' });

      if (res && res.user) {
        if (res.token) localStorage.setItem('forge_jwt_token', res.token);
        localStorage.setItem('forge_user_session', JSON.stringify(res.user));
        showAlert(alertEl, 'Registration successful! Directing to Dashboard...', false);
        setTimeout(() => {
          store.setState({ currentUser: res.user, activeTab: 'dashboard' });
          if (reloadDataCallback) reloadDataCallback();
        }, 800);
      }
    } catch (err) {
      showAlert(alertEl, err.message || 'Failed to register', true);
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Complete Registration</span>
        <span class="material-symbols-outlined text-sm">arrow_forward</span>
      `;
    }
  });
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
