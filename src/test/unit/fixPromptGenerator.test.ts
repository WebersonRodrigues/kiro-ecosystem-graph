import * as assert from 'assert';
import { generateTargetedPrompt, generateConsolidatedPrompt } from '../../services/fixPromptGenerator';
import { IssueCategory, FixIssueData } from '../../types';

describe('FixPromptGenerator', function () {
  describe('generateTargetedPrompt', function () {
    // ─── One test per category (19 tests) ───

    it('generates prompt for orphan-steerings', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/steering/orphan.md'],
        labels: ['orphan'],
      };
      const prompt = generateTargetedPrompt('orphan-steerings', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/steering/orphan.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for fragile-links', function () {
      const issue: FixIssueData = {
        ids: ['source.md', 'target.md'],
        labels: ['source', 'target'],
      };
      const prompt = generateTargetedPrompt('fragile-links', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('source.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for isolated-files', function () {
      const issue: FixIssueData = {
        ids: ['src/utils/helper.ts'],
        labels: ['helper'],
      };
      const prompt = generateTargetedPrompt('isolated-files', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('src/utils/helper.ts'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for coverage-gaps', function () {
      const issue: FixIssueData = {
        ids: ['src/services'],
        labels: ['services'],
      };
      const prompt = generateTargetedPrompt('coverage-gaps', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('src/services'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for weak-instructions', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/steering/weak.md'],
        labels: ['weak'],
        extra: { lines: 5 },
      };
      const prompt = generateTargetedPrompt('weak-instructions', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/steering/weak.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for context-overload', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/steering/huge.md'],
        labels: ['huge'],
        extra: { lines: 500 },
      };
      const prompt = generateTargetedPrompt('context-overload', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/steering/huge.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for large-domain-steerings', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/steering/domain-all.md'],
        labels: ['domain-all'],
        extra: { lines: 800 },
      };
      const prompt = generateTargetedPrompt('large-domain-steerings', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/steering/domain-all.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for hooks-without-instruction', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/hooks/pre-commit.json'],
        labels: ['pre-commit'],
      };
      const prompt = generateTargetedPrompt('hooks-without-instruction', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/hooks/pre-commit.json'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for steerings-without-access', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/steering/no-access.md'],
        labels: ['no-access'],
        extra: { inclusion: 'auto' },
      };
      const prompt = generateTargetedPrompt('steerings-without-access', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/steering/no-access.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for dead-loops', function () {
      const issue: FixIssueData = {
        ids: ['a.md', 'b.md', 'c.md'],
        labels: ['a', 'b', 'c'],
        extra: { nodes: ['a.md', 'b.md', 'c.md'] },
      };
      const prompt = generateTargetedPrompt('dead-loops', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('a.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for hops-to-reach', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/steering/deep.md'],
        labels: ['deep'],
        extra: { hops: 5 },
      };
      const prompt = generateTargetedPrompt('hops-to-reach', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/steering/deep.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for duplicate-intent', function () {
      const issue: FixIssueData = {
        ids: ['steering-a.md', 'steering-b.md'],
        labels: ['steering-a', 'steering-b'],
        extra: { overlap: 75 },
      };
      const prompt = generateTargetedPrompt('duplicate-intent', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('steering-a.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for passive-knowledge', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/steering/passive.md'],
        labels: ['passive'],
        extra: { actionable: 5 },
      };
      const prompt = generateTargetedPrompt('passive-knowledge', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/steering/passive.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for signal-to-noise', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/steering/noisy.md'],
        labels: ['noisy'],
        extra: { signal: 15 },
      };
      const prompt = generateTargetedPrompt('signal-to-noise', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/steering/noisy.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for contradictions', function () {
      const issue: FixIssueData = {
        ids: ['steering-x.md', 'steering-y.md'],
        labels: ['steering-x', 'steering-y'],
        extra: {
          snippetA: 'always use semicolons',
          snippetB: 'never use semicolons',
          conflictType: 'always vs never',
        },
      };
      const prompt = generateTargetedPrompt('contradictions', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('steering-x.md'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for hook-coverage', function () {
      const issue: FixIssueData = {
        ids: ['fileEdited'],
        labels: ['fileEdited'],
        extra: { event: 'fileEdited' },
      };
      const prompt = generateTargetedPrompt('hook-coverage', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('fileEdited'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for decision-path', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/hooks/review.json'],
        labels: ['review'],
        extra: { gap: 'no steering reference' },
      };
      const prompt = generateTargetedPrompt('decision-path', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/hooks/review.json'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for quality-gate', function () {
      const issue: FixIssueData = {
        ids: ['ecosystem'],
        labels: ['quality-gate'],
        extra: { missing: 'self-review hook, quality steering' },
      };
      const prompt = generateTargetedPrompt('quality-gate', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('ecosystem'));
      assert.ok(prompt.length <= 2000);
    });

    it('generates prompt for dml-protection', function () {
      const issue: FixIssueData = {
        ids: ['ecosystem'],
        labels: ['dml-protection'],
        extra: { missing: 'DML hook, risk steering' },
      };
      const prompt = generateTargetedPrompt('dml-protection', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('ecosystem'));
      assert.ok(prompt.length <= 2000);
    });

    // ─── Edge cases ───

    it('handles empty ids gracefully', function () {
      const issue: FixIssueData = {
        ids: [],
        labels: ['something'],
      };
      const prompt = generateTargetedPrompt('orphan-steerings', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
    });

    it('handles empty labels gracefully', function () {
      const issue: FixIssueData = {
        ids: ['file.md'],
        labels: [],
      };
      const prompt = generateTargetedPrompt('fragile-links', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('file.md'));
    });

    it('handles undefined extra gracefully', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/steering/test.md'],
        labels: ['test'],
        extra: undefined,
      };
      const prompt = generateTargetedPrompt('weak-instructions', issue);
      assert.ok(prompt.length > 0);
      assert.ok(prompt.includes('Resolva'));
      assert.ok(prompt.includes('.kiro/steering/test.md'));
    });

    // ─── Format tests ───

    it('always contains "Resolva"', function () {
      const categories: IssueCategory[] = [
        'orphan-steerings', 'fragile-links', 'isolated-files',
        'coverage-gaps', 'weak-instructions', 'context-overload',
        'large-domain-steerings', 'hooks-without-instruction',
        'steerings-without-access', 'dead-loops', 'hops-to-reach',
        'duplicate-intent', 'passive-knowledge', 'signal-to-noise',
        'contradictions', 'hook-coverage', 'decision-path',
        'quality-gate', 'dml-protection',
      ];
      for (const cat of categories) {
        const issue: FixIssueData = { ids: ['test.md'], labels: ['test'] };
        const prompt = generateTargetedPrompt(cat, issue);
        assert.ok(prompt.includes('Resolva'), `Category "${cat}" missing "Resolva"`);
      }
    });

    it('contains file paths from input', function () {
      const issue: FixIssueData = {
        ids: ['.kiro/steering/my-file.md', 'src/other.ts'],
        labels: ['my-file', 'other'],
      };
      const prompt = generateTargetedPrompt('fragile-links', issue);
      assert.ok(prompt.includes('.kiro/steering/my-file.md'));
    });

    it('does not exceed 2000 characters', function () {
      // Generate a large issue with many long paths
      const longPaths = Array.from({ length: 50 }, (_, i) =>
        `.kiro/steering/very-long-path-name-for-testing-truncation-behavior-${i}.md`,
      );
      const issue: FixIssueData = {
        ids: longPaths,
        labels: longPaths.map((p) => p.replace('.md', '')),
      };
      const prompt = generateTargetedPrompt('orphan-steerings', issue);
      assert.ok(prompt.length <= 2000, `Prompt length ${prompt.length} exceeds 2000`);
    });
  });

  describe('generateConsolidatedPrompt', function () {
    it('generates numbered list for multiple issues', function () {
      const issues: FixIssueData[] = [
        { ids: ['file-a.md'], labels: ['a'] },
        { ids: ['file-b.md'], labels: ['b'] },
        { ids: ['file-c.md'], labels: ['c'] },
      ];
      const prompt = generateConsolidatedPrompt('orphan-steerings', issues);
      assert.ok(prompt.includes('1.'));
      assert.ok(prompt.includes('2.'));
      assert.ok(prompt.includes('3.'));
      assert.ok(prompt.includes('file-a.md'));
      assert.ok(prompt.includes('file-b.md'));
      assert.ok(prompt.includes('file-c.md'));
    });

    it('returns empty string for empty array', function () {
      const prompt = generateConsolidatedPrompt('orphan-steerings', []);
      assert.strictEqual(prompt, '');
    });

    it('contains all issue paths', function () {
      const issues: FixIssueData[] = [
        { ids: ['path/alpha.md'], labels: ['alpha'] },
        { ids: ['path/beta.md'], labels: ['beta'] },
      ];
      const prompt = generateConsolidatedPrompt('fragile-links', issues);
      assert.ok(prompt.includes('path/alpha.md'));
      assert.ok(prompt.includes('path/beta.md'));
      assert.ok(prompt.includes('Resolva'));
    });
  });
});
