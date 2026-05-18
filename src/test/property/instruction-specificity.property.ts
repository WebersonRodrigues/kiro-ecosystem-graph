import * as assert from 'assert';
import * as fc from 'fast-check';
import {
  hasSpecificityMarker,
  computeSpecificityScore,
  analyzeInstructionSpecificity,
} from '../../services/cognitiveValidations';
import type { GraphNode } from '../../types';

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

const vagueTexts = [
  'follow best practices',
  'ensure quality',
  'use proper handling',
  'maintain quality',
  'handle errors properly',
  'follow standards',
  'use appropriate measures',
];

const specificTexts = [
  'use typescript strict mode',
  'put files in src/',
  'create a .ts file',
  'use `parameterizedQuery()`',
  'call getUserName',
  'keep functions under 30 lines',
  'response time < 200ms',
];

const imperativeLineArb = fc.oneof(
  fc.constantFrom(...vagueTexts).map((text) => ({ text, pattern: 'use', subject: 'x' })),
  fc.constantFrom(...specificTexts).map((text) => ({ text, pattern: 'use', subject: 'x' })),
);

const steeringNodeArb = fc.record({
  id: fc.nat({ max: 99 }).map((n) => `steering-${n}.md`),
  lines: fc.array(imperativeLineArb, { minLength: 0, maxLength: 10 }),
}).map(({ id, lines }) => makeNode(id, {
  type: 'steering-domain',
  metadata: { imperativeLines: lines },
}));

const graphArb = fc.array(steeringNodeArb, { minLength: 0, maxLength: 8 }).map((nodes) => {
  const seen = new Set<string>();
  return nodes.filter((n) => {
    if (seen.has(n.id)) { return false; }
    seen.add(n.id);
    return true;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Properties
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates: Requirements 3.1, 3.2, 3.3, 4.4, 5.2
 */
describe('Instruction Specificity — Property-Based Tests', function () {
  this.timeout(30000);

  it('score is always an integer in range [0, 100]', function () {
    fc.assert(
      fc.property(
        fc.array(imperativeLineArb, { minLength: 0, maxLength: 20 }),
        (lines) => {
          const score = computeSpecificityScore(lines);
          assert.ok(Number.isInteger(score));
          assert.ok(score >= 0);
          assert.ok(score <= 100);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('alerts only contain steerings with score < 50', function () {
    fc.assert(
      fc.property(graphArb, (nodes) => {
        const result = analyzeInstructionSpecificity(nodes);
        result.alerts.forEach((alert) => {
          assert.ok(alert.score < 50);
        });
      }),
      { numRuns: 200 },
    );
  });

  it('vagueExamples.length <= 3 for each alert', function () {
    fc.assert(
      fc.property(graphArb, (nodes) => {
        const result = analyzeInstructionSpecificity(nodes);
        result.alerts.forEach((alert) => {
          assert.ok(alert.vagueExamples.length <= 3);
        });
      }),
      { numRuns: 200 },
    );
  });

  it('vagueCount + specificCount === imperativeLines.length for each alert', function () {
    fc.assert(
      fc.property(graphArb, (nodes) => {
        const result = analyzeInstructionSpecificity(nodes);
        result.alerts.forEach((alert) => {
          const node = nodes.find((n) => n.id === alert.id);
          const totalLines = node?.metadata?.imperativeLines?.length || 0;
          assert.strictEqual(alert.vagueCount + alert.specificCount, totalLines);
        });
      }),
      { numRuns: 200 },
    );
  });

  it('no alert label contains error/warning language', function () {
    fc.assert(
      fc.property(graphArb, (nodes) => {
        const result = analyzeInstructionSpecificity(nodes);
        result.alerts.forEach((alert) => {
          const lower = alert.label.toLowerCase();
          assert.ok(!lower.includes('warning'));
          assert.ok(!lower.includes('problem'));
          assert.ok(!lower.includes('issue'));
          assert.ok(!lower.includes('broken'));
        });
      }),
      { numRuns: 200 },
    );
  });

  it('averageScore is in range [0, 100]', function () {
    fc.assert(
      fc.property(graphArb, (nodes) => {
        const result = analyzeInstructionSpecificity(nodes);
        assert.ok(result.averageScore >= 0);
        assert.ok(result.averageScore <= 100);
      }),
      { numRuns: 200 },
    );
  });

  it('metamorphic: adding a specificity marker never decreases the score', function () {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...vagueTexts).map((t) => ({ text: t })), { minLength: 1, maxLength: 10 }),
        (lines) => {
          const baseLine = computeSpecificityScore(lines);
          const augmented = [...lines, { text: 'use typescript strict mode' }];
          const augmentedScore = computeSpecificityScore(augmented);
          assert.ok(augmentedScore >= baseLine);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('idempotence: running analysis twice produces identical output', function () {
    fc.assert(
      fc.property(graphArb, (nodes) => {
        const r1 = analyzeInstructionSpecificity(nodes);
        const r2 = analyzeInstructionSpecificity(nodes);
        assert.deepStrictEqual(r1, r2);
      }),
      { numRuns: 100 },
    );
  });

  it('if all lines contain specificity marker, score === 100', function () {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...specificTexts).map((t) => ({ text: t })), { minLength: 1, maxLength: 10 }),
        (lines) => {
          const score = computeSpecificityScore(lines);
          assert.strictEqual(score, 100);
        },
      ),
      { numRuns: 200 },
    );
  });
});
