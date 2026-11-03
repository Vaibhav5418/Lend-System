import { cacheService } from '../services/cacheService.js';
import { sanitizeLog } from '../utils/security.js';

/**
 * Deterministically sorts object keys for uniform cache key generation.
 * e.g., { b: 2, a: 1 } -> { a: 1, b: 2 }
 */
function sortQueryKeys(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

/**
 * Express middleware for caching API GET responses.
 *
 * @param {object} [options]
 * @param {number} [options.ttl=60] - Time to live in seconds
 * @param {string[]} [options.tags=[]] - Tags for group invalidation
 * @param {string} [options.prefix=''] - Custom key prefix
 * @param {(req: import('express').Request) => string} [options.keyGenerator]
 */
export function cacheMiddleware(options = {}) {
  const ttl = typeof options.ttl === 'number' && options.ttl > 0 ? options.ttl : 60;
  const tags = Array.isArray(options.tags) ? options.tags : [options.tags].filter(Boolean);
  const prefix = options.prefix || '';

  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching if explicit no-cache header is sent
    const cacheControl = req.headers['cache-control'] || '';
    if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    // Generate unique, deterministic cache key
    let cacheKey;
    if (typeof options.keyGenerator === 'function') {
      try {
        cacheKey = options.keyGenerator(req);
      } catch (err) {
        console.warn('Error in custom cache keyGenerator:', sanitizeLog(err?.message || err));
      }
    }

    if (!cacheKey) {
      const sortedQuery = sortQueryKeys(req.query);
      const queryString = Object.keys(sortedQuery).length > 0 ? `:${JSON.stringify(sortedQuery)}` : '';
      const pathKey = prefix || (req.baseUrl + (req.path === '/' ? '' : req.path));
      cacheKey = `api:${pathKey}${queryString}`;
    }

    try {
      const cached = await cacheService.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Driver', cacheService.getDriver());
        return res.json(cached);
      }
    } catch (err) {
      console.warn('Cache lookup error:', sanitizeLog(err?.message || err));
    }

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-Driver', cacheService.getDriver());

    // Intercept res.json to capture and cache response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful 2xx responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire-and-forget set to avoid blocking response pipeline
        void cacheService.set(cacheKey, body, ttl, tags).catch((err) => {
          console.warn('Failed to cache response:', sanitizeLog(err?.message || err));
        });
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidate cache tags helper for mutation handlers.
 * @param {string|string[]} tags
 */
export async function invalidateCache(tags) {
  try {
    await cacheService.invalidateTags(tags);
  } catch (err) {
    console.error('Cache invalidation error:', sanitizeLog(err?.message || err));
  }
}

/**
 * Invalidate cache pattern helper.
 * @param {string} pattern
 */
export async function invalidatePattern(pattern) {
  try {
    await cacheService.invalidatePattern(pattern);
  } catch (err) {
    console.error('Cache pattern invalidation error:', sanitizeLog(err?.message || err));
  }
}

