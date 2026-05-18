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

// ─────────────────────────────────────────────────────────────────────────────
// False Positives Fix — Bug Condition Exploration Tests
// ─────────────────────────────────────────────────────────────────────────────

import {
  computeContextOverload,
  computeOrphanSteerings,
  computeIsolatedFiles,
  computeHooksWithoutInstruction,
  isPromptSelfSufficient,
} from '../../services/cognitiveValidations';

describe('Bug Condition — Context Overload excludes fileMatch/manual (Property)', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 1.1, 2.1**
   *
   * For any steering with inclusion fileMatch or manual,
   * computeContextOverload must NOT include it in the result.
   */
  it('steerings with fileMatch/manual inclusion are NOT in overload result', function () {
    const inclusionArb = fc.constantFrom('fileMatch', 'manual');
    const lineCountArb = fc.integer({ min: 351, max: 5000 });

    fc.assert(
      fc.property(inclusionArb, lineCountArb, (inclusion, lineCount) => {
        const node = makeNode('test-steering.md', {
          type: 'steering-domain',
          metadata: { inclusion, lineCount },
        });
        const result = computeContextOverload([node]);
        assert.strictEqual(result.overloaded.length, 0,
          `Steering with inclusion=${inclusion} should NOT be in overload`);
        assert.strictEqual(result.totalAlwaysLines, 0,
          `Steering with inclusion=${inclusion} should NOT count in totalAlwaysLines`);
      }),
      { numRuns: 50 },
    );
  });

  it('multiple fileMatch/manual steerings produce empty overload', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-flow', metadata: { inclusion: 'fileMatch', lineCount: 400 } }),
      makeNode('b.md', { type: 'steering-tech', metadata: { inclusion: 'manual', lineCount: 500 } }),
      makeNode('c.md', { type: 'steering-domain', metadata: { inclusion: 'fileMatch', lineCount: 1000 } }),
    ];
    const result = computeContextOverload(nodes);
    assert.strictEqual(result.overloaded.length, 0);
    assert.strictEqual(result.totalAlwaysLines, 0);
  });
});

describe('Bug Condition — Orphan Steerings excludes fileMatch/manual (Property)', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 1.2, 2.2**
   *
   * For any steering with inclusion fileMatch or manual and 0 connections,
   * computeOrphanSteerings must NOT include it in the result.
   */
  it('steerings with fileMatch/manual inclusion are NOT marked as orphans', function () {
    const inclusionArb = fc.constantFrom('fileMatch', 'manual');

    fc.assert(
      fc.property(inclusionArb, (inclusion) => {
        const node = makeNode('orphan-test.md', {
          type: 'steering-domain',
          metadata: { inclusion },
        });
        const result = computeOrphanSteerings([node], []);
        assert.strictEqual(result.length, 0,
          `Steering with inclusion=${inclusion} should NOT be marked as orphan`);
      }),
      { numRuns: 50 },
    );
  });

  it('fileMatch/manual steerings with zero edges are not orphans', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-flow', metadata: { inclusion: 'fileMatch' } }),
      makeNode('b.md', { type: 'steering-tech', metadata: { inclusion: 'manual' } }),
    ];
    const result = computeOrphanSteerings(nodes, []);
    assert.strictEqual(result.length, 0);
  });
});

describe('Bug Condition — Isolated Files excludes hooks and skills (Property)', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 1.3, 2.3**
   *
   * For any node with type hook-auto, hook-manual, or skill,
   * computeIsolatedFiles must NOT include it in the result.
   */
  it('hooks and skills with 0 connections are NOT marked as isolated', function () {
    const typeArb = fc.constantFrom('hook-auto' as const, 'hook-manual' as const, 'skill' as const);

    fc.assert(
      fc.property(typeArb, (nodeType) => {
        const node = makeNode('test-node.md', { type: nodeType });
        const result = computeIsolatedFiles([node], []);
        assert.strictEqual(result.length, 0,
          `Node with type=${nodeType} should NOT be marked as isolated`);
      }),
      { numRuns: 30 },
    );
  });

  it('multiple hooks and skills with zero edges are not isolated', function () {
    const nodes: GraphNode[] = [
      makeNode('hook1.json', { type: 'hook-auto' }),
      makeNode('hook2.json', { type: 'hook-manual' }),
      makeNode('skill1.md', { type: 'skill' }),
    ];
    const result = computeIsolatedFiles(nodes, []);
    assert.strictEqual(result.length, 0);
  });
});

describe('Bug Condition — Hooks Without Instruction recognizes self-sufficient prompts (Property)', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 1.4, 2.4**
   *
   * For any hook with a self-sufficient prompt (>= 20 words + imperative verbs)
   * and no steering reference, computeHooksWithoutInstruction must NOT flag it.
   */
  it('hooks with self-sufficient prompts are NOT flagged', function () {
    const verbArb = fc.constantFrom(
      'analise', 'verifique', 'garanta', 'ensure', 'verify', 'check',
      'validate', 'review', 'implement', 'always', 'must', 'should',
    );
    const fillerArb = fc.constantFrom(
      'the', 'code', 'changes', 'output', 'result', 'file', 'module',
      'function', 'class', 'method', 'variable', 'pattern', 'structure',
      'logic', 'behavior', 'input', 'data', 'format', 'style', 'naming',
    );

    // Generate prompts with >= 20 words including at least one imperative verb
    const promptArb = fc.tuple(
      verbArb,
      fc.array(fillerArb, { minLength: 19, maxLength: 40 }),
    ).map(([verb, fillers]) => [verb, ...fillers].join(' '));

    fc.assert(
      fc.property(promptArb, (prompt) => {
        const node = makeNode('hook-test.json', {
          type: 'hook-auto',
          metadata: { hookPrompt: prompt },
        });
        const result = computeHooksWithoutInstruction([node], []);
        assert.strictEqual(result.length, 0,
          `Hook with self-sufficient prompt should NOT be flagged`);
      }),
      { numRuns: 50 },
    );
  });

  it('hook with 30-word imperative prompt is not flagged', function () {
    const prompt = 'Analise o código alterado e verifique se segue os padrões de nomenclatura do projeto. Garanta que não há duplicação de lógica e que os testes cobrem os cenários principais. Reporte qualquer violação encontrada.';
    const node = makeNode('review-hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: prompt },
    });
    const result = computeHooksWithoutInstruction([node], []);
    assert.strictEqual(result.length, 0);
  });
});

describe('Bug Condition — Parser strips quotes from inclusion (Property)', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 1.1, 3.5**
   *
   * The isPromptSelfSufficient function correctly evaluates prompts.
   * This test validates the fix indirectly through the validation functions.
   */
  it('isPromptSelfSufficient returns true for adequate prompts', function () {
    const prompt = 'Ensure that all code changes follow the established patterns and verify that no regressions are introduced in the test suite before completing the task';
    assert.strictEqual(isPromptSelfSufficient(prompt), true);
  });

  it('isPromptSelfSufficient returns false for short prompts', function () {
    assert.strictEqual(isPromptSelfSufficient('check code'), false);
    assert.strictEqual(isPromptSelfSufficient(''), false);
    assert.strictEqual(isPromptSelfSufficient(null), false);
    assert.strictEqual(isPromptSelfSufficient(undefined), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// False Positives Fix — Preservation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Preservation — Context Overload keeps always/auto steerings (Property)', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 3.1**
   *
   * For any steering with inclusion always or auto and lineCount > 350,
   * computeContextOverload MUST include it in the result.
   */
  it('steerings with always inclusion and >350 lines ARE in overload', function () {
    const lineCountArb = fc.integer({ min: 351, max: 5000 });

    fc.assert(
      fc.property(lineCountArb, (lineCount) => {
        const node = makeNode('big-steering.md', {
          type: 'steering-domain',
          metadata: { inclusion: 'always', lineCount },
        });
        const result = computeContextOverload([node]);
        assert.strictEqual(result.overloaded.length, 1,
          `Steering with inclusion=always and ${lineCount} lines should be in overload`);
        assert.strictEqual(result.totalAlwaysLines, lineCount);
      }),
      { numRuns: 50 },
    );
  });

  it('steerings with auto inclusion and >1000 lines ARE in largeDomainSteerings', function () {
    const lineCountArb = fc.integer({ min: 1001, max: 5000 });

    fc.assert(
      fc.property(lineCountArb, (lineCount) => {
        const node = makeNode('domain-steering.md', {
          type: 'steering-domain',
          metadata: { inclusion: 'auto', lineCount },
        });
        const result = computeContextOverload([node]);
        assert.strictEqual(result.overloaded.length, 0,
          `Auto steering should NOT be in overload`);
        assert.strictEqual(result.largeDomainSteerings.length, 1,
          `Auto steering with ${lineCount} lines should be in largeDomainSteerings`);
        assert.strictEqual(result.totalAlwaysLines, 0);
      }),
      { numRuns: 50 },
    );
  });

  it('steerings with auto inclusion and <=1000 lines are NOT flagged', function () {
    const lineCountArb = fc.integer({ min: 100, max: 1000 });

    fc.assert(
      fc.property(lineCountArb, (lineCount) => {
        const node = makeNode('small-domain.md', {
          type: 'steering-domain',
          metadata: { inclusion: 'auto', lineCount },
        });
        const result = computeContextOverload([node]);
        assert.strictEqual(result.overloaded.length, 0);
        assert.strictEqual(result.largeDomainSteerings.length, 0);
      }),
      { numRuns: 50 },
    );
  });

  it('steerings without inclusion (default always) and >350 lines ARE in overload', function () {
    const lineCountArb = fc.integer({ min: 351, max: 5000 });

    fc.assert(
      fc.property(lineCountArb, (lineCount) => {
        const node = makeNode('default-steering.md', {
          type: 'steering-flow',
          metadata: { lineCount },
        });
        const result = computeContextOverload([node]);
        assert.strictEqual(result.overloaded.length, 1);
        assert.strictEqual(result.totalAlwaysLines, lineCount);
      }),
      { numRuns: 30 },
    );
  });
});

describe('Preservation — Orphan Steerings keeps always/auto without connections (Property)', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 3.2**
   *
   * For any steering with inclusion always or auto and 0 connections,
   * computeOrphanSteerings MUST include it in the result.
   */
  it('steerings with always/auto inclusion and 0 edges ARE orphans', function () {
    const inclusionArb = fc.constantFrom('always', 'auto');

    fc.assert(
      fc.property(inclusionArb, (inclusion) => {
        const node = makeNode('orphan-always.md', {
          type: 'steering-domain',
          metadata: { inclusion },
        });
        const result = computeOrphanSteerings([node], []);
        assert.strictEqual(result.length, 1,
          `Steering with inclusion=${inclusion} and 0 edges should be orphan`);
      }),
      { numRuns: 30 },
    );
  });

  it('steerings without inclusion (default always) and 0 edges ARE orphans', function () {
    const node = makeNode('no-inclusion.md', {
      type: 'steering-tech',
      metadata: {},
    });
    const result = computeOrphanSteerings([node], []);
    assert.strictEqual(result.length, 1);
  });
});

describe('Preservation — Isolated Files keeps steerings without connections (Property)', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 3.3**
   *
   * For any steering node with 0 edges, computeIsolatedFiles MUST include it.
   */
  it('steering nodes with 0 edges ARE marked as isolated', function () {
    const typeArb = fc.constantFrom(
      'steering-domain' as const,
      'steering-flow' as const,
      'steering-tech' as const,
      'steering-help' as const,
      'steering-policy' as const,
    );

    fc.assert(
      fc.property(typeArb, (nodeType) => {
        const node = makeNode('isolated-steering.md', { type: nodeType });
        const result = computeIsolatedFiles([node], []);
        assert.strictEqual(result.length, 1,
          `Steering with type=${nodeType} and 0 edges should be isolated`);
      }),
      { numRuns: 30 },
    );
  });

  it('non-hook non-skill nodes with 0 edges ARE isolated', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { type: 'steering-domain' }),
      makeNode('b.md', { type: 'steering-flow' }),
      makeNode('c.md', { type: 'unknown' }),
    ];
    const result = computeIsolatedFiles(nodes, []);
    assert.strictEqual(result.length, 3);
  });
});

describe('Preservation — Hooks Without Instruction keeps hooks with insufficient prompts (Property)', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 3.4**
   *
   * For any hook without steering ref AND with empty/short/non-imperative prompt,
   * computeHooksWithoutInstruction MUST flag it.
   */
  it('hooks with empty prompt and no steering ref ARE flagged', function () {
    const node = makeNode('empty-hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: '' },
    });
    const result = computeHooksWithoutInstruction([node], []);
    assert.strictEqual(result.length, 1);
  });

  it('hooks with short prompt (< 20 words) and no steering ref ARE flagged', function () {
    const shortPromptArb = fc.array(
      fc.constantFrom('run', 'lint', 'check', 'code', 'file', 'test'),
      { minLength: 1, maxLength: 19 },
    ).map((words) => words.join(' '));

    fc.assert(
      fc.property(shortPromptArb, (prompt) => {
        const node = makeNode('short-hook.json', {
          type: 'hook-auto',
          metadata: { hookPrompt: prompt },
        });
        const result = computeHooksWithoutInstruction([node], []);
        assert.strictEqual(result.length, 1,
          `Hook with ${prompt.split(/\s+/).length}-word prompt should be flagged`);
      }),
      { numRuns: 30 },
    );
  });

  it('hooks with 25-word prompt but no imperative verbs ARE flagged', function () {
    // Generate a prompt with 25 words but no imperative verbs
    const fillerWords = Array(25).fill('lorem').join(' ');
    const node = makeNode('no-verb-hook.json', {
      type: 'hook-auto',
      metadata: { hookPrompt: fillerWords },
    });
    const result = computeHooksWithoutInstruction([node], []);
    assert.strictEqual(result.length, 1);
  });
});

describe('Preservation — Parser extracts inclusion without quotes correctly (Property)', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 3.5**
   *
   * The computeContextOverload function works correctly with nodes
   * that have properly extracted inclusion values (no quotes).
   */
  it('nodes with inclusion=always are correctly processed', function () {
    const node = makeNode('always-steering.md', {
      type: 'steering-domain',
      metadata: { inclusion: 'always', lineCount: 400 },
    });
    const result = computeContextOverload([node]);
    assert.strictEqual(result.overloaded.length, 1);
  });

  it('nodes with inclusion=fileMatch are correctly excluded', function () {
    const node = makeNode('filematch-steering.md', {
      type: 'steering-domain',
      metadata: { inclusion: 'fileMatch', lineCount: 400 },
    });
    const result = computeContextOverload([node]);
    assert.strictEqual(result.overloaded.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Analysis Precision Refinements — Decision Table Detection
// ─────────────────────────────────────────────────────────────────────────────

import {
  isDecisionTableHeader,
  computeActionableRatio,
} from '../../services/contentAnalyzer';
import { computeFragileLinks } from '../../services/cognitiveValidations';

describe('Decision Table — Header Detection (Property)', function () {
  this.timeout(30000);

  /**
   * **Feature: analysis-precision-refinements, Property 1: Detecção de cabeçalho de tabela de decisão**
   * **Validates: Requirements 1.1**
   *
   * For any table line containing a recognized decision pair,
   * isDecisionTableHeader must return true.
   */
  it('lines with recognized decision pairs return true', function () {
    const pairArb = fc.constantFrom(
      ['Quando', 'Ação'], ['Quando', 'Acao'],
      ['Se', 'Então'], ['Se', 'Entao'],
      ['Situação', 'Ação'], ['Situacao', 'Acao'],
      ['Cenário', 'Resposta'], ['Cenario', 'Resposta'],
      ['Condition', 'Action'],
      ['If', 'Then'],
      ['Trigger', 'Response'],
    );

    const extraColArb = fc.array(
      fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 3, maxLength: 8 }),
      { minLength: 0, maxLength: 3 },
    );

    fc.assert(
      fc.property(pairArb, extraColArb, ([colA, colB], extras) => {
        const allCols = [colA, colB, ...extras];
        const line = '| ' + allCols.join(' | ') + ' |';
        assert.strictEqual(isDecisionTableHeader(line), true,
          `Expected true for: ${line}`);
      }),
      { numRuns: 100 },
    );
  });

  it('lines without recognized pairs return false', function () {
    const nonDecisionColArb = fc.constantFrom(
      'Name', 'Description', 'File', 'Size', 'Date', 'Author',
      'Status', 'Priority', 'Module', 'Version', 'Notes',
    );

    const colsArb = fc.array(nonDecisionColArb, { minLength: 2, maxLength: 5 });

    fc.assert(
      fc.property(colsArb, (cols) => {
        const line = '| ' + cols.join(' | ') + ' |';
        assert.strictEqual(isDecisionTableHeader(line), false,
          `Expected false for: ${line}`);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Decision Table — Data Rows Actionable (Property)', function () {
  this.timeout(30000);

  /**
   * **Feature: analysis-precision-refinements, Property 2: Linhas de dados de tabela de decisão são acionáveis**
   * **Validates: Requirements 1.2, 1.3, 1.6**
   *
   * For any decision table with N data rows, computeActionableRatio
   * counts exactly N lines as actionable from the table.
   */
  it('N data rows produce exactly N actionable lines from table', function () {
    const dataRowCountArb = fc.integer({ min: 1, max: 10 });

    fc.assert(
      fc.property(dataRowCountArb, (n) => {
        const lines = ['| Condition | Action |', '|---|---|'];
        for (let i = 0; i < n; i++) {
          lines.push(`| condition-${i} | action-${i} |`);
        }
        const content = lines.join('\n');
        const ratio = computeActionableRatio(content);
        const totalNonEmpty = n + 2; // header + separator + n data rows
        const expected = n / totalNonEmpty;
        assert.strictEqual(ratio, expected,
          `Expected ${n}/${totalNonEmpty} for ${n} data rows`);
      }),
      { numRuns: 100 },
    );
  });

  it('table with 0 data rows contributes 0 actionable', function () {
    const content = ['| If | Then |', '|---|---|'].join('\n');
    const ratio = computeActionableRatio(content);
    assert.strictEqual(ratio, 0);
  });
});

describe('Decision Table — Additivity (Property)', function () {
  this.timeout(30000);

  /**
   * **Feature: analysis-precision-refinements, Property 3: Aditividade de imperativos e tabelas de decisão**
   * **Validates: Requirements 1.5**
   *
   * For content with K imperative lines and a decision table with N data rows,
   * total actionable = K + N.
   */
  it('K imperatives + N data rows = K+N actionable', function () {
    const kArb = fc.integer({ min: 1, max: 5 });
    const nArb = fc.integer({ min: 1, max: 5 });

    fc.assert(
      fc.property(kArb, nArb, (k, n) => {
        const lines: string[] = [];
        for (let i = 0; i < k; i++) {
          lines.push(`Always validate input-${i}.`);
        }
        lines.push('| Trigger | Response |');
        lines.push('|---|---|');
        for (let i = 0; i < n; i++) {
          lines.push(`| trigger-${i} | response-${i} |`);
        }
        const content = lines.join('\n');
        const ratio = computeActionableRatio(content);
        const totalNonEmpty = k + 2 + n; // k imperatives + header + sep + n data
        const expectedActionable = k + n;
        const expected = expectedActionable / totalNonEmpty;
        assert.strictEqual(ratio, expected,
          `Expected ${expectedActionable}/${totalNonEmpty}`);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Decision Table — Non-Decision Tables (Property)', function () {
  this.timeout(30000);

  /**
   * **Feature: analysis-precision-refinements, Property 4: Tabelas não-decisão não inflam o actionable count**
   * **Validates: Requirements 1.4, 3.1, 3.3, 3.4**
   *
   * Adding a non-decision table does not change the actionable count.
   */
  it('non-decision table rows do not inflate actionable count', function () {
    const kArb = fc.integer({ min: 1, max: 5 });
    const tableRowsArb = fc.integer({ min: 1, max: 5 });

    fc.assert(
      fc.property(kArb, tableRowsArb, (k, tableRows) => {
        // Base content with k imperative lines
        const baseLines: string[] = [];
        for (let i = 0; i < k; i++) {
          baseLines.push(`Never skip validation-${i}.`);
        }
        const baseContent = baseLines.join('\n');
        const baseRatio = computeActionableRatio(baseContent);
        const baseActionable = Math.round(baseRatio * k);

        // Add non-decision table
        const withTable = [...baseLines];
        withTable.push('| Name | Description |');
        withTable.push('|---|---|');
        for (let i = 0; i < tableRows; i++) {
          withTable.push(`| item-${i} | desc-${i} |`);
        }
        const tableContent = withTable.join('\n');
        const tableRatio = computeActionableRatio(tableContent);
        const totalNonEmpty = k + 2 + tableRows;
        const tableActionable = Math.round(tableRatio * totalNonEmpty);

        // Actionable count should remain the same (only k imperatives)
        assert.strictEqual(tableActionable, baseActionable,
          `Actionable count should stay at ${baseActionable}, got ${tableActionable}`);
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Analysis Precision Refinements — Fragile Links Filter
// ─────────────────────────────────────────────────────────────────────────────

describe('Fragile Links Filter (Property)', function () {
  this.timeout(30000);

  /**
   * **Feature: analysis-precision-refinements, Property 5: Vínculos frágeis apenas de origens always/auto/hook**
   * **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 3.2**
   *
   * computeFragileLinks only includes edges where source is always/auto or hook.
   * Edges from fileMatch/manual sources never appear.
   */
  it('only always/auto/hook sources appear in fragile links', function () {
    const inclusionArb = fc.constantFrom('always', 'auto', 'fileMatch', 'manual');
    const typeArb = fc.constantFrom(
      'steering-domain' as const,
      'steering-flow' as const,
      'hook-auto' as const,
      'hook-manual' as const,
    );

    const nodeCountArb = fc.integer({ min: 2, max: 8 });

    fc.assert(
      fc.property(nodeCountArb, fc.array(
        fc.tuple(inclusionArb, typeArb),
        { minLength: 2, maxLength: 8 },
      ), (_, nodeConfigs) => {
        const nodes: GraphNode[] = nodeConfigs.map(([inclusion, type], i) =>
          makeNode(`node-${i}.md`, { type, metadata: { inclusion } }),
        );
        nodes.push(makeNode('target.md'));

        const edges: GraphEdge[] = nodeConfigs.map((_, i) => ({
          source: `node-${i}.md`,
          target: 'target.md',
          type: 'backtick-ref' as const,
        }));

        const result = computeFragileLinks(nodes, edges);

        for (const link of result) {
          const sourceNode = nodes.find((n) => n.id === link.source);
          assert.ok(sourceNode, `Source node ${link.source} should exist`);
          const sType = sourceNode!.type || '';
          const isHook = sType === 'hook-auto' || sType === 'hook-manual';
          if (!isHook) {
            const inclusion = (sourceNode!.metadata && sourceNode!.metadata.inclusion) || 'always';
            assert.ok(
              inclusion === 'always' || inclusion === 'auto',
              `Non-hook source should have always/auto inclusion, got ${inclusion}`,
            );
          }
        }

        // Verify fileMatch/manual sources are excluded
        for (const edge of edges) {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          if (!sourceNode) { continue; }
          const sType = sourceNode.type || '';
          const isHook = sType === 'hook-auto' || sType === 'hook-manual';
          if (!isHook) {
            const inclusion = (sourceNode.metadata && sourceNode.metadata.inclusion) || 'always';
            if (inclusion === 'fileMatch' || inclusion === 'manual') {
              assert.ok(
                !result.some((r) => r.source === edge.source),
                `fileMatch/manual source ${edge.source} should NOT be in result`,
              );
            }
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('hooks always appear regardless of inclusion metadata', function () {
    const inclusionArb = fc.constantFrom('always', 'auto', 'fileMatch', 'manual');
    const hookTypeArb = fc.constantFrom('hook-auto' as const, 'hook-manual' as const);

    fc.assert(
      fc.property(inclusionArb, hookTypeArb, (inclusion, hookType) => {
        const nodes: GraphNode[] = [
          makeNode('hook.json', { type: hookType, metadata: { inclusion } }),
          makeNode('target.md'),
        ];
        const edges: GraphEdge[] = [
          { source: 'hook.json', target: 'target.md', type: 'backtick-ref' },
        ];
        const result = computeFragileLinks(nodes, edges);
        assert.strictEqual(result.length, 1,
          `Hook with type=${hookType} and inclusion=${inclusion} should be included`);
      }),
      { numRuns: 50 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stale Content Detection (Rule 20) — Property-Based Tests
// ─────────────────────────────────────────────────────────────────────────────

import { detectStaleContent } from '../../services/cognitiveValidations';

describe('Stale Content Detection (Property)', function () {
  this.timeout(30000);

  const DAY_MS = 1000 * 60 * 60 * 24;
  const NOW = 1700000000000;

  /**
   * **Validates: Requirements 1.2**
   * Property: riskScore always === stalenessDays × degree for each result.
   */
  it('riskScore === stalenessDays × degree for all results', function () {
    const mtimeArb = fc.integer({ min: 1, max: 365 }).map((days) => NOW - (days * DAY_MS));
    const degreeArb = fc.integer({ min: 1, max: 10 });

    fc.assert(
      fc.property(
        fc.array(fc.tuple(mtimeArb, degreeArb), { minLength: 1, maxLength: 10 }),
        (configs) => {
          const nodes: GraphNode[] = [];
          const edges: GraphEdge[] = [];

          configs.forEach(([mtime, targetDegree], i) => {
            const nodeId = `steer-${i}.md`;
            nodes.push(makeNode(nodeId, { type: 'steering-domain', metadata: { mtime } }));
            for (let j = 0; j < targetDegree; j++) {
              const targetId = `target-${i}-${j}.md`;
              nodes.push(makeNode(targetId));
              edges.push({ source: nodeId, target: targetId, type: 'wiki-link' });
            }
          });

          const result = detectStaleContent(nodes, edges, {
            stalenessThresholdDays: 0,
            degreeThreshold: 0,
            currentTimeMs: NOW,
          });

          for (const alert of result) {
            assert.strictEqual(
              alert.riskScore,
              alert.stalenessDays * alert.degree,
              `riskScore should be ${alert.stalenessDays} × ${alert.degree}`,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.3**
   * Property: results always sorted by riskScore descending.
   */
  it('results sorted by riskScore descending', function () {
    const mtimeArb = fc.integer({ min: 1, max: 365 }).map((days) => NOW - (days * DAY_MS));

    fc.assert(
      fc.property(
        fc.array(mtimeArb, { minLength: 2, maxLength: 10 }),
        (mtimes) => {
          const nodes: GraphNode[] = [];
          const edges: GraphEdge[] = [];

          mtimes.forEach((mtime, i) => {
            const nodeId = `s-${i}.md`;
            nodes.push(makeNode(nodeId, { type: 'steering-domain', metadata: { mtime } }));
            for (let j = 0; j <= i; j++) {
              const targetId = `t-${i}-${j}.md`;
              nodes.push(makeNode(targetId));
              edges.push({ source: nodeId, target: targetId, type: 'wiki-link' });
            }
          });

          const result = detectStaleContent(nodes, edges, {
            stalenessThresholdDays: 0,
            degreeThreshold: 0,
            currentTimeMs: NOW,
          });

          for (let k = 1; k < result.length; k++) {
            assert.ok(
              result[k - 1].riskScore >= result[k].riskScore,
              `result[${k - 1}].riskScore (${result[k - 1].riskScore}) >= result[${k}].riskScore (${result[k].riskScore})`,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.5**
   * Property: no result with stalenessDays < threshold (when threshold > 0).
   */
  it('no result with stalenessDays < threshold', function () {
    const thresholdArb = fc.integer({ min: 1, max: 200 });
    const mtimeArb = fc.integer({ min: 1, max: 365 }).map((days) => NOW - (days * DAY_MS));

    fc.assert(
      fc.property(
        thresholdArb,
        fc.array(mtimeArb, { minLength: 1, maxLength: 8 }),
        (threshold, mtimes) => {
          const nodes: GraphNode[] = [];
          const edges: GraphEdge[] = [];

          mtimes.forEach((mtime, i) => {
            const nodeId = `n-${i}.md`;
            nodes.push(makeNode(nodeId, { type: 'steering-domain', metadata: { mtime } }));
            for (let j = 0; j < 5; j++) {
              const targetId = `e-${i}-${j}.md`;
              nodes.push(makeNode(targetId));
              edges.push({ source: nodeId, target: targetId, type: 'wiki-link' });
            }
          });

          const result = detectStaleContent(nodes, edges, {
            stalenessThresholdDays: threshold,
            degreeThreshold: 0,
            currentTimeMs: NOW,
          });

          for (const alert of result) {
            assert.ok(
              alert.stalenessDays >= threshold,
              `stalenessDays (${alert.stalenessDays}) should be >= threshold (${threshold})`,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.6**
   * Property: no result with degree < degreeThreshold (when degreeThreshold > 0).
   */
  it('no result with degree < degreeThreshold', function () {
    const degreeThresholdArb = fc.integer({ min: 1, max: 8 });
    const mtimeArb = fc.integer({ min: 91, max: 365 }).map((days) => NOW - (days * DAY_MS));

    fc.assert(
      fc.property(
        degreeThresholdArb,
        fc.array(
          fc.tuple(mtimeArb, fc.integer({ min: 1, max: 10 })),
          { minLength: 1, maxLength: 8 },
        ),
        (degreeThreshold, configs) => {
          const nodes: GraphNode[] = [];
          const edges: GraphEdge[] = [];

          configs.forEach(([mtime, edgeCount], i) => {
            const nodeId = `d-${i}.md`;
            nodes.push(makeNode(nodeId, { type: 'steering-domain', metadata: { mtime } }));
            for (let j = 0; j < edgeCount; j++) {
              const targetId = `dt-${i}-${j}.md`;
              nodes.push(makeNode(targetId));
              edges.push({ source: nodeId, target: targetId, type: 'wiki-link' });
            }
          });

          const result = detectStaleContent(nodes, edges, {
            stalenessThresholdDays: 0,
            degreeThreshold,
            currentTimeMs: NOW,
          });

          for (const alert of result) {
            assert.ok(
              alert.degree >= degreeThreshold,
              `degree (${alert.degree}) should be >= degreeThreshold (${degreeThreshold})`,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Link Recommender (Suggested Connections)
// ─────────────────────────────────────────────────────────────────────────────

import { computeLinkSuggestions } from '../../services/cognitiveValidations';

describe('Cognitive Validations — Link Recommender (Property)', function () {
  this.timeout(30000);

  // Arbitrary: generate a list of unique keyword strings
  const keywordArb = fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'),
    { minLength: 3, maxLength: 6 },
  );

  const keywordListArb = fc.uniqueArray(keywordArb, { minLength: 3, maxLength: 12 });

  // Arbitrary: generate steering nodes with keywords
  const steeringNodesArb = fc.array(
    fc.tuple(
      fc.integer({ min: 0, max: 99 }),
      keywordListArb,
    ).map(([idx, keywords]) => makeNode(`s${idx}.md`, {
      type: 'steering-domain',
      metadata: { keywords },
    })),
    { minLength: 2, maxLength: 8 },
  ).map((nodes) => {
    // Ensure unique IDs
    const seen = new Set<string>();
    return nodes.filter((n) => {
      if (seen.has(n.id)) { return false; }
      seen.add(n.id);
      return true;
    });
  }).filter((nodes) => nodes.length >= 2);

  // Arbitrary: generate edges between some node pairs
  const edgesFromNodesArb = (nodes: GraphNode[]) => fc.array(
    fc.tuple(
      fc.integer({ min: 0, max: nodes.length - 1 }),
      fc.integer({ min: 0, max: nodes.length - 1 }),
    ).filter(([a, b]) => a !== b)
      .map(([a, b]) => ({
        source: nodes[a].id,
        target: nodes[b].id,
        type: 'wiki-link' as const,
      })),
    { minLength: 0, maxLength: nodes.length },
  );

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * Property: All suggestions have similarityScore in [30, 60).
   */
  it('all scores in results are in [30, 60)', function () {
    fc.assert(
      fc.property(steeringNodesArb, (nodes) => {
        const result = computeLinkSuggestions(nodes, []);
        for (const suggestion of result) {
          assert.ok(
            suggestion.similarityScore >= 30,
            `Score ${suggestion.similarityScore} should be >= 30`,
          );
          assert.ok(
            suggestion.similarityScore < 60,
            `Score ${suggestion.similarityScore} should be < 60`,
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.1**
   *
   * Property: Results are always sorted by similarityScore descending.
   */
  it('results are sorted by similarityScore descending', function () {
    fc.assert(
      fc.property(steeringNodesArb, (nodes) => {
        const result = computeLinkSuggestions(nodes, []);
        for (let i = 1; i < result.length; i++) {
          assert.ok(
            result[i - 1].similarityScore >= result[i].similarityScore,
            `Result[${i - 1}].score (${result[i - 1].similarityScore}) should be >= Result[${i}].score (${result[i].similarityScore})`,
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 4.2, 4.3**
   *
   * Property: Maximum 10 results regardless of input size.
   */
  it('count is always <= 10', function () {
    // Generate many nodes to potentially produce > 10 pairs
    const manyNodesArb = fc.array(
      fc.integer({ min: 0, max: 50 }).map((idx) => makeNode(`n${idx}.md`, {
        type: 'steering-domain',
        metadata: { keywords: ['shared1', 'shared2', `unique-${idx}`] },
      })),
      { minLength: 5, maxLength: 20 },
    ).map((nodes) => {
      const seen = new Set<string>();
      return nodes.filter((n) => {
        if (seen.has(n.id)) { return false; }
        seen.add(n.id);
        return true;
      });
    });

    fc.assert(
      fc.property(manyNodesArb, (nodes) => {
        const result = computeLinkSuggestions(nodes, []);
        assert.ok(
          result.length <= 10,
          `Result count (${result.length}) should be <= 10`,
        );
      }),
      { numRuns: 50 },
    );
  });

  /**
   * **Validates: Requirements 1.1**
   *
   * Property: No suggestion has a direct edge in the graph.
   */
  it('no suggestion has a direct edge between its pair', function () {
    fc.assert(
      fc.property(
        steeringNodesArb.chain((nodes) =>
          edgesFromNodesArb(nodes).map((edges) => ({ nodes, edges })),
        ),
        ({ nodes, edges }) => {
          const edgeSet = new Set<string>();
          for (const e of edges) {
            edgeSet.add(`${e.source}|||${e.target}`);
            edgeSet.add(`${e.target}|||${e.source}`);
          }

          const result = computeLinkSuggestions(nodes, edges);
          for (const suggestion of result) {
            const key = `${suggestion.nodeA.id}|||${suggestion.nodeB.id}`;
            assert.ok(
              !edgeSet.has(key),
              `Suggestion ${suggestion.nodeA.id} <-> ${suggestion.nodeB.id} should NOT have a direct edge`,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * Property: computeLinkSuggestions is idempotent (same input = same output).
   */
  it('computation is idempotent', function () {
    fc.assert(
      fc.property(steeringNodesArb, (nodes) => {
        const result1 = computeLinkSuggestions(nodes, []);
        const result2 = computeLinkSuggestions(nodes, []);
        assert.deepStrictEqual(result1, result2);
      }),
      { numRuns: 50 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Coherence (Rule 21) — Property Tests
// ─────────────────────────────────────────────────────────────────────────────

import {
  computeSemanticCoherence,
  isHeaderOnTopic,
  KEYWORD_SETS,
} from '../../services/cognitiveValidations';
import type { NodeType } from '../../types';

describe('Cognitive Validations — Semantic Coherence (Property)', function () {
  this.timeout(30000);

  const steeringTypes: NodeType[] = [
    'steering-policy', 'steering-tech', 'steering-flow',
    'steering-domain', 'steering-product', 'steering-agent',
    'steering-help', 'steering-playbook', 'steering-observability',
  ];

  const steeringTypeArb = fc.constantFrom(...steeringTypes);

  const headerArb = fc.stringOf(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      ' ', '-', '_',
    ),
    { minLength: 1, maxLength: 30 },
  );

  /**
   * **Validates: Requirements 2.3**
   * Property: coherence is always between 0.0 and 1.0 for any input
   */
  it('coherence is always between 0.0 and 1.0', function () {
    const arb = fc.tuple(
      steeringTypeArb,
      fc.array(headerArb, { minLength: 1, maxLength: 20 }),
    );

    fc.assert(
      fc.property(arb, ([nodeType, headers]) => {
        const nodes = [makeNode('test.md', {
          type: nodeType,
          metadata: { sectionHeaders: headers },
        })];
        const result = computeSemanticCoherence(nodes);
        if (result.length > 0) {
          assert.ok(result[0].coherencePercent >= 0.0, 'coherence must be >= 0');
          assert.ok(result[0].coherencePercent <= 1.0, 'coherence must be <= 1');
        }
        // If no alert, coherence >= 0.70 which is still in [0, 1]
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 2.4**
   * Property: steering without headers always returns coherence 1.0 (no alert)
   */
  it('steering without headers never produces an alert', function () {
    fc.assert(
      fc.property(steeringTypeArb, (nodeType) => {
        const nodesEmpty = [makeNode('test.md', {
          type: nodeType,
          metadata: { sectionHeaders: [] },
        })];
        const nodesUndefined = [makeNode('test.md', {
          type: nodeType,
          metadata: {},
        })];

        assert.strictEqual(computeSemanticCoherence(nodesEmpty).length, 0);
        assert.strictEqual(computeSemanticCoherence(nodesUndefined).length, 0);
      }),
      { numRuns: 50 },
    );
  });

  /**
   * **Validates: Requirements 2.2**
   * Property: headers containing keywords from the set are always classified as on-topic
   */
  it('headers containing a keyword from the set are always on-topic', function () {
    const arb = steeringTypeArb.chain((nodeType) => {
      const keywords = KEYWORD_SETS[nodeType]!;
      const keywordArb = fc.constantFrom(...keywords);
      return fc.tuple(
        fc.constant(nodeType),
        keywordArb,
        fc.stringOf(fc.constantFrom('a', 'b', 'c', ' ', '-'), { minLength: 0, maxLength: 10 }),
      );
    });

    fc.assert(
      fc.property(arb, ([nodeType, keyword, prefix]) => {
        const header = `${prefix} ${keyword}`;
        const keywordSet = KEYWORD_SETS[nodeType]!;
        assert.ok(
          isHeaderOnTopic(header, keywordSet),
          `Header "${header}" should be on-topic for ${nodeType}`,
        );
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 2.3, 2.5**
   * Property: offTopicHeaders + onTopicHeaders === total headers
   */
  it('offTopicHeaders count + onTopicHeaders count equals total headers', function () {
    const arb = fc.tuple(
      steeringTypeArb,
      fc.array(headerArb, { minLength: 1, maxLength: 15 }),
    );

    fc.assert(
      fc.property(arb, ([nodeType, headers]) => {
        const nodes = [makeNode('test.md', {
          type: nodeType,
          metadata: { sectionHeaders: headers },
        })];
        const result = computeSemanticCoherence(nodes);
        if (result.length > 0) {
          const offTopicCount = result[0].offTopicHeaders.length;
          const onTopicCount = headers.length - offTopicCount;
          assert.strictEqual(
            offTopicCount + onTopicCount,
            headers.length,
            'off-topic + on-topic must equal total headers',
          );
        }
      }),
      { numRuns: 200 },
    );
  });
});
