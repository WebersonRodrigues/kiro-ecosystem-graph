import * as assert from 'assert';
import { ParserService, isEcosystemRelevantPath } from '../../services/parserService';
import { NodeClassifier } from '../../services/nodeClassifier';
import { PathResolver } from '../../services/pathResolver';
import type { SteeringFile, EcosystemFile } from '../../types';

function createMockSteeringFile(relativePath = '.kiro/steering/test-steering.md'): SteeringFile {
  return {
    uri: { fsPath: `/workspace/${relativePath}` } as unknown as SteeringFile['uri'],
    workspaceFolder: 'Workspace',
    relativePath,
  };
}

function createMockEcosystemFile(
  relativePath: string,
  category: 'steering' | 'skill' | 'hook' = 'hook',
): EcosystemFile {
  return {
    uri: { fsPath: `/workspace/${relativePath}` } as unknown as EcosystemFile['uri'],
    workspaceFolder: 'Workspace',
    relativePath,
    category,
  };
}

describe('ParserService', function () {
  const nodeClassifier = new NodeClassifier();
  const pathResolver = new PathResolver();
  const parserService = new ParserService(nodeClassifier, pathResolver);

  describe('parse()', function () {
    it('extracts wiki-links', function () {
      const file = createMockSteeringFile();
      const content = [
        '# Test',
        '',
        'See #[[file:.kiro/steering/other.md]] for details.',
      ].join('\n');
      const knownFiles = new Map<string, string>();

      const result = parserService.parse(file, content, knownFiles);
      const wikiRefs = result.references.filter((r) => r.type === 'wiki-link');
      assert.strictEqual(wikiRefs.length, 1);
      assert.strictEqual(wikiRefs[0].target, '.kiro/steering/other.md');
    });

    it('extracts markdown-links', function () {
      const file = createMockSteeringFile();
      const content = [
        '# Test',
        '',
        'See [other doc](.kiro/steering/other.md) for details.',
      ].join('\n');
      const knownFiles = new Map<string, string>();

      const result = parserService.parse(file, content, knownFiles);
      const mdRefs = result.references.filter((r) => r.type === 'markdown-link');
      assert.strictEqual(mdRefs.length, 1);
      assert.strictEqual(mdRefs[0].target, '.kiro/steering/other.md');
    });

    it('extracts backtick-refs when filename is in knownSteeringFiles', function () {
      const file = createMockSteeringFile();
      const content = [
        '# Test',
        '',
        'Reference `help-faq.md` for common questions.',
      ].join('\n');
      const knownFiles = new Map<string, string>([
        ['help-faq.md', '.kiro/steering/help-faq.md'],
      ]);

      const result = parserService.parse(file, content, knownFiles);
      const btRefs = result.references.filter((r) => r.type === 'backtick-ref');
      assert.strictEqual(btRefs.length, 1);
      assert.strictEqual(btRefs[0].target, '.kiro/steering/help-faq.md');
    });

    it('does not extract backtick-refs for unknown filenames', function () {
      const file = createMockSteeringFile();
      const content = 'Reference `unknown-file.md` here.';
      const knownFiles = new Map<string, string>();

      const result = parserService.parse(file, content, knownFiles);
      const btRefs = result.references.filter((r) => r.type === 'backtick-ref');
      assert.strictEqual(btRefs.length, 0);
    });

    it('extracts table-paths for ecosystem files', function () {
      const file = createMockSteeringFile();
      const content = [
        '| File | Description |',
        '|------|-------------|',
        '| docs/guide.md | Main guide |',
      ].join('\n');
      const knownFiles = new Map<string, string>();

      const result = parserService.parse(file, content, knownFiles);
      const tableRefs = result.references.filter((r) => r.type === 'table-path');
      assert.strictEqual(tableRefs.length, 1);
      assert.strictEqual(tableRefs[0].target, 'docs/guide.md');
    });

    it('does not extract table-paths for non-ecosystem files', function () {
      const file = createMockSteeringFile();
      const content = [
        '| File | Description |',
        '|------|-------------|',
        '| src/service.ts | Service impl |',
      ].join('\n');
      const knownFiles = new Map<string, string>();

      const result = parserService.parse(file, content, knownFiles);
      const tableRefs = result.references.filter((r) => r.type === 'table-path');
      assert.strictEqual(tableRefs.length, 0);
    });

    it('returns a node with correct metadata', function () {
      const file = createMockSteeringFile('.kiro/steering/flow-deploy.md');
      const content = [
        '---',
        'inclusion: always',
        '---',
        '# Deploy Flow',
        '',
        'Always run tests before deploying.',
      ].join('\n');
      const knownFiles = new Map<string, string>();

      const result = parserService.parse(file, content, knownFiles);
      assert.strictEqual(result.node.id, '.kiro/steering/flow-deploy.md');
      assert.strictEqual(result.node.label, 'flow-deploy');
      assert.strictEqual(result.node.type, 'steering-flow');
      assert.strictEqual(result.node.metadata?.inclusion, 'always');
    });
  });

  describe('isEcosystemRelevantPath()', function () {
    it('returns true for .md files', function () {
      assert.strictEqual(isEcosystemRelevantPath('docs/guide.md'), true);
    });

    it('returns true for .json files', function () {
      assert.strictEqual(isEcosystemRelevantPath('.kiro/hooks/my-hook.json'), true);
    });

    it('returns true for .kiro.hook files', function () {
      assert.strictEqual(isEcosystemRelevantPath('.kiro/hooks/lint.kiro.hook'), true);
    });

    it('returns false for .cs files', function () {
      assert.strictEqual(isEcosystemRelevantPath('src/Service.cs'), false);
    });

    it('returns false for .ts files', function () {
      assert.strictEqual(isEcosystemRelevantPath('src/index.ts'), false);
    });

    it('returns false for .py files', function () {
      assert.strictEqual(isEcosystemRelevantPath('scripts/main.py'), false);
    });

    it('returns false for .js files', function () {
      assert.strictEqual(isEcosystemRelevantPath('lib/utils.js'), false);
    });

    it('returns false for .png files', function () {
      assert.strictEqual(isEcosystemRelevantPath('resources/icon.png'), false);
    });

    it('handles fragments (#anchor) correctly', function () {
      assert.strictEqual(isEcosystemRelevantPath('docs/guide.md#section'), true);
      assert.strictEqual(isEcosystemRelevantPath('src/file.ts#line10'), false);
    });

    it('handles .kiro/ prefix with non-ecosystem extension', function () {
      assert.strictEqual(isEcosystemRelevantPath('.kiro/steering/IProdutoService.cs'), false);
      assert.strictEqual(isEcosystemRelevantPath('.kiro/steering/helper.ts'), false);
    });
  });

  describe('parseHook()', function () {
    it('extracts hook metadata from valid JSON', function () {
      const file = createMockEcosystemFile('.kiro/hooks/lint-check.json');
      const content = JSON.stringify({
        name: 'Lint Check',
        description: 'Runs linter on save',
        when: { type: 'fileEdited', patterns: ['*.ts'] },
        then: { command: 'npm run lint', prompt: '' },
      });
      const knownFiles = new Map<string, string>();

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.node.label, 'Lint Check');
      assert.strictEqual(result!.node.type, 'hook-auto');
      assert.strictEqual(result!.node.metadata?.whenType, 'fileEdited');
      assert.strictEqual(result!.node.metadata?.description, 'Runs linter on save');
    });

    it('classifies userTriggered hooks as hook-manual', function () {
      const file = createMockEcosystemFile('.kiro/hooks/deploy.json');
      const content = JSON.stringify({
        name: 'Deploy',
        when: { type: 'userTriggered' },
        then: { prompt: '' },
      });
      const knownFiles = new Map<string, string>();

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.node.type, 'hook-manual');
    });

    it('extracts references from prompt', function () {
      const file = createMockEcosystemFile('.kiro/hooks/review.json');
      const content = JSON.stringify({
        name: 'Review',
        when: { type: 'postToolUse' },
        then: { prompt: 'Follow the rules in `code-conventions.md` and `security-policies.md`.' },
      });
      const knownFiles = new Map<string, string>([
        ['code-conventions.md', '.kiro/steering/code-conventions.md'],
        ['security-policies.md', '.kiro/steering/security-policies.md'],
      ]);

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.references.length, 2);
      assert.ok(result!.references.some((r) => r.target === '.kiro/steering/code-conventions.md'));
      assert.ok(result!.references.some((r) => r.target === '.kiro/steering/security-policies.md'));
    });

    it('returns null for invalid JSON', function () {
      const file = createMockEcosystemFile('.kiro/hooks/broken.json');
      const content = '{ invalid json content';
      const knownFiles = new Map<string, string>();

      const result = parserService.parseHook(file, content, knownFiles);
      assert.strictEqual(result, null);
    });

    it('uses filename as label when name is missing', function () {
      const file = createMockEcosystemFile('.kiro/hooks/my-hook.json');
      const content = JSON.stringify({
        when: { type: 'fileEdited' },
        then: { prompt: '' },
      });
      const knownFiles = new Map<string, string>();

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.node.label, 'my-hook');
    });
  });

  describe('parseSkill()', function () {
    it('extracts skill node with correct label from SKILL.md', function () {
      const file = createMockEcosystemFile(
        '.kiro/skills/compilacao-delphi/SKILL.md',
        'skill',
      );
      const content = [
        '# Compilação Delphi',
        '',
        'This skill handles Delphi compilation.',
      ].join('\n');
      const knownFiles = new Map<string, string>();

      const result = parserService.parseSkill(file, content, knownFiles);
      assert.strictEqual(result.node.type, 'skill');
      assert.strictEqual(result.node.label, 'compilacao-delphi');
    });

    it('uses filename as label for non-SKILL.md files', function () {
      const file = createMockEcosystemFile(
        '.kiro/skills/my-skill.md',
        'skill',
      );
      const content = '# My Skill\n\nDoes things.';
      const knownFiles = new Map<string, string>();

      const result = parserService.parseSkill(file, content, knownFiles);
      assert.strictEqual(result.node.type, 'skill');
      assert.strictEqual(result.node.label, 'my-skill');
    });

    it('extracts references from skill content', function () {
      const file = createMockEcosystemFile(
        '.kiro/skills/my-skill/SKILL.md',
        'skill',
      );
      const content = [
        '# My Skill',
        '',
        'See #[[file:.kiro/steering/flow-deploy.md]] for deploy steps.',
      ].join('\n');
      const knownFiles = new Map<string, string>();

      const result = parserService.parseSkill(file, content, knownFiles);
      assert.strictEqual(result.references.length, 1);
      assert.strictEqual(result.references[0].target, '.kiro/steering/flow-deploy.md');
      assert.strictEqual(result.references[0].type, 'wiki-link');
    });
  });

  describe('extractBacktickRefs — extensionless backtick refs', function () {
    it('creates backtick-ref edge when extensionless name + .md exists in knownSteeringFiles', function () {
      const file = createMockSteeringFile();
      const content = 'Reference `security-policies` for guidelines.';
      const knownFiles = new Map<string, string>([
        ['security-policies.md', '.kiro/steering/security-policies.md'],
      ]);

      const result = parserService.parse(file, content, knownFiles);
      const btRefs = result.references.filter((r) => r.type === 'backtick-ref');
      assert.strictEqual(btRefs.length, 1);
      assert.strictEqual(btRefs[0].target, '.kiro/steering/security-policies.md');
    });

    it('creates edges for multiple extensionless refs on the same line', function () {
      const file = createMockSteeringFile();
      const content = 'See `help-faq` and `code-conventions` for details.';
      const knownFiles = new Map<string, string>([
        ['help-faq.md', '.kiro/steering/help-faq.md'],
        ['code-conventions.md', '.kiro/steering/code-conventions.md'],
      ]);

      const result = parserService.parse(file, content, knownFiles);
      const btRefs = result.references.filter((r) => r.type === 'backtick-ref');
      assert.strictEqual(btRefs.length, 2);
      assert.ok(btRefs.some((r) => r.target === '.kiro/steering/help-faq.md'));
      assert.ok(btRefs.some((r) => r.target === '.kiro/steering/code-conventions.md'));
    });

    it('does not create duplicate edge when both name.md and name appear', function () {
      const file = createMockSteeringFile();
      const content = 'See `help-faq.md` and also `help-faq` for info.';
      const knownFiles = new Map<string, string>([
        ['help-faq.md', '.kiro/steering/help-faq.md'],
      ]);

      const result = parserService.parse(file, content, knownFiles);
      const btRefs = result.references.filter((r) => r.type === 'backtick-ref');
      assert.strictEqual(btRefs.length, 1);
      assert.strictEqual(btRefs[0].target, '.kiro/steering/help-faq.md');
    });

    it('does not create edges for code keywords', function () {
      const file = createMockSteeringFile();
      const content = 'Use `const` and `function` and `import` in your code.';
      const knownFiles = new Map<string, string>([
        ['help-faq.md', '.kiro/steering/help-faq.md'],
      ]);

      const result = parserService.parse(file, content, knownFiles);
      const btRefs = result.references.filter((r) => r.type === 'backtick-ref');
      assert.strictEqual(btRefs.length, 0);
    });

    it('does not match names containing dots (file.ts, v2.0)', function () {
      const file = createMockSteeringFile();
      const content = 'See `file.ts` and `v2.0` for examples.';
      const knownFiles = new Map<string, string>([
        ['file.ts.md', '.kiro/steering/file.ts.md'],
        ['v2.0.md', '.kiro/steering/v2.0.md'],
      ]);

      const result = parserService.parse(file, content, knownFiles);
      const btRefs = result.references.filter((r) => r.type === 'backtick-ref');
      assert.strictEqual(btRefs.length, 0);
    });

    it('existing .md backtick ref behavior is unchanged (regression)', function () {
      const file = createMockSteeringFile();
      const content = 'Reference `help-faq.md` for common questions.';
      const knownFiles = new Map<string, string>([
        ['help-faq.md', '.kiro/steering/help-faq.md'],
      ]);

      const result = parserService.parse(file, content, knownFiles);
      const btRefs = result.references.filter((r) => r.type === 'backtick-ref');
      assert.strictEqual(btRefs.length, 1);
      assert.strictEqual(btRefs[0].target, '.kiro/steering/help-faq.md');
    });
  });

  describe('extractFrontMatter() — inclusion quote stripping', function () {
    it('strips double quotes from inclusion value', function () {
      const file = createMockSteeringFile('.kiro/steering/api-patterns.md');
      const content = [
        '---',
        'inclusion: "fileMatch"',
        '---',
        '# API Patterns',
      ].join('\n');
      const knownFiles = new Map<string, string>();

      const result = parserService.parse(file, content, knownFiles);
      assert.strictEqual(result.node.metadata?.inclusion, 'fileMatch');
    });

    it('strips single quotes from inclusion value', function () {
      const file = createMockSteeringFile('.kiro/steering/manual-deploy.md');
      const content = [
        '---',
        "inclusion: 'manual'",
        '---',
        '# Manual Deploy',
      ].join('\n');
      const knownFiles = new Map<string, string>();

      const result = parserService.parse(file, content, knownFiles);
      assert.strictEqual(result.node.metadata?.inclusion, 'manual');
    });

    it('preserves unquoted inclusion value', function () {
      const file = createMockSteeringFile('.kiro/steering/always-on.md');
      const content = [
        '---',
        'inclusion: always',
        '---',
        '# Always On',
      ].join('\n');
      const knownFiles = new Map<string, string>();

      const result = parserService.parse(file, content, knownFiles);
      assert.strictEqual(result.node.metadata?.inclusion, 'always');
    });
  });

  describe('parseHook() — hookPrompt metadata', function () {
    it('stores then.prompt as hookPrompt in metadata', function () {
      const file = createMockEcosystemFile('.kiro/hooks/review.json');
      const prompt = 'Analise o código e verifique se segue os padrões estabelecidos no projeto';
      const content = JSON.stringify({
        name: 'Code Review',
        description: 'Reviews code changes',
        when: { type: 'postToolUse' },
        then: { prompt },
      });
      const knownFiles = new Map<string, string>();

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.node.metadata?.hookPrompt, prompt);
    });

    it('stores empty string as hookPrompt when prompt is empty', function () {
      const file = createMockEcosystemFile('.kiro/hooks/simple.json');
      const content = JSON.stringify({
        name: 'Simple Hook',
        when: { type: 'fileEdited' },
        then: { prompt: '' },
      });
      const knownFiles = new Map<string, string>();

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.node.metadata?.hookPrompt, '');
    });

    it('stores empty string as hookPrompt when then.prompt is missing', function () {
      const file = createMockEcosystemFile('.kiro/hooks/no-prompt.json');
      const content = JSON.stringify({
        name: 'No Prompt Hook',
        when: { type: 'fileEdited' },
        then: { command: 'npm run lint' },
      });
      const knownFiles = new Map<string, string>();

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.node.metadata?.hookPrompt, '');
    });
  });

  describe('parseHook() — #name reference detection', function () {
    it('creates edge for #name pattern when name.md exists in knownSteeringFiles', function () {
      const file = createMockEcosystemFile('.kiro/hooks/commit.json');
      const content = JSON.stringify({
        name: 'Commit Hook',
        when: { type: 'postToolUse' },
        then: { prompt: 'Follow the rules in #commit-message when writing commits.' },
      });
      const knownFiles = new Map<string, string>([
        ['commit-message.md', '.kiro/steering/commit-message.md'],
      ]);

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.references.length, 1);
      assert.strictEqual(result!.references[0].target, '.kiro/steering/commit-message.md');
      assert.strictEqual(result!.references[0].type, 'backtick-ref');
    });

    it('creates multiple edges for multiple #name patterns', function () {
      const file = createMockEcosystemFile('.kiro/hooks/review.json');
      const content = JSON.stringify({
        name: 'Review Hook',
        when: { type: 'postToolUse' },
        then: { prompt: 'Check #code-conventions and #security-policies before approving.' },
      });
      const knownFiles = new Map<string, string>([
        ['code-conventions.md', '.kiro/steering/code-conventions.md'],
        ['security-policies.md', '.kiro/steering/security-policies.md'],
      ]);

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.references.length, 2);
      assert.ok(result!.references.some((r) => r.target === '.kiro/steering/code-conventions.md'));
      assert.ok(result!.references.some((r) => r.target === '.kiro/steering/security-policies.md'));
    });

    it('does not create edge for #name when name.md is not in knownSteeringFiles', function () {
      const file = createMockEcosystemFile('.kiro/hooks/test.json');
      const content = JSON.stringify({
        name: 'Test Hook',
        when: { type: 'fileEdited' },
        then: { prompt: 'Reference #unknown-steering for context.' },
      });
      const knownFiles = new Map<string, string>();

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.references.length, 0);
    });

    it('deduplicates #name against backtick-ref for same steering', function () {
      const file = createMockEcosystemFile('.kiro/hooks/dedup.json');
      const content = JSON.stringify({
        name: 'Dedup Hook',
        when: { type: 'postToolUse' },
        then: { prompt: 'See `commit-message.md` and also #commit-message for rules.' },
      });
      const knownFiles = new Map<string, string>([
        ['commit-message.md', '.kiro/steering/commit-message.md'],
      ]);

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.references.length, 1);
      assert.strictEqual(result!.references[0].target, '.kiro/steering/commit-message.md');
    });

    it('does not match #name patterns starting with uppercase', function () {
      const file = createMockEcosystemFile('.kiro/hooks/upper.json');
      const content = JSON.stringify({
        name: 'Upper Hook',
        when: { type: 'fileEdited' },
        then: { prompt: 'See #Commit-Message for rules.' },
      });
      const knownFiles = new Map<string, string>([
        ['Commit-Message.md', '.kiro/steering/Commit-Message.md'],
      ]);

      const result = parserService.parseHook(file, content, knownFiles);
      assert.ok(result !== null);
      assert.strictEqual(result!.references.length, 0);
    });
  });
});