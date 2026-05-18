import * as assert from 'assert';

import { ContentAnalysisCache, computeContentHash } from '../../services/contentAnalysisCache';
import type { ContentMetrics } from '../../services/contentAnalyzer';

/**
 * Creates a minimal ContentMetrics fixture for testing.
 */
function createMetrics(keywords: string[] = ['test']): ContentMetrics {
  return {
    keywords,
    sectionHeaders: ['header'],
    actionableRatio: 0.5,
    imperativeLines: [{ text: 'Always test', pattern: 'always', subject: 'test' }],
  };
}

describe('ContentAnalysisCache', function () {
  describe('get() / set()', function () {
    it('returns cached metrics for a known hash (cache hit)', function () {
      const cache = new ContentAnalysisCache();
      const hash = 'abc123';
      const metrics = createMetrics(['keyword1', 'keyword2']);

      cache.set(hash, metrics);
      const result = cache.get(hash);

      assert.deepStrictEqual(result, metrics);
    });

    it('returns undefined for an unknown hash (cache miss)', function () {
      const cache = new ContentAnalysisCache();
      const result = cache.get('nonexistent');

      assert.strictEqual(result, undefined);
    });

    it('overwrites existing entry with same hash', function () {
      const cache = new ContentAnalysisCache();
      const hash = 'abc123';
      const metrics1 = createMetrics(['old']);
      const metrics2 = createMetrics(['new']);

      cache.set(hash, metrics1);
      cache.set(hash, metrics2);

      assert.deepStrictEqual(cache.get(hash), metrics2);
      assert.strictEqual(cache.size, 1);
    });
  });

  describe('invalidateByPath()', function () {
    it('removes cache entry associated with a file path', function () {
      const cache = new ContentAnalysisCache();
      const hash = 'abc123';
      const metrics = createMetrics();

      cache.set(hash, metrics);
      cache.registerPath('file.md', hash);
      cache.invalidateByPath('file.md');

      assert.strictEqual(cache.get(hash), undefined);
      assert.strictEqual(cache.size, 0);
    });

    it('does nothing for an unregistered path', function () {
      const cache = new ContentAnalysisCache();
      const hash = 'abc123';
      const metrics = createMetrics();

      cache.set(hash, metrics);
      cache.invalidateByPath('unknown.md');

      assert.deepStrictEqual(cache.get(hash), metrics);
      assert.strictEqual(cache.size, 1);
    });
  });

  describe('LRU eviction', function () {
    it('evicts the least recently used entry when at capacity', function () {
      const cache = new ContentAnalysisCache(3);

      cache.set('hash1', createMetrics(['first']));
      cache.set('hash2', createMetrics(['second']));
      cache.set('hash3', createMetrics(['third']));

      // Cache is full (3/3). Adding a 4th should evict hash1 (LRU).
      cache.set('hash4', createMetrics(['fourth']));

      assert.strictEqual(cache.get('hash1'), undefined);
      assert.ok(cache.get('hash2'));
      assert.ok(cache.get('hash3'));
      assert.ok(cache.get('hash4'));
      assert.strictEqual(cache.size, 3);
    });

    it('accessing an entry moves it to most-recently-used', function () {
      const cache = new ContentAnalysisCache(3);

      cache.set('hash1', createMetrics(['first']));
      cache.set('hash2', createMetrics(['second']));
      cache.set('hash3', createMetrics(['third']));

      // Access hash1 to make it most recently used
      cache.get('hash1');

      // Adding hash4 should evict hash2 (now the LRU)
      cache.set('hash4', createMetrics(['fourth']));

      assert.ok(cache.get('hash1'));
      assert.strictEqual(cache.get('hash2'), undefined);
      assert.ok(cache.get('hash3'));
      assert.ok(cache.get('hash4'));
    });

    it('size never exceeds maxCapacity', function () {
      const cache = new ContentAnalysisCache(5);

      for (let i = 0; i < 20; i++) {
        cache.set(`hash${i}`, createMetrics([`kw${i}`]));
      }

      assert.ok(cache.size <= 5);
    });
  });

  describe('clear()', function () {
    it('empties the cache completely', function () {
      const cache = new ContentAnalysisCache();

      cache.set('hash1', createMetrics());
      cache.set('hash2', createMetrics());
      cache.registerPath('file1.md', 'hash1');

      cache.clear();

      assert.strictEqual(cache.size, 0);
      assert.strictEqual(cache.get('hash1'), undefined);
      assert.strictEqual(cache.get('hash2'), undefined);
    });
  });

  describe('size', function () {
    it('returns 0 for empty cache', function () {
      const cache = new ContentAnalysisCache();
      assert.strictEqual(cache.size, 0);
    });

    it('reflects the number of stored entries', function () {
      const cache = new ContentAnalysisCache();
      cache.set('h1', createMetrics());
      cache.set('h2', createMetrics());
      cache.set('h3', createMetrics());
      assert.strictEqual(cache.size, 3);
    });
  });

  describe('computeContentHash()', function () {
    it('returns a 32-character hex string', function () {
      const hash = computeContentHash('hello world');
      assert.strictEqual(hash.length, 32);
      assert.ok(/^[0-9a-f]+$/.test(hash));
    });

    it('returns same hash for same content', function () {
      const h1 = computeContentHash('test content');
      const h2 = computeContentHash('test content');
      assert.strictEqual(h1, h2);
    });

    it('returns different hash for different content', function () {
      const h1 = computeContentHash('content A');
      const h2 = computeContentHash('content B');
      assert.notStrictEqual(h1, h2);
    });

    it('handles empty string', function () {
      const hash = computeContentHash('');
      assert.strictEqual(hash.length, 32);
    });
  });
});
