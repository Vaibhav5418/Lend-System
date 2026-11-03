import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { cacheService } from '../src/services/cacheService.js';
import { cacheMiddleware, invalidateCache } from '../src/middleware/cacheMiddleware.js';

describe('Comprehensive Caching Strategy Suite', () => {
  beforeEach(async () => {
    await cacheService.flush();
  });

  describe('1. MemoryCacheStore & CacheService Operations', () => {
    it('should set and get values with correct types', async () => {
      await cacheService.set('test:key1', { count: 42, name: 'Alice' }, 60, ['test']);
      const val = await cacheService.get('test:key1');
      assert.deepEqual(val, { count: 42, name: 'Alice' });
    });

    it('should return null on cache miss', async () => {
      const val = await cacheService.get('test:nonexistent');
      assert.equal(val, null);
    });

    it('should expire keys after TTL has elapsed', async () => {
      // 1 second TTL
      await cacheService.set('test:short', 'temporary', 1);
      const immediate = await cacheService.get('test:short');
      assert.equal(immediate, 'temporary');

      // Wait 1100ms
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const expired = await cacheService.get('test:short');
      assert.equal(expired, null);
    });

    it('should delete individual keys via del()', async () => {
      await cacheService.set('test:del', 'delete-me', 60);
      assert.equal(await cacheService.get('test:del'), 'delete-me');

      await cacheService.del('test:del');
      assert.equal(await cacheService.get('test:del'), null);
    });

    it('should support getOrSet cache-aside helper', async () => {
      let fetchCount = 0;
      const fetchFn = async () => {
        fetchCount++;
        return { data: 'from-db' };
      };

      const res1 = await cacheService.getOrSet('test:aside', fetchFn, 60, ['aside']);
      assert.equal(res1.data, 'from-db');
      assert.equal(fetchCount, 1);

      // Second call should return cached value without calling fetchFn
      const res2 = await cacheService.getOrSet('test:aside', fetchFn, 60, ['aside']);
      assert.equal(res2.data, 'from-db');
      assert.equal(fetchCount, 1);
    });
  });

  describe('2. Multi-Key & Grouped Tag Invalidation', () => {
    it('should invalidate all keys associated with a tag', async () => {
      await cacheService.set('inquiries:list:page1', [{ id: 'INQ-001' }], 60, ['inquiries']);
      await cacheService.set('inquiries:list:page2', [{ id: 'INQ-002' }], 60, ['inquiries']);
      await cacheService.set('inquiries:stats', { total: 100 }, 60, ['inquiries', 'dashboard']);
      await cacheService.set('loans:list', [{ id: 'LOAN-001' }], 60, ['borrower']);

      // Invalidate inquiries tag
      await cacheService.invalidateTags(['inquiries']);

      // Inquiries-tagged keys should be removed
      assert.equal(await cacheService.get('inquiries:list:page1'), null);
      assert.equal(await cacheService.get('inquiries:list:page2'), null);
      assert.equal(await cacheService.get('inquiries:stats'), null);

      // Borrower loans should still be intact
      const loan = await cacheService.get('loans:list');
      assert.deepEqual(loan, [{ id: 'LOAN-001' }]);
    });

    it('should invalidate keys matching a pattern', async () => {
      await cacheService.set('api:/inquiries:1', { page: 1 }, 60);
      await cacheService.set('api:/inquiries:2', { page: 2 }, 60);
      await cacheService.set('api:/borrower:1', { page: 1 }, 60);

      await cacheService.invalidatePattern('api:/inquiries:*');

      assert.equal(await cacheService.get('api:/inquiries:1'), null);
      assert.equal(await cacheService.get('api:/inquiries:2'), null);
      assert.deepEqual(await cacheService.get('api:/borrower:1'), { page: 1 });
    });
  });

  describe('3. LRU Eviction & Capacity Constraints', () => {
    it('should evict least-recently used items when capacity is reached', () => {
      // Test LRU specifically on MemoryCacheStore with small maxEntries
      const smallStore = new (cacheService.memoryStore.constructor)({ maxEntries: 3 });

      smallStore.set('k1', 1);
      smallStore.set('k2', 2);
      smallStore.set('k3', 3);

      // Access k1 so k2 becomes least recently accessed
      smallStore.get('k1');

      // Add k4 (should evict k2)
      smallStore.set('k4', 4);

      assert.equal(smallStore.get('k2'), null, 'k2 should have been evicted');
      assert.equal(smallStore.get('k1'), 1, 'k1 should still exist');
      assert.equal(smallStore.get('k3'), 3, 'k3 should still exist');
      assert.equal(smallStore.get('k4'), 4, 'k4 should still exist');

      smallStore.destroy();
    });
  });

  describe('4. Express Middleware Behavior & Headers', () => {
    it('should set X-Cache: MISS on first request and HIT on subsequent request', async () => {
      const middleware = cacheMiddleware({ ttl: 60, prefix: '/test-route' });

      let handlerCalled = 0;
      const fakeReq = {
        method: 'GET',
        headers: {},
        query: { page: '1', limit: '25' },
        baseUrl: '',
        path: '/test-route',
      };

      const headers = {};
      let responseBody = null;

      const fakeRes = {
        statusCode: 200,
        setHeader(name, val) {
          headers[name] = val;
        },
        json(data) {
          responseBody = data;
          return this;
        },
      };

      // 1st request (MISS)
      await middleware(fakeReq, fakeRes, () => {
        handlerCalled++;
        fakeRes.json({ success: true, count: 10 });
      });

      assert.equal(headers['X-Cache'], 'MISS');
      assert.equal(handlerCalled, 1);
      assert.deepEqual(responseBody, { success: true, count: 10 });

      // Wait a tick for async cache write
      await new Promise((r) => setTimeout(r, 50));

      // 2nd request (HIT)
      const hitHeaders = {};
      let hitBody = null;
      const fakeHitRes = {
        statusCode: 200,
        setHeader(name, val) {
          hitHeaders[name] = val;
        },
        json(data) {
          hitBody = data;
          return this;
        },
      };

      let hitHandlerCalled = false;
      await middleware(fakeReq, fakeHitRes, () => {
        hitHandlerCalled = true;
      });

      assert.equal(hitHeaders['X-Cache'], 'HIT');
      assert.equal(hitHandlerCalled, false, 'Route handler should not be executed on cache HIT');
      assert.deepEqual(hitBody, { success: true, count: 10 });
    });

    it('should bypass cache when Cache-Control: no-cache is provided', async () => {
      const middleware = cacheMiddleware({ ttl: 60, prefix: '/test-bypass' });
      const req = {
        method: 'GET',
        headers: { 'cache-control': 'no-cache' },
        query: {},
        baseUrl: '',
        path: '/test-bypass',
      };

      const headers = {};
      const res = {
        setHeader(name, val) {
          headers[name] = val;
        },
      };

      let nextCalled = false;
      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.equal(headers['X-Cache'], 'BYPASS');
      assert.equal(nextCalled, true);
    });
  });

  describe('5. Observability & Stats Tracking', () => {
    it('should provide accurate stats on hits, misses, and hit rate', async () => {
      await cacheService.set('stat:1', 'a');
      await cacheService.get('stat:1'); // hit
      await cacheService.get('stat:2'); // miss

      const stats = cacheService.getStats();
      assert.equal(stats.hits >= 1, true);
      assert.equal(stats.misses >= 1, true);
      assert.equal(typeof stats.hitRate, 'string');
    });
  });
});

