import * as assert from 'assert';
import * as fc from 'fast-check';
import {
  generateTargetedPrompt,
  generateConsolidatedPrompt,
} from '../../services/fixPromptGenerator';
import type { IssueCategory, FixIssueData } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

const allCategories: IssueCategory[] = [
  'orphan-steerings',
  'fragile-links',
  'isolated-files',
  'coverage-gaps',
  'weak-instructions',
  'context-overload',
  'large-domain-steerings',
  'hooks-without-instruction',
  'steerings-without-access',
  'dead-loops',
  'hops-to-reach',
  'duplicate-intent',
  'passive-knowledge',
  'signal-to-noise',
  'contradictions',
  'hook-coverage',
  'decision-path',
  'quality-gate',
  'dml-protection',
];

const categoryArb = fc.constantFrom(...allCategories);

const idsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 100 }),
  { minLength: 1, maxLength: 5 },
);

const labelsArb = fc.array(
  fc.string({ minLength: 1, maxLength: 50 }),
  { minLength: 1, maxLength: 5 },
);

const fixIssueDataArb: fc.Arbitrary<FixIssueData> = fc.record({
  ids: idsArb,
  labels: labelsArb,
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 1: File paths presentes
// ─────────────────────────────────────────────────────────────────────────────

describe('FixPromptGenerator — Property 1: Prompts sempre contêm file paths', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 2.1, 2.3**
   *
   * For any issue with non-empty ids, the generated prompt must contain
   * at least one of the paths present in issue.ids.
   */
  it('generated prompt contains at least one path from issue.ids', function () {
    fc.assert(
      fc.property(categoryArb, fixIssueDataArb, (category, issue) => {
        const prompt = generateTargetedPrompt(category, issue);
        const containsAtLeastOne = issue.ids.some((id) => prompt.includes(id));
        assert.ok(
          containsAtLeastOne,
          `Prompt for category "${category}" should contain at least one id from ${JSON.stringify(issue.ids)}`,
        );
      }),
      { numRuns: 200 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 2: Consolidado completo
// ─────────────────────────────────────────────────────────────────────────────

describe('FixPromptGenerator — Property 2: Prompts consolidados contêm todos os itens', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 4.3, 4.4**
   *
   * For any array of issues (N >= 1), the consolidated prompt must contain
   * references to all N items (each ids[0] of each issue appears in the prompt).
   */
  it('consolidated prompt contains ids[0] of every issue', function () {
    const issuesArb = fc.array(fixIssueDataArb, { minLength: 1, maxLength: 10 });

    fc.assert(
      fc.property(categoryArb, issuesArb, (category, issues) => {
        const prompt = generateConsolidatedPrompt(category, issues);
        for (const issue of issues) {
          const firstId = issue.ids[0];
          assert.ok(
            prompt.includes(firstId),
            `Consolidated prompt should contain "${firstId}" but got:\n${prompt}`,
          );
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 3: Limite de tamanho
// ─────────────────────────────────────────────────────────────────────────────

describe('FixPromptGenerator — Property 3: Prompts individuais não excedem limite', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 7.5**
   *
   * For any valid issue data, the generated targeted prompt must not exceed
   * 2000 characters.
   */
  it('targeted prompt is always <= 2000 characters', function () {
    fc.assert(
      fc.property(categoryArb, fixIssueDataArb, (category, issue) => {
        const prompt = generateTargetedPrompt(category, issue);
        assert.ok(
          prompt.length <= 2000,
          `Prompt length ${prompt.length} exceeds 2000 chars for category "${category}"`,
        );
      }),
      { numRuns: 200 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 4: Isolamento
// ─────────────────────────────────────────────────────────────────────────────

describe('FixPromptGenerator — Property 4: Prompts não contêm dados de outras issues', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 2.4**
   *
   * For any pair of issues (A, B) with distinct ids, the prompt generated
   * for A must not contain the exclusive file paths of B.
   */
  it('prompt of issue A does not contain exclusive ids of issue B', function () {
    // Use path-like ids with a unique prefix to avoid collisions with template text
    const pathIdArb = fc.string({ minLength: 5, maxLength: 80 }).map(
      (s) => `xfile/${s.replace(/[^a-zA-Z0-9]/g, '_')}.md`,
    );

    const issueWithPathIds: fc.Arbitrary<FixIssueData> = fc.record({
      ids: fc.array(pathIdArb, { minLength: 1, maxLength: 5 }),
      labels: labelsArb,
    });

    const distinctPairArb = fc.tuple(issueWithPathIds, issueWithPathIds).filter(([a, b]) => {
      // Ensure B has at least one id not present in A's ids
      const aSet = new Set(a.ids);
      return b.ids.some((id) => !aSet.has(id));
    });

    fc.assert(
      fc.property(categoryArb, distinctPairArb, (category, [issueA, issueB]) => {
        const promptA = generateTargetedPrompt(category, issueA);
        const aSet = new Set(issueA.ids);
        const exclusiveB = issueB.ids.filter((id) => !aSet.has(id));

        for (const exclusiveId of exclusiveB) {
          assert.ok(
            !promptA.includes(exclusiveId),
            `Prompt for issue A should not contain exclusive id "${exclusiveId}" from issue B`,
          );
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Property 5: Todas categorias válidas
// ─────────────────────────────────────────────────────────────────────────────

describe('FixPromptGenerator — Property 5: Todas as 19 categorias produzem prompts válidos', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * For any valid IssueCategory with minimal valid data, generateTargetedPrompt
   * must return a non-empty string containing the word "Resolva".
   */
  it('every category produces a non-empty prompt containing "Resolva"', function () {
    fc.assert(
      fc.property(categoryArb, fixIssueDataArb, (category, issue) => {
        const prompt = generateTargetedPrompt(category, issue);
        assert.ok(
          prompt.length > 0,
          `Prompt for category "${category}" should not be empty`,
        );
        assert.ok(
          prompt.includes('Resolva'),
          `Prompt for category "${category}" should contain "Resolva"`,
        );
      }),
      { numRuns: 200 },
    );
  });
});
