import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { ProgressionService } from '../src/server/services/progressionService.js';
import { slugify } from '../src/server/utils/publicProfile.js';

const PUBLIC_USER = 'u_pp_public';
const PRIVATE_USER = 'u_pp_private';

describe('Public portfolio profiles', () => {
  let publicToken, privateToken;

  before(async () => {
    initSchema();
    const passHash = bcrypt.hashSync('pass123', 10);
    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, phone, password_hash, role, tag, bio, github_url)
      VALUES (?, 'Pia Public', 'pia_public', 'pia@forge.local', '+15551234567', ?, 'member', 'Code Ninja', 'I build things.', 'https://github.com/pia')
    `).run(PUBLIC_USER, passHash);
    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, phone, password_hash, role, tag)
      VALUES (?, 'Priya Private', 'priya_private', 'priya@forge.local', '+15559876543', ?, 'member', 'Member')
    `).run(PRIVATE_USER, passHash);

    const login = async (id) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier: id, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    publicToken = await login('pia_public');
    privateToken = await login('priya_private');

    ProgressionService.award({
      userId: PUBLIC_USER, amount: 450, sourceType: 'TASK_COMPLETED',
      sourceId: 'pp_seed', description: 'Seeded work', today: '2026-04-01'
    });
  });

  describe('privacy defaults', () => {
    it('keeps profiles private until published', async () => {
      const res = await supertest(app).get('/api/public/profile/pia_public');
      assert.equal(res.status, 404);
    });

    it('reports settings to the owner', async () => {
      const res = await supertest(app)
        .get('/api/profile/settings')
        .set('Authorization', `Bearer ${publicToken}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.is_public, false);
    });

    it('requires auth to change settings', async () => {
      const res = await supertest(app).patch('/api/profile/settings').send({ is_public: true });
      assert.equal(res.status, 401);
    });
  });

  describe('publishing', () => {
    it('publishes with a chosen slug', async () => {
      const res = await supertest(app)
        .patch('/api/profile/settings')
        .set('Authorization', `Bearer ${publicToken}`)
        .send({ is_public: true, slug: 'Pia Builds Things' });
      assert.equal(res.status, 200);
      assert.equal(res.body.is_public, true);
      assert.equal(res.body.slug, 'pia-builds-things');
    });

    it('serves the published profile without any token', async () => {
      const res = await supertest(app).get('/api/public/profile/pia-builds-things');
      assert.equal(res.status, 200);
      assert.equal(res.body.profile.name, 'Pia Public');
      assert.equal(res.body.profile.handle, 'pia-builds-things');
      assert.ok(res.body.profile.xp >= 450);
      assert.ok(res.body.profile.level >= 3);
      assert.ok(Array.isArray(res.body.profile.badges));
      assert.ok(Array.isArray(res.body.profile.contributions));
    });

    it('NEVER leaks sensitive fields', async () => {
      const res = await supertest(app).get('/api/public/profile/pia-builds-things');
      const serialized = JSON.stringify(res.body);

      for (const secret of ['pia@forge.local', '+15551234567', '$2a$', '$2b$']) {
        assert.equal(serialized.includes(secret), false, `public payload leaked: ${secret}`);
      }
      for (const field of ['email', 'phone', 'password_hash', 'role', 'public_role', 'is_public']) {
        assert.equal(
          Object.prototype.hasOwnProperty.call(res.body.profile, field),
          false,
          `public profile exposed field: ${field}`
        );
      }
      // The internal primary key must not travel either.
      assert.equal(serialized.includes(PUBLIC_USER), false, 'public payload leaked the internal user id');
    });

    it('rejects a slug already taken', async () => {
      const res = await supertest(app)
        .patch('/api/profile/settings')
        .set('Authorization', `Bearer ${privateToken}`)
        .send({ is_public: true, slug: 'pia-builds-things' });
      assert.equal(res.status, 409);
    });

    it('unpublishing makes the profile disappear again', async () => {
      const off = await supertest(app)
        .patch('/api/profile/settings')
        .set('Authorization', `Bearer ${publicToken}`)
        .send({ is_public: false });
      assert.equal(off.status, 200);

      const res = await supertest(app).get('/api/public/profile/pia-builds-things');
      assert.equal(res.status, 404);

      // Restore for later assertions.
      await supertest(app)
        .patch('/api/profile/settings')
        .set('Authorization', `Bearer ${publicToken}`)
        .send({ is_public: true });
    });
  });

  describe('enumeration resistance', () => {
    it('returns the same 404 for unknown and unpublished profiles', async () => {
      const unknown = await supertest(app).get('/api/public/profile/no-such-person-at-all');
      const unpublished = await supertest(app).get('/api/public/profile/priya_private');
      assert.equal(unknown.status, 404);
      assert.equal(unpublished.status, 404);
      assert.deepEqual(unknown.body, unpublished.body, 'responses must be indistinguishable');
    });

    it('never exposes the hardcoded owner account', async () => {
      db.prepare(`UPDATE users SET is_public = 1, public_slug = 'owner-slug' WHERE id = 'u_dev'`).run();
      const res = await supertest(app).get('/api/public/profile/owner-slug');
      assert.equal(res.status, 404, 'the owner account must stay invisible even if flagged public');
      db.prepare(`UPDATE users SET is_public = 0, public_slug = NULL WHERE id = 'u_dev'`).run();
    });
  });

  describe('slugify', () => {
    it('produces url-safe slugs and falls back when empty', () => {
      assert.equal(slugify('V Chakradhar'), 'v-chakradhar');
      assert.equal(slugify('  Mixed   CASE__name '), 'mixed-case-name');
      assert.equal(slugify('!!!', 'fallback'), 'fallback');
      assert.equal(slugify('a'.repeat(80)).length, 40);
    });
  });
});
