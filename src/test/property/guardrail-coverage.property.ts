import * as assert from 'assert';
import * as fc from 'fast-check';
import { analyzeGuardrailCoverage } from '../../services/cognitiveValidations';
import type { GraphNode, GraphEdge } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

function makeNode(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    label: id.replace('.md', '').replace('.json', ''),
    type: 'steering-domain',
    workspaceFolder: 'Workspace',
    filePath: id,
    resolved: true,
    source: 'local',
    ...overrides,
  };
}

const hookKeywords = ['sql', 'database', 'deploy', 'publish', 'write', 'file', 'test', 'terraform', 'docker'];
const steeringKeywords = ['database', 'deploy', 'secret', 'testing', 'infrastructure', 'release', 'credential'];

const hookNodeArb = fc.record({
  id: fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1, maxLength: 3 }).map((s) => `hook-${s}.json`),
  description: fc.oneof(
    fc.constant(''),
    fc.constantFrom(...hookKeywords),
    fc.stringOf(fc.constantFrom('x', 'y', 'z'), { minLength: 1, maxLength: 5 }),
  ),
}).map(({ id, description }) => makeNode(id, {
  type: 'hook-auto',
  metadata: { description },
}));

const steeringNodeArb = fc.record({
  id: fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1, maxLength: 3 }).map((s) => `steering-${s}.md`),
  keywords: fc.array(
    fc.oneof(fc.constantFrom(...steeringKeywords), fc.stringOf(fc.constantFrom('x', 'y', 'z'), { minLength: 1, maxLength: 5 })),
    { minLength: 0, maxLength: 4 },
  ),
}).map(({ id, keywords }) => makeNode(id, {
  type: 'steering-tech',
  metadata: { keywords },
}));

const graphArb = fc.record({
  hooks: fc.array(hookNodeArb, { minLength: 0, maxLength: 5 }),
  steerings: fc.array(steeringNodeArb, { minLength: 0, maxLength: 5 }),
  dmlLevel: fc.constantFrom(0, 1, 2) as fc.Arbitrary<number>,
});

// ─────────────────────────────────────────────────────────────────────────────
// Properties
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates: Requirements 1.2
 */
describe('Guardrail Coverage — Property-Based Tests', function () {
  this.timeout(30000);

  it('maturityLevel is always 0, 1, or 2 for each category', function () {
    fc.assert(
      fc.property(graphArb, ({ hooks, steerings, dmlLevel }) => {
        const nodes = [...hooks, ...steerings];
        const result = analyzeGuardrailCoverage(nodes, [], dmlLevel);
        result.categories.forEach((c) => {
          assert.ok(c.maturityLevel === 0 || c.maturityLevel === 1 || c.maturityLevel === 2);
        });
      }),
      { numRuns: 200 },
    );
  });

  it('categories.length is always exactly 5', function () {
    fc.assert(
      fc.property(graphArb, ({ hooks, steerings, dmlLevel }) => {
        const nodes = [...hooks, ...steerings];
        const result = analyzeGuardrailCoverage(nodes, [], dmlLevel);
        assert.strictEqual(result.categories.length, 5);
      }),
      { numRuns: 200 },
    );
  });

  it('suggestions only exist for categories with isRelevant=true AND maturityLevel < 2', function () {
    fc.assert(
      fc.property(graphArb, ({ hooks, steerings, dmlLevel }) => {
        const nodes = [...hooks, ...steerings];
        const result = analyzeGuardrailCoverage(nodes, [], dmlLevel);
        result.categories.forEach((c) => {
          if (c.suggestion) {
            assert.strictEqual(c.isRelevant, true);
            assert.ok(c.maturityLevel < 2);
          }
        });
      }),
      { numRuns: 200 },
    );
  });

  it('no suggestion text contains error/warning language', function () {
    fc.assert(
      fc.property(graphArb, ({ hooks, steerings, dmlLevel }) => {
        const nodes = [...hooks, ...steerings];
        const result = analyzeGuardrailCoverage(nodes, [], dmlLevel);
        result.categories.forEach((c) => {
          if (c.suggestion) {
            const text = c.suggestion.text.toLowerCase();
            assert.ok(!text.includes('error'));
            assert.ok(!text.includes('warning'));
            assert.ok(!text.includes('problem'));
            assert.ok(!text.includes('issue'));
            assert.ok(!text.includes('broken'));
          }
        });
      }),
      { numRuns: 200 },
    );
  });

  it('overallMaturity is in range [0, 2]', function () {
    fc.assert(
      fc.property(graphArb, ({ hooks, steerings, dmlLevel }) => {
        const nodes = [...hooks, ...steerings];
        const result = analyzeGuardrailCoverage(nodes, [], dmlLevel);
        assert.ok(result.overallMaturity >= 0);
        assert.ok(result.overallMaturity <= 2);
      }),
      { numRuns: 200 },
    );
  });

  it('if hasHook=true AND hasSteering=true then maturityLevel=2', function () {
    fc.assert(
      fc.property(graphArb, ({ hooks, steerings, dmlLevel }) => {
        const nodes = [...hooks, ...steerings];
        const result = analyzeGuardrailCoverage(nodes, [], dmlLevel);
        result.categories.forEach((c) => {
          if (c.hasHook && c.hasSteering) {
            assert.strictEqual(c.maturityLevel, 2);
          }
        });
      }),
      { numRuns: 200 },
    );
  });

  it('if hasHook=false AND hasSteering=false then maturityLevel=0', function () {
    fc.assert(
      fc.property(graphArb, ({ hooks, steerings, dmlLevel }) => {
        const nodes = [...hooks, ...steerings];
        const result = analyzeGuardrailCoverage(nodes, [], dmlLevel);
        result.categories.forEach((c) => {
          if (!c.hasHook && !c.hasSteering) {
            assert.strictEqual(c.maturityLevel, 0);
          }
        });
      }),
      { numRuns: 200 },
    );
  });

  it('metamorphic: adding a hook never decreases maturityLevel', function () {
    fc.assert(
      fc.property(graphArb, ({ hooks, steerings, dmlLevel }) => {
        const baseNodes = [...hooks, ...steerings];
        const baseLine = analyzeGuardrailCoverage(baseNodes, [], dmlLevel);

        const extraHook = makeNode('extra-hook.json', {
          type: 'hook-auto',
          metadata: { description: 'deploy terraform sql test write' },
        });
        const augmented = analyzeGuardrailCoverage([...baseNodes, extraHook], [], dmlLevel);

        for (let i = 0; i < 5; i++) {
          assert.ok(augmented.categories[i].maturityLevel >= baseLine.categories[i].maturityLevel);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('idempotence: running analysis twice produces identical output', function () {
    fc.assert(
      fc.property(graphArb, ({ hooks, steerings, dmlLevel }) => {
        const nodes = [...hooks, ...steerings];
        const edges: GraphEdge[] = [];
        const r1 = analyzeGuardrailCoverage(nodes, edges, dmlLevel);
        const r2 = analyzeGuardrailCoverage(nodes, edges, dmlLevel);
        assert.deepStrictEqual(r1, r2);
      }),
      { numRuns: 100 },
    );
  });
});
