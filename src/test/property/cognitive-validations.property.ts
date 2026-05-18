import * as assert from 'assert';
import * as fc from 'fast-check';
import {
  detectDeadLoops,
  computeHopsToReach,
  computeKeywordOverlap,
  detectDuplicateIntent,
  detectPassiveKnowledge,
  detectSignalToNoise,
  detectContradictions,
  computeHookCoverage,
  computeQualityGateLevel,
  computeDmlProtectionLevel,
} from '../../services/cognitiveValidations';
import type { GraphNode, GraphEdge } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

const nodeIdArb = fc.stringOf(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'),
  { minLength: 1, maxLength: 5 },
).map((s) => `${s}.md`);

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

// ─────────────────────────────────────────────────────────────────────────────
// Dead Loops
// ─────────────────────────────────────────────────────────────────────────────

describe('Cognitive Validations — Dead Loops (Property)', function () {
  this.timeout(30000);

  it('DAGs produce 0 dead loops', function () {
    // Generate a DAG: nodes with edges only going forward (i → j where j > i)
    const dagArb = fc.integer({ min: 3, max: 10 }).chain((size) => {
      const nodeIds = Array.from({ length: size }, (_, i) => `node-${i}.md`);
      const edgeArb = fc.array(
        fc.tuple(
          fc.integer({ min: 0, max: size - 2 }),
          fc.integer({ min: 1, max: size - 1 }),
        ).filter(([a, b]) => a < b),
        { minLength: 1, maxLength: size * 2 },
      );

      return edgeArb.map((edgePairs) => {
        const nodes = nodeIds.map((id) => makeNode(id));
        const edges: GraphEdge[] = edgePairs.map(([a, b]) => ({
          source: nodeIds[a],
          target: nodeIds[b],
          type: 'wiki-link' as const,
        }));
        return { nodes, edges };
      });
    });

    fc.assert(
      fc.property(dagArb, ({ nodes, edges }) => {
        const loops = detectDeadLoops(nodes, edges);
        assert.strictEqual(loops.length, 0, 'DAGs should have 0 dead loops');
      }),
      { numRuns: 100 },
    );
  });

  it('cycles without external entry are detected', function () {
    // Create a simple cycle A→B→C→A with no external edges
    const nodes = [
      makeNode('a.md'),
      makeNode('b.md'),
      makeNode('c.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'wiki-link' },
      { source: 'b.md', target: 'c.md', type: 'wiki-link' },
      { source: 'c.md', target: 'a.md', type: 'wiki-link' },
    ];

    const loops = detectDeadLoops(nodes, edges);
    assert.strictEqual(loops.length, 1);
    assert.strictEqual(loops[0].size, 3);
  });

  it('cycles with external entry are NOT detected as dead loops', function () {
    // Cycle A→B→A, but external node X→A exists
    const nodes = [
      makeNode('a.md'),
      makeNode('b.md'),
      makeNode('x.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'wiki-link' },
      { source: 'b.md', target: 'a.md', type: 'wiki-link' },
      { source: 'x.md', target: 'a.md', type: 'wiki-link' },
    ];

    const loops = detectDeadLoops(nodes, edges);
    assert.strictEqual(loops.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hops to Reach
// ─────────────────────────────────────────────────────────────────────────────

describe('Cognitive Validations — Hops to Reach (Property)', function () {
  this.timeout(30000);

  it('entry points have distance 0 (never flagged)', function () {
    const entryArb = fc.integer({ min: 1, max: 5 }).map((count) => {
      const nodes: GraphNode[] = [];
      for (let i = 0; i < count; i++) {
        nodes.push(makeNode(`entry-${i}.md`, {
          metadata: { inclusion: 'always' },
        }));
      }
      return nodes;
    });

    fc.assert(
      fc.property(entryArb, (nodes) => {
        const alerts = computeHopsToReach(nodes, []);
        // Entry points should never appear in alerts
        for (const node of nodes) {
          assert.ok(
            !alerts.find((a) => a.id === node.id),
            `Entry point ${node.id} should not be flagged`,
          );
        }
      }),
      { numRuns: 50 },
    );
  });

  it('threshold at 4 hops: nodes at distance < 4 are not flagged', function () {
    // Linear chain: entry → n1 → n2 → n3 (3 hops, should NOT be flagged)
    const entry = makeNode('entry.md', { metadata: { inclusion: 'always' } });
    const n1 = makeNode('n1.md');
    const n2 = makeNode('n2.md');
    const n3 = makeNode('n3.md');

    const nodes = [entry, n1, n2, n3];
    const edges: GraphEdge[] = [
      { source: 'entry.md', target: 'n1.md', type: 'wiki-link' },
      { source: 'n1.md', target: 'n2.md', type: 'wiki-link' },
      { source: 'n2.md', target: 'n3.md', type: 'wiki-link' },
    ];

    const alerts = computeHopsToReach(nodes, edges, 4);
    assert.strictEqual(alerts.length, 0);
  });

  it('threshold at 4 hops: nodes at distance >= 4 ARE flagged', function () {
    // Linear chain: entry → n1 → n2 → n3 → n4 (4 hops)
    const entry = makeNode('entry.md', { metadata: { inclusion: 'always' } });
    const n1 = makeNode('n1.md');
    const n2 = makeNode('n2.md');
    const n3 = makeNode('n3.md');
    const n4 = makeNode('n4.md');

    const nodes = [entry, n1, n2, n3, n4];
    const edges: GraphEdge[] = [
      { source: 'entry.md', target: 'n1.md', type: 'wiki-link' },
      { source: 'n1.md', target: 'n2.md', type: 'wiki-link' },
      { source: 'n2.md', target: 'n3.md', type: 'wiki-link' },
      { source: 'n3.md', target: 'n4.md', type: 'wiki-link' },
    ];

    const alerts = computeHopsToReach(nodes, edges, 4);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].id, 'n4.md');
    assert.strictEqual(alerts[0].hops, 4);
  });

  it('unreachable nodes get hops=999', function () {
    const entry = makeNode('entry.md', { metadata: { inclusion: 'always' } });
    const isolated = makeNode('isolated.md');

    const nodes = [entry, isolated];
    const edges: GraphEdge[] = [];

    const alerts = computeHopsToReach(nodes, edges, 4);
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].id, 'isolated.md');
    assert.strictEqual(alerts[0].hops, 999);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate Intent
// ─────────────────────────────────────────────────────────────────────────────

describe('Cognitive Validations — Duplicate Intent (Property)', function () {
  this.timeout(30000);

  it('identical keywords → 100% overlap', function () {
    const keywordsArb = fc.array(
      fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'), { minLength: 4, maxLength: 8 }),
      { minLength: 1, maxLength: 10 },
    );

    fc.assert(
      fc.property(keywordsArb, (keywords) => {
        const overlap = computeKeywordOverlap(keywords, keywords);
        assert.strictEqual(overlap, 100);
      }),
      { numRuns: 50 },
    );
  });

  it('disjoint keywords → 0% overlap', function () {
    const overlap = computeKeywordOverlap(
      ['alpha', 'beta', 'gamma', 'delta'],
      ['epsilon', 'zeta', 'theta', 'iota'],
    );
    assert.strictEqual(overlap, 0);
  });

  it('empty keywords → 0% overlap', function () {
    assert.strictEqual(computeKeywordOverlap([], ['word']), 0);
    assert.strictEqual(computeKeywordOverlap(['word'], []), 0);
    assert.strictEqual(computeKeywordOverlap([], []), 0);
  });

  it('detectDuplicateIntent flags pairs above threshold', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        metadata: {
          inclusion: 'always',
          keywords: ['typescript', 'strict', 'mode', 'compile'],
        },
      }),
      makeNode('b.md', {
        metadata: {
          inclusion: 'always',
          keywords: ['typescript', 'strict', 'mode', 'compile'],
        },
      }),
    ];

    const pairs = detectDuplicateIntent(nodes, 60);
    assert.strictEqual(pairs.length, 1);
    assert.strictEqual(pairs[0].overlap, 100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Passive Knowledge
// ─────────────────────────────────────────────────────────────────────────────

describe('Cognitive Validations — Passive Knowledge (Property)', function () {
  this.timeout(30000);

  it('ratio < 0.10 detected as passive', function () {
    const ratioArb = fc.double({ min: 0, max: 0.099, noNaN: true });

    fc.assert(
      fc.property(ratioArb, (ratio) => {
        const nodes = [makeNode('test.md', { metadata: { actionableRatio: ratio } })];
        const results = detectPassiveKnowledge(nodes, 0.10);
        assert.strictEqual(results.length, 1);
      }),
      { numRuns: 50 },
    );
  });

  it('ratio >= 0.10 NOT detected as passive', function () {
    const ratioArb = fc.double({ min: 0.10, max: 1.0, noNaN: true });

    fc.assert(
      fc.property(ratioArb, (ratio) => {
        const nodes = [makeNode('test.md', { metadata: { actionableRatio: ratio } })];
        const results = detectPassiveKnowledge(nodes, 0.10);
        assert.strictEqual(results.length, 0);
      }),
      { numRuns: 50 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Signal-to-Noise
// ─────────────────────────────────────────────────────────────────────────────

describe('Cognitive Validations — Signal-to-Noise (Property)', function () {
  this.timeout(30000);

  it('0.10 <= ratio < 0.20 detected as low signal', function () {
    const ratioArb = fc.double({ min: 0.10, max: 0.199, noNaN: true });

    fc.assert(
      fc.property(ratioArb, (ratio) => {
        const nodes = [makeNode('test.md', { metadata: { actionableRatio: ratio } })];
        const results = detectSignalToNoise(nodes, 0.10, 0.20);
        assert.strictEqual(results.length, 1);
      }),
      { numRuns: 50 },
    );
  });

  it('ratio < 0.10 NOT detected as signal-to-noise', function () {
    const ratioArb = fc.double({ min: 0, max: 0.099, noNaN: true });

    fc.assert(
      fc.property(ratioArb, (ratio) => {
        const nodes = [makeNode('test.md', { metadata: { actionableRatio: ratio } })];
        const results = detectSignalToNoise(nodes, 0.10, 0.20);
        assert.strictEqual(results.length, 0);
      }),
      { numRuns: 50 },
    );
  });

  it('ratio >= 0.20 NOT detected as signal-to-noise', function () {
    const ratioArb = fc.double({ min: 0.20, max: 1.0, noNaN: true });

    fc.assert(
      fc.property(ratioArb, (ratio) => {
        const nodes = [makeNode('test.md', { metadata: { actionableRatio: ratio } })];
        const results = detectSignalToNoise(nodes, 0.10, 0.20);
        assert.strictEqual(results.length, 0);
      }),
      { numRuns: 50 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Contradictions
// ─────────────────────────────────────────────────────────────────────────────

describe('Cognitive Validations — Contradictions (Property)', function () {
  this.timeout(30000);

  it('opposite pairs detected (always vs never)', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        metadata: {
          inclusion: 'always',
          imperativeLines: [
            { text: 'Always validate input', pattern: 'always', subject: 'validate' },
          ],
        },
      }),
      makeNode('b.md', {
        metadata: {
          inclusion: 'always',
          imperativeLines: [
            { text: 'Never validate input', pattern: 'never', subject: 'validate' },
          ],
        },
      }),
    ];

    const contradictions = detectContradictions(nodes);
    assert.strictEqual(contradictions.length, 1);
    assert.strictEqual(contradictions[0].conflictType, 'always vs never');
  });

  it('opposite pairs detected (use vs avoid)', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        metadata: {
          inclusion: 'always',
          imperativeLines: [
            { text: 'Use globals for config', pattern: 'use', subject: 'globals' },
          ],
        },
      }),
      makeNode('b.md', {
        metadata: {
          inclusion: 'always',
          imperativeLines: [
            { text: 'Avoid globals in modules', pattern: 'avoid', subject: 'globals' },
          ],
        },
      }),
    ];

    const contradictions = detectContradictions(nodes);
    assert.strictEqual(contradictions.length, 1);
    assert.strictEqual(contradictions[0].conflictType, 'use vs avoid');
  });

  it('same patterns not flagged as contradictions', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        metadata: {
          inclusion: 'always',
          imperativeLines: [
            { text: 'Always validate input', pattern: 'always', subject: 'validate' },
          ],
        },
      }),
      makeNode('b.md', {
        metadata: {
          inclusion: 'always',
          imperativeLines: [
            { text: 'Always validate output', pattern: 'always', subject: 'validate' },
          ],
        },
      }),
    ];

    const contradictions = detectContradictions(nodes);
    assert.strictEqual(contradictions.length, 0);
  });

  it('different subjects not flagged', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', {
        metadata: {
          inclusion: 'always',
          imperativeLines: [
            { text: 'Always validate input', pattern: 'always', subject: 'validate' },
          ],
        },
      }),
      makeNode('b.md', {
        metadata: {
          inclusion: 'always',
          imperativeLines: [
            { text: 'Never skip tests', pattern: 'never', subject: 'skip' },
          ],
        },
      }),
    ];

    const contradictions = detectContradictions(nodes);
    assert.strictEqual(contradictions.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hook Coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('Cognitive Validations — Hook Coverage (Property)', function () {
  this.timeout(30000);

  it('all events covered → uncovered empty', function () {
    const allEvents = [
      'fileEdited', 'fileCreated', 'fileDeleted', 'userTriggered',
      'promptSubmit', 'agentStop', 'preToolUse', 'postToolUse',
      'preTaskExecution', 'postTaskExecution',
    ];

    const nodes: GraphNode[] = allEvents.map((event, i) =>
      makeNode(`hook-${i}.md`, {
        type: 'hook-auto',
        metadata: { whenType: event },
      }),
    );

    const coverage = computeHookCoverage(nodes);
    assert.strictEqual(coverage.uncovered.length, 0);
    assert.strictEqual(coverage.covered.length, 10);
  });

  it('missing events listed in uncovered', function () {
    // Only cover 2 events
    const nodes: GraphNode[] = [
      makeNode('hook-1.md', { type: 'hook-auto', metadata: { whenType: 'fileEdited' } }),
      makeNode('hook-2.md', { type: 'hook-manual', metadata: { whenType: 'userTriggered' } }),
    ];

    const coverage = computeHookCoverage(nodes);
    assert.strictEqual(coverage.covered.length, 2);
    assert.strictEqual(coverage.uncovered.length, 8);
    assert.ok(coverage.uncovered.some((u) => u.event === 'preToolUse'));
    assert.ok(coverage.uncovered.some((u) => u.event === 'postToolUse'));
  });

  it('no hooks → all events uncovered', function () {
    const coverage = computeHookCoverage([]);
    assert.strictEqual(coverage.covered.length, 0);
    assert.strictEqual(coverage.uncovered.length, 10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quality Gate
// ─────────────────────────────────────────────────────────────────────────────

describe('Cognitive Validations — Quality Gate (Property)', function () {
  this.timeout(30000);

  it('level 0 when all components missing', function () {
    assert.strictEqual(computeQualityGateLevel(false, false, false), 0);
  });

  it('level 1 when some components present', function () {
    assert.strictEqual(computeQualityGateLevel(true, false, false), 1);
    assert.strictEqual(computeQualityGateLevel(false, true, false), 1);
    assert.strictEqual(computeQualityGateLevel(false, false, true), 1);
    assert.strictEqual(computeQualityGateLevel(true, true, false), 1);
    assert.strictEqual(computeQualityGateLevel(true, false, true), 1);
    assert.strictEqual(computeQualityGateLevel(false, true, true), 1);
  });

  it('level 2 when all components present', function () {
    assert.strictEqual(computeQualityGateLevel(true, true, true), 2);
  });

  it('property: level is always 0, 1, or 2', function () {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (a, b, c) => {
          const level = computeQualityGateLevel(a, b, c);
          assert.ok(level === 0 || level === 1 || level === 2);
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DML Protection
// ─────────────────────────────────────────────────────────────────────────────

describe('Cognitive Validations — DML Protection (Property)', function () {
  this.timeout(30000);

  it('level 0 when no hook and no steering', function () {
    assert.strictEqual(computeDmlProtectionLevel(false, false, false), 0);
  });

  it('level 1 when hook + steering but no risk integration', function () {
    assert.strictEqual(computeDmlProtectionLevel(true, true, false), 1);
  });

  it('level 1 when only hook present', function () {
    assert.strictEqual(computeDmlProtectionLevel(true, false, false), 1);
  });

  it('level 1 when only steering present', function () {
    assert.strictEqual(computeDmlProtectionLevel(false, true, false), 1);
  });

  it('level 2 when all components present', function () {
    assert.strictEqual(computeDmlProtectionLevel(true, true, true), 2);
  });

  it('property: level is always 0, 1, or 2', function () {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (hook, steering, risk) => {
          const level = computeDmlProtectionLevel(hook, steering, risk);
          assert.ok(level === 0 || level === 1 || level === 2);
        },
      ),
      { numRuns: 20 },
    );
  });
});
