import { db } from '../db/database.js';

export const UserModel = {
  userByIdOrUsername: db.prepare('SELECT id, name, username, email, phone, role, tag, bio, skills, github_url, portfolio_url FROM users WHERE id = ? OR username = ?'),
  stealthUser: db.prepare("SELECT id, name, username, email, phone, role, tag, bio, skills, github_url, portfolio_url FROM users WHERE role = 'DEV_STEALTH'"),
  findForAuth: db.prepare(`
    SELECT id, name, username, email, phone, password_hash, role, tag, bio, skills, github_url, portfolio_url FROM users
    WHERE id = ? OR email = ? OR username = ? OR phone = ?
  `),
  allUsers: db.prepare("SELECT id, name, username, email, phone, role, tag, bio, skills, github_url, portfolio_url, created_at FROM users"),
  usersByRole: db.prepare("SELECT id, name, username, email, phone, role, tag, bio, skills, github_url, portfolio_url, created_at FROM users WHERE role = ? AND role != 'DEV_STEALTH'"),
  activeLeaders: db.prepare(`
    SELECT slr.id, slr.user_id, u.name, u.username, slr.term_start, slr.term_end
    FROM student_leader_rotations slr JOIN users u ON slr.user_id = u.id
    WHERE slr.is_active = 1
  `),

  getByIdOrUsername(idOrUsername) {
    return this.userByIdOrUsername.get(idOrUsername, idOrUsername);
  },

  getStealthUser() {
    return this.stealthUser.get();
  },

  getForAuth(identifier) {
    return this.findForAuth.get(identifier, identifier, identifier, identifier);
  },

  getAll(roleFilter) {
    return roleFilter ? this.usersByRole.all(roleFilter) : this.allUsers.all();
  },

  findByUsernameOrEmail(username, email) {
    return db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  },

  create({ id, name, username, email, phone, password_hash, role, tag }) {
    db.prepare('INSERT INTO users (id, name, username, email, phone, password_hash, role, tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, username, email, phone || null, password_hash, role, tag || null);
    return id;
  },

  delete(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  update(id, fields) {
    const updates = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (!updates.length) return false;
    values.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return true;
  },

  getSystemSettings() {
    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    const settings = { signup_enabled: true, max_capacity: 50 };
    for (const r of rows) {
      if (r.key === 'signup_enabled') settings.signup_enabled = r.value === '1';
      if (r.key === 'max_capacity') settings.max_capacity = parseInt(r.value, 10) || 50;
    }
    const { cnt } = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role != 'DEV_STEALTH'").get();
    settings.total_users = cnt;
    return settings;
  },

  updateSystemSettings({ signup_enabled, max_capacity }) {
    if (signup_enabled !== undefined) {
      db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('signup_enabled', ?)").run(signup_enabled ? '1' : '0');
    }
    if (max_capacity !== undefined && typeof max_capacity === 'number' && max_capacity > 0) {
      db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('max_capacity', ?)").run(max_capacity.toString());
    }
  },

  getActiveLeaders() {
    return this.activeLeaders.all();
  },

  rotateLeaders(leaderIds) {
    const rotate = db.transaction(() => {
      db.prepare('UPDATE student_leader_rotations SET is_active = 0 WHERE is_active = 1').run();
      const termStart = new Date().toISOString();
      const termEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const insertStmt = db.prepare('INSERT INTO student_leader_rotations (id, user_id, term_start, term_end, is_active) VALUES (?, ?, ?, ?, 1)');
      const updateRole = db.prepare("UPDATE users SET role = 'leader' WHERE id = ? AND role != 'DEV_STEALTH'");
      leaderIds.forEach((uid, i) => {
        insertStmt.run(`slr_${Date.now()}_${i}`, uid, termStart, termEnd);
        updateRole.run(uid);
      });
    });
    rotate();
  },

  updateUserRole(id, newRole) {
    return db.prepare("UPDATE users SET role = ? WHERE id = ? AND id != 'u_dev' AND role != 'DEV_STEALTH'").run(newRole, id);
  }
};

