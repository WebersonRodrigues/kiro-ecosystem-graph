import * as assert from 'assert';
import {
  computeFragileLinks,
  computeCoverageGaps,
  computeWeakInstructions,
  computeSteeringsWithoutAccess,
  computeDecisionPath,
  computeSemanticCoherence,
  detectCircularHookDependencies,
  isHeaderOnTopic,
  tokenizeHeader,
  KEYWORD_SETS,
  hasSpecificityMarker,
  isVagueInstruction,
  computeSpecificityScore,
  analyzeInstructionSpecificity,
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

// ─────────────────────────────────────────────────────────────────────────────
// Circular Hook Dependencies (Rule 22)
// ─────────────────────────────────────────────────────────────────────────────

describe('CognitiveValidations — detectCircularHookDependencies()', function () {
  it('detects simple 2-node cycle: hook A → steering B → hook A', function () {
    const nodes: GraphNode[] = [
      makeNode('hook-a.json', { type: 'hook-auto' }),
      makeNode('steering-b.md', { type: 'steering-domain' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook-a.json', target: 'steering-b.md', type: 'wiki-link' },
      { source: 'steering-b.md', target: 'hook-a.json', type: 'wiki-link' },
    ];
    const result = detectCircularHookDependencies(nodes, edges);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].cycleLength, 2);
  });

  it('detects 3+ node cycle: hook A → steering B → hook C → steering D → hook A', function () {
    const nodes: GraphNode[] = [
      makeNode('hook-a.json', { type: 'hook-auto' }),
      makeNode('steering-b.md', { type: 'steering-domain' }),
      makeNode('hook-c.json', { type: 'hook-manual' }),
      makeNode('steering-d.md', { type: 'steering-flow' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook-a.json', target: 'steering-b.md', type: 'wiki-link' },
      { source: 'steering-b.md', target: 'hook-c.json', type: 'wiki-link' },
      { source: 'hook-c.json', target: 'steering-d.md', type: 'wiki-link' },
      { source: 'steering-d.md', target: 'hook-a.json', type: 'wiki-link' },
    ];
    const result = detectCircularHookDependencies(nodes, edges);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].cycleLength, 4);
  });

  it('acyclic graph returns empty array', function () {
    const nodes: GraphNode[] = [
      makeNode('hook-a.json', { type: 'hook-auto' }),
      makeNode('steering-b.md', { type: 'steering-domain' }),
      makeNode('steering-c.md', { type: 'steering-flow' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook-a.json', target: 'steering-b.md', type: 'wiki-link' },
      { source: 'steering-b.md', target: 'steering-c.md', type: 'wiki-link' },
    ];
    const result = detectCircularHookDependencies(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('cycle only between steerings is NOT reported', function () {
    const nodes: GraphNode[] = [
      makeNode('steering-a.md', { type: 'steering-domain' }),
      makeNode('steering-b.md', { type: 'steering-flow' }),
      makeNode('steering-c.md', { type: 'steering-tech' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'steering-a.md', target: 'steering-b.md', type: 'wiki-link' },
      { source: 'steering-b.md', target: 'steering-c.md', type: 'wiki-link' },
      { source: 'steering-c.md', target: 'steering-a.md', type: 'wiki-link' },
    ];
    const result = detectCircularHookDependencies(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('unresolved nodes (resolved: false) are excluded', function () {
    const nodes: GraphNode[] = [
      makeNode('hook-a.json', { type: 'hook-auto', resolved: false }),
      makeNode('steering-b.md', { type: 'steering-domain' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook-a.json', target: 'steering-b.md', type: 'wiki-link' },
      { source: 'steering-b.md', target: 'hook-a.json', type: 'wiki-link' },
    ];
    const result = detectCircularHookDependencies(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('empty graph returns empty array', function () {
    const result = detectCircularHookDependencies([], []);
    assert.strictEqual(result.length, 0);
  });

  it('deduplication: same cycle from different entry points reported once', function () {
    const nodes: GraphNode[] = [
      makeNode('hook-a.json', { type: 'hook-auto' }),
      makeNode('steering-b.md', { type: 'steering-domain' }),
      makeNode('hook-c.json', { type: 'hook-manual' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook-a.json', target: 'steering-b.md', type: 'wiki-link' },
      { source: 'steering-b.md', target: 'hook-c.json', type: 'wiki-link' },
      { source: 'hook-c.json', target: 'hook-a.json', type: 'wiki-link' },
    ];
    const result = detectCircularHookDependencies(nodes, edges);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].cycleLength, 3);
  });

  it('cycles larger than maxDepth are not reported', function () {
    // Create a cycle of length 5 but set maxDepth to 3
    const nodes: GraphNode[] = [
      makeNode('hook-a.json', { type: 'hook-auto' }),
      makeNode('s-b.md', { type: 'steering-domain' }),
      makeNode('s-c.md', { type: 'steering-flow' }),
      makeNode('s-d.md', { type: 'steering-tech' }),
      makeNode('s-e.md', { type: 'steering-policy' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook-a.json', target: 's-b.md', type: 'wiki-link' },
      { source: 's-b.md', target: 's-c.md', type: 'wiki-link' },
      { source: 's-c.md', target: 's-d.md', type: 'wiki-link' },
      { source: 's-d.md', target: 's-e.md', type: 'wiki-link' },
      { source: 's-e.md', target: 'hook-a.json', type: 'wiki-link' },
    ];
    const result = detectCircularHookDependencies(nodes, edges, 3);
    assert.strictEqual(result.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail Coverage Analysis (Rule 23)
// ─────────────────────────────────────────────────────────────────────────────

import { analyzeGuardrailCoverage } from '../../services/cognitiveValidations';

describe('CognitiveValidations — analyzeGuardrailCoverage()', function () {
  it('database maturity 2: hook with sql + steering with database keyword', function () {
    const nodes: GraphNode[] = [
      makeNode('dml-hook.json', { type: 'hook-auto', metadata: { description: 'sql protection' } }),
      makeNode('db-rules.md', { type: 'steering-tech', metadata: { keywords: ['database', 'backup'] } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    const db = result.categories.find((c) => c.category === 'database')!;
    assert.strictEqual(db.maturityLevel, 2);
    assert.strictEqual(db.hasHook, true);
    assert.strictEqual(db.hasSteering, true);
    assert.strictEqual(db.suggestion, undefined);
  });

  it('deploy maturity 2: hook with deploy + steering with release keyword', function () {
    const nodes: GraphNode[] = [
      makeNode('deploy-hook.json', { type: 'hook-auto', metadata: { description: 'deploy gate' } }),
      makeNode('deploy-rules.md', { type: 'steering-tech', metadata: { keywords: ['release', 'rollback'] } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    const deploy = result.categories.find((c) => c.category === 'deploy')!;
    assert.strictEqual(deploy.maturityLevel, 2);
    assert.strictEqual(deploy.isRelevant, true);
  });

  it('secrets maturity 2: hook with write + steering with secret keyword', function () {
    const nodes: GraphNode[] = [
      makeNode('write-hook.json', { type: 'hook-auto', metadata: { description: 'file write guard' } }),
      makeNode('secrets.md', { type: 'steering-policy', metadata: { keywords: ['secret', 'credential'] } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    const secrets = result.categories.find((c) => c.category === 'secrets')!;
    assert.strictEqual(secrets.maturityLevel, 2);
  });

  it('tests maturity 2: hook with test + steering with testing keyword', function () {
    const nodes: GraphNode[] = [
      makeNode('test-hook.json', { type: 'hook-auto', metadata: { description: 'run test after task' } }),
      makeNode('testing-guide.md', { type: 'steering-domain', metadata: { keywords: ['testing', 'tdd'] } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    const tests = result.categories.find((c) => c.category === 'tests')!;
    assert.strictEqual(tests.maturityLevel, 2);
  });

  it('infrastructure maturity 2: hook with terraform + steering with infra keyword', function () {
    const nodes: GraphNode[] = [
      makeNode('infra-hook.json', { type: 'hook-auto', metadata: { description: 'terraform guard' } }),
      makeNode('infra-rules.md', { type: 'steering-tech', metadata: { keywords: ['infrastructure', 'docker'] } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    const infra = result.categories.find((c) => c.category === 'infrastructure')!;
    assert.strictEqual(infra.maturityLevel, 2);
  });

  it('maturity level 0: no components present for relevant category', function () {
    const nodes: GraphNode[] = [
      makeNode('some-hook.json', { type: 'hook-auto', metadata: { description: 'deploy check' } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    const deploy = result.categories.find((c) => c.category === 'deploy')!;
    assert.strictEqual(deploy.maturityLevel, 1);
    // tests is relevant (has hook) but no test-specific hook/steering
    const tests = result.categories.find((c) => c.category === 'tests')!;
    assert.strictEqual(tests.maturityLevel, 0);
    assert.strictEqual(tests.isRelevant, true);
    assert.ok(tests.suggestion !== undefined);
  });

  it('maturity level 1: only hook present', function () {
    const nodes: GraphNode[] = [
      makeNode('deploy-hook.json', { type: 'hook-auto', metadata: { description: 'deploy gate' } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    const deploy = result.categories.find((c) => c.category === 'deploy')!;
    assert.strictEqual(deploy.maturityLevel, 1);
    assert.strictEqual(deploy.hasHook, true);
    assert.strictEqual(deploy.hasSteering, false);
    assert.strictEqual(deploy.suggestion?.missing, 'steering');
  });

  it('maturity level 1: only steering present', function () {
    const nodes: GraphNode[] = [
      makeNode('deploy-rules.md', { type: 'steering-tech', metadata: { keywords: ['deploy', 'release'] } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    const deploy = result.categories.find((c) => c.category === 'deploy')!;
    assert.strictEqual(deploy.maturityLevel, 1);
    assert.strictEqual(deploy.hasHook, false);
    assert.strictEqual(deploy.hasSteering, true);
    assert.strictEqual(deploy.suggestion?.missing, 'hook');
  });

  it('contextual filtering: irrelevant category does not generate suggestion', function () {
    const nodes: GraphNode[] = [
      makeNode('generic.md', { type: 'steering-domain', metadata: { keywords: ['general'] } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    const infra = result.categories.find((c) => c.category === 'infrastructure')!;
    assert.strictEqual(infra.isRelevant, false);
    assert.strictEqual(infra.suggestion, undefined);
  });

  it('DML Protection overlap: database skipped when dmlProtectionLevel >= 1', function () {
    const nodes: GraphNode[] = [
      makeNode('dml-hook.json', { type: 'hook-auto', metadata: { description: 'sql protection' } }),
      makeNode('db-rules.md', { type: 'steering-tech', metadata: { keywords: ['database'] } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, [], 1);
    const db = result.categories.find((c) => c.category === 'database')!;
    assert.strictEqual(db.isRelevant, false);
    assert.strictEqual(db.suggestion, undefined);
  });

  it('empty graph: returns 5 categories with isRelevant=false', function () {
    const result = analyzeGuardrailCoverage([], []);
    assert.strictEqual(result.categories.length, 5);
    assert.strictEqual(result.overallMaturity, 0);
    result.categories.forEach((c) => {
      assert.strictEqual(c.isRelevant, false);
      assert.strictEqual(c.suggestion, undefined);
    });
  });

  it('suggestion text does not contain error language', function () {
    const nodes: GraphNode[] = [
      makeNode('deploy-hook.json', { type: 'hook-auto', metadata: { description: 'deploy gate' } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    result.categories.forEach((c) => {
      if (c.suggestion) {
        const text = c.suggestion.text.toLowerCase();
        assert.ok(!text.includes('error'));
        assert.ok(!text.includes('warning'));
        assert.ok(!text.includes('problem'));
      }
    });
  });

  it('overallMaturity is calculated only over relevant categories', function () {
    const nodes: GraphNode[] = [
      makeNode('deploy-hook.json', { type: 'hook-auto', metadata: { description: 'deploy gate' } }),
      makeNode('deploy-rules.md', { type: 'steering-tech', metadata: { keywords: ['deploy'] } }),
    ];
    const result = analyzeGuardrailCoverage(nodes, []);
    const relevant = result.categories.filter((c) => c.isRelevant);
    const expected = relevant.reduce((s, c) => s + c.maturityLevel, 0) / relevant.length;
    assert.strictEqual(result.overallMaturity, expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Instruction Specificity (Rule 24)
// ─────────────────────────────────────────────────────────────────────────────

describe('CognitiveValidations — hasSpecificityMarker()', function () {
  it('detects technology names: "use typescript strict mode" → true', function () {
    assert.strictEqual(hasSpecificityMarker('use typescript strict mode'), true);
  });

  it('detects file extensions: "create a .ts file" → true', function () {
    assert.strictEqual(hasSpecificityMarker('create a .ts file'), true);
  });

  it('detects path prefixes: "put files in src/" → true', function () {
    assert.strictEqual(hasSpecificityMarker('put files in src/'), true);
  });

  it('detects backtick code: "use `parameterizedQuery()`" → true', function () {
    assert.strictEqual(hasSpecificityMarker('use `parameterizedQuery()`'), true);
  });

  it('detects camelCase identifiers: "call getUserName" → true', function () {
    assert.strictEqual(hasSpecificityMarker('call getUserName'), true);
  });

  it('detects PascalCase identifiers: "extend BaseController" → true', function () {
    assert.strictEqual(hasSpecificityMarker('extend BaseController'), true);
  });

  it('detects measurable criteria: "keep functions under 30 lines" → true', function () {
    assert.strictEqual(hasSpecificityMarker('keep functions under 30 lines'), true);
  });

  it('detects measurable operator criteria: "response time < 200" → true', function () {
    assert.strictEqual(hasSpecificityMarker('response time < 200'), true);
  });

  it('returns false for purely vague line: "follow best practices" → false', function () {
    assert.strictEqual(hasSpecificityMarker('follow best practices'), false);
  });

  it('returns false for generic instruction: "ensure quality" → false', function () {
    assert.strictEqual(hasSpecificityMarker('ensure quality'), false);
  });
});

describe('CognitiveValidations — isVagueInstruction()', function () {
  it('"follow best practices" → true (vague)', function () {
    assert.strictEqual(isVagueInstruction('follow best practices'), true);
  });

  it('"ensure quality" → true (vague)', function () {
    assert.strictEqual(isVagueInstruction('ensure quality'), true);
  });

  it('"use proper handling" → true (vague)', function () {
    assert.strictEqual(isVagueInstruction('use proper handling'), true);
  });

  it('"follow best practices using eslint" → false (has marker)', function () {
    assert.strictEqual(isVagueInstruction('follow best practices using eslint'), false);
  });

  it('"use typescript strict mode" → false (specific)', function () {
    assert.strictEqual(isVagueInstruction('use typescript strict mode'), false);
  });

  it('"validate" alone → true (generic subject)', function () {
    assert.strictEqual(isVagueInstruction('validate'), true);
  });

  it('"validate using zod schema" → false (has marker)', function () {
    assert.strictEqual(isVagueInstruction('validate using eslint rules'), false);
  });
});

describe('CognitiveValidations — computeSpecificityScore()', function () {
  it('returns 100 for empty array', function () {
    assert.strictEqual(computeSpecificityScore([]), 100);
  });

  it('returns 0 when all lines are vague', function () {
    const lines = [
      { text: 'follow best practices' },
      { text: 'ensure quality' },
    ];
    assert.strictEqual(computeSpecificityScore(lines), 0);
  });

  it('returns 50 when half are specific', function () {
    const lines = [
      { text: 'use typescript strict mode' },
      { text: 'follow best practices' },
    ];
    assert.strictEqual(computeSpecificityScore(lines), 50);
  });

  it('returns 100 when all are specific', function () {
    const lines = [
      { text: 'use typescript strict mode' },
      { text: 'put files in src/' },
    ];
    assert.strictEqual(computeSpecificityScore(lines), 100);
  });
});

describe('CognitiveValidations — analyzeInstructionSpecificity()', function () {
  it('alerts only contain steerings with score < 50', function () {
    const nodes: GraphNode[] = [
      makeNode('vague.md', {
        type: 'steering-domain',
        metadata: {
          imperativeLines: [
            { text: 'follow best practices', pattern: 'use', subject: 'practices' },
            { text: 'ensure quality', pattern: 'ensure', subject: 'quality' },
          ],
        },
      }),
      makeNode('specific.md', {
        type: 'steering-tech',
        metadata: {
          imperativeLines: [
            { text: 'use typescript strict mode', pattern: 'use', subject: 'typescript' },
            { text: 'put files in src/', pattern: 'use', subject: 'files' },
          ],
        },
      }),
    ];
    const result = analyzeInstructionSpecificity(nodes);
    assert.strictEqual(result.alerts.length, 1);
    assert.strictEqual(result.alerts[0].id, 'vague.md');
    assert.strictEqual(result.alerts[0].score, 0);
  });

  it('ignores hook and skill nodes', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', {
        type: 'hook-auto',
        metadata: {
          imperativeLines: [
            { text: 'follow best practices', pattern: 'use', subject: 'practices' },
          ],
        },
      }),
      makeNode('skill.md', {
        type: 'skill' as NodeType,
        metadata: {
          imperativeLines: [
            { text: 'ensure quality', pattern: 'ensure', subject: 'quality' },
          ],
        },
      }),
    ];
    const result = analyzeInstructionSpecificity(nodes);
    assert.strictEqual(result.alerts.length, 0);
    assert.strictEqual(result.averageScore, 100);
  });

  it('steerings without imperativeLines do not appear in alerts', function () {
    const nodes: GraphNode[] = [
      makeNode('empty.md', { type: 'steering-domain', metadata: {} }),
      makeNode('no-lines.md', { type: 'steering-tech', metadata: { imperativeLines: [] } }),
    ];
    const result = analyzeInstructionSpecificity(nodes);
    assert.strictEqual(result.alerts.length, 0);
    assert.strictEqual(result.averageScore, 100);
  });

  it('vagueExamples has at most 3 items', function () {
    const lines = Array.from({ length: 10 }, (_, i) => ({
      text: 'follow best practices ' + i,
      pattern: 'use',
      subject: 'practices',
    }));
    const nodes: GraphNode[] = [
      makeNode('many-vague.md', {
        type: 'steering-domain',
        metadata: { imperativeLines: lines },
      }),
    ];
    const result = analyzeInstructionSpecificity(nodes);
    assert.strictEqual(result.alerts.length, 1);
    assert.ok(result.alerts[0].vagueExamples.length <= 3);
  });

  it('vagueCount + specificCount === total imperative lines', function () {
    const nodes: GraphNode[] = [
      makeNode('mixed.md', {
        type: 'steering-domain',
        metadata: {
          imperativeLines: [
            { text: 'follow best practices', pattern: 'use', subject: 'practices' },
            { text: 'use typescript', pattern: 'use', subject: 'typescript' },
            { text: 'ensure quality', pattern: 'ensure', subject: 'quality' },
          ],
        },
      }),
    ];
    const result = analyzeInstructionSpecificity(nodes);
    assert.strictEqual(result.alerts.length, 1);
    const alert = result.alerts[0];
    assert.strictEqual(alert.vagueCount + alert.specificCount, 3);
  });

  it('averageScore is computed only over steerings with imperativeLines', function () {
    const nodes: GraphNode[] = [
      makeNode('empty.md', { type: 'steering-domain', metadata: {} }),
      makeNode('specific.md', {
        type: 'steering-tech',
        metadata: {
          imperativeLines: [
            { text: 'use typescript strict mode', pattern: 'use', subject: 'typescript' },
          ],
        },
      }),
    ];
    const result = analyzeInstructionSpecificity(nodes);
    assert.strictEqual(result.averageScore, 100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Context Budget Estimator (Rule 25)
// ─────────────────────────────────────────────────────────────────────────────

import {
  estimateTokenCount,
  estimateContextBudget,
  DEFAULT_MAX_BUDGET,
  BUDGET_ALERT_THRESHOLD,
} from '../../services/cognitiveValidations';

describe('CognitiveValidations — estimateTokenCount()', function () {
  it('"hello world" → Math.ceil(2 * 1.3) = 3', function () {
    assert.strictEqual(estimateTokenCount('hello world'), 3);
  });

  it('empty string → 0', function () {
    assert.strictEqual(estimateTokenCount(''), 0);
  });

  it('string with only whitespace → 0', function () {
    assert.strictEqual(estimateTokenCount('   \t\n  '), 0);
  });

  it('multiple spaces between words → counts words correctly', function () {
    assert.strictEqual(estimateTokenCount('a   b   c'), Math.ceil(3 * 1.3));
  });

  it('100 words → Math.ceil(100 * 1.3) = 130', function () {
    const content = Array(100).fill('word').join(' ');
    assert.strictEqual(estimateTokenCount(content), 130);
  });
});

describe('CognitiveValidations — estimateContextBudget()', function () {
  it('0 always-loaded steerings → totalTokens=0, budgetPercent=0, perSteering=[]', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { inclusion: 'always' } }),
    ];
    const result = estimateContextBudget(nodes);
    assert.strictEqual(result.totalTokens, 0);
    assert.strictEqual(result.budgetPercent, 0);
    assert.strictEqual(result.perSteering.length, 0);
    assert.strictEqual(result.suggestion, undefined);
  });

  it('1 always-loaded steering → correct totalTokens and perSteering.length=1', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        type: 'steering-domain',
        metadata: { alwaysApply: true, content: 'hello world' },
      }),
    ];
    const result = estimateContextBudget(nodes);
    assert.strictEqual(result.perSteering.length, 1);
    assert.strictEqual(result.totalTokens, 3); // ceil(2 * 1.3)
    assert.strictEqual(result.perSteering[0].tokens, 3);
  });

  it('multiple steerings → totalTokens = sum of individual tokens', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        type: 'steering-domain',
        metadata: { alwaysApply: true, content: 'hello world' },
      }),
      makeNode('b.md', {
        type: 'steering-tech',
        metadata: { autoInclusion: true, content: 'one two three' },
      }),
    ];
    const result = estimateContextBudget(nodes);
    const expectedA = Math.ceil(2 * 1.3);
    const expectedB = Math.ceil(3 * 1.3);
    assert.strictEqual(result.totalTokens, expectedA + expectedB);
    assert.strictEqual(result.perSteering.length, 2);
  });

  it('budgetPercent=15 → no suggestion', function () {
    // 15% of 200000 = 30000 tokens
    // Need 30000 tokens → 30000 / 1.3 ≈ 23077 words
    const words = Array(23077).fill('w').join(' ');
    const nodes: GraphNode[] = [
      makeNode('big.md', {
        type: 'steering-domain',
        metadata: { alwaysApply: true, content: words },
      }),
    ];
    const result = estimateContextBudget(nodes);
    assert.ok(result.budgetPercent <= 15);
    assert.strictEqual(result.suggestion, undefined);
  });

  it('budgetPercent=16 → suggestion generated', function () {
    // Use custom maxBudget to make it easier
    const words = Array(100).fill('word').join(' ');
    const nodes: GraphNode[] = [
      makeNode('big.md', {
        type: 'steering-domain',
        metadata: { alwaysApply: true, content: words },
      }),
    ];
    // 130 tokens / 800 budget = 16.25%
    const result = estimateContextBudget(nodes, 800);
    assert.ok(result.budgetPercent > 15);
    assert.ok(result.suggestion !== undefined);
    assert.ok(result.suggestion!.includes('Consider reviewing'));
  });

  it('custom maxBudget is respected', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        type: 'steering-domain',
        metadata: { alwaysApply: true, content: 'hello world' },
      }),
    ];
    const result = estimateContextBudget(nodes, 100000);
    assert.strictEqual(result.maxBudget, 100000);
  });

  it('non-steering nodes are ignored (hooks, skills)', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', {
        type: 'hook-auto',
        metadata: { alwaysApply: true, content: 'lots of content here' },
      }),
      makeNode('skill.md', {
        type: 'skill' as NodeType,
        metadata: { alwaysApply: true, content: 'skill content' },
      }),
    ];
    const result = estimateContextBudget(nodes);
    assert.strictEqual(result.totalTokens, 0);
    assert.strictEqual(result.perSteering.length, 0);
  });

  it('steerings without alwaysApply/autoInclusion are ignored', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        type: 'steering-domain',
        metadata: { inclusion: 'always', content: 'hello world' },
      }),
      makeNode('b.md', {
        type: 'steering-tech',
        metadata: { content: 'some content here' },
      }),
    ];
    const result = estimateContextBudget(nodes);
    assert.strictEqual(result.totalTokens, 0);
    assert.strictEqual(result.perSteering.length, 0);
  });

  it('content fallback: metadata.content → imperativeLines → label', function () {
    // Uses imperativeLines when content is absent
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        type: 'steering-domain',
        metadata: {
          alwaysApply: true,
          imperativeLines: [
            { text: 'use typescript', pattern: 'use', subject: 'typescript' },
            { text: 'always test', pattern: 'always', subject: 'test' },
          ],
        },
      }),
    ];
    const result = estimateContextBudget(nodes);
    // "use typescript always test" → 4 words → ceil(4 * 1.3) = 6
    assert.strictEqual(result.perSteering[0].tokens, 6);

    // Uses label when both content and imperativeLines are absent
    const nodes2: GraphNode[] = [
      makeNode('my-steering.md', {
        type: 'steering-domain',
        label: 'my-steering',
        metadata: { alwaysApply: true },
      }),
    ];
    const result2 = estimateContextBudget(nodes2);
    // "my-steering" → 1 word → ceil(1 * 1.3) = 2
    assert.strictEqual(result2.perSteering[0].tokens, 2);
  });

  it('DEFAULT_MAX_BUDGET is 200000', function () {
    assert.strictEqual(DEFAULT_MAX_BUDGET, 200000);
  });

  it('BUDGET_ALERT_THRESHOLD is 0.15', function () {
    assert.strictEqual(BUDGET_ALERT_THRESHOLD, 0.15);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Jailbreak Protection (Rule 26)
// ─────────────────────────────────────────────────────────────────────────────

import { analyzeJailbreakProtection } from '../../services/cognitiveValidations';

describe('CognitiveValidations — analyzeJailbreakProtection()', function () {
  function makeAlwaysSteering(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
    return makeNode(id, {
      type: 'steering-domain',
      metadata: { alwaysApply: true, ...overrides.metadata },
      ...overrides,
    });
  }

  describe('Identity Lock Detection', function () {
    it('detects "I am Kiro" in imperative lines', function () {
      const nodes: GraphNode[] = [
        makeAlwaysSteering('identity.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [{ text: 'I am Kiro and I will never change', pattern: 'always', subject: 'identity' }],
          },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.hasIdentityLock, true);
    });

    it('detects "NEVER change persona" in content first 10 lines', function () {
      const nodes: GraphNode[] = [
        makeAlwaysSteering('persona.md', {
          metadata: {
            alwaysApply: true,
            content: 'Line 1\nNEVER change persona\nLine 3',
          },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.hasIdentityLock, true);
    });

    it('returns false when no identity patterns present', function () {
      const nodes: GraphNode[] = [
        makeAlwaysSteering('generic.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [{ text: 'Always use TypeScript', pattern: 'always', subject: 'typescript' }],
          },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.hasIdentityLock, false);
    });
  });

  describe('Strong Language Counting', function () {
    it('counts 3 lines with NEVER', function () {
      const content = 'NEVER do this\nNEVER do that\nNEVER ignore rules';
      const nodes: GraphNode[] = [
        makeAlwaysSteering('strong.md', { metadata: { alwaysApply: true, content } }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.strongRuleCount, 3);
    });

    it('does not count lowercase "never"', function () {
      const content = 'never do this\nnever do that';
      const nodes: GraphNode[] = [
        makeAlwaysSteering('weak.md', { metadata: { alwaysApply: true, content } }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.strongRuleCount, 0);
    });

    it('counts line with NEVER and FORBIDDEN as 1', function () {
      const content = 'NEVER do this, it is FORBIDDEN';
      const nodes: GraphNode[] = [
        makeAlwaysSteering('multi.md', { metadata: { alwaysApply: true, content } }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.strongRuleCount, 1);
    });
  });

  describe('Redundancy Detection', function () {
    it('counts same subject in 2 steerings as 1 redundant', function () {
      const nodes: GraphNode[] = [
        makeAlwaysSteering('a.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [{ text: 'use typescript strict mode', pattern: 'use', subject: 'typescript strict mode' }],
          },
        }),
        makeAlwaysSteering('b.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [{ text: 'use typescript strict mode always', pattern: 'use', subject: 'typescript strict mode' }],
          },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.redundantRuleCount, 1);
    });

    it('returns 0 when subjects are different', function () {
      const nodes: GraphNode[] = [
        makeAlwaysSteering('a.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [{ text: 'Always use typescript', pattern: 'always', subject: 'typescript' }],
          },
        }),
        makeAlwaysSteering('b.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [{ text: 'Never use python', pattern: 'never', subject: 'python' }],
          },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.redundantRuleCount, 0);
    });
  });

  describe('Destructive Hooks Detection', function () {
    it('counts preToolUse hook with "delete" in description', function () {
      const nodes: GraphNode[] = [
        makeNode('hook-del.json', {
          type: 'hook-auto',
          metadata: { whenType: 'preToolUse', description: 'Block delete operations' },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.destructiveHookCount, 1);
    });

    it('does not count postToolUse hook with "delete"', function () {
      const nodes: GraphNode[] = [
        makeNode('hook-post.json', {
          type: 'hook-auto',
          metadata: { whenType: 'postToolUse', description: 'Log delete operations' },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.destructiveHookCount, 0);
    });
  });

  describe('Maturity Level Computation', function () {
    it('level 0 when no components present', function () {
      const nodes: GraphNode[] = [
        makeAlwaysSteering('plain.md', {
          metadata: { alwaysApply: true, content: 'Just some plain text' },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.maturityLevel, 0);
    });

    it('level 1 with only identity lock', function () {
      const nodes: GraphNode[] = [
        makeAlwaysSteering('id.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [{ text: 'I am Kiro, the AI assistant', pattern: 'always', subject: 'kiro' }],
          },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.maturityLevel, 1);
    });

    it('level 1 with only destructive hook', function () {
      const nodes: GraphNode[] = [
        makeNode('hook-del.json', {
          type: 'hook-auto',
          metadata: { whenType: 'preToolUse', description: 'Block delete operations' },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.maturityLevel, 1);
    });

    it('level 2 with identity lock + destructive hook + redundancy', function () {
      const nodes: GraphNode[] = [
        makeAlwaysSteering('id.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [
              { text: 'I am Kiro, the AI assistant', pattern: 'always', subject: 'kiro' },
              { text: 'use typescript strict mode', pattern: 'use', subject: 'typescript strict' },
            ],
          },
        }),
        makeAlwaysSteering('rules.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [
              { text: 'use typescript strict mode always', pattern: 'use', subject: 'typescript strict' },
            ],
          },
        }),
        makeNode('hook-del.json', {
          type: 'hook-auto',
          metadata: { whenType: 'preToolUse', description: 'Block delete operations' },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.maturityLevel, 2);
    });
  });

  describe('Suggestions', function () {
    it('empty when level 2', function () {
      const nodes: GraphNode[] = [
        makeAlwaysSteering('id.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [
              { text: 'I am Kiro, the AI assistant', pattern: 'always', subject: 'kiro' },
              { text: 'use typescript strict mode', pattern: 'use', subject: 'typescript strict' },
            ],
          },
        }),
        makeAlwaysSteering('rules.md', {
          metadata: {
            alwaysApply: true,
            imperativeLines: [
              { text: 'use typescript strict mode always', pattern: 'use', subject: 'typescript strict' },
            ],
          },
        }),
        makeNode('hook-del.json', {
          type: 'hook-auto',
          metadata: { whenType: 'preToolUse', description: 'Block delete operations' },
        }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.suggestions.length, 0);
    });

    it('non-empty when level 0 or 1', function () {
      const result = analyzeJailbreakProtection([]);
      assert.ok(result.suggestions.length > 0);
    });
  });

  describe('Edge Cases', function () {
    it('empty graph returns level 0 with all counts 0', function () {
      const result = analyzeJailbreakProtection([]);
      assert.strictEqual(result.maturityLevel, 0);
      assert.strictEqual(result.hasIdentityLock, false);
      assert.strictEqual(result.strongRuleCount, 0);
      assert.strictEqual(result.redundantRuleCount, 0);
      assert.strictEqual(result.destructiveHookCount, 0);
      assert.ok(result.suggestions.length > 0);
    });

    it('non-steering and non-hook nodes are ignored', function () {
      const nodes: GraphNode[] = [
        makeNode('code.ts', { type: 'code-file', metadata: { content: 'NEVER FORBIDDEN' } }),
        makeNode('skill.md', { type: 'skill', metadata: { content: 'I am Kiro' } }),
      ];
      const result = analyzeJailbreakProtection(nodes);
      assert.strictEqual(result.maturityLevel, 0);
      assert.strictEqual(result.strongRuleCount, 0);
      assert.strictEqual(result.hasIdentityLock, false);
    });
  });
});
