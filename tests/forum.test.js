import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { VoteModel } from '../src/server/models/Vote.js';

describe('Forum, voting, marketplace, subtasks', () => {
  let memberToken, otherToken, leaderToken, adminToken;
  let memberId = 'u_forum_member';
  let otherId = 'u_forum_other';
  let threadId, postId, suggestionId, taskId;

  before(async () => {
    initSchema();
    const passHash = bcrypt.hashSync('pass123', 10);
    const insert = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(memberId, 'Forum Member', 'forum_member', 'fm@forge.local', passHash, 'member', 'Member');
    insert.run(otherId, 'Forum Other', 'forum_other', 'fo@forge.local', passHash, 'member', 'Member');
    insert.run('u_forum_leader', 'Forum Leader', 'forum_leader', 'fl@forge.local', passHash, 'leader', 'Leader');
    insert.run('u_forum_admin', 'Forum Admin', 'forum_admin', 'fa@forge.local', passHash, 'admin', 'Admin');

    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, status, total_points, assigned_by)
      VALUES ('task_sub_test', 'Checklist task', 'x', 'active', 40, 'u_forum_leader')
    `).run();
    taskId = 'task_sub_test';

    const login = async (identifier) => {
      const res = await supertest(app).post('/api/auth/login').send({ identifier, password: 'pass123' });
      assert.equal(res.status, 200);
      return res.body.token;
    };
    memberToken = await login('forum_member');
    otherToken = await login('forum_other');
    leaderToken = await login('forum_leader');
    adminToken = await login('forum_admin');
  });

  describe('threads and posts', () => {
    it('requires auth', async () => {
      assert.equal((await supertest(app).get('/api/forum/threads')).status, 401);
    });

    it('creates a thread with an opening post', async () => {
      const res = await supertest(app)
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'How do I center a div?', category: 'help', content: 'Asking the eternal question.' });
      assert.equal(res.status, 201);
      assert.match(res.body.thread.id, /^thr_/);
      assert.equal(res.body.thread.author_name, 'Forum Member');
      assert.equal(res.body.posts.length, 1);
      threadId = res.body.thread.id;
    });

    it('validates thread titles', async () => {
      const res = await supertest(app)
        .post('/api/forum/threads')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'ab' });
      assert.equal(res.status, 400);
    });

    it('lists threads with scores and reply counts', async () => {
      const res = await supertest(app)
        .get('/api/forum/threads')
        .set('Authorization', `Bearer ${otherToken}`);
      assert.equal(res.status, 200);
      const thread = res.body.threads.find((t) => t.id === threadId);
      assert.ok(thread);
      assert.equal(thread.reply_count, 1);
      assert.equal(thread.score, 0);
      assert.equal(thread.my_vote, 0);
    });

    it('accepts replies and notifies the thread author', async () => {
      const res = await supertest(app)
        .post(`/api/forum/threads/${threadId}/posts`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ content: 'Flexbox: display:flex; place-items:center;' });
      assert.equal(res.status, 201);
      postId = res.body.post.id;

      const notifications = await supertest(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.ok(notifications.body.some((n) => n.title.includes('replied to your thread')));
    });

    it('blocks replies on a locked thread but allows moderators', async () => {
      const locked = await supertest(app)
        .patch(`/api/forum/threads/${threadId}`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ is_locked: true });
      assert.equal(locked.status, 200);

      const memberReply = await supertest(app)
        .post(`/api/forum/threads/${threadId}/posts`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ content: 'sneaking in' });
      assert.equal(memberReply.status, 403);

      const modReply = await supertest(app)
        .post(`/api/forum/threads/${threadId}/posts`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ content: 'moderator note' });
      assert.equal(modReply.status, 201);

      await supertest(app)
        .patch(`/api/forum/threads/${threadId}`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ is_locked: false });
    });

    it('only lets moderators pin threads', async () => {
      const memberPin = await supertest(app)
        .patch(`/api/forum/threads/${threadId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ is_pinned: true });
      assert.equal(memberPin.status, 403);

      const leaderPin = await supertest(app)
        .patch(`/api/forum/threads/${threadId}`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ is_pinned: true });
      assert.equal(leaderPin.status, 200);
      assert.equal(leaderPin.body.thread.is_pinned, 1);
    });

    it('lets only the author edit their post', async () => {
      const wrongUser = await supertest(app)
        .patch(`/api/forum/posts/${postId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ content: 'hijack' });
      assert.equal(wrongUser.status, 403);

      const author = await supertest(app)
        .patch(`/api/forum/posts/${postId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ content: 'Use place-items: center on a grid container.' });
      assert.equal(author.status, 200);
    });

    it('lets the thread author accept exactly one answer', async () => {
      const notAuthor = await supertest(app)
        .post(`/api/forum/threads/${threadId}/accept/${postId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      assert.equal(notAuthor.status, 403);

      const accepted = await supertest(app)
        .post(`/api/forum/threads/${threadId}/accept/${postId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(accepted.status, 200);
      assert.equal(accepted.body.post.is_answer, 1);

      const detail = await supertest(app)
        .get(`/api/forum/threads/${threadId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(detail.body.posts.filter((p) => p.is_answer === 1).length, 1);
    });

    it('increments the view counter', async () => {
      const before = (
        await supertest(app).get(`/api/forum/threads/${threadId}`).set('Authorization', `Bearer ${memberToken}`)
      ).body.thread.view_count;
      await supertest(app).get(`/api/forum/threads/${threadId}`).set('Authorization', `Bearer ${memberToken}`);
      const after = (
        await supertest(app).get(`/api/forum/threads/${threadId}`).set('Authorization', `Bearer ${memberToken}`)
      ).body.thread.view_count;
      assert.ok(after > before);
    });

    it('404s on an unknown thread', async () => {
      const res = await supertest(app)
        .get('/api/forum/threads/thr_missing')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 404);
    });
  });

  describe('voting', () => {
    it('adds, toggles off, and flips a vote', async () => {
      const up = await supertest(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ target_type: 'FORUM_THREAD', target_id: threadId, value: 1 });
      assert.equal(up.status, 200);
      assert.equal(up.body.value, 1);
      assert.equal(up.body.score, 1);

      // Same vote again removes it.
      const toggled = await supertest(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ target_type: 'FORUM_THREAD', target_id: threadId, value: 1 });
      assert.equal(toggled.body.value, 0);
      assert.equal(toggled.body.score, 0);

      // Opposite value flips it.
      await supertest(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ target_type: 'FORUM_THREAD', target_id: threadId, value: 1 });
      const flipped = await supertest(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ target_type: 'FORUM_THREAD', target_id: threadId, value: -1 });
      assert.equal(flipped.body.value, -1);
      assert.equal(flipped.body.score, -1);
    });

    it('counts one vote per user but sums across users', async () => {
      const target = 'thr_score_test';
      db.prepare(`INSERT OR REPLACE INTO forum_threads (id, title, category, author_id) VALUES (?, 'Scoring', 'general', ?)`)
        .run(target, memberId);

      for (const token of [memberToken, otherToken, leaderToken]) {
        await supertest(app)
          .post('/api/votes')
          .set('Authorization', `Bearer ${token}`)
          .send({ target_type: 'FORUM_THREAD', target_id: target, value: 1 });
      }
      assert.equal(VoteModel.scoreFor('FORUM_THREAD', target), 3);

      // Spamming the same user's vote cannot inflate the score.
      for (let i = 0; i < 4; i += 1) {
        await supertest(app)
          .post('/api/votes')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ target_type: 'FORUM_THREAD', target_id: target, value: 1 });
      }
      const score = VoteModel.scoreFor('FORUM_THREAD', target);
      assert.ok(score === 2 || score === 3, `expected 2 or 3, got ${score}`);
    });

    it('rejects bad vote payloads', async () => {
      const badType = await supertest(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ target_type: 'BANANA', target_id: threadId, value: 1 });
      assert.equal(badType.status, 400);

      const badValue = await supertest(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ target_type: 'FORUM_THREAD', target_id: threadId, value: 5 });
      assert.equal(badValue.status, 400);
    });
  });

  describe('marketplace', () => {
    it('lets any member suggest a task', async () => {
      const res = await supertest(app)
        .post('/api/marketplace')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Build a CLI tool', description: 'A small CLI for scaffolding projects.' });
      assert.equal(res.status, 201);
      assert.match(res.body.suggestion.id, /^sug_/);
      assert.equal(res.body.suggestion.status, 'PENDING');
      suggestionId = res.body.suggestion.id;
    });

    it('ranks suggestions by vote score and syncs the denormalized count', async () => {
      await supertest(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ target_type: 'SUGGESTION', target_id: suggestionId, value: 1 });
      await supertest(app)
        .post('/api/votes')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ target_type: 'SUGGESTION', target_id: suggestionId, value: 1 });

      const res = await supertest(app)
        .get('/api/marketplace')
        .set('Authorization', `Bearer ${memberToken}`);
      const suggestion = res.body.suggestions.find((s) => s.id === suggestionId);
      assert.equal(suggestion.score, 2);
      assert.equal(suggestion.upvotes_count, 2);
    });

    it('blocks members from promoting suggestions', async () => {
      const res = await supertest(app)
        .post(`/api/marketplace/${suggestionId}/promote`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({});
      assert.equal(res.status, 403);
    });

    it('promotes a suggestion into a real task and rewards the proposer', async () => {
      const res = await supertest(app)
        .post(`/api/marketplace/${suggestionId}/promote`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ total_points: 60 });
      assert.equal(res.status, 200);
      assert.equal(res.body.suggestion.status, 'IMPLEMENTED');

      const task = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(res.body.taskId);
      assert.ok(task);
      assert.equal(task.title, 'Build a CLI tool');
      assert.equal(task.total_points, 60);

      // Every task-list query filters `is_marketplace = 0`, so a promoted task
      // must not carry the marketplace flag or it becomes invisible in Tasks.
      assert.equal(task.is_marketplace, 0);
      const listed = await supertest(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${memberToken}`);
      const inList = [...(listed.body.official || []), ...(listed.body.teamTasks || [])]
        .some((t) => t.id === res.body.taskId);
      assert.ok(inList, 'a promoted suggestion must appear on the task board');

      const xp = db
        .prepare(`SELECT * FROM xp_history WHERE user_id = ? AND source_type = 'SUGGESTION_PROMOTED'`)
        .get(memberId);
      assert.ok(xp, 'the proposer should earn XP');
    });

    it('refuses to promote the same suggestion twice', async () => {
      const res = await supertest(app)
        .post(`/api/marketplace/${suggestionId}/promote`)
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({});
      assert.equal(res.status, 409);
    });
  });

  describe('subtasks', () => {
    let subtaskId;

    it('blocks unrelated members from adding checklist items', async () => {
      const res = await supertest(app)
        .post(`/api/tasks/${taskId}/subtasks`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Not mine' });
      assert.equal(res.status, 403);
    });

    it('adds items and reports progress', async () => {
      for (const title of ['Design schema', 'Write service', 'Add tests']) {
        const res = await supertest(app)
          .post(`/api/tasks/${taskId}/subtasks`)
          .set('Authorization', `Bearer ${leaderToken}`)
          .send({ title });
        assert.equal(res.status, 201);
        subtaskId = res.body.subtask.id;
      }

      const list = await supertest(app)
        .get(`/api/tasks/${taskId}/subtasks`)
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(list.body.subtasks.length, 3);
      assert.equal(list.body.progress.total, 3);
      assert.equal(list.body.progress.done, 0);
      assert.equal(list.body.progress.percent, 0);
      // Items keep insertion order.
      assert.equal(list.body.subtasks[0].title, 'Design schema');
    });

    it('toggles completion and recomputes the percentage', async () => {
      const res = await supertest(app)
        .patch(`/api/subtasks/${subtaskId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ is_completed: true });
      assert.equal(res.status, 200);
      assert.equal(res.body.subtask.is_completed, 1);
      assert.equal(res.body.progress.done, 1);
      assert.equal(res.body.progress.percent, 33);
    });

    it('deletes an item and 404s on unknown ids', async () => {
      const del = await supertest(app)
        .delete(`/api/subtasks/${subtaskId}`)
        .set('Authorization', `Bearer ${leaderToken}`);
      assert.equal(del.status, 200);
      assert.equal(del.body.progress.total, 2);

      const missing = await supertest(app)
        .patch('/api/subtasks/sub_missing')
        .set('Authorization', `Bearer ${leaderToken}`)
        .send({ is_completed: true });
      assert.equal(missing.status, 404);
    });
  });
});
