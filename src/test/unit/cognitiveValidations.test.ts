import * as assert from 'assert';
import {
  computeFragileLinks,
  computeCoverageGaps,
  computeWeakInstructions,
  computeSteeringsWithoutAccess,
  computeDecisionPath,
  computeSemanticCoherence,
  detectCircularHookDependencies,
  detectPassiveKnowledge,
  isHeaderOnTopic,
  tokenizeHeader,
  KEYWORD_SETS,
  UNIVERSAL_KEYWORDS,
  hasSpecificityMarker,
  isVagueInstruction,
  computeSpecificityScore,
  analyzeInstructionSpecificity,
  INLINE_RISK_KEYWORDS,
  hasInlineRiskCriteria,
  computeDmlProtectionLevel,
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

  it('source without metadata defaults to auto (included)', function () {
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
        metadata: { sectionHeaders: ['Deploy Pipeline', 'Database Migrations', 'Docker Compose'] },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].coherencePercent, 0);
    assert.deepStrictEqual(result[0].offTopicHeaders, ['Deploy Pipeline', 'Database Migrations', 'Docker Compose']);
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
            'Database Migrations', // off-topic
            'Docker Compose',      // off-topic
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
      makeNode('a.md', { type: 'steering-domain', metadata: { inclusion: 'auto' } }),
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
        metadata: { inclusion: 'fileMatch', content: 'hello world' },
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

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Resolution Priority (Rule 27)
// ─────────────────────────────────────────────────────────────────────────────

import { analyzeConflictResolution, PRIORITY_LANGUAGE_PATTERNS } from '../../services/cognitiveValidations';

describe('CognitiveValidations — analyzeConflictResolution()', function () {
  it('detects "in case of conflict" as priority language', function () {
    const nodes: GraphNode[] = [
      makeNode('policy.md', {
        type: 'steering-policy',
        metadata: { alwaysApply: true, content: 'In case of conflict, security takes priority.' },
      }),
    ];
    const result = analyzeConflictResolution(nodes, 1);
    assert.strictEqual(result.hasPriorityDefined, true);
    assert.strictEqual(result.priorityStatements.length, 1);
  });

  it('detects "prioridade" as priority language (PT-BR)', function () {
    const nodes: GraphNode[] = [
      makeNode('regras.md', {
        type: 'steering-domain',
        metadata: { alwaysApply: true, content: 'Este steering tem prioridade sobre os demais.' },
      }),
    ];
    const result = analyzeConflictResolution(nodes, 0);
    assert.strictEqual(result.hasPriorityDefined, true);
  });

  it('detects "takes priority" as priority language', function () {
    const nodes: GraphNode[] = [
      makeNode('security.md', {
        type: 'steering-policy',
        metadata: { alwaysApply: true, content: 'Security takes priority over convenience.' },
      }),
    ];
    const result = analyzeConflictResolution(nodes, 0);
    assert.strictEqual(result.hasPriorityDefined, true);
  });

  it('returns hasPriorityDefined=false when no priority language found', function () {
    const nodes: GraphNode[] = [
      makeNode('generic.md', {
        type: 'steering-domain',
        metadata: { alwaysApply: true, content: 'Use TypeScript strict mode.\nAlways write tests.' },
      }),
    ];
    const result = analyzeConflictResolution(nodes, 0);
    assert.strictEqual(result.hasPriorityDefined, false);
    assert.strictEqual(result.priorityStatements.length, 0);
  });

  it('extracts correct steeringId and text', function () {
    const nodes: GraphNode[] = [
      makeNode('conventions.md', {
        type: 'steering-domain',
        metadata: { alwaysApply: true, content: 'Line 1\nThis has precedence over other rules.\nLine 3' },
      }),
    ];
    const result = analyzeConflictResolution(nodes, 1);
    assert.strictEqual(result.priorityStatements[0].steeringId, 'conventions.md');
    assert.strictEqual(result.priorityStatements[0].text, 'This has precedence over other rules.');
  });

  it('performs case-insensitive matching', function () {
    const nodes: GraphNode[] = [
      makeNode('upper.md', {
        type: 'steering-policy',
        metadata: { alwaysApply: true, content: 'PRIORITY is given to security rules.' },
      }),
    ];
    const result = analyzeConflictResolution(nodes, 1);
    assert.strictEqual(result.hasPriorityDefined, true);
  });

  it('relevance: contradictions=1, alwaysLoaded=1 → relevant (suggestion when no priority)', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        type: 'steering-domain',
        metadata: { alwaysApply: true, content: 'Use TypeScript.' },
      }),
    ];
    const result = analyzeConflictResolution(nodes, 1);
    assert.strictEqual(result.hasPriorityDefined, false);
    assert.ok(result.suggestion !== undefined);
  });

  it('relevance: contradictions=0, alwaysLoaded=3 → relevant (suggestion when no priority)', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { alwaysApply: true, content: 'A' } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { alwaysApply: true, content: 'B' } }),
      makeNode('c.md', { type: 'steering-domain', metadata: { alwaysApply: true, content: 'C' } }),
    ];
    const result = analyzeConflictResolution(nodes, 0);
    assert.strictEqual(result.hasPriorityDefined, false);
    assert.ok(result.suggestion !== undefined);
  });

  it('relevance: contradictions=0, alwaysLoaded=2 → not relevant (no suggestion)', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { alwaysApply: true, content: 'A' } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { alwaysApply: true, content: 'B' } }),
    ];
    const result = analyzeConflictResolution(nodes, 0);
    assert.strictEqual(result.hasPriorityDefined, false);
    assert.strictEqual(result.suggestion, undefined);
  });

  it('suggestion NOT generated when hasPriorityDefined=true', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { alwaysApply: true, content: 'This has priority over B.' } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { alwaysApply: true, content: 'B content' } }),
      makeNode('c.md', { type: 'steering-domain', metadata: { alwaysApply: true, content: 'C content' } }),
    ];
    const result = analyzeConflictResolution(nodes, 1);
    assert.strictEqual(result.hasPriorityDefined, true);
    assert.strictEqual(result.suggestion, undefined);
  });

  it('empty graph returns hasPriorityDefined=false, empty statements, no suggestion', function () {
    const result = analyzeConflictResolution([], 0);
    assert.strictEqual(result.hasPriorityDefined, false);
    assert.strictEqual(result.priorityStatements.length, 0);
    assert.strictEqual(result.suggestion, undefined);
  });

  it('non-steering nodes are ignored', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto', metadata: { alwaysApply: true, content: 'priority override' } }),
      makeNode('code.ts', { type: 'code-file', metadata: { alwaysApply: true, content: 'has priority over' } }),
    ];
    const result = analyzeConflictResolution(nodes, 1);
    assert.strictEqual(result.hasPriorityDefined, false);
  });

  it('steerings without alwaysApply/autoInclusion are ignored', function () {
    const nodes: GraphNode[] = [
      makeNode('manual.md', { type: 'steering-domain', metadata: { content: 'This has priority over all.' } }),
    ];
    const result = analyzeConflictResolution(nodes, 1);
    assert.strictEqual(result.hasPriorityDefined, false);
  });

  it('defaults contradictionCount to 0 when not provided', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain', metadata: { alwaysApply: true, content: 'A' } }),
      makeNode('b.md', { type: 'steering-domain', metadata: { alwaysApply: true, content: 'B' } }),
    ];
    // Not providing contradictionCount — should default to 0
    // With 2 always-loaded and 0 contradictions → not relevant → no suggestion
    const result = analyzeConflictResolution(nodes);
    assert.strictEqual(result.suggestion, undefined);
  });

  it('uses imperativeLines as fallback when content is not available', function () {
    const nodes: GraphNode[] = [
      makeNode('fallback.md', {
        type: 'steering-domain',
        metadata: {
          alwaysApply: true,
          imperativeLines: [
            { text: 'In case of conflict, follow security rules', pattern: 'always', subject: 'security' },
          ],
        },
      }),
    ];
    const result = analyzeConflictResolution(nodes, 1);
    assert.strictEqual(result.hasPriorityDefined, true);
    assert.strictEqual(result.priorityStatements[0].text, 'In case of conflict, follow security rules');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// Feedback Loop Completeness (Rule 28)
// ─────────────────────────────────────────────────────────────────────────────

import { analyzeFeedbackLoops } from '../../services/cognitiveValidations';

describe('CognitiveValidations — analyzeFeedbackLoops()', function () {
  it('Detection is always true for any hook', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto' }),
    ];
    const result = analyzeFeedbackLoops(nodes, []);
    // Hook with only detection (1 component) → flagged as incomplete
    assert.strictEqual(result.incompleteLoops.length, 1);
    assert.strictEqual(result.incompleteLoops[0].hasDetection, true);
  });

  it('Decision true: hook with edge to steering', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto' }),
      makeNode('guide.md', { type: 'steering-flow' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'guide.md', type: 'hook-implicit' },
    ];
    const result = analyzeFeedbackLoops(nodes, edges);
    // 2 components (Detection + Decision) → still < 3, flagged
    assert.strictEqual(result.incompleteLoops.length, 1);
    assert.strictEqual(result.incompleteLoops[0].hasDecision, true);
  });

  it('Decision false: hook with no edges', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-manual' }),
    ];
    const result = analyzeFeedbackLoops(nodes, []);
    assert.strictEqual(result.incompleteLoops[0].hasDecision, false);
  });

  it('Decision false: hook with edge to non-steering node', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto' }),
      makeNode('skill.md', { type: 'skill' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'skill.md', type: 'backtick-ref' },
    ];
    const result = analyzeFeedbackLoops(nodes, edges);
    assert.strictEqual(result.incompleteLoops[0].hasDecision, false);
  });

  it('Action true: hook with prompt >= 20 words', function () {
    const longPrompt = 'word '.repeat(25).trim();
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto', metadata: { hookPrompt: longPrompt } }),
    ];
    const result = analyzeFeedbackLoops(nodes, []);
    // Detection + Action = 2 components → flagged
    assert.strictEqual(result.incompleteLoops[0].hasAction, true);
  });

  it('Action false: hook with prompt < 20 words', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto', metadata: { hookPrompt: 'short prompt' } }),
    ];
    const result = analyzeFeedbackLoops(nodes, []);
    assert.strictEqual(result.incompleteLoops[0].hasAction, false);
  });

  it('Action false: hook without prompt (hookPrompt undefined)', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto', metadata: {} }),
    ];
    const result = analyzeFeedbackLoops(nodes, []);
    assert.strictEqual(result.incompleteLoops[0].hasAction, false);
  });

  it('Verification true: another hook postToolUse references same steering', function () {
    const longPrompt = 'word '.repeat(25).trim();
    const nodes: GraphNode[] = [
      makeNode('hook-a.json', { type: 'hook-auto', metadata: { hookPrompt: longPrompt } }),
      makeNode('hook-b.json', { type: 'hook-auto', metadata: { whenType: 'postToolUse', hookPrompt: longPrompt } }),
      makeNode('guide.md', { type: 'steering-flow' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook-a.json', target: 'guide.md', type: 'hook-implicit' },
      { source: 'hook-b.json', target: 'guide.md', type: 'hook-implicit' },
    ];
    const result = analyzeFeedbackLoops(nodes, edges);
    // hook-a: Detection + Decision + Action + Verification = 4 → complete
    // hook-b: Detection + Decision + Action + Verification = 4 → complete (hook-a is also post? No, but hook-a refs same steering)
    // Actually hook-b verification: needs ANOTHER post-hook referencing same steering. hook-a is not post-event.
    // hook-b: Detection + Decision + Action = 3 → NOT flagged (>= 3)
    // hook-a: Detection + Decision + Action + Verification = 4 → complete
    assert.strictEqual(result.completeLoops, 1); // hook-a is complete
    assert.strictEqual(result.incompleteLoops.length, 0); // hook-b has 3 components, not flagged
  });

  it('Verification true: another hook postTaskExecution references same steering', function () {
    const longPrompt = 'word '.repeat(25).trim();
    const nodes: GraphNode[] = [
      makeNode('hook-a.json', { type: 'hook-auto', metadata: { hookPrompt: longPrompt } }),
      makeNode('hook-b.json', { type: 'hook-manual', metadata: { whenType: 'postTaskExecution', hookPrompt: longPrompt } }),
      makeNode('rules.md', { type: 'steering-policy' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook-a.json', target: 'rules.md', type: 'hook-implicit' },
      { source: 'hook-b.json', target: 'rules.md', type: 'hook-implicit' },
    ];
    const result = analyzeFeedbackLoops(nodes, edges);
    // hook-a: Detection + Decision + Action + Verification = 4 → complete
    // hook-b: Detection + Decision + Action = 3 → NOT flagged
    assert.strictEqual(result.completeLoops, 1);
    assert.strictEqual(result.incompleteLoops.length, 0);
  });

  it('Verification false: no post-hook exists', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto' }),
      makeNode('guide.md', { type: 'steering-flow' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'guide.md', type: 'hook-implicit' },
    ];
    const result = analyzeFeedbackLoops(nodes, edges);
    assert.strictEqual(result.incompleteLoops[0].hasVerification, false);
  });

  it('Verification false: post-hook references different steering', function () {
    const nodes: GraphNode[] = [
      makeNode('hook-a.json', { type: 'hook-auto' }),
      makeNode('hook-b.json', { type: 'hook-auto', metadata: { whenType: 'postToolUse' } }),
      makeNode('guide.md', { type: 'steering-flow' }),
      makeNode('other.md', { type: 'steering-domain' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook-a.json', target: 'guide.md', type: 'hook-implicit' },
      { source: 'hook-b.json', target: 'other.md', type: 'hook-implicit' },
    ];
    const result = analyzeFeedbackLoops(nodes, edges);
    assert.strictEqual(result.incompleteLoops[0].hasVerification, false);
  });

  it('complete loop: all 4 components → counted in completeLoops', function () {
    const longPrompt = 'word '.repeat(25).trim();
    const nodes: GraphNode[] = [
      makeNode('hook-a.json', { type: 'hook-auto', metadata: { hookPrompt: longPrompt } }),
      makeNode('hook-b.json', { type: 'hook-auto', metadata: { whenType: 'postToolUse' } }),
      makeNode('guide.md', { type: 'steering-flow' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook-a.json', target: 'guide.md', type: 'hook-implicit' },
      { source: 'hook-b.json', target: 'guide.md', type: 'hook-implicit' },
    ];
    const result = analyzeFeedbackLoops(nodes, edges);
    assert.strictEqual(result.completeLoops, 1);
  });

  it('incomplete loop: only Detection (1 component) → flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto', metadata: { hookPrompt: 'short' } }),
    ];
    const result = analyzeFeedbackLoops(nodes, []);
    assert.strictEqual(result.incompleteLoops.length, 1);
    assert.deepStrictEqual(result.incompleteLoops[0].missing, ['Decision', 'Action', 'Verification']);
  });

  it('incomplete loop: Detection + Decision (2 components) → flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto' }),
      makeNode('guide.md', { type: 'steering-flow' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'guide.md', type: 'hook-implicit' },
    ];
    const result = analyzeFeedbackLoops(nodes, edges);
    assert.strictEqual(result.incompleteLoops.length, 1);
    assert.ok(result.incompleteLoops[0].missing.includes('Action'));
    assert.ok(result.incompleteLoops[0].missing.includes('Verification'));
  });

  it('not flagged: Detection + Decision + Action (3 components) → not in incompleteLoops', function () {
    const longPrompt = 'word '.repeat(25).trim();
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto', metadata: { hookPrompt: longPrompt } }),
      makeNode('guide.md', { type: 'steering-flow' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'guide.md', type: 'hook-implicit' },
    ];
    const result = analyzeFeedbackLoops(nodes, edges);
    assert.strictEqual(result.incompleteLoops.length, 0);
  });

  it('empty graph: completeLoops=0, incompleteLoops=[], no suggestion', function () {
    const result = analyzeFeedbackLoops([], []);
    assert.strictEqual(result.completeLoops, 0);
    assert.strictEqual(result.incompleteLoops.length, 0);
    assert.strictEqual(result.suggestion, undefined);
  });

  it('suggestion generated when incompleteLoops > 0', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto' }),
    ];
    const result = analyzeFeedbackLoops(nodes, []);
    assert.ok(result.suggestion);
    assert.ok(result.suggestion!.includes('Consider completing'));
  });

  it('suggestion not generated when all hooks have >= 3 components', function () {
    const longPrompt = 'word '.repeat(25).trim();
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto', metadata: { hookPrompt: longPrompt } }),
      makeNode('guide.md', { type: 'steering-flow' }),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'guide.md', type: 'hook-implicit' },
    ];
    const result = analyzeFeedbackLoops(nodes, edges);
    assert.strictEqual(result.suggestion, undefined);
  });

  it('missing never contains "Detection"', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto' }),
    ];
    const result = analyzeFeedbackLoops(nodes, []);
    for (const entry of result.incompleteLoops) {
      assert.ok(!entry.missing.includes('Detection'));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inline Risk Criteria (DML Protection Bugfix — Spec 23)
// ─────────────────────────────────────────────────────────────────────────────

describe('CognitiveValidations — hasInlineRiskCriteria()', function () {
  it('returns false with 0 keywords in prompt', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: 'verify the query before executing' },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), false);
  });

  it('returns false with 1 keyword in prompt', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: 'check risk level before running' },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), false);
  });

  it('returns false with 2 keywords in prompt', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: 'check risk level and critical operations' },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), false);
  });

  it('returns true with exactly 3 keywords in prompt', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: 'check risk level, critical operations, and high impact' },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), true);
  });

  it('returns true with 5+ keywords in prompt', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: {
        hookPrompt: 'Avaliar risco da operação. Se critico ou alto, recusar. Verificar count antes.',
      },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), true);
  });

  it('detects mixed EN/PT-BR keywords', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: 'check risk, avaliar risco, refuse if critical' },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), true);
  });

  it('detects multi-word keywords "sem where"', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: 'recusar operação sem where em tabela critica' },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), true);
  });

  it('detects multi-word keywords "without where" and "critical table"', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: 'refuse operations without where on critical table with high risk' },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), true);
  });

  it('returns false with empty description and no hookPrompt', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: { description: '' },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), false);
  });

  it('returns false with undefined metadata', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: undefined,
    });
    assert.strictEqual(hasInlineRiskCriteria(node), false);
  });

  it('uses description as fallback when hookPrompt is absent', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: { description: 'avaliar risco critico e recusar operações perigosas' },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), true);
  });

  it('concatenates hookPrompt and description for keyword matching', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: {
        hookPrompt: 'check risk level',
        description: 'critical operations must be refused',
      },
    });
    // risk + critical + refuse = 3 keywords across both fields
    assert.strictEqual(hasInlineRiskCriteria(node), true);
  });

  it('is case-insensitive', function () {
    const node = makeNode('hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: 'RISK assessment for CRITICAL and HIGH impact operations' },
    });
    assert.strictEqual(hasInlineRiskCriteria(node), true);
  });
});

describe('CognitiveValidations — computeDmlProtectionLevel with hasInlineRisk', function () {
  it('returns level 2 when hasDmlHook=true and hasInlineRisk=true', function () {
    assert.strictEqual(computeDmlProtectionLevel(true, true, false, true), 2);
  });

  it('returns level 2 when hasDmlHook=true, hasInlineRisk=true, no steering', function () {
    assert.strictEqual(computeDmlProtectionLevel(true, false, false, true), 2);
  });

  it('returns level 2 when hasRiskIntegration=true (existing path preserved)', function () {
    assert.strictEqual(computeDmlProtectionLevel(true, true, true, false), 2);
  });

  it('returns level 1 when hasInlineRisk=false and no risk integration', function () {
    assert.strictEqual(computeDmlProtectionLevel(true, true, false, false), 1);
  });

  it('returns level 0 when no hook and no steering', function () {
    assert.strictEqual(computeDmlProtectionLevel(false, false, false, false), 0);
  });

  it('backward compatible: omitted hasInlineRisk preserves level 1', function () {
    assert.strictEqual(computeDmlProtectionLevel(true, true, false), 1);
  });

  it('backward compatible: omitted hasInlineRisk preserves level 2 with risk integration', function () {
    assert.strictEqual(computeDmlProtectionLevel(true, true, true), 2);
  });

  it('backward compatible: omitted hasInlineRisk preserves level 0', function () {
    assert.strictEqual(computeDmlProtectionLevel(false, false, false), 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Universal Keywords — Semantic Coherence False Positives Fix (Spec 25)
// ─────────────────────────────────────────────────────────────────────────────

describe('CognitiveValidations — UNIVERSAL_KEYWORDS bypass (EN)', function () {
  const enKeywords = [
    'troubleshooting', 'setup', 'configuration', 'examples', 'references',
    'overview', 'summary', 'getting', 'started', 'prerequisites', 'faq', 'tips',
  ];

  const arbitraryKeywordSet = ['security', 'auth', 'permission'];

  enKeywords.forEach(function (keyword) {
    it(`"${keyword}" returns true from isHeaderOnTopic regardless of keyword set`, function () {
      assert.strictEqual(isHeaderOnTopic(keyword, arbitraryKeywordSet), true);
    });
  });

  it('EN universal keyword in mixed-case header returns true', function () {
    assert.strictEqual(isHeaderOnTopic('Troubleshooting Guide', arbitraryKeywordSet), true);
  });

  it('EN universal keyword in compound header returns true', function () {
    assert.strictEqual(isHeaderOnTopic('Getting Started with the Project', arbitraryKeywordSet), true);
  });
});

describe('CognitiveValidations — UNIVERSAL_KEYWORDS bypass (PT-BR)', function () {
  const ptbrKeywords = [
    'armadilhas', 'configuração', 'exemplos', 'referências', 'visão', 'geral',
    'pré', 'requisitos', 'dicas', 'atalhos', 'erros', 'comuns', 'diagnóstico',
  ];

  const arbitraryKeywordSet = ['deploy', 'pipeline', 'docker'];

  ptbrKeywords.forEach(function (keyword) {
    it(`"${keyword}" returns true from isHeaderOnTopic regardless of keyword set`, function () {
      assert.strictEqual(isHeaderOnTopic(keyword, arbitraryKeywordSet), true);
    });
  });

  it('PT-BR universal keyword in compound header returns true', function () {
    assert.strictEqual(isHeaderOnTopic('Visão Geral do Sistema', arbitraryKeywordSet), true);
  });

  it('PT-BR universal keyword "Pré-requisitos" returns true', function () {
    assert.strictEqual(isHeaderOnTopic('Pré-requisitos', arbitraryKeywordSet), true);
  });

  it('PT-BR universal keyword "Erros Comuns" returns true', function () {
    assert.strictEqual(isHeaderOnTopic('Erros Comuns', arbitraryKeywordSet), true);
  });
});

describe('CognitiveValidations — expanded steering-tech terms', function () {
  const techKeywords = KEYWORD_SETS['steering-tech']!;

  it('"Ambientes" is recognized as on-topic for steering-tech', function () {
    assert.strictEqual(isHeaderOnTopic('Ambientes de Produção', techKeywords), true);
  });

  it('"Acesso SSH" is recognized as on-topic for steering-tech', function () {
    assert.strictEqual(isHeaderOnTopic('Acesso SSH', techKeywords), true);
  });

  it('"Tunnel" is recognized as on-topic for steering-tech', function () {
    assert.strictEqual(isHeaderOnTopic('Tunnel Configuration', techKeywords), true);
  });

  it('"Cluster" is recognized as on-topic for steering-tech', function () {
    assert.strictEqual(isHeaderOnTopic('Cluster Setup', techKeywords), true);
  });

  it('"Environment" is recognized as on-topic for steering-tech', function () {
    assert.strictEqual(isHeaderOnTopic('Environment Variables', techKeywords), true);
  });

  it('"SSH" is recognized as on-topic for steering-tech', function () {
    assert.strictEqual(isHeaderOnTopic('SSH Keys', techKeywords), true);
  });

  it('"Network" is recognized as on-topic for steering-tech', function () {
    assert.strictEqual(isHeaderOnTopic('Network Configuration', techKeywords), true);
  });

  it('"Servidor" is recognized as on-topic for steering-tech', function () {
    assert.strictEqual(isHeaderOnTopic('Servidor de Aplicação', techKeywords), true);
  });

  it('"Banco" is recognized as on-topic for steering-tech', function () {
    assert.strictEqual(isHeaderOnTopic('Banco de Dados', techKeywords), true);
  });
});

describe('CognitiveValidations — expanded steering-domain terms', function () {
  const domainKeywords = KEYWORD_SETS['steering-domain']!;

  it('"Stack" is recognized as on-topic for steering-domain', function () {
    assert.strictEqual(isHeaderOnTopic('Stack Tecnológica', domainKeywords), true);
  });

  it('"Webhooks" is recognized as on-topic for steering-domain', function () {
    assert.strictEqual(isHeaderOnTopic('Webhooks Integration', domainKeywords), true);
  });

  it('"Endpoints" is recognized as on-topic for steering-domain', function () {
    assert.strictEqual(isHeaderOnTopic('Endpoints da API', domainKeywords), true);
  });

  it('"Estrutura" is recognized as on-topic for steering-domain', function () {
    assert.strictEqual(isHeaderOnTopic('Estrutura do Projeto', domainKeywords), true);
  });

  it('"Camadas" is recognized as on-topic for steering-domain', function () {
    assert.strictEqual(isHeaderOnTopic('Camadas da Aplicação', domainKeywords), true);
  });
});

describe('CognitiveValidations — genuinely off-topic headers still return false', function () {
  it('"Deploy Pipeline" in steering-policy returns false', function () {
    const policyKeywords = KEYWORD_SETS['steering-policy']!;
    assert.strictEqual(isHeaderOnTopic('Deploy Pipeline', policyKeywords), false);
  });

  it('"Database Migrations" in steering-policy returns false', function () {
    const policyKeywords = KEYWORD_SETS['steering-policy']!;
    assert.strictEqual(isHeaderOnTopic('Database Migrations', policyKeywords), false);
  });

  it('"Docker Compose" in steering-agent returns false', function () {
    const agentKeywords = KEYWORD_SETS['steering-agent']!;
    assert.strictEqual(isHeaderOnTopic('Docker Compose', agentKeywords), false);
  });

  it('"Sprint Planning" in steering-tech returns false', function () {
    const techKeywords = KEYWORD_SETS['steering-tech']!;
    assert.strictEqual(isHeaderOnTopic('Sprint Planning', techKeywords), false);
  });

  it('"User Stories" in steering-observability returns false', function () {
    const obsKeywords = KEYWORD_SETS['steering-observability']!;
    assert.strictEqual(isHeaderOnTopic('User Stories', obsKeywords), false);
  });
});

describe('CognitiveValidations — computeSemanticCoherence with universal headers', function () {
  it('steering with universal headers mixed with domain headers produces no alert', function () {
    const nodes: GraphNode[] = [
      makeNode('tech-guide.md', {
        type: 'steering-tech',
        metadata: {
          sectionHeaders: [
            'Overview',           // universal
            'Prerequisites',      // universal
            'Architecture',       // domain (steering-tech)
            'Troubleshooting',    // universal
            'Examples',           // universal
          ],
        },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 0);
  });

  it('steering with only universal headers produces no alert', function () {
    const nodes: GraphNode[] = [
      makeNode('domain-guide.md', {
        type: 'steering-domain',
        metadata: {
          sectionHeaders: [
            'Visão Geral',
            'Configuração',
            'Exemplos',
            'Diagnóstico',
            'Dicas',
          ],
        },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 0);
  });

  it('steering with genuinely off-topic headers still produces alert', function () {
    const nodes: GraphNode[] = [
      makeNode('policy-guide.md', {
        type: 'steering-policy',
        metadata: {
          sectionHeaders: [
            'Deploy Pipeline',
            'Database Migrations',
            'Docker Compose',
            'Kubernetes Pods',
          ],
        },
      }),
    ];
    const result = computeSemanticCoherence(nodes);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].offTopicHeaders.length, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passive Knowledge — Domain Threshold (Bug C)
// ─────────────────────────────────────────────────────────────────────────────

describe('CognitiveValidations — detectPassiveKnowledge() domain threshold', function () {
  it('domain steering with 7% actionable ratio is NOT flagged (domain threshold 5%)', function () {
    const nodes: GraphNode[] = [
      makeNode('api-patterns.md', { type: 'steering-domain', metadata: { actionableRatio: 0.07 } }),
    ];
    const result = detectPassiveKnowledge(nodes);
    assert.strictEqual(result.length, 0);
  });

  it('domain steering with 4% actionable ratio IS flagged (below domain threshold 5%)', function () {
    const nodes: GraphNode[] = [
      makeNode('api-patterns.md', { type: 'steering-domain', metadata: { actionableRatio: 0.04 } }),
    ];
    const result = detectPassiveKnowledge(nodes);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].actionablePercent, 4);
  });

  it('non-domain steering with 7% actionable ratio IS flagged (standard threshold 10%)', function () {
    const nodes: GraphNode[] = [
      makeNode('flow-deploy.md', { type: 'steering-flow', metadata: { actionableRatio: 0.07 } }),
    ];
    const result = detectPassiveKnowledge(nodes);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].actionablePercent, 7);
  });

  it('non-domain steering with 11% actionable ratio is NOT flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('flow-deploy.md', { type: 'steering-flow', metadata: { actionableRatio: 0.11 } }),
    ];
    const result = detectPassiveKnowledge(nodes);
    assert.strictEqual(result.length, 0);
  });

  it('domain steering at exactly 5% is NOT flagged (threshold is exclusive)', function () {
    const nodes: GraphNode[] = [
      makeNode('domain-rules.md', { type: 'steering-domain', metadata: { actionableRatio: 0.05 } }),
    ];
    const result = detectPassiveKnowledge(nodes);
    assert.strictEqual(result.length, 0);
  });

  it('domain steering with undefined actionableRatio is NOT flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('domain-rules.md', { type: 'steering-domain', metadata: {} }),
    ];
    const result = detectPassiveKnowledge(nodes);
    assert.strictEqual(result.length, 0);
  });
});
