import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { cacheService } from '../src/services/cacheService.js';
import { cacheMiddleware, invalidateCache } from '../src/middleware/cacheMiddleware.js';

describe('Route Caching & Invalidation End-to-End Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    await cacheService.flush();

    const app = express();
    app.use(express.json());

    let counter = 0;
    let dashboardCounter = 0;

    app.get('/api/staff', cacheMiddleware({ ttl: 600, tags: ['staff'] }), (_req, res) => {
      counter += 1;
      res.json({ staff: ['Amit', 'Neha'], fetchCount: counter });
    });

    app.get('/api/inquiries/dashboard-stats', cacheMiddleware({ ttl: 60, tags: ['dashboard', 'inquiries'] }), (_req, res) => {
      dashboardCounter += 1;
      res.json({ totalInquiries: 100, fetchCount: dashboardCounter });
    });

    app.post('/api/inquiries', async (_req, res) => {
      await invalidateCache(['inquiries', 'dashboard']);
      res.status(201).json({ success: true });
    });

    app.get('/api/cache/stats', async (_req, res) => {
      const stats = await cacheService.getStats();
      res.json(stats);
    });

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await cacheService.flush();
  });

  test('should return MISS on first call and HIT with identical body on second call', async () => {
    // 1st request -> MISS
    const startMiss = performance.now();
    const res1 = await fetch(`${baseUrl}/api/staff`);
    const timeMiss = performance.now() - startMiss;

    assert.equal(res1.status, 200);
    assert.equal(res1.headers.get('x-cache'), 'MISS');
    const data1 = await res1.json();
    assert.equal(data1.fetchCount, 1);

    // 2nd request -> HIT (sub-millisecond / ultra fast)
    const startHit = performance.now();
    const res2 = await fetch(`${baseUrl}/api/staff`);
    const timeHit = performance.now() - startHit;

    assert.equal(res2.status, 200);
    assert.equal(res2.headers.get('x-cache'), 'HIT');
    const data2 = await res2.json();
    assert.equal(data2.fetchCount, 1, 'Should return cached result without re-executing handler');
    assert.deepEqual(data2.staff, ['Amit', 'Neha']);
  });

  test('should bypass cache when Cache-Control: no-cache header is sent', async () => {
    const res = await fetch(`${baseUrl}/api/staff`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-cache'), 'BYPASS');
    const data = await res.json();
    assert.equal(data.fetchCount, 2, 'Handler executed due to bypass');
  });

  test('should invalidate dashboard cache when mutation occurs', async () => {
    // Prime the dashboard cache
    const res1 = await fetch(`${baseUrl}/api/inquiries/dashboard-stats`);
    assert.equal(res1.headers.get('x-cache'), 'MISS');
    const data1 = await res1.json();
    assert.equal(data1.fetchCount, 1);

    // Cache HIT
    const res2 = await fetch(`${baseUrl}/api/inquiries/dashboard-stats`);
    assert.equal(res2.headers.get('x-cache'), 'HIT');
    const data2 = await res2.json();
    assert.equal(data2.fetchCount, 1);

    // Mutate inquiry (triggers invalidateCache(['inquiries', 'dashboard']))
    const mutateRes = await fetch(`${baseUrl}/api/inquiries`, { method: 'POST' });
    assert.equal(mutateRes.status, 201);

    // Next request must be MISS and have fresh data
    const res3 = await fetch(`${baseUrl}/api/inquiries/dashboard-stats`);
    assert.equal(res3.headers.get('x-cache'), 'MISS');
    const data3 = await res3.json();
    assert.equal(data3.fetchCount, 2, 'Should have re-executed handler after cache invalidation');
  });

  test('should report accurate observability metrics in /api/cache/stats', async () => {
    const res = await fetch(`${baseUrl}/api/cache/stats`);
    assert.equal(res.status, 200);
    const stats = await res.json();
    assert.ok(stats.hits > 0);
    assert.ok(stats.misses > 0);
    assert.ok(typeof stats.hitRate === 'string');
    assert.ok(stats.activeKeys >= 0);
  });
});

