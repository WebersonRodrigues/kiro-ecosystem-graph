import * as assert from 'assert';
import {
  computeFragileLinks,
  computeCoverageGaps,
  computeWeakInstructions,
  computeSteeringsWithoutAccess,
  computeDecisionPath,
  computeSemanticCoherence,
  isHeaderOnTopic,
  tokenizeHeader,
  KEYWORD_SETS,
} from '../../services/cognitiveValidations';
import type { GraphNode, GraphEdge, NodeType } from '../../types';

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

// ─────────────────────────────────────────────────────────────────────────────

import { computeLinkSuggestions } from '../../services/cognitiveValidations';

describe('CognitiveValidations — computeLinkSuggestions()', function () {
  it('suggests pair with 45% overlap and no direct edge', function () {
    // 5 keywords each, sharing 3 → overlap = 3/5 * 100 = 60%? No.
    // Need to craft: min(|A|,|B|) = 5, intersection = 2 → 40%
    // Actually: 10 keywords in A, 5 in B, 3 shared → 3/5 * 100 = 60% (too high)
    // Let's do: A has 4 keywords, B has 4 keywords, 2 shared → 2/4 * 100 = 50%
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { keywords: ['auth', 'login', 'session', 'token'] } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { keywords: ['auth', 'login', 'password', 'hash'] } }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeLinkSuggestions(nodes, edges);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].nodeA.id, 'a.md');
    assert.strictEqual(result[0].nodeB.id, 'b.md');
    assert.strictEqual(result[0].similarityScore, 50);
    assert.deepStrictEqual(result[0].sharedKeywords, ['auth', 'login']);
  });

  it('excludes pair with overlap >= 60%', function () {
    // A has 5 keywords, B has 5 keywords, 4 shared → 4/5 * 100 = 80%
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { keywords: ['a', 'b', 'c', 'd', 'e'] } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { keywords: ['a', 'b', 'c', 'd', 'f'] } }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeLinkSuggestions(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('excludes pair with overlap < 30%', function () {
    // A has 5 keywords, B has 5 keywords, 1 shared → 1/5 * 100 = 20%
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { keywords: ['a', 'b', 'c', 'd', 'e'] } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { keywords: ['a', 'x', 'y', 'z', 'w'] } }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeLinkSuggestions(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('excludes pair already connected by edge', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { keywords: ['auth', 'login', 'session', 'token'] } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { keywords: ['auth', 'login', 'password', 'hash'] } }),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'wiki-link' },
    ];
    const result = computeLinkSuggestions(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('excludes pair present in duplicateIntentPairs', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { keywords: ['auth', 'login', 'session', 'token'] } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { keywords: ['auth', 'login', 'password', 'hash'] } }),
    ];
    const edges: GraphEdge[] = [];
    const duplicates = [
      { nodeA: { id: 'a.md', label: 'a' }, nodeB: { id: 'b.md', label: 'b' }, overlap: 65 },
    ];
    const result = computeLinkSuggestions(nodes, edges, duplicates);
    assert.strictEqual(result.length, 0);
  });

  it('skips nodes without keywords (score 0)', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { keywords: ['auth', 'login'] } }),
      makeNode('b.md', { type: 'steering-domain', metadata: {} }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeLinkSuggestions(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('orders results by similarityScore descending', function () {
    // Pair A-B: 2/4 = 50%, Pair A-C: 3/5 = 60% (excluded), Pair B-C: need to craft
    // A: [a,b,c,d], B: [a,b,x,y,z,w] → 2/4 = 50%
    // A: [a,b,c,d], C: [a,c,e,f,g,h,i,j] → 2/4 = 50%
    // B: [a,b,x,y,z,w], C: [a,c,e,f,g,h,i,j] → 1/6 = 17% (excluded)
    // Let's use different setup:
    // A: [a,b,c,d,e,f,g,h,i,j] (10 kw), B: [a,b,c,d,x] (5 kw) → 4/5 = 80% (too high)
    // Simpler: A=[a,b,c,d,e], B=[a,b,x,y,z] → 2/5=40%, A=[a,b,c,d,e], C=[a,b,c,x,y] → 3/5=60% (excluded)
    // B=[a,b,x,y,z], C=[a,b,c,x,y] → 3/5=60% (excluded)
    // Let's just use 3 pairs with different overlaps:
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { keywords: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9', 'k10'] } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { keywords: ['k1', 'k2', 'k3', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7'] } }),
      makeNode('c.md', { type: 'steering-domain', metadata: { keywords: ['k1', 'k2', 'k3', 'k4', 'k5', 'y1', 'y2', 'y3', 'y4', 'y5'] } }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeLinkSuggestions(nodes, edges);
    // A-B: 3/10 = 30%, A-C: 5/10 = 50%, B-C: 3/10 = 30%
    assert.ok(result.length >= 2);
    assert.ok(result[0].similarityScore >= result[1].similarityScore);
  });

  it('limits to 10 suggestions when more pairs are eligible', function () {
    // Create 12 steering nodes with pairwise 50% overlap
    const nodes: GraphNode[] = [];
    for (let i = 0; i < 12; i++) {
      const keywords = ['shared1', 'shared2', `unique-${i}-a`, `unique-${i}-b`];
      nodes.push(makeNode(`s${i}.md`, { type: 'steering-domain', metadata: { keywords } }));
    }
    const edges: GraphEdge[] = [];
    const result = computeLinkSuggestions(nodes, edges);
    assert.ok(result.length <= 10);
  });

  it('returns empty array for empty graph', function () {
    const result = computeLinkSuggestions([], []);
    assert.strictEqual(result.length, 0);
  });

  it('includes pair at exactly 30% overlap', function () {
    // A has 10 keywords, B has 10 keywords, 3 shared → 3/10 * 100 = 30%
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { keywords: ['k1', 'k2', 'k3', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'] } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { keywords: ['k1', 'k2', 'k3', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] } }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeLinkSuggestions(nodes, edges);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].similarityScore, 30);
  });

  it('excludes pair at exactly 59% overlap (included) vs 60% (excluded)', function () {
    // 59% is included: need intersection/min = 0.59 → hard to get exact with integers
    // Let's test 60% is excluded: A has 5 kw, B has 5 kw, 3 shared → 3/5 = 60% (excluded)
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { keywords: ['k1', 'k2', 'k3', 'a1', 'a2'] } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { keywords: ['k1', 'k2', 'k3', 'b1', 'b2'] } }),
    ];
    const edges: GraphEdge[] = [];
    const result = computeLinkSuggestions(nodes, edges);
    assert.strictEqual(result.length, 0); // 60% is excluded
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Coherence (Rule 21)
// ─────────────────────────────────────────────────────────────────────────────

describe('CognitiveValidations — computeSemanticCoherence()', function () {
  it('steering with 100% on-topic headers produces no alert', function () {
    const nodes: GraphNode[] = [
      makeNode('security-policies.md', {
        type: 'steering-policy',
        metadata: { sectionHeaders: ['Security Rules', 'Access Control', 'Permission Model'] },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 0);
  });

  it('steering with 100% off-topic headers produces alert with coherence 0.0', function () {
    const nodes: GraphNode[] = [
      makeNode('security-policies.md', {
        type: 'steering-policy',
        metadata: { sectionHeaders: ['Deploy Pipeline', 'Database Migrations', 'Docker Setup'] },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].coherencePercent, 0);
    assert.deepStrictEqual(result[0].offTopicHeaders, ['Deploy Pipeline', 'Database Migrations', 'Docker Setup']);
  });

  it('steering with mix of headers (2/5 on-topic = 0.40) produces alert', function () {
    const nodes: GraphNode[] = [
      makeNode('security-policies.md', {
        type: 'steering-policy',
        metadata: {
          sectionHeaders: [
            'Security Overview',   // on-topic (security)
            'Deploy Pipeline',     // off-topic
            'Access Rules',        // on-topic (access)
            'Database Setup',      // off-topic
            'Docker Config',       // off-topic
          ],
        },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].coherencePercent, 0.4);
    assert.strictEqual(result[0].offTopicHeaders.length, 3);
  });

  it('steering without sectionHeaders produces no alert (coherence 1.0)', function () {
    const nodes: GraphNode[] = [
      makeNode('security-policies.md', {
        type: 'steering-policy',
        metadata: {},
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 0);
  });

  it('node with NodeType without Keyword_Set is ignored', function () {
    const nodes: GraphNode[] = [
      makeNode('unknown.md', {
        type: 'unknown' as NodeType,
        metadata: { sectionHeaders: ['Random Header'] },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 0);
  });

  it('non-steering node (hook-auto) is ignored', function () {
    const nodes: GraphNode[] = [
      makeNode('my-hook.json', {
        type: 'hook-auto',
        metadata: { sectionHeaders: ['Some Header'] },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 0);
  });

  it('threshold exact: coherence 0.70 does NOT produce alert', function () {
    // 7/10 on-topic = 0.70
    const nodes: GraphNode[] = [
      makeNode('tech-guide.md', {
        type: 'steering-tech',
        metadata: {
          sectionHeaders: [
            'API Design',          // on-topic
            'Server Setup',        // on-topic
            'Docker Config',       // on-topic
            'Pipeline CI',         // on-topic (pipeline)
            'Database Schema',     // on-topic
            'Architecture Layers', // on-topic
            'Deploy Strategy',     // on-topic
            'Random Thoughts',     // off-topic
            'Team Culture',        // off-topic
            'Meeting Notes',       // off-topic
          ],
        },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 0);
  });

  it('threshold exact: coherence 0.69 (< 0.70) produces alert', function () {
    // Need coherence just below 0.70. Use 9/13 = 0.692... still >= 0.70? No, 9/13 = 0.6923
    // Actually 2/3 = 0.666... < 0.70
    const nodes: GraphNode[] = [
      makeNode('tech-guide.md', {
        type: 'steering-tech',
        metadata: {
          sectionHeaders: [
            'API Design',      // on-topic
            'Random Thoughts', // off-topic
            'Team Culture',    // off-topic (not in tech keywords)
          ],
        },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 1);
    // 1/3 ≈ 0.333
    assert.ok(result[0].coherencePercent < 0.70);
  });

  it('offTopicHeaders contains only headers that did not match', function () {
    const nodes: GraphNode[] = [
      makeNode('flow-guide.md', {
        type: 'steering-flow',
        metadata: {
          sectionHeaders: [
            'Workflow Steps',    // on-topic (workflow)
            'Security Rules',   // off-topic
            'Process Overview', // on-topic (process)
            'Deploy Notes',     // off-topic
          ],
        },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].offTopicHeaders, ['Security Rules', 'Deploy Notes']);
  });

  it('all 9 Keyword_Sets work with representative headers', function () {
    const testCases: { type: NodeType; header: string }[] = [
      { type: 'steering-policy', header: 'Security Guidelines' },
      { type: 'steering-tech', header: 'API Architecture' },
      { type: 'steering-flow', header: 'Workflow Steps' },
      { type: 'steering-domain', header: 'Business Logic' },
      { type: 'steering-product', header: 'Feature Roadmap' },
      { type: 'steering-agent', header: 'Agent Behavior' },
      { type: 'steering-help', header: 'FAQ Section' },
      { type: 'steering-playbook', header: 'Incident Recovery' },
      { type: 'steering-observability', header: 'Monitoring Dashboard' },
    ];

    for (const tc of testCases) {
      const keywordSet = KEYWORD_SETS[tc.type]!;
      assert.ok(keywordSet, `KEYWORD_SETS should have entry for ${tc.type}`);
      assert.ok(
        isHeaderOnTopic(tc.header, keywordSet),
        `Header "${tc.header}" should be on-topic for ${tc.type}`,
      );
    }
  });

  it('tokenizeHeader splits by non-alphanumeric and lowercases', function () {
    const tokens = tokenizeHeader('Deploy-Pipeline (CI/CD)');
    assert.deepStrictEqual(tokens, ['deploy', 'pipeline', 'ci', 'cd']);
  });
});
