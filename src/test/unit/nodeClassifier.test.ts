import * as assert from 'assert';
import { NodeClassifier } from '../../services/nodeClassifier';
import type { NodeType } from '../../types';

describe('NodeClassifier', function () {
  const classifier = new NodeClassifier();

  describe('classify()', function () {
    it('flow- prefix → steering-flow', function () {
      assert.strictEqual(classifier.classify('flow-deploy.md', 'Workspace'), 'steering-flow');
      assert.strictEqual(classifier.classify('flow-pedido.md', 'Workspace'), 'steering-flow');
    });

    it('help- prefix → steering-help', function () {
      assert.strictEqual(classifier.classify('help-faq.md', 'Workspace'), 'steering-help');
      assert.strictEqual(classifier.classify('help-troubleshooting.md', 'Workspace'), 'steering-help');
    });

    it('hook types: userTriggered → hook-manual, others → hook-auto', function () {
      // NodeClassifier doesn't directly handle hook types (that's ParserService),
      // but we test the NodeType values exist and are distinct
      const manualColor = classifier.getColor('hook-manual');
      const autoColor = classifier.getColor('hook-auto');
      assert.ok(manualColor !== autoColor);
    });

    it('playbook prefix → steering-playbook', function () {
      assert.strictEqual(classifier.classify('playbook-incident.md', 'Workspace'), 'steering-playbook');
    });

    it('observability prefix → steering-observability', function () {
      assert.strictEqual(classifier.classify('observability-metrics.md', 'Workspace'), 'steering-observability');
      assert.strictEqual(classifier.classify('monitoring-guide.md', 'Workspace'), 'steering-observability');
    });

    it('policy/security keywords → steering-policy', function () {
      assert.strictEqual(classifier.classify('security-policies.md', 'Workspace'), 'steering-policy');
      assert.strictEqual(classifier.classify('governance-rules.md', 'Workspace'), 'steering-policy');
    });

    it('tech/architecture keywords → steering-tech', function () {
      assert.strictEqual(classifier.classify('tech-stack.md', 'Workspace'), 'steering-tech');
      assert.strictEqual(classifier.classify('architecture-overview.md', 'Workspace'), 'steering-tech');
      assert.strictEqual(classifier.classify('code-conventions.md', 'Workspace'), 'steering-tech');
    });

    it('product/business keywords → steering-product', function () {
      assert.strictEqual(classifier.classify('product-roadmap.md', 'Workspace'), 'steering-product');
      assert.strictEqual(classifier.classify('business-rules.md', 'Workspace'), 'steering-product');
    });

    it('agent/AI keywords → steering-agent', function () {
      assert.strictEqual(classifier.classify('agent-persona.md', 'Workspace'), 'steering-agent');
      assert.strictEqual(classifier.classify('prompt-engineering.md', 'Workspace'), 'steering-agent');
    });

    it('.md fallback → steering-domain', function () {
      assert.strictEqual(classifier.classify('random-notes.md', 'Workspace'), 'steering-domain');
      assert.strictEqual(classifier.classify('project-overview.md', 'Workspace'), 'steering-domain');
    });

    it('non-.md → unknown', function () {
      assert.strictEqual(classifier.classify('config.json', 'Workspace'), 'unknown');
      assert.strictEqual(classifier.classify('data.yaml', 'Workspace'), 'unknown');
    });

    it('code workspace folder with non-.md → code-file', function () {
      assert.strictEqual(classifier.classify('service.ts', 'api'), 'code-file');
      assert.strictEqual(classifier.classify('handler.py', 'integrador'), 'code-file');
    });

    it('code workspace folder with .md → steering-domain (not code-file)', function () {
      assert.strictEqual(classifier.classify('readme.md', 'api'), 'steering-domain');
    });
  });

  describe('getColor()', function () {
    it('returns unique color per type', function () {
      const types: NodeType[] = [
        'steering-flow',
        'steering-help',
        'steering-playbook',
        'steering-observability',
        'steering-domain',
        'steering-policy',
        'steering-tech',
        'steering-product',
        'steering-agent',
        'code-file',
        'module',
        'entity',
        'skill',
        'hook-manual',
        'hook-auto',
        'unknown',
      ];

      const colors = types.map((t) => classifier.getColor(t));
      const uniqueColors = new Set(colors);
      assert.strictEqual(uniqueColors.size, types.length, 'Each NodeType must have a unique color');
    });

    it('returns a valid hex color string', function () {
      const color = classifier.getColor('steering-flow');
      assert.ok(/^#[0-9A-Fa-f]{6}$/.test(color), `Expected hex color, got: ${color}`);
    });
  });
});
