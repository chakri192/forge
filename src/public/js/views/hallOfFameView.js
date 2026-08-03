// The Hall of Fame View Renderer (Marble & Granite Theme)
import { getIcon } from '../components/icons.js';
import { openModal } from '../components/modal.js';
import { awardTitle } from '../services/api.js';

export function renderHallOfFameView(state) {
  const { hallOfFameData, currentUser } = state;
  const allTime = hallOfFameData.allTime || [];
  const season1 = hallOfFameData.season1 || [];
  const titles = hallOfFameData.titles || [];
  const userRole = currentUser ? (currentUser.public_role || currentUser.role) : '';
  const isTeacherOrDev = ['TEACHER'].includes(userRole);

  return `
    <div class="hall-of-fame-wrapper">
      <div class="hall-header">
        <h2>
          ${getIcon('hall', 'svg-icon')} The Hall of Fame
        </h2>
        <p style="opacity:0.8; margin-top:0.4rem;">Honoring Academic Excellence, Coding Mastery & Community Titles</p>
        ${isTeacherOrDev ? `
          <div style="margin-top:1rem;">
            <button id="btnAwardTitle" class="btn btn-primary" style="font-size:0.85rem;">
              ${getIcon('award')} Award Title
            </button>
          </div>
        ` : ''}
      </div>

      <div class="hall-grid">
        <!-- All-Time Leaderboard Sideboard -->
        <div>
          <h3 style="margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem;">All-Time Rankings</h3>
          <ol style="padding-left:1.2rem;">
            ${allTime.map(u => `
              <li style="margin-bottom:0.6rem; font-weight:600;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span>${u.name} ${u.tag ? `<small style="opacity:0.7">(${u.tag})</small>` : ''}</span>
                  <span class="badge badge-accent2">${u.points} PTS</span>
                </div>
              </li>
            `).join('')}
          </ol>
        </div>

        <!-- Central Monument Wall (Awarded Titles) -->
        <div class="hall-monument">
          <h3 style="margin-bottom:1rem;">Awarded Honors</h3>
          ${titles.length === 0 ? `<p style="opacity:0.7;">No titles awarded yet.</p>` : ''}
          ${titles.map(t => `
            <div class="plaque">
              <div style="font-size:1.05rem; display:flex; align-items:center; gap:0.4rem; justify-content:center;">
                ${getIcon('trophy')} ${t.title_name}
              </div>
              <div style="font-size:0.8rem; opacity:0.9;">
                Awarded to: ${t.user_name || t.team_name || 'Cohort'} (${t.category})
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Season 1 Leaderboard Sideboard -->
        <div>
          <h3 style="margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem;">Season 1 Rankings</h3>
          <ol style="padding-left:1.2rem;">
            ${season1.map(u => `
              <li style="margin-bottom:0.6rem; font-weight:600;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span>${u.name} ${u.tag ? `<small style="opacity:0.7">(${u.tag})</small>` : ''}</span>
                  <span class="badge badge-accent1">${u.points} PTS</span>
                </div>
              </li>
            `).join('')}
          </ol>
        </div>
      </div>
    </div>
  `;
}

export function attachHallOfFameEvents(state, refreshData) {
  const awardBtn = document.getElementById('btnAwardTitle');
  if (awardBtn) {
    awardBtn.addEventListener('click', () => {
      openModal({
        title: 'Award Hall of Fame Title',
        contentHtml: `
          <div class="form-group">
            <label>Title Name</label>
            <input type="text" id="modalTitleName" class="form-control" placeholder="e.g. Master UI Craftsperson" />
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="modalTitleCategory" class="form-control">
              <option value="Academics">Academics</option>
              <option value="Coding">Coding</option>
              <option value="Design">Design</option>
              <option value="Leadership">Leadership</option>
              <option value="Collaboration">Collaboration</option>
            </select>
          </div>
          <div class="form-group">
            <label>Awardee User ID (Optional)</label>
            <input type="text" id="modalAwardeeUser" class="form-control" placeholder="e.g. u_o1" />
          </div>
        `,
        onConfirm: async (overlay) => {
          const title_name = overlay.querySelector('#modalTitleName').value.trim();
          const category = overlay.querySelector('#modalTitleCategory').value;
          const awarded_to_user_id = overlay.querySelector('#modalAwardeeUser').value.trim() || null;

          if (!title_name) return false;

          await awardTitle({ title_name, category, awarded_to_user_id, season: 'Season 1' });
          refreshData();
          return true;
        }
      });
    });
  }
}
