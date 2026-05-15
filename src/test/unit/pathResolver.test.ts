import * as assert from 'assert';
import { PathResolver } from '../../services/pathResolver';

describe('PathResolver', function () {
  const resolver = new PathResolver();

  describe('resolve()', function () {
    it('bare filenames resolve to source directory', function () {
      const result = resolver.resolve(
        'help-faq.md',
        '.kiro/steering/flow-deploy.md',
        'Workspace',
      );
      assert.strictEqual(result, '.kiro/steering/help-faq.md');
    });

    it('bare filenames in nested source resolve to that directory', function () {
      const result = resolver.resolve(
        'config.json',
        '.kiro/hooks/my-hook.json',
        'Workspace',
      );
      assert.strictEqual(result, '.kiro/hooks/config.json');
    });

    it('paths with / treated as workspace-relative', function () {
      const result = resolver.resolve(
        'docs/guide.md',
        '.kiro/steering/flow-deploy.md',
        'Workspace',
      );
      assert.strictEqual(result, 'docs/guide.md');
    });

    it('paths with nested directories treated as workspace-relative', function () {
      const result = resolver.resolve(
        'src/services/parser.ts',
        '.kiro/steering/test.md',
        'Workspace',
      );
      assert.strictEqual(result, 'src/services/parser.ts');
    });

    it('.kiro/ prefix paths pass through unchanged', function () {
      const result = resolver.resolve(
        '.kiro/steering/other.md',
        '.kiro/steering/flow-deploy.md',
        'Workspace',
      );
      assert.strictEqual(result, '.kiro/steering/other.md');
    });

    it('.kiro/ prefix with subdirectory passes through', function () {
      const result = resolver.resolve(
        '.kiro/skills/my-skill/SKILL.md',
        '.kiro/steering/test.md',
        'Workspace',
      );
      assert.strictEqual(result, '.kiro/skills/my-skill/SKILL.md');
    });

    it('backslash normalization converts to forward slashes', function () {
      const result = resolver.resolve(
        'docs\\guide.md',
        '.kiro/steering/test.md',
        'Workspace',
      );
      assert.strictEqual(result, 'docs/guide.md');
    });

    it('backslash normalization with .kiro prefix', function () {
      const result = resolver.resolve(
        '.kiro\\steering\\other.md',
        '.kiro/steering/test.md',
        'Workspace',
      );
      assert.strictEqual(result, '.kiro/steering/other.md');
    });
  });
});
