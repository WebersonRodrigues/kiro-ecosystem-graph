import * as assert from 'assert';
import {
  computeFragileLinks,
  computeCoverageGaps,
  computeWeakInstructions,
  computeSteeringsWithoutAccess,
  computeDecisionPath,
} from '../../services/cognitiveValidations';
import type { GraphNode, GraphEdge } from '../../types';

function makeNode(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    label: id.replace('.md', ''),
    type: 'steering-domain',
    workspaceFolder: 'Workspace',
    filePath: id,
    resolved: true,
    source: 'local',
    ...overrides,
  };
}

describe('CognitiveValidations — computeFragileLinks()', function () {
  it('includes backtick-ref edges from always-loaded sources', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'always' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].sourceLabel, 'a');
  });

  it('includes backtick-ref edges from auto-loaded sources', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'auto' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 1);
  });

  it('includes backtick-ref edges from hook sources', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto', metadata: { inclusion: 'fileMatch' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 1);
  });

  it('excludes backtick-ref edges from fileMatch sources', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'fileMatch' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('excludes backtick-ref edges from manual sources', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'manual' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('excludes non-backtick-ref edges', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'always' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'wiki-link' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('returns empty when all sources are fileMatch/manual', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'fileMatch' } }),
      makeNode('b.md', { metadata: { inclusion: 'manual' } }),
      makeNode('c.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'c.md', type: 'backtick-ref' },
      { source: 'b.md', target: 'c.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('mixed sources: only includes always/auto/hook edges', function () {
    const nodes: GraphNode[] = [
      makeNode('always.md', { metadata: { inclusion: 'always' } }),
      makeNode('manual.md', { metadata: { inclusion: 'manual' } }),
      makeNode('hook.json', { type: 'hook-manual' }),
      makeNode('target.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'always.md', target: 'target.md', type: 'backtick-ref' },
      { source: 'manual.md', target: 'target.md', type: 'backtick-ref' },
      { source: 'hook.json', target: 'target.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 2);
    const sources = result.map((r) => r.source);
    assert.ok(sources.includes('always.md'));
    assert.ok(sources.includes('hook.json'));
    assert.ok(!sources.includes('manual.md'));
  });

  it('source without metadata defaults to always (included)', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: undefined }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Coverage Gaps
// ─────────────────────────────────────────────────────────────────────────────

describe('CognitiveValidations — computeCoverageGaps()', function () {
  it('folder with steerings is NOT a gap', function () {
    const nodes: GraphNode[] = [
      makeNode('steering.md', { type: 'steering-domain', workspaceFolder: 'API' }),
    ];
    const result = computeCoverageGaps(nodes, ['API']);
    assert.strictEqual(result.length, 0);
  });

  it('folder without steerings IS a gap', function () {
    const nodes: GraphNode[] = [
      makeNode('steering.md', { type: 'steering-domain', workspaceFolder: 'API' }),
    ];
    const result = computeCoverageGaps(nodes, ['API', 'Mobile']);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].folder, 'Mobile');
  });

  it('empty workspaceFolders returns empty result', function () {
    const nodes: GraphNode[] = [
      makeNode('steering.md', { type: 'steering-domain', workspaceFolder: 'API' }),
    ];
    const result = computeCoverageGaps(nodes, []);
    assert.strictEqual(result.length, 0);
  });

  it('multiple folders, some with steerings some without', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-flow', workspaceFolder: 'Backend' }),
      makeNode('b.md', { type: 'steering-tech', workspaceFolder: 'Backend' }),
      makeNode('c.md', { type: 'hook-auto', workspaceFolder: 'Frontend' }),
    ];
    const result = computeCoverageGaps(nodes, ['Backend', 'Frontend', 'Infra']);
    assert.strictEqual(result.length, 2);
    const gapFolders = result.map((g) => g.folder);
    assert.ok(gapFolders.includes('Frontend'));
    assert.ok(gapFolders.includes('Infra'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Weak Instructions
// ─────────────────────────────────────────────────────────────────────────────

describe('CognitiveValidations — computeWeakInstructions()', function () {
  it('steering with 5 lines is weak (threshold=10)', function () {
    const nodes: GraphNode[] = [
      makeNode('short.md', { type: 'steering-domain', metadata: { lineCount: 5 } }),
    ];
    const result = computeWeakInstructions(nodes, 10);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].lineCount, 5);
  });

  it('steering with 10 lines is NOT weak (threshold=10)', function () {
    const nodes: GraphNode[] = [
      makeNode('exact.md', { type: 'steering-domain', metadata: { lineCount: 10 } }),
    ];
    const result = computeWeakInstructions(nodes, 10);
    assert.strictEqual(result.length, 0);
  });

  it('steering with 0 lines (no lineCount) is NOT weak (skip)', function () {
    const nodes: GraphNode[] = [
      makeNode('no-data.md', { type: 'steering-domain', metadata: {} }),
    ];
    const result = computeWeakInstructions(nodes, 10);
    assert.strictEqual(result.length, 0);
  });

  it('steering with 100 lines is NOT weak', function () {
    const nodes: GraphNode[] = [
      makeNode('big.md', { type: 'steering-flow', metadata: { lineCount: 100 } }),
    ];
    const result = computeWeakInstructions(nodes, 10);
    assert.strictEqual(result.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Steerings Without Access
// ─────────────────────────────────────────────────────────────────────────────

describe('CognitiveValidations — computeSteeringsWithoutAccess()', function () {
  it('fileMatch steering not referenced by hook is flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('conditional.md', { type: 'steering-domain', metadata: { inclusion: 'fileMatch' } }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeSteeringsWithoutAccess(nodes, edges);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].inclusion, 'fileMatch');
  });

  it('manual steering not referenced by hook is flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('manual.md', { type: 'steering-tech', metadata: { inclusion: 'manual' } }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeSteeringsWithoutAccess(nodes, edges);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].inclusion, 'manual');
  });

  it('always steering not referenced is NOT flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('always.md', { type: 'steering-domain', metadata: { inclusion: 'always' } }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeSteeringsWithoutAccess(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('fileMatch steering referenced by hook is NOT flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto' }),
      makeNode('conditional.md', { type: 'steering-domain', metadata: { inclusion: 'fileMatch' } }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'conditional.md', type: 'hook-implicit' },
    ];
    const result = computeSteeringsWithoutAccess(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('auto steering not referenced is NOT flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('auto.md', { type: 'steering-domain', metadata: { inclusion: 'auto' } }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeSteeringsWithoutAccess(nodes, edges);
    assert.strictEqual(result.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Decision Path
// ─────────────────────────────────────────────────────────────────────────────

describe('CognitiveValidations — computeDecisionPath()', function () {
  it('hook with steering edge is NOT in hooksWithoutSteering', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto' }),
      makeNode('guide.md', { type: 'steering-flow' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'guide.md', type: 'hook-implicit' },
    ];
    const result = computeDecisionPath(nodes, edges);
    assert.strictEqual(result.hooksWithoutSteering.length, 0);
  });

  it('hook without steering edge IS in hooksWithoutSteering', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-manual' }),
      makeNode('other.md', { type: 'steering-domain' }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeDecisionPath(nodes, edges);
    assert.strictEqual(result.hooksWithoutSteering.length, 1);
    assert.strictEqual(result.hooksWithoutSteering[0].id, 'hook.json');
  });

  it('decision steering (fileMatch) with hook is NOT in steeringsWithoutHook', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto' }),
      makeNode('decision.md', {
        type: 'steering-domain',
        metadata: { inclusion: 'fileMatch', keywords: ['decide', 'routing'] },
      }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'decision.md', type: 'hook-implicit' },
    ];
    const result = computeDecisionPath(nodes, edges);
    assert.strictEqual(result.steeringsWithoutHook.length, 0);
  });

  it('decision steering (fileMatch) without hook IS in steeringsWithoutHook', function () {
    const nodes: GraphNode[] = [
      makeNode('decision.md', {
        type: 'steering-domain',
        metadata: { inclusion: 'fileMatch', keywords: ['decide', 'routing'] },
      }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeDecisionPath(nodes, edges);
    assert.strictEqual(result.steeringsWithoutHook.length, 1);
    assert.strictEqual(result.steeringsWithoutHook[0].id, 'decision.md');
  });

  it('always steering with decision keywords is NOT flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('always-decision.md', {
        type: 'steering-flow',
        metadata: { inclusion: 'always', keywords: ['decide', 'when', 'criteria'] },
      }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeDecisionPath(nodes, edges);
    assert.strictEqual(result.steeringsWithoutHook.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stale Content Detection (Rule 20)
// ─────────────────────────────────────────────────────────────────────────────

import { detectStaleContent } from '../../services/cognitiveValidations';

describe('CognitiveValidations — detectStaleContent()', function () {
  const DAY_MS = 1000 * 60 * 60 * 24;
  const NOW = 1700000000000; // fixed reference time

  it('detects stale steering with high degree', function () {
    const mtime = NOW - (100 * DAY_MS); // 100 days old
    const nodes: GraphNode[] = [
      makeNode('old-hub.md', { type: 'steering-domain', metadata: { mtime } }),
      makeNode('a.md'), makeNode('b.md'), makeNode('c.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'old-hub.md', target: 'a.md', type: 'wiki-link' },
      { source: 'old-hub.md', target: 'b.md', type: 'wiki-link' },
      { source: 'c.md', target: 'old-hub.md', type: 'wiki-link' },
    ];
    const result = detectStaleContent(nodes, edges, { currentTimeMs: NOW });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'old-hub.md');
    assert.strictEqual(result[0].stalenessDays, 100);
    assert.strictEqual(result[0].degree, 3);
    assert.strictEqual(result[0].riskScore, 300);
  });

  it('skips node with mtime within threshold', function () {
    const mtime = NOW - (30 * DAY_MS); // 30 days old (< 90)
    const nodes: GraphNode[] = [
      makeNode('recent.md', { type: 'steering-domain', metadata: { mtime } }),
      makeNode('a.md'), makeNode('b.md'), makeNode('c.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'recent.md', target: 'a.md', type: 'wiki-link' },
      { source: 'recent.md', target: 'b.md', type: 'wiki-link' },
      { source: 'c.md', target: 'recent.md', type: 'wiki-link' },
    ];
    const result = detectStaleContent(nodes, edges, { currentTimeMs: NOW });
    assert.strictEqual(result.length, 0);
  });

  it('skips node with degree below threshold', function () {
    const mtime = NOW - (100 * DAY_MS); // 100 days old
    const nodes: GraphNode[] = [
      makeNode('old-leaf.md', { type: 'steering-domain', metadata: { mtime } }),
      makeNode('a.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'old-leaf.md', target: 'a.md', type: 'wiki-link' },
    ];
    const result = detectStaleContent(nodes, edges, { currentTimeMs: NOW });
    assert.strictEqual(result.length, 0);
  });

  it('skips node with mtime undefined', function () {
    const nodes: GraphNode[] = [
      makeNode('no-mtime.md', { type: 'steering-domain', metadata: {} }),
      makeNode('a.md'), makeNode('b.md'), makeNode('c.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'no-mtime.md', target: 'a.md', type: 'wiki-link' },
      { source: 'no-mtime.md', target: 'b.md', type: 'wiki-link' },
      { source: 'c.md', target: 'no-mtime.md', type: 'wiki-link' },
    ];
    const result = detectStaleContent(nodes, edges, { currentTimeMs: NOW });
    assert.strictEqual(result.length, 0);
  });

  it('orders results by riskScore descending', function () {
    const nodes: GraphNode[] = [
      makeNode('low.md', { type: 'steering-domain', metadata: { mtime: NOW - (100 * DAY_MS) } }),
      makeNode('high.md', { type: 'steering-domain', metadata: { mtime: NOW - (200 * DAY_MS) } }),
      makeNode('a.md'), makeNode('b.md'), makeNode('c.md'), makeNode('d.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'low.md', target: 'a.md', type: 'wiki-link' },
      { source: 'low.md', target: 'b.md', type: 'wiki-link' },
      { source: 'c.md', target: 'low.md', type: 'wiki-link' },
      { source: 'high.md', target: 'a.md', type: 'wiki-link' },
      { source: 'high.md', target: 'b.md', type: 'wiki-link' },
      { source: 'high.md', target: 'c.md', type: 'wiki-link' },
      { source: 'd.md', target: 'high.md', type: 'wiki-link' },
    ];
    const result = detectStaleContent(nodes, edges, { currentTimeMs: NOW });
    assert.strictEqual(result.length, 2);
    assert.ok(result[0].riskScore >= result[1].riskScore);
    assert.strictEqual(result[0].id, 'high.md');
  });

  it('uses custom thresholds', function () {
    const mtime = NOW - (50 * DAY_MS); // 50 days old
    const nodes: GraphNode[] = [
      makeNode('custom.md', { type: 'steering-domain', metadata: { mtime } }),
      makeNode('a.md'), makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'custom.md', target: 'a.md', type: 'wiki-link' },
      { source: 'b.md', target: 'custom.md', type: 'wiki-link' },
    ];
    const result = detectStaleContent(nodes, edges, {
      stalenessThresholdDays: 30,
      degreeThreshold: 2,
      currentTimeMs: NOW,
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].stalenessDays, 50);
    assert.strictEqual(result[0].degree, 2);
  });

  it('threshold zero disables staleness filter', function () {
    const mtime = NOW - (5 * DAY_MS); // only 5 days old
    const nodes: GraphNode[] = [
      makeNode('fresh-hub.md', { type: 'steering-domain', metadata: { mtime } }),
      makeNode('a.md'), makeNode('b.md'), makeNode('c.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'fresh-hub.md', target: 'a.md', type: 'wiki-link' },
      { source: 'fresh-hub.md', target: 'b.md', type: 'wiki-link' },
      { source: 'c.md', target: 'fresh-hub.md', type: 'wiki-link' },
    ];
    const result = detectStaleContent(nodes, edges, {
      stalenessThresholdDays: 0,
      degreeThreshold: 3,
      currentTimeMs: NOW,
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].stalenessDays, 5);
  });

  it('returns empty array for empty graph', function () {
    const result = detectStaleContent([], []);
    assert.strictEqual(result.length, 0);
  });
});
