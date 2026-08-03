import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app } from '../src/server/app.js';

describe('Static File Server (Production App Instance)', () => {
  it('should serve index.html with HTML5 doctype and ES module script from production app instance', async () => {
    const res = await supertest(app).get('/');
    assert.equal(res.status, 200);
    assert.match(res.text, /<!DOCTYPE html>/i);
    assert.match(res.text, /FORGE|MANABI|LUMINA/);
    assert.match(res.text, /type="module" src="\/js\/app.js"/);
  });

  it('should serve CSS style.css file with custom property tokens from production app instance', async () => {
    const res = await supertest(app).get('/css/style.css');
    assert.equal(res.status, 200);
    assert.match(res.text, /--bg-base:/);
    assert.match(res.text, /--accent-1:/);
  });

  it('should serve frontend ES module bundle app.js from production app instance', async () => {
    const res = await supertest(app).get('/js/app.js');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('javascript') || res.headers['content-type'].includes('application/javascript') || res.headers['content-type'].includes('text/javascript'));
  });
});
