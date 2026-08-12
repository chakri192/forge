import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';
import { normaliseCategory, sanitiseTags, CATEGORY_IDS } from '../src/server/config/forum.js';

/**
 * Forum categories and tags (milestone 3.4).
 *
 * `category` used to be free text, which is how a cohort ends up with one
 * thread under "Engineering" and nothing to browse by.
 */
describe('Forum taxonomy', () => {
  let memberToken, teacherToken;

  before(async () => {
    initSchema();
    const hash = bcrypt.hashSync('pass123', 10);
    const user = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    user.run('u_ft_mem', 'Forum Member', 'ft_member', 'ftm@forge.local', hash, 'member', 'Member');
    user.run('u_ft_teach', 'Forum Teacher', 'ft_teach', 'ftt@forge.local', hash, 'teacher', 'Instructor');

    const login = async (u) =>
      (await supertest(app).post('/api/auth/login').send({ identifier: u, password: 'pass123' })).body.token;
    memberToken = await login('ft_member');
    teacherToken = await login('ft_teach');
  });

  const as = (token, method, path) =>
    supertest(app)[method](path).set('Authorization', `Bearer ${token}`);

  it('publishes the eight categories the spec asks for', async () => {
    const res = await as(memberToken, 'get', '/api/forum/taxonomy');
    assert.equal(res.status, 200);
    assert.equal(res.body.categories.length, 8);
    for (const id of ['general', 'academic', 'hackathons', 'resources', 'ideas', 'social', 'qa', 'feedback']) {
      assert.ok(res.body.categories.some((c) => c.id === id), `missing category ${id}`);
    }
  });

  describe('normalising a category', () => {
    it('accepts the real ones', () => {
      for (const id of CATEGORY_IDS) assert.equal(normaliseCategory(id), id);
    });

    it('maps the free-text ones already in the database', () => {
      // "Engineering" is really in there — it predates the fixed set.
      assert.equal(normaliseCategory('Engineering'), 'academic');
      assert.equal(normaliseCategory('off-topic'), 'social');
      assert.equal(normaliseCategory('Q&A'), 'qa');
    });

    it('files anything unrecognised under General rather than inventing one', () => {
      assert.equal(normaliseCategory('wharrgarbl'), 'general');
      assert.equal(normaliseCategory(''), 'general');
      assert.equal(normaliseCategory(null), 'general');
    });
  });

  describe('tags', () => {
    it('keeps only known tags', () => {
      assert.deepEqual(sanitiseTags(['question', 'not-a-tag']), ['question']);
    });

    it('dedupes and caps at three', () => {
      const many = ['question', 'question', 'discussion', 'solved', 'showcase', 'help-wanted'];
      const result = sanitiseTags(many);
      assert.equal(result.length, 3);
      assert.equal(new Set(result).size, 3);
    });

    it('reserves "announcement" for moderators', () => {
      // If anyone can tag a thread as an announcement, the tag stops meaning
      // anything the moment someone notices.
      assert.deepEqual(sanitiseTags(['announcement'], false), []);
      assert.deepEqual(sanitiseTags(['announcement'], true), ['announcement']);
    });

    it('survives nonsense input', () => {
      assert.deepEqual(sanitiseTags(null), []);
      assert.deepEqual(sanitiseTags('question'), [], 'a bare string is not a tag list');
    });
  });

  describe('creating a thread', () => {
    it('stores the normalised category and the tags', async () => {
      const res = await as(memberToken, 'post', '/api/forum/threads').send({
        title: 'How do I profile the parser?',
        category: 'Engineering',
        content: 'It gets slow past 10k tokens.',
        tags: ['question', 'nonsense']
      });
      assert.ok(res.status === 200 || res.status === 201, `got ${res.status}`);

      const row = db
        .prepare(`SELECT category, tags FROM forum_threads WHERE title = ?`)
        .get('How do I profile the parser?');
      assert.equal(row.category, 'academic', 'free text should be mapped, not stored raw');
      assert.deepEqual(JSON.parse(row.tags), ['question']);
    });

    it('will not let a member self-apply the announcement tag', async () => {
      await as(memberToken, 'post', '/api/forum/threads').send({
        title: 'Definitely official',
        category: 'general',
        content: 'trust me',
        tags: ['announcement']
      });
      const row = db.prepare(`SELECT tags FROM forum_threads WHERE title = 'Definitely official'`).get();
      assert.deepEqual(JSON.parse(row.tags), []);
    });

    it('lets a teacher apply it', async () => {
      await as(teacherToken, 'post', '/api/forum/threads').send({
        title: 'Reading week moved',
        category: 'general',
        content: 'One week later than planned.',
        tags: ['announcement']
      });
      const row = db.prepare(`SELECT tags FROM forum_threads WHERE title = 'Reading week moved'`).get();
      assert.deepEqual(JSON.parse(row.tags), ['announcement']);
    });
  });
});
