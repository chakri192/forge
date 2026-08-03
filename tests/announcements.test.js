import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

describe('Announcements: RBAC, audience scoping, notifications', () => {
  let memberToken, leaderToken, teacherToken, adminToken;
  let announcementId;

  before(async () => {
    initSchema();
    const passHash = bcrypt.hashSync('pass123', 10);
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('u_ann_member', 'Ann Member', 'ann_member', 'ann_member@forge.local', passHash, 'member', 'Member');
    insertUser.run('u_ann_leader', 'Ann Leader', 'ann_leader', 'ann_leader@forge.local', passHash, 'leader', 'Leader');
    insertUser.run('u_ann_teacher', 'Ann Teacher', 'ann_teacher', 'ann_teacher@forge.local', passHash, 'teacher', 'Teacher');
    insertUser.run('u_ann_admin', 'Ann Admin', 'ann_admin', 'ann_admin@forge.local', passHash, 'admin', 'Admin');

    const login = async (identifier) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    memberToken = await login('ann_member');
    leaderToken = await login('ann_leader');
    teacherToken = await login('ann_teacher');
    adminToken = await login('ann_admin');
  });

  it('requires authentication to list announcements (401)', async () => {
    const res = await supertest(app).get('/api/announcements');
    assert.equal(res.status, 401);
  });

  it('forbids members from publishing announcements (403)', async () => {
    const res = await supertest(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Sneaky', content: 'Should fail' });
    assert.equal(res.status, 403);
  });

  it('lets a leader publish an announcement and notifies recipients', async () => {
    const res = await supertest(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ title: 'Welcome aboard', content: 'The platform is live!', priority: 'HIGH' });
    assert.equal(res.status, 201);
    assert.match(res.body.announcement.id, /^ann_/);
    assert.equal(res.body.announcement.priority, 'HIGH');
    assert.equal(res.body.announcement.author_name, 'Ann Leader');
    announcementId = res.body.announcement.id;

    const notifications = await supertest(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(notifications.status, 200);
    assert.ok(
      notifications.body.some(
        (n) => n.type === 'ANNOUNCEMENT' && n.title.includes('Welcome aboard')
      )
    );
  });

  it('validates announcement payloads (400)', async () => {
    const missingTitle = await supertest(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ content: 'No title' });
    assert.equal(missingTitle.status, 400);

    const badPriority = await supertest(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ title: 'Bad', content: 'Priority', priority: 'MEGA' });
    assert.equal(badPriority.status, 400);

    const badRole = await supertest(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ title: 'Bad', content: 'Audience', target_role: 'aliens' });
    assert.equal(badRole.status, 400);
  });

  it('scopes role-targeted announcements to the audience', async () => {
    const created = await supertest(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Teachers only', content: 'Grading sync Friday', target_role: 'teacher' });
    assert.equal(created.status, 201);

    const asMember = await supertest(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.ok(!asMember.body.announcements.some((a) => a.title === 'Teachers only'));

    const asTeacher = await supertest(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${teacherToken}`);
    assert.ok(asTeacher.body.announcements.some((a) => a.title === 'Teachers only'));

    const asAdmin = await supertest(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.ok(asAdmin.body.announcements.some((a) => a.title === 'Teachers only'));
  });

  it('hides expired announcements', async () => {
    const created = await supertest(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ title: 'Old news', content: 'Expired', expires_at: '2020-01-01T00:00:00.000Z' });
    assert.equal(created.status, 201);

    const list = await supertest(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${memberToken}`);
    assert.ok(!list.body.announcements.some((a) => a.title === 'Old news'));
  });

  it('restricts edits and deletes to the author or an admin', async () => {
    const memberEdit = await supertest(app)
      .patch(`/api/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ content: 'hacked' });
    assert.equal(memberEdit.status, 403);

    const teacherEdit = await supertest(app)
      .patch(`/api/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ content: 'not mine' });
    assert.equal(teacherEdit.status, 403);

    const emptyPatch = await supertest(app)
      .patch(`/api/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({});
    assert.equal(emptyPatch.status, 400);

    const authorEdit = await supertest(app)
      .patch(`/api/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${leaderToken}`)
      .send({ content: 'The platform is live! (v2)', priority: 'URGENT' });
    assert.equal(authorEdit.status, 200);
    assert.equal(authorEdit.body.announcement.priority, 'URGENT');

    const memberDelete = await supertest(app)
      .delete(`/api/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${memberToken}`);
    assert.equal(memberDelete.status, 403);

    const adminDelete = await supertest(app)
      .delete(`/api/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminDelete.status, 200);

    const gone = await supertest(app)
      .delete(`/api/announcements/${announcementId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(gone.status, 404);
  });
});
