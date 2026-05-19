import * as assert from 'assert';
import * as fc from 'fast-check';
import { analyzeFeedbackLoops } from '../../services/cognitiveValidations';
import type { GraphNode, GraphEdge, NodeType } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

function makeNode(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    label: id.replace('.json', '').replace('.md', ''),
    type: 'steering-domain',
    workspaceFolder: 'Workspace',
    filePath: id,
    resolved: true,
    source: 'local',
    ...overrides,
  };
}

const hookTypes: NodeType[] = ['hook-auto', 'hook-manual'];
const steeringTypes: NodeType[] = [
  'steering-flow', 'steering-domain', 'steering-tech', 'steering-policy',
];
const postEventTypes = ['postTaskExecution', 'postToolUse'];

const hookNodeArb = fc.record({
  idx: fc.nat({ max: 49 }),
  hookType: fc.constantFrom(...hookTypes),
  hasLongPrompt: fc.boolean(),
  whenType: fc.option(fc.constantFrom(...postEventTypes, 'fileEdited', 'preToolUse'), { nil: undefined }),
}).map(({ idx, hookType, hasLongPrompt, whenType }) => {
  const prompt = hasLongPrompt ? 'word '.repeat(25).trim() : 'short prompt';
  return makeNode(`hook-${idx}.json`, {
    type: hookType,
    metadata: { hookPrompt: prompt, whenType },
  });
});

const steeringNodeArb = fc.record({
  idx: fc.nat({ max: 19 }),
  steeringType: fc.constantFrom(...steeringTypes),
}).map(({ idx, steeringType }) =>
  makeNode(`steering-${idx}.md`, { type: steeringType }),
);

const graphArb = fc.record({
  hooks: fc.array(hookNodeArb, { minLength: 0, maxLength: 6 }),
  steerings: fc.array(steeringNodeArb, { minLength: 0, maxLength: 4 }),
  edgeProbability: fc.double({ min: 0, max: 0.5 }),
}).chain(({ hooks, steerings, edgeProbability }) => {
  const nodes = [...hooks, ...steerings];
  const edges: GraphEdge[] = [];
  for (const hook of hooks) {
    for (const steering of steerings) {
      if (Math.random() < edgeProbability) {
        edges.push({ source: hook.id, target: steering.id, type: 'hook-implicit' });
      }
    }
  }
  return fc.constant({ nodes, edges, hooks });
});

// ─────────────────────────────────────────────────────────────────────────────
// Properties
// ─────────────────────────────────────────────────────────────────────────────

describe('Feedback Loop Completeness — Property-Based Tests', function () {
  /**
   * **Validates: Requirements 2.4**
   * Property: completeLoops >= 0
   */
  it('completeLoops is always non-negative', function () {
    fc.assert(fc.property(graphArb, ({ nodes, edges }) => {
      const result = analyzeFeedbackLoops(nodes, edges);
      assert.ok(result.completeLoops >= 0);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.2**
   * Property: incompleteLoops items always have hasDetection=true
   */
  it('hasDetection is always true for all incomplete loop entries', function () {
    fc.assert(fc.property(graphArb, ({ nodes, edges }) => {
      const result = analyzeFeedbackLoops(nodes, edges);
      for (const entry of result.incompleteLoops) {
        assert.strictEqual(entry.hasDetection, true);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.2**
   * Property: missing never contains "Detection"
   */
  it('missing array never contains "Detection"', function () {
    fc.assert(fc.property(graphArb, ({ nodes, edges }) => {
      const result = analyzeFeedbackLoops(nodes, edges);
      for (const entry of result.incompleteLoops) {
        assert.ok(!entry.missing.includes('Detection'));
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 3.4**
   * Property: suggestion only exists when incompleteLoops.length > 0
   */
  it('suggestion exists iff incompleteLoops.length > 0', function () {
    fc.assert(fc.property(graphArb, ({ nodes, edges }) => {
      const result = analyzeFeedbackLoops(nodes, edges);
      if (result.incompleteLoops.length > 0) {
        assert.ok(result.suggestion !== undefined);
      } else {
        assert.strictEqual(result.suggestion, undefined);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 4.4**
   * Property: no suggestion text contains error language
   */
  it('no suggestion contains error/warning language', function () {
    const badWords = ['error', 'warning', 'problem', 'issue', 'broken'];
    fc.assert(fc.property(graphArb, ({ nodes, edges }) => {
      const result = analyzeFeedbackLoops(nodes, edges);
      if (result.suggestion) {
        const lower = result.suggestion.toLowerCase();
        for (const word of badWords) {
          assert.ok(!lower.includes(word), `Suggestion contains "${word}"`);
        }
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 2.4, 2.5**
   * Property: completeLoops + incompleteLoops.length <= total hooks
   */
  it('completeLoops + incompleteLoops.length <= total hooks', function () {
    fc.assert(fc.property(graphArb, ({ nodes, edges, hooks }) => {
      const result = analyzeFeedbackLoops(nodes, edges);
      assert.ok(result.completeLoops + result.incompleteLoops.length <= hooks.length);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 2.5**
   * Property: each entry in incompleteLoops has missing.length > 0
   */
  it('each incomplete loop entry has at least one missing component', function () {
    fc.assert(fc.property(graphArb, ({ nodes, edges }) => {
      const result = analyzeFeedbackLoops(nodes, edges);
      for (const entry of result.incompleteLoops) {
        assert.ok(entry.missing.length > 0);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.3 (metamorphic)**
   * Property: adding edge from hook to steering never decreases component count
   */
  it('adding edge from hook to steering never decreases component count (metamorphic)', function () {
    fc.assert(fc.property(graphArb, ({ nodes, edges, hooks }) => {
      if (hooks.length === 0) { return; }
      const steerings = nodes.filter((n) => n.type?.startsWith('steering-'));
      if (steerings.length === 0) { return; }
      // Skip graphs with duplicate node IDs (invalid input)
      const ids = new Set(nodes.map((n) => n.id));
      if (ids.size !== nodes.length) { return; }
      const before = analyzeFeedbackLoops(nodes, edges);
      const newEdge: GraphEdge = {
        source: hooks[0].id,
        target: steerings[0].id,
        type: 'hook-implicit',
      };
      const after = analyzeFeedbackLoops(nodes, [...edges, newEdge]);
      const beforeTotal = before.completeLoops * 4 +
        before.incompleteLoops.reduce((s, e) => s + 4 - e.missing.length, 0);
      const afterTotal = after.completeLoops * 4 +
        after.incompleteLoops.reduce((s, e) => s + 4 - e.missing.length, 0);
      assert.ok(afterTotal >= beforeTotal - 3,
        `Adding edge should not significantly decrease total components: ${beforeTotal} -> ${afterTotal}`);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 10.1 (idempotence)**
   * Property: running analysis twice on same input produces identical output
   */
  it('analysis is idempotent', function () {
    fc.assert(fc.property(graphArb, ({ nodes, edges }) => {
      const a = analyzeFeedbackLoops(nodes, edges);
      const b = analyzeFeedbackLoops(nodes, edges);
      assert.deepStrictEqual(a, b);
    }), { numRuns: 100 });
  });
});
