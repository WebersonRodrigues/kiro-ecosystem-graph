import * as assert from 'assert';
import * as fc from 'fast-check';
import { analyzeConflictResolution, PRIORITY_LANGUAGE_PATTERNS } from '../../services/cognitiveValidations';
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

const alwaysSteeringArb = fc.record({
  id: fc.nat({ max: 99 }).map((n) => `steering-${n}.md`),
  type: fc.constantFrom(...steeringTypes),
  hasPriorityLine: fc.boolean(),
  contentLines: fc.array(fc.stringMatching(/^[a-zA-Z ]{5,40}$/), { minLength: 0, maxLength: 5 }),
}).map(({ id, type, hasPriorityLine, contentLines }) => {
  const lines = [...contentLines];
  if (hasPriorityLine) {
    const pattern = fc.sample(fc.constantFrom(...PRIORITY_LANGUAGE_PATTERNS), 1)[0];
    lines.push(`This steering ${pattern} over others.`);
  }
  return makeNode(id, {
    type,
    metadata: {
      alwaysApply: true,
      content: lines.join('\n'),
    },
  });
});

const nonSteeringNodeArb = fc.record({
  id: fc.nat({ max: 99 }).map((n) => `hook-${n}.json`),
}).map(({ id }) => makeNode(id, {
  type: 'hook-auto',
  metadata: { alwaysApply: true, content: 'priority override' },
}));

const contradictionCountArb = fc.nat({ max: 10 });

const graphArb = fc.record({
  steerings: fc.array(alwaysSteeringArb, { minLength: 0, maxLength: 8 }),
  nonSteerings: fc.array(nonSteeringNodeArb, { minLength: 0, maxLength: 3 }),
  contradictionCount: contradictionCountArb,
}).map(({ steerings, nonSteerings, contradictionCount }) => ({
  nodes: [...steerings, ...nonSteerings],
  contradictionCount,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Properties
// ─────────────────────────────────────────────────────────────────────────────

describe('Conflict Resolution Priority — Property-Based Tests', function () {
  /**
   * **Validates: Requirements 5.2**
   * Property: hasPriorityDefined is always boolean
   */
  it('hasPriorityDefined is always boolean', function () {
    fc.assert(fc.property(graphArb, ({ nodes, contradictionCount }) => {
      const result = analyzeConflictResolution(nodes, contradictionCount);
      assert.strictEqual(typeof result.hasPriorityDefined, 'boolean');
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 5.2**
   * Property: priorityStatements is always an array (never undefined)
   */
  it('priorityStatements is always an array', function () {
    fc.assert(fc.property(graphArb, ({ nodes, contradictionCount }) => {
      const result = analyzeConflictResolution(nodes, contradictionCount);
      assert.ok(Array.isArray(result.priorityStatements));
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 3.1, 3.3, 3.4**
   * Property: suggestion only exists when hasPriorityDefined=false AND context is relevant
   */
  it('suggestion only exists when hasPriorityDefined=false AND context is relevant', function () {
    fc.assert(fc.property(graphArb, ({ nodes, contradictionCount }) => {
      const result = analyzeConflictResolution(nodes, contradictionCount);
      if (result.suggestion !== undefined) {
        assert.strictEqual(result.hasPriorityDefined, false);
        const alwaysCount = nodes.filter((n) =>
          n.type?.startsWith('steering-') && n.metadata?.alwaysApply === true,
        ).length;
        assert.ok(contradictionCount > 0 || alwaysCount >= 3);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 4.4**
   * Property: no suggestion text contains "error", "warning", "problem", "issue", "broken"
   */
  it('no suggestion contains error/warning language', function () {
    const badWords = ['error', 'warning', 'problem', 'issue', 'broken'];
    fc.assert(fc.property(graphArb, ({ nodes, contradictionCount }) => {
      const result = analyzeConflictResolution(nodes, contradictionCount);
      if (result.suggestion) {
        const lower = result.suggestion.toLowerCase();
        for (const word of badWords) {
          assert.ok(!lower.includes(word), `Suggestion contains "${word}": ${result.suggestion}`);
        }
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.2**
   * Property: priorityStatements.length > 0 ⟹ hasPriorityDefined=true
   */
  it('priorityStatements.length > 0 implies hasPriorityDefined=true', function () {
    fc.assert(fc.property(graphArb, ({ nodes, contradictionCount }) => {
      const result = analyzeConflictResolution(nodes, contradictionCount);
      if (result.priorityStatements.length > 0) {
        assert.strictEqual(result.hasPriorityDefined, true);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.2**
   * Property: priorityStatements.length === 0 ⟹ hasPriorityDefined=false
   */
  it('priorityStatements.length === 0 implies hasPriorityDefined=false', function () {
    fc.assert(fc.property(graphArb, ({ nodes, contradictionCount }) => {
      const result = analyzeConflictResolution(nodes, contradictionCount);
      if (result.priorityStatements.length === 0) {
        assert.strictEqual(result.hasPriorityDefined, false);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.3, 1.5**
   * Property: each priorityStatement has non-empty steeringId and text
   */
  it('each priorityStatement has non-empty steeringId and text', function () {
    fc.assert(fc.property(graphArb, ({ nodes, contradictionCount }) => {
      const result = analyzeConflictResolution(nodes, contradictionCount);
      for (const stmt of result.priorityStatements) {
        assert.ok(stmt.steeringId.length > 0, 'steeringId should not be empty');
        assert.ok(stmt.text.length > 0, 'text should not be empty');
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 1.2 (metamorphic)**
   * Property: adding priority language to a steering never changes hasPriorityDefined from true to false
   */
  it('adding priority language never changes hasPriorityDefined from true to false (metamorphic)', function () {
    fc.assert(fc.property(graphArb, ({ nodes, contradictionCount }) => {
      const before = analyzeConflictResolution(nodes, contradictionCount);
      const extraNode = makeNode('extra-priority.md', {
        type: 'steering-domain',
        metadata: { alwaysApply: true, content: 'In case of conflict, this takes priority.' },
      });
      const after = analyzeConflictResolution([...nodes, extraNode], contradictionCount);
      if (before.hasPriorityDefined) {
        assert.strictEqual(after.hasPriorityDefined, true);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 10.1 (idempotence)**
   * Property: running analysis twice on same input produces identical output
   */
  it('analysis is idempotent', function () {
    fc.assert(fc.property(graphArb, ({ nodes, contradictionCount }) => {
      const a = analyzeConflictResolution(nodes, contradictionCount);
      const b = analyzeConflictResolution(nodes, contradictionCount);
      assert.deepStrictEqual(a, b);
    }), { numRuns: 100 });
  });
});
