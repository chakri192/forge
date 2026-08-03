import { loginUser } from '../services/api.js';
import { store } from '../state/store.js';

export function renderLoginView(state) {
  return `
    <div class="max-w-md mx-auto py-8 px-4">
      <div class="glass-card p-8 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
        <!-- Background Ambient Accent Glow -->
        <div class="absolute -top-24 -left-24 w-64 h-64 bg-royal-slate-blue/20 rounded-full blur-3xl pointer-events-none"></div>

        <div class="flex flex-col items-center text-center mb-6 space-y-2">
          <img src="/assets/logo/FULL.png" alt="FORGE Logo" class="h-12 w-auto object-contain mb-1" />
          <h2 class="text-xl font-extrabold text-white tracking-tight">Sign In to <span class="text-royal-slate-blue accent-target">FORGE</span></h2>
          <p class="text-xs text-outline">Access your assigned tasks, team rosters, and challenges</p>
        </div>

        <!-- Quick Dev Account Shortcut Banner -->
        <div class="mb-6 p-3 rounded-xl bg-royal-slate-blue/15 border border-royal-slate-blue/30 text-xs flex items-center justify-between gap-2">
          <div class="text-left">
            <span class="font-bold text-white block">Aaron (Dev / Owner)</span>
            <span class="text-[10px] text-ice-blue">Pre-seeded developer profile</span>
          </div>
          <button id="btnQuickDevLogin" class="px-3 py-1.5 bg-royal-slate-blue hover:bg-royal-slate-blue/80 text-white font-bold text-xs rounded-lg transition-all shadow">
            Quick Login
          </button>
        </div>

        <form id="loginForm" class="space-y-4">
          <div id="loginAlert" class="hidden p-3 rounded-xl text-xs font-semibold"></div>

          <div>
            <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Username or Email</label>
            <input type="text" id="loginIdentifier" required placeholder="e.g. aaron_dev or user@forge.local" 
              class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none transition-all" />
          </div>

          <div>
            <label class="block text-xs font-bold text-ice-blue uppercase tracking-wider mb-1">Password</label>
            <input type="password" id="loginPassword" required placeholder="••••••••" 
              class="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-royal-slate-blue focus:outline-none transition-all" />
          </div>

          <button type="submit" id="loginSubmitBtn" class="w-full py-3 mt-2 bg-gradient-to-r from-royal-slate-blue to-ice-blue/80 hover:from-royal-slate-blue hover:to-royal-slate-blue text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 group cursor-pointer">
            <span>Sign In</span>
            <span class="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        </form>

        <div class="mt-6 pt-4 border-t border-white/10 text-center text-xs text-outline">
          <span>Don't have an account?</span>
          <button class="nav-drawer-item text-royal-slate-blue hover:underline font-bold ml-1 accent-target" data-tab="signup">
            Create Account →
          </button>
        </div>
      </div>
    </div>
  `;
}

export function attachLoginEvents(state, reloadDataCallback) {
  const form = document.getElementById('loginForm');
  const quickDevBtn = document.getElementById('btnQuickDevLogin');

  if (quickDevBtn) {
    quickDevBtn.addEventListener('click', async () => {
      try {
        const res = await loginUser('aaron_dev', 'devpass123');
        if (res && res.user) {
          if (res.token) localStorage.setItem('forge_jwt_token', res.token);
          localStorage.setItem('forge_user_session', JSON.stringify(res.user));
          store.setState({ currentUser: res.user, activeTab: 'dashboard' });
          if (reloadDataCallback) reloadDataCallback();
        }
      } catch (err) {
        console.error('Quick dev login failed:', err);
      }
    });
  }

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('loginAlert');
    const submitBtn = document.getElementById('loginSubmitBtn');

    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="material-symbols-outlined animate-spin text-sm">progress_activity</span>
        <span>Signing In...</span>
      `;

      const res = await loginUser(identifier, password);
      if (res && res.user) {
        if (res.token) localStorage.setItem('forge_jwt_token', res.token);
        localStorage.setItem('forge_user_session', JSON.stringify(res.user));
        store.setState({ currentUser: res.user, activeTab: 'dashboard' });
        if (reloadDataCallback) reloadDataCallback();
      }
    } catch (err) {
      if (alertEl) {
        alertEl.classList.remove('hidden');
        alertEl.classList.add('bg-red-500/20', 'text-red-300', 'border', 'border-red-500/30');
        alertEl.textContent = err.message || 'Invalid credentials';
      }
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Sign In</span>
        <span class="material-symbols-outlined text-sm">arrow_forward</span>
      `;
    }
  });
}
