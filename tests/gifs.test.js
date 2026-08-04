import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/server/app.js';
import { db, initSchema } from '../src/server/db/database.js';

/**
 * GIF search proxies a third party, so these tests stub `fetch` rather than
 * reach the network: the point is that we normalise each provider's shape and
 * never leak the key to the client.
 */
describe('GIF search', () => {
  let token;
  const realFetch = globalThis.fetch;
  let lastUrl = null;

  const stubUpstream = (body, ok = true) => {
    globalThis.fetch = async (url) => {
      lastUrl = String(url);
      return { ok, status: ok ? 200 : 500, json: async () => body };
    };
  };

  before(async () => {
    initSchema();
    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, username, email, password_hash, role, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'u_gif',
      'Gif Tester',
      'gif_tester',
      'gif@forge.local',
      bcrypt.hashSync('pass123', 10),
      'member',
      'Member'
    );

    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ identifier: 'gif_tester', password: 'pass123' });
    token = res.body.token;
  });

  beforeEach(() => {
    delete process.env.GIPHY_API_KEY;
    delete process.env.TENOR_API_KEY;
    lastUrl = null;
  });

  after(() => {
    globalThis.fetch = realFetch;
  });

  const search = (q = 'celebrate') =>
    supertest(app).get(`/api/gifs/search?q=${q}`).set('Authorization', `Bearer ${token}`);

  it('requires a signed-in user', async () => {
    const res = await supertest(app).get('/api/gifs/search?q=celebrate');
    assert.equal(res.status, 401);
  });

  it('reports plainly when no provider is configured', async () => {
    const res = await search();
    assert.equal(res.status, 200);
    assert.equal(res.body.configured, false);
    assert.deepEqual(res.body.results, []);
    assert.match(res.body.message, /not set up/i);
  });

  it('normalises a Giphy response', async () => {
    process.env.GIPHY_API_KEY = 'giphy-test-key';
    stubUpstream({
      data: [
        {
          id: 'g1',
          title: 'confetti',
          images: {
            fixed_width_small: { url: 'https://media.giphy.com/media/g1/200w_s.gif' },
            downsized: { url: 'https://media.giphy.com/media/g1/giphy.gif' }
          }
        },
        // No usable URL at all — must be dropped, not rendered as a broken tile.
        { id: 'g2', title: 'broken', images: {} }
      ]
    });

    const res = await search();
    assert.equal(res.body.configured, true);
    assert.deepEqual(res.body.results, [
      {
        id: 'g1',
        description: 'confetti',
        preview: 'https://media.giphy.com/media/g1/200w_s.gif',
        url: 'https://media.giphy.com/media/g1/giphy.gif'
      }
    ]);
    assert.ok(lastUrl.startsWith('https://api.giphy.com/v1/gifs/search'));
    assert.ok(lastUrl.includes('rating=g'), 'content rating must be pinned');
  });

  it('normalises a Tenor response', async () => {
    process.env.TENOR_API_KEY = 'tenor-test-key';
    stubUpstream({
      results: [
        {
          id: 't1',
          content_description: 'applause',
          media_formats: {
            tinygif: { url: 'https://media.tenor.com/t1/tiny.gif' },
            gif: { url: 'https://media.tenor.com/t1/full.gif' }
          }
        }
      ]
    });

    const res = await search();
    assert.deepEqual(res.body.results, [
      {
        id: 't1',
        description: 'applause',
        preview: 'https://media.tenor.com/t1/tiny.gif',
        url: 'https://media.tenor.com/t1/full.gif'
      }
    ]);
    assert.ok(lastUrl.startsWith('https://tenor.googleapis.com/v2/search'));
  });

  it('prefers an existing Tenor key over Giphy', async () => {
    process.env.TENOR_API_KEY = 'tenor-test-key';
    process.env.GIPHY_API_KEY = 'giphy-test-key';
    stubUpstream({ results: [] });

    await search();
    assert.ok(lastUrl.includes('tenor.googleapis.com'), 'a working Tenor key must not be silently replaced');
  });

  it('never returns the API key to the client', async () => {
    process.env.GIPHY_API_KEY = 'super-secret-key';
    stubUpstream({ data: [] });

    const res = await search();
    assert.ok(lastUrl.includes('super-secret-key'), 'the key is sent upstream');
    assert.equal(JSON.stringify(res.body).includes('super-secret-key'), false);
  });

  it('surfaces an upstream failure as 502, not a crash', async () => {
    process.env.GIPHY_API_KEY = 'giphy-test-key';
    stubUpstream({}, false);

    const res = await search();
    assert.equal(res.status, 502);
    assert.match(res.body.error, /unavailable/i);
  });

  it('rejects an empty or over-long search term', async () => {
    process.env.GIPHY_API_KEY = 'giphy-test-key';
    for (const q of ['', 'x'.repeat(80)]) {
      const res = await supertest(app)
        .get(`/api/gifs/search?q=${q}`)
        .set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 400, `${q.length} chars should be rejected`);
    }
  });
});
