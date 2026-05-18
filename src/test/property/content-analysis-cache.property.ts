import * as assert from 'assert';
import * as fc from 'fast-check';

import { ContentAnalysisCache, computeContentHash } from '../../services/contentAnalysisCache';
import { analyzeContent } from '../../services/contentAnalyzer';
import type { ContentMetrics } from '../../services/contentAnalyzer';

/**
 * Property-Based Tests: ContentAnalysisCache
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 6.1, 6.2**
 *
 * Tests cache consistency, size bounds, and equivalence with direct computation.
 */

/** Arbitrary for generating realistic steering file content */
const steeringContentArb = fc.array(
  fc.oneof(
    fc.constant('# Section Header'),
    fc.constant('## Sub Section'),
    fc.constant('Always use strict mode.'),
    fc.constant('Never skip validation.'),
    fc.constant('Must handle errors properly.'),
    fc.constant('Prefer composition over inheritance.'),
    fc.constant('Avoid global state in modules.'),
    fc.constant('This is a descriptive line about the system.'),
    fc.constant('The architecture follows clean patterns.'),
    fc.constant(''),
    fc.stringOf(fc.char(), { minLength: 5, maxLength: 80 }),
  ),
  { minLength: 1, maxLength: 20 },
).map((lines) => lines.join('\n'));

/** Arbitrary for generating content metrics */
const metricsArb = fc.record({
  keywords: fc.array(fc.stringOf(fc.char(), { minLength: 4, maxLength: 12 }), { minLength: 0, maxLength: 10 }),
  sectionHeaders: fc.array(fc.stringOf(fc.char(), { minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
  actionableRatio: fc.double({ min: 0, max: 1, noNaN: true }),
  imperativeLines: fc.array(
    fc.record({
      text: fc.stringOf(fc.char(), { minLength: 5, maxLength: 50 }),
      pattern: fc.constantFrom('always', 'never', 'use', 'do_not', 'prefer', 'avoid', 'must', 'shall'),
      subject: fc.stringOf(fc.char(), { minLength: 3, maxLength: 15 }),
    }),
    { minLength: 0, maxLength: 5 },
  ),
}) as fc.Arbitrary<ContentMetrics>;

/** Arbitrary for cache operation sequences */
type CacheOp =
  | { type: 'set'; hash: string; metrics: ContentMetrics }
  | { type: 'get'; hash: string }
  | { type: 'invalidate'; path: string };

const cacheOpArb: fc.Arbitrary<CacheOp> = fc.oneof(
  fc.record({
    type: fc.constant('set' as const),
    hash: fc.hexaString({ minLength: 8, maxLength: 8 }),
    metrics: metricsArb,
  }),
  fc.record({
    type: fc.constant('get' as const),
    hash: fc.hexaString({ minLength: 8, maxLength: 8 }),
  }),
  fc.record({
    type: fc.constant('invalidate' as const),
    path: fc.stringOf(fc.char(), { minLength: 3, maxLength: 20 }),
  }),
);

describe('ContentAnalysisCache — Property-Based Tests', function () {
  this.timeout(30000);

  it('Property: get after set returns identical metrics for same hash', function () {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 8, maxLength: 32 }),
        metricsArb,
        (hash: string, metrics: ContentMetrics) => {
          const cache = new ContentAnalysisCache();
          cache.set(hash, metrics);
          const retrieved = cache.get(hash);

          assert.deepStrictEqual(retrieved, metrics);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property: size never exceeds maxCapacity for any operation sequence', function () {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.array(cacheOpArb, { minLength: 1, maxLength: 100 }),
        (maxCapacity: number, ops: CacheOp[]) => {
          const cache = new ContentAnalysisCache(maxCapacity);

          for (const op of ops) {
            switch (op.type) {
              case 'set':
                cache.set(op.hash, op.metrics);
                break;
              case 'get':
                cache.get(op.hash);
                break;
              case 'invalidate':
                cache.invalidateByPath(op.path);
                break;
            }
            assert.ok(
              cache.size <= maxCapacity,
              `Cache size ${cache.size} exceeded maxCapacity ${maxCapacity}`,
            );
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('Property: cached result is identical to analyzeContent() for same content', function () {
    fc.assert(
      fc.property(steeringContentArb, (content: string) => {
        const cache = new ContentAnalysisCache();
        const hash = computeContentHash(content);
        const directMetrics = analyzeContent(content);

        cache.set(hash, directMetrics);
        const cachedMetrics = cache.get(hash);

        assert.deepStrictEqual(cachedMetrics, directMetrics);
      }),
      { numRuns: 100 },
    );
  });

  it('Property: invalidateByPath followed by get returns undefined', function () {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 8, maxLength: 32 }),
        fc.stringOf(fc.char(), { minLength: 3, maxLength: 30 }),
        metricsArb,
        (hash: string, filePath: string, metrics: ContentMetrics) => {
          const cache = new ContentAnalysisCache();

          cache.set(hash, metrics);
          cache.registerPath(filePath, hash);
          cache.invalidateByPath(filePath);

          const result = cache.get(hash);
          assert.strictEqual(result, undefined);
        },
      ),
      { numRuns: 100 },
    );
  });
});
