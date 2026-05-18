import * as assert from 'assert';

import { LazyContentProvider } from '../../services/lazyContentProvider';
import { ContentAnalysisCache } from '../../services/contentAnalysisCache';
import { analyzeContent } from '../../services/contentAnalyzer';
import type { GraphNode } from '../../types';

/**
 * Creates a minimal steering GraphNode fixture for testing.
 */
function createSteeringNode(filePath: string): GraphNode {
  return {
    id: filePath,
    label: filePath.replace(/\.md$/, ''),
    type: 'steering-flow',
    workspaceFolder: 'Workspace',
    filePath,
    resolved: true,
    source: 'local',
  };
}

/**
 * Creates a non-steering GraphNode fixture for testing.
 */
function createSkillNode(filePath: string): GraphNode {
  return {
    id: filePath,
    label: filePath.replace(/\.md$/, ''),
    type: 'skill',
    workspaceFolder: 'Workspace',
    filePath,
    resolved: true,
    source: 'local',
  };
}

describe('LazyContentProvider', function () {
  describe('ensureMetrics() — cache hit', function () {
    it('returns cached metrics without re-computing', function () {
      const cache = new ContentAnalysisCache();
      const provider = new LazyContentProvider(cache);

      const content = '# Title\n\nAlways use strict mode.\nNever skip tests.';
      const node = createSteeringNode('test.md');
      const contentMap = new Map([['test.md', content]]);

      // First call: computes and caches
      provider.ensureMetrics([node], contentMap);
      const firstKeywords = node.metadata?.keywords;
      const firstHeaders = node.metadata?.sectionHeaders;
      const firstRatio = node.metadata?.actionableRatio;

      // Create a fresh node to verify cache hit repopulates metadata
      const freshNode = createSteeringNode('test.md');

      // Second call: should use cache (same content hash)
      provider.ensureMetrics([freshNode], contentMap);

      assert.deepStrictEqual(freshNode.metadata?.keywords, firstKeywords);
      assert.deepStrictEqual(freshNode.metadata?.sectionHeaders, firstHeaders);
      assert.strictEqual(freshNode.metadata?.actionableRatio, firstRatio);
    });
  });

  describe('ensureMetrics() — cache miss', function () {
    it('computes metrics and stores in cache', function () {
      const cache = new ContentAnalysisCache();
      const provider = new LazyContentProvider(cache);

      const content = '# Guide\n\nAlways validate input.';
      const node = createSteeringNode('guide.md');
      const contentMap = new Map([['guide.md', content]]);

      provider.ensureMetrics([node], contentMap);

      assert.ok(node.metadata?.keywords);
      assert.ok(node.metadata?.keywords.length > 0);
      assert.deepStrictEqual(node.metadata?.sectionHeaders, ['guide']);
      assert.ok(cache.size > 0);
    });
  });

  describe('ensureMetrics() — skips non-steering nodes', function () {
    it('does not compute metrics for skill nodes', function () {
      const cache = new ContentAnalysisCache();
      const provider = new LazyContentProvider(cache);

      const content = '# Skill Content\n\nAlways do something.';
      const node = createSkillNode('skill.md');
      const contentMap = new Map([['skill.md', content]]);

      provider.ensureMetrics([node], contentMap);

      assert.strictEqual(node.metadata?.keywords, undefined);
      assert.strictEqual(cache.size, 0);
    });
  });

  describe('ensureMetrics() — skips nodes without content', function () {
    it('does not compute metrics when content is missing from map', function () {
      const cache = new ContentAnalysisCache();
      const provider = new LazyContentProvider(cache);

      const node = createSteeringNode('missing.md');
      const contentMap = new Map<string, string>();

      provider.ensureMetrics([node], contentMap);

      assert.strictEqual(node.metadata?.keywords, undefined);
      assert.strictEqual(cache.size, 0);
    });
  });

  describe('ensureMetrics() — result matches analyzeContent()', function () {
    it('produces identical metrics to direct analyzeContent call', function () {
      const cache = new ContentAnalysisCache();
      const provider = new LazyContentProvider(cache);

      const content = [
        '# Configuration',
        '',
        'Always use TypeScript strict mode.',
        'Never use any types.',
        'Prefer composition over inheritance.',
      ].join('\n');

      const node = createSteeringNode('config.md');
      const contentMap = new Map([['config.md', content]]);

      provider.ensureMetrics([node], contentMap);

      const directMetrics = analyzeContent(content);

      assert.deepStrictEqual(node.metadata?.keywords, directMetrics.keywords);
      assert.deepStrictEqual(node.metadata?.sectionHeaders, directMetrics.sectionHeaders);
      assert.strictEqual(node.metadata?.actionableRatio, directMetrics.actionableRatio);
      assert.deepStrictEqual(node.metadata?.imperativeLines, directMetrics.imperativeLines);
    });
  });

  describe('invalidate()', function () {
    it('removes cache entry for the given file path', function () {
      const cache = new ContentAnalysisCache();
      const provider = new LazyContentProvider(cache);

      const content = '# Test\n\nAlways validate.';
      const node = createSteeringNode('test.md');
      const contentMap = new Map([['test.md', content]]);

      provider.ensureMetrics([node], contentMap);
      assert.strictEqual(cache.size, 1);

      provider.invalidate('test.md');
      assert.strictEqual(cache.size, 0);
    });
  });

  describe('getCache()', function () {
    it('returns the underlying cache instance', function () {
      const cache = new ContentAnalysisCache();
      const provider = new LazyContentProvider(cache);

      assert.strictEqual(provider.getCache(), cache);
    });
  });
});
