import * as assert from 'assert';
import {
  extractKeywords,
  computeActionableRatio,
  extractImperativeLines,
  extractSectionHeaders,
  analyzeContent,
  isDecisionTableHeader,
  isTableSeparator,
} from '../../services/contentAnalyzer';

describe('ContentAnalyzer', function () {
  describe('extractKeywords()', function () {
    it('extracts words with 4+ characters', function () {
      const content = 'Use the main service for data processing';
      const keywords = extractKeywords(content);
      // 'main' (4), 'service' (7), 'data' (4), 'processing' (10)
      assert.ok(keywords.includes('main'));
      assert.ok(keywords.includes('service'));
      assert.ok(keywords.includes('data'));
      assert.ok(keywords.includes('processing'));
    });

    it('excludes words shorter than 4 characters', function () {
      const content = 'Use the API for all new tasks';
      const keywords = extractKeywords(content);
      assert.ok(!keywords.includes('use'));
      assert.ok(!keywords.includes('the'));
      assert.ok(!keywords.includes('api'));
      assert.ok(!keywords.includes('for'));
      assert.ok(!keywords.includes('all'));
      assert.ok(!keywords.includes('new'));
    });

    it('excludes English stop-words', function () {
      const content = 'this should have been with more from over';
      const keywords = extractKeywords(content);
      assert.ok(!keywords.includes('this'));
      assert.ok(!keywords.includes('should'));
      assert.ok(!keywords.includes('have'));
      assert.ok(!keywords.includes('been'));
      assert.ok(!keywords.includes('with'));
      assert.ok(!keywords.includes('more'));
      assert.ok(!keywords.includes('from'));
      assert.ok(!keywords.includes('over'));
    });

    it('excludes PT-BR stop-words', function () {
      const content = 'para cada todo sobre entre';
      const keywords = extractKeywords(content);
      assert.ok(!keywords.includes('para'));
      assert.ok(!keywords.includes('cada'));
      assert.ok(!keywords.includes('todo'));
      assert.ok(!keywords.includes('sobre'));
      assert.ok(!keywords.includes('entre'));
    });

    it('returns empty array for empty content', function () {
      const keywords = extractKeywords('');
      assert.deepStrictEqual(keywords, []);
    });

    it('returns empty array for content with only short/stop words', function () {
      const keywords = extractKeywords('the a an is are for and but');
      assert.deepStrictEqual(keywords, []);
    });

    it('deduplicates keywords', function () {
      const content = 'service service service service';
      const keywords = extractKeywords(content);
      assert.strictEqual(keywords.filter((k) => k === 'service').length, 1);
    });

    it('lowercases all keywords', function () {
      const content = 'Service SERVICE sErViCe';
      const keywords = extractKeywords(content);
      assert.ok(keywords.includes('service'));
      assert.strictEqual(keywords.length, 1);
    });
  });

  describe('computeActionableRatio()', function () {
    it('returns correct ratio for mixed content', function () {
      const content = [
        'This is a description line.',
        'Always use TypeScript strict mode.',
        'Another description line here.',
        'Never use any types in code.',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      // 2 actionable out of 4 non-empty lines
      assert.strictEqual(ratio, 0.5);
    });

    it('returns 1.0 for 100% imperative content', function () {
      const content = [
        'Always use strict mode.',
        'Never skip validation.',
        'Must implement error handling.',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      assert.strictEqual(ratio, 1.0);
    });

    it('returns 0.0 for 100% descriptive content', function () {
      const content = [
        'This is a description.',
        'The system has many components.',
        'Files are organized in folders.',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      assert.strictEqual(ratio, 0.0);
    });

    it('returns 0 for empty content', function () {
      const ratio = computeActionableRatio('');
      assert.strictEqual(ratio, 0);
    });

    it('excludes front-matter separators from line count', function () {
      const content = [
        '---',
        'title: my document',
        '---',
        'Always use TypeScript.',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      // '---' lines are excluded, 'title: my document' is not actionable,
      // 'Always use TypeScript.' is actionable → 1/2 = 0.5
      assert.strictEqual(ratio, 0.5);
    });

    it('excludes empty lines from calculation', function () {
      const content = [
        '',
        'Always use strict mode.',
        '',
        '',
        'This is descriptive.',
        '',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      // 1 actionable out of 2 non-empty lines
      assert.strictEqual(ratio, 0.5);
    });
  });

  describe('extractImperativeLines()', function () {
    it('detects "always" pattern', function () {
      const content = 'Always validate input before processing.';
      const lines = extractImperativeLines(content);
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0].pattern, 'always');
      assert.strictEqual(lines[0].subject, 'validate');
    });

    it('detects "never" pattern', function () {
      const content = 'Never expose secrets in logs.';
      const lines = extractImperativeLines(content);
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0].pattern, 'never');
      assert.strictEqual(lines[0].subject, 'expose');
    });

    it('detects "use" pattern', function () {
      const content = 'Use parameterized queries for SQL.';
      const lines = extractImperativeLines(content);
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0].pattern, 'use');
      assert.strictEqual(lines[0].subject, 'parameterized');
    });

    it('detects "do_not" pattern', function () {
      const content = 'Do not commit secrets to the repository.';
      const lines = extractImperativeLines(content);
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0].pattern, 'do_not');
      assert.strictEqual(lines[0].subject, 'commit');
    });

    it('detects "prefer" pattern', function () {
      const content = 'Prefer composition over inheritance.';
      const lines = extractImperativeLines(content);
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0].pattern, 'prefer');
      assert.strictEqual(lines[0].subject, 'composition');
    });

    it('detects "avoid" pattern', function () {
      const content = 'Avoid global state in modules.';
      const lines = extractImperativeLines(content);
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0].pattern, 'avoid');
      assert.strictEqual(lines[0].subject, 'global');
    });

    it('detects "must" pattern', function () {
      const content = 'Must handle all error cases.';
      const lines = extractImperativeLines(content);
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0].pattern, 'must');
      assert.strictEqual(lines[0].subject, 'handle');
    });

    it('detects "shall" pattern', function () {
      const content = 'Shall implement retry logic.';
      const lines = extractImperativeLines(content);
      assert.strictEqual(lines.length, 1);
      assert.strictEqual(lines[0].pattern, 'shall');
      assert.strictEqual(lines[0].subject, 'implement');
    });

    it('extracts correct subject from imperative line', function () {
      const content = 'Always encrypt sensitive data at rest.';
      const lines = extractImperativeLines(content);
      assert.strictEqual(lines[0].subject, 'encrypt');
    });

    it('returns empty array for non-imperative content', function () {
      const content = 'The system processes data in batches.';
      const lines = extractImperativeLines(content);
      assert.strictEqual(lines.length, 0);
    });
  });

  describe('extractSectionHeaders()', function () {
    it('extracts # headers', function () {
      const content = [
        '# Main Title',
        '',
        'Some content here.',
        '',
        '## Sub Section',
        '',
        '### Deep Section',
      ].join('\n');
      const headers = extractSectionHeaders(content);
      assert.deepStrictEqual(headers, ['main title', 'sub section', 'deep section']);
    });

    it('ignores non-header lines', function () {
      const content = [
        'This is not a header',
        '- list item',
        '| table | cell |',
        '```code block```',
      ].join('\n');
      const headers = extractSectionHeaders(content);
      assert.deepStrictEqual(headers, []);
    });

    it('returns empty array for empty content', function () {
      const headers = extractSectionHeaders('');
      assert.deepStrictEqual(headers, []);
    });
  });

  describe('analyzeContent()', function () {
    it('returns complete ContentMetrics', function () {
      const content = [
        '# Configuration Guide',
        '',
        'Always use strict mode in TypeScript.',
        'Never skip error handling.',
        'The system processes requests.',
      ].join('\n');
      const metrics = analyzeContent(content);

      assert.ok(Array.isArray(metrics.keywords));
      assert.ok(metrics.keywords.length > 0);
      assert.ok(Array.isArray(metrics.sectionHeaders));
      assert.deepStrictEqual(metrics.sectionHeaders, ['configuration guide']);
      assert.ok(typeof metrics.actionableRatio === 'number');
      assert.ok(metrics.actionableRatio > 0);
      assert.ok(Array.isArray(metrics.imperativeLines));
      assert.ok(metrics.imperativeLines.length >= 2);
    });
  });

  describe('isDecisionTableHeader()', function () {
    it('detects PT-BR pair: Quando/Ação', function () {
      assert.strictEqual(isDecisionTableHeader('| Quando | Ação |'), true);
    });

    it('detects PT-BR pair: Quando/Acao (no accent)', function () {
      assert.strictEqual(isDecisionTableHeader('| Quando | Acao |'), true);
    });

    it('detects PT-BR pair: Se/Então', function () {
      assert.strictEqual(isDecisionTableHeader('| Se | Então |'), true);
    });

    it('detects PT-BR pair: Se/Entao (no accent)', function () {
      assert.strictEqual(isDecisionTableHeader('| Se | Entao |'), true);
    });

    it('detects PT-BR pair: Situação/Ação', function () {
      assert.strictEqual(isDecisionTableHeader('| Situação | Ação |'), true);
    });

    it('detects PT-BR pair: Cenário/Resposta', function () {
      assert.strictEqual(isDecisionTableHeader('| Cenário | Resposta |'), true);
    });

    it('detects EN pair: Condition/Action', function () {
      assert.strictEqual(isDecisionTableHeader('| Condition | Action |'), true);
    });

    it('detects EN pair: If/Then', function () {
      assert.strictEqual(isDecisionTableHeader('| If | Then |'), true);
    });

    it('detects EN pair: Trigger/Response', function () {
      assert.strictEqual(isDecisionTableHeader('| Trigger | Response |'), true);
    });

    it('is case-insensitive', function () {
      assert.strictEqual(isDecisionTableHeader('| CONDITION | ACTION |'), true);
      assert.strictEqual(isDecisionTableHeader('| condition | action |'), true);
    });

    it('returns false for regular table headers', function () {
      assert.strictEqual(isDecisionTableHeader('| Name | Description |'), false);
      assert.strictEqual(isDecisionTableHeader('| File | Size | Date |'), false);
    });

    it('returns false for lines not starting with |', function () {
      assert.strictEqual(isDecisionTableHeader('Condition | Action'), false);
    });

    it('returns false for empty string', function () {
      assert.strictEqual(isDecisionTableHeader(''), false);
    });
  });

  describe('isTableSeparator()', function () {
    it('detects standard separator', function () {
      assert.strictEqual(isTableSeparator('|---|---|'), true);
    });

    it('detects separator with colons (alignment)', function () {
      assert.strictEqual(isTableSeparator('|:---|---:|'), true);
    });

    it('detects separator with spaces', function () {
      assert.strictEqual(isTableSeparator('| --- | --- |'), true);
    });

    it('returns false for data rows', function () {
      assert.strictEqual(isTableSeparator('| value1 | value2 |'), false);
    });

    it('returns false for non-table lines', function () {
      assert.strictEqual(isTableSeparator('some text'), false);
    });
  });

  describe('computeActionableRatio() with decision tables', function () {
    it('counts decision table data rows as actionable', function () {
      const content = [
        '| Condition | Action |',
        '|---|---|',
        '| User logs in | Show dashboard |',
        '| User logs out | Redirect to login |',
        '| Session expires | Show timeout message |',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      // 3 data rows actionable out of 5 non-empty lines (header + sep + 3 data)
      // But header is not counted as actionable, separator is not counted
      // nonEmpty = 5 lines, actionable = 3
      assert.strictEqual(ratio, 3 / 5);
    });

    it('counts mixed imperative + decision table rows', function () {
      const content = [
        'Always validate input.',
        'Never skip tests.',
        '| If | Then |',
        '|---|---|',
        '| error occurs | retry operation |',
        '| timeout | show message |',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      // 2 imperative + 2 data rows = 4 actionable out of 6 non-empty lines
      assert.strictEqual(ratio, 4 / 6);
    });

    it('does not count header or separator as actionable', function () {
      const content = [
        '| Trigger | Response |',
        '|---|---|',
        '| click | navigate |',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      // 1 data row actionable out of 3 non-empty lines
      assert.strictEqual(ratio, 1 / 3);
    });

    it('table with only header + separator contributes 0 actionable', function () {
      const content = [
        '| Condition | Action |',
        '|---|---|',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      // 0 actionable out of 2 non-empty lines
      assert.strictEqual(ratio, 0);
    });

    it('non-decision table does not count rows as actionable', function () {
      const content = [
        '| Name | Description |',
        '|---|---|',
        '| foo | a thing |',
        '| bar | another thing |',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      // No decision pair → no actionable lines
      assert.strictEqual(ratio, 0);
    });

    it('exits decision table mode on non-pipe line', function () {
      const content = [
        '| If | Then |',
        '|---|---|',
        '| error | retry |',
        'This is descriptive text.',
        'Always log errors.',
      ].join('\n');
      const ratio = computeActionableRatio(content);
      // 1 data row + 1 imperative = 2 actionable out of 5 non-empty lines
      assert.strictEqual(ratio, 2 / 5);
    });
  });
});
