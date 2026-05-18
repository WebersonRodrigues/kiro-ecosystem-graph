import * as assert from 'assert';
import * as fc from 'fast-check';
import { analyzeJailbreakProtection } from '../../services/cognitiveValidations';
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

const identityPatterns = ['I am Kiro', 'my identity is', 'you are kiro', 'never change persona'];
const strongPatterns = ['NEVER do this', 'FORBIDDEN action', 'MUST NOT proceed', 'DO NOT execute', 'ABSOLUTELY required'];

const alwaysSteeringArb = fc.record({
  id: fc.nat({ max: 99 }).map((n) => `steering-${n}.md`),
  type: fc.constantFrom(...steeringTypes),
  hasIdentity: fc.boolean(),
  strongLineCount: fc.nat({ max: 5 }),
  imperativeSubject: fc.stringMatching(/^[a-z]{4,8}$/),
}).map(({ id, type, hasIdentity, strongLineCount, imperativeSubject }) => {
  const contentLines: string[] = [];
  if (hasIdentity) {
    contentLines.push(fc.sample(fc.constantFrom(...identityPatterns), 1)[0]);
  }
  for (let i = 0; i < strongLineCount; i++) {
    contentLines.push(strongPatterns[i % strongPatterns.length]);
  }
  const imperativeLines = [{ text: `always use ${imperativeSubject} mode`, pattern: 'always', subject: imperativeSubject }];
  return makeNode(id, {
    type,
    metadata: {
      alwaysApply: true,
      content: contentLines.join('\n'),
      imperativeLines,
    },
  });
});

const destructiveHookArb = fc.record({
  id: fc.nat({ max: 99 }).map((n) => `hook-${n}.json`),
  isPreToolUse: fc.boolean(),
  hasDestructive: fc.boolean(),
}).map(({ id, isPreToolUse, hasDestructive }) => makeNode(id, {
  type: 'hook-auto',
  metadata: {
    whenType: isPreToolUse ? 'preToolUse' : 'postToolUse',
    description: hasDestructive ? 'Block delete operations' : 'Log operations',
  },
}));

const graphArb = fc.record({
  steerings: fc.array(alwaysSteeringArb, { minLength: 0, maxLength: 6 }),
  hooks: fc.array(destructiveHookArb, { minLength: 0, maxLength: 4 }),
}).map(({ steerings, hooks }) => [...steerings, ...hooks]);

// ─────────────────────────────────────────────────────────────────────────────
// Properties
// ─────────────────────────────────────────────────────────────────────────────

describe('Jailbreak Protection — Property-Based Tests', function () {
  /**
   * **Validates: Requirements 5.1**
   * Property: maturityLevel is always 0, 1, or 2
   */
  it('maturityLevel is always 0, 1, or 2', function () {
    fc.assert(fc.property(graphArb, (nodes) => {
      const result = analyzeJailbreakProtection(nodes);
      assert.ok([0, 1, 2].includes(result.maturityLevel));
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 2.2**
   * Property: strongRuleCount >= 0
   */
  it('strongRuleCount >= 0', function () {
    fc.assert(fc.property(graphArb, (nodes) => {
      const result = analyzeJailbreakProtection(nodes);
      assert.ok(result.strongRuleCount >= 0);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 3.3**
   * Property: redundantRuleCount >= 0
   */
  it('redundantRuleCount >= 0', function () {
    fc.assert(fc.property(graphArb, (nodes) => {
      const result = analyzeJailbreakProtection(nodes);
      assert.ok(result.redundantRuleCount >= 0);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 4.2**
   * Property: destructiveHookCount >= 0
   */
  it('destructiveHookCount >= 0', function () {
    fc.assert(fc.property(graphArb, (nodes) => {
      const result = analyzeJailbreakProtection(nodes);
      assert.ok(result.destructiveHookCount >= 0);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 5.5**
   * Property: suggestions.length === 0 when maturityLevel === 2
   */
  it('suggestions empty when maturityLevel === 2', function () {
    fc.assert(fc.property(graphArb, (nodes) => {
      const result = analyzeJailbreakProtection(nodes);
      if (result.maturityLevel === 2) {
        assert.strictEqual(result.suggestions.length, 0);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 6.3**
   * Property: no suggestion text contains error/warning language
   */
  it('no suggestion contains error/warning language', function () {
    const badWords = ['error', 'warning', 'problem', 'issue', 'broken'];
    fc.assert(fc.property(graphArb, (nodes) => {
      const result = analyzeJailbreakProtection(nodes);
      for (const s of result.suggestions) {
        const lower = s.toLowerCase();
        for (const word of badWords) {
          assert.ok(!lower.includes(word), `Suggestion contains "${word}": ${s}`);
        }
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 5.3**
   * Property: if hasIdentityLock AND destructiveHookCount >= 1 AND redundantRuleCount >= 1, then maturityLevel=2
   */
  it('level 2 when identity + hooks + redundancy', function () {
    fc.assert(fc.property(graphArb, (nodes) => {
      const result = analyzeJailbreakProtection(nodes);
      if (result.hasIdentityLock && result.destructiveHookCount >= 1 && result.redundantRuleCount >= 1) {
        assert.strictEqual(result.maturityLevel, 2);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 5.1**
   * Property: if hasIdentityLock=false AND strongRuleCount < 3 AND destructiveHookCount=0, then maturityLevel=0
   */
  it('level 0 when no components', function () {
    fc.assert(fc.property(graphArb, (nodes) => {
      const result = analyzeJailbreakProtection(nodes);
      if (!result.hasIdentityLock && result.strongRuleCount < 3 && result.destructiveHookCount === 0) {
        assert.strictEqual(result.maturityLevel, 0);
      }
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 5.3 (metamorphic)**
   * Property: adding an identity lock never decreases maturityLevel
   */
  it('adding identity lock never decreases maturityLevel (metamorphic)', function () {
    fc.assert(fc.property(graphArb, (nodes) => {
      const before = analyzeJailbreakProtection(nodes);
      const identityNode = makeNode('identity-extra.md', {
        type: 'steering-domain',
        metadata: {
          alwaysApply: true,
          imperativeLines: [{ text: 'I am Kiro, the AI assistant', pattern: 'always', subject: 'kiro' }],
        },
      });
      const after = analyzeJailbreakProtection([...nodes, identityNode]);
      assert.ok(after.maturityLevel >= before.maturityLevel);
    }), { numRuns: 100 });
  });

  /**
   * **Validates: Requirements 12.1 (idempotence)**
   * Property: running analysis twice on same input produces identical output
   */
  it('analysis is idempotent', function () {
    fc.assert(fc.property(graphArb, (nodes) => {
      const a = analyzeJailbreakProtection(nodes);
      const b = analyzeJailbreakProtection(nodes);
      assert.deepStrictEqual(a, b);
    }), { numRuns: 100 });
  });
});
