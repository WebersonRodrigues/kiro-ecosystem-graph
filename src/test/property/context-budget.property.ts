import * as assert from 'assert';
import * as fc from 'fast-check';
import {
  estimateTokenCount,
  estimateContextBudget,
} from '../../services/cognitiveValidations';
import type { GraphNode, NodeType } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

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

const steeringTypes: NodeType[] = [
  'steering-flow', 'steering-domain', 'steering-tech',
  'steering-policy', 'steering-product', 'steering-agent',
];

const alwaysLoadedSteeringArb = fc.record({
  id: fc.nat({ max: 99 }).map((n) => `steering-${n}.md`),
  type: fc.constantFrom(...steeringTypes),
  content: fc.string({ minLength: 0, maxLength: 200 }),
}).map(({ id, type, content }) => makeNode(id, {
  type,
  metadata: { alwaysApply: true, content },
}));

const nonAlwaysSteeringArb = fc.record({
  id: fc.nat({ max: 99 }).map((n) => `other-${n}.md`),
  type: fc.constantFrom(...steeringTypes),
}).map(({ id, type }) => makeNode(id, {
  type,
  metadata: { inclusion: 'always' },
}));

const hookNodeArb = fc.nat({ max: 99 }).map((n) => makeNode(`hook-${n}.json`, {
  type: 'hook-auto',
  metadata: { alwaysApply: true, content: 'some hook content' },
}));

const graphArb = fc.record({
  alwaysLoaded: fc.array(alwaysLoadedSteeringArb, { minLength: 0, maxLength: 8 }),
  others: fc.array(nonAlwaysSteeringArb, { minLength: 0, maxLength: 5 }),
  hooks: fc.array(hookNodeArb, { minLength: 0, maxLength: 3 }),
}).map(({ alwaysLoaded, others, hooks }) => ({
  nodes: [...alwaysLoaded, ...others, ...hooks],
  alwaysCount: alwaysLoaded.length,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Properties
// ─────────────────────────────────────────────────────────────────────────────

describe('Context Budget — Property-Based Tests', function () {
  /**
   * **Validates: Requirements 1.1, 10.2**
   * Property: totalTokens >= 0 always
   */
  it('totalTokens >= 0 always', function () {
    fc.assert(fc.property(graphArb, ({ nodes }) => {
      const result = estimateContextBudget(nodes);
      assert.ok(result.totalTokens >= 0);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.4, 10.2**
   * Property: budgetPercent >= 0 always
   */
  it('budgetPercent >= 0 always', function () {
    fc.assert(fc.property(graphArb, ({ nodes }) => {
      const result = estimateContextBudget(nodes);
      assert.ok(result.budgetPercent >= 0);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.2, 1.6**
   * Property: perSteering.length === number of always-loaded steerings in input
   */
  it('perSteering.length === always-loaded steering count', function () {
    fc.assert(fc.property(graphArb, ({ nodes, alwaysCount }) => {
      const result = estimateContextBudget(nodes);
      assert.strictEqual(result.perSteering.length, alwaysCount);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 2.1, 2.3**
   * Property: suggestion exists iff budgetPercent > 15
   */
  it('suggestion exists iff budgetPercent > 15', function () {
    fc.assert(fc.property(graphArb, ({ nodes }) => {
      const result = estimateContextBudget(nodes);
      if (result.budgetPercent > 15) {
        assert.ok(result.suggestion !== undefined);
      } else {
        assert.strictEqual(result.suggestion, undefined);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 10.2**
   * Property: estimateTokenCount is deterministic (same input → same output)
   */
  it('estimateTokenCount is deterministic', function () {
    fc.assert(fc.property(fc.string({ maxLength: 500 }), (content) => {
      const a = estimateTokenCount(content);
      const b = estimateTokenCount(content);
      assert.strictEqual(a, b);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.1, 10.2**
   * Property: estimateTokenCount(content) >= 0 for any string
   */
  it('estimateTokenCount >= 0 for any string', function () {
    fc.assert(fc.property(fc.string({ maxLength: 500 }), (content) => {
      assert.ok(estimateTokenCount(content) >= 0);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.3**
   * Property: totalTokens === sum of perSteering[].tokens
   */
  it('totalTokens === sum of perSteering tokens', function () {
    fc.assert(fc.property(graphArb, ({ nodes }) => {
      const result = estimateContextBudget(nodes);
      const sum = result.perSteering.reduce((acc, s) => acc + s.tokens, 0);
      assert.strictEqual(result.totalTokens, sum);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.3 (metamorphic)**
   * Property: adding an always-loaded steering never decreases totalTokens
   */
  it('adding a steering never decreases totalTokens (metamorphic)', function () {
    fc.assert(fc.property(
      graphArb,
      alwaysLoadedSteeringArb,
      ({ nodes }, extra) => {
        const before = estimateContextBudget(nodes);
        const after = estimateContextBudget([...nodes, extra]);
        assert.ok(after.totalTokens >= before.totalTokens);
      },
    ), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 10.2 (idempotence)**
   * Property: running estimation twice on same input produces identical output
   */
  it('estimation is idempotent', function () {
    fc.assert(fc.property(graphArb, ({ nodes }) => {
      const a = estimateContextBudget(nodes);
      const b = estimateContextBudget(nodes);
      assert.deepStrictEqual(a, b);
    }), { numRuns: 100 });
  });
});
