import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { uploadsDir } from '../src/server/middleware/upload.js';

/**
 * Submitted coursework used to be served by express.static mounted ahead of the
 * auth middleware — readable by anyone holding the URL, forever. These tests
 * pin the replacement: a session is required, and being signed in is not on its
 * own enough to read someone else's work.
 */
describe('Upload access control', () => {
  const OWNED = '11111111-2222-3333-4444-555555555555.png';
  const ORPHAN = '99999999-8888-7777-6666-555555555555.png';
  const written = [];

  let ownerToken, otherToken, reviewerToken;

  const write = (name) => {
    const target = path.join(uploadsDir, name);
    fs.writeFileSync(target, 'proof-bytes');
    written.push(target);
  };

  const login = async (identifier, password) => {
    const res = await supertest(app).post('/api/auth/login').send({ identifier, password });
    return res.body.token;
  };

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run('u_up_owner', 'Upload Owner', 'up_owner', 'upo@forge.local', hash, 'member', 'Member');
    insert.run('u_up_other', 'Upload Other', 'up_other', 'upx@forge.local', hash, 'member', 'Member');
    insert.run('u_up_teach', 'Upload Teacher', 'up_teach', 'upt@forge.local', hash, 'teacher', 'Instructor');

    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, status, total_points)
      VALUES ('task_upload', 'Upload task', 'x', 'active', 10)
    `).run();
    db.prepare(`
      INSERT OR REPLACE INTO task_submissions (id, task_id, submitted_by, proof_url, status)
      VALUES ('sub_upload', 'task_upload', 'u_up_owner', ?, 'PENDING')
    `).run(`/uploads/${OWNED}`);

    write(OWNED);
    write(ORPHAN);

    ownerToken = await login('up_owner', 'pass123');
    otherToken = await login('up_other', 'pass123');
    reviewerToken = await login('up_teach', 'pass123');
  });

  after(() => {
    for (const file of written) {
      try {
        fs.unlinkSync(file);
      } catch (_) {}
    }
  });

  const get = (name, token) => {
    const req = supertest(app).get(`/api/uploads/${name}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('is not served statically any more', async () => {
    // The old world-readable path must be gone, not merely shadowed.
    const res = await supertest(app).get(`/uploads/${OWNED}`);
    assert.notEqual(res.status, 200, '/uploads must no longer serve files without a session');
  });

  it('refuses an anonymous request', async () => {
    const res = await get(OWNED, null);
    assert.equal(res.status, 401);
  });

  it('serves the file to the person who submitted it', async () => {
    const res = await get(OWNED, ownerToken);
    assert.equal(res.status, 200);
    // A png comes back as a Buffer, not text.
    assert.equal(Buffer.from(res.body).toString(), 'proof-bytes');
  });

  it('serves the file to a reviewer', async () => {
    const res = await get(OWNED, reviewerToken);
    assert.equal(res.status, 200);
  });

  it('hides another member\'s submission behind a 404, not a 403', async () => {
    const res = await get(OWNED, otherToken);
    // A 403 would confirm the file exists, which is itself a disclosure.
    assert.equal(res.status, 404);
  });

  it('withholds a file no submission points at', async () => {
    const res = await get(ORPHAN, ownerToken);
    assert.equal(res.status, 404, 'an unattached upload has no owner to authorise');
  });

  it('rejects anything that is not an upload filename', async () => {
    // These reach the route and must be turned away by the pattern.
    for (const name of ['..%2F..%2Fpackage.json', '%2Fetc%2Fpasswd', 'forge.db', 'index.html']) {
      const res = await get(name, reviewerToken);
      assert.ok(res.status === 400 || res.status === 404, `${name} must not be served (got ${res.status})`);
    }
  });

  it('never returns the contents of a file outside the uploads directory', async () => {
    // A raw `../../` is normalised away by the HTTP layer before routing, so it
    // lands on the SPA catch-all and returns index.html. That is not a leak,
    // but the thing actually worth asserting is that no real file comes back.
    for (const name of ['../../.env', '../../package.json', '../../forge.db']) {
      const res = await get(name, reviewerToken);
      const body = res.text || Buffer.from(res.body || '').toString();
      assert.equal(
        /JWT_SECRET|GIPHY_API_KEY|"dependencies"|SQLite format/.test(body),
        false,
        `${name} leaked file contents`
      );
    }
  });

  it('marks non-image attachments for download rather than display', async () => {
    const doc = '12121212-3434-5656-7878-909090909090.txt';
    write(doc);
    db.prepare(`
      INSERT OR REPLACE INTO task_submissions (id, task_id, submitted_by, proof_url, status)
      VALUES ('sub_upload_doc', 'task_upload', 'u_up_owner', ?, 'PENDING')
    `).run(`/uploads/${doc}`);

    const res = await get(doc, ownerToken);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /^attachment/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });

  it('lets an image render inline', async () => {
    const res = await get(OWNED, ownerToken);
    assert.match(res.headers['content-disposition'], /^inline/);
    assert.match(res.headers['content-type'], /image\/png/);
  });
});
