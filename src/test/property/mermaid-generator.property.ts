import * as assert from 'assert';
import * as fc from 'fast-check';

import {
  sanitizeNodeId,
  generateMermaidFlowchart,
} from '../../services/mermaidGenerator';
import type { GraphNode, GraphEdge, NodeType } from '../../types';

const NODE_TYPES: NodeType[] = [
  'steering-flow', 'steering-help', 'steering-playbook',
  'steering-domain', 'steering-policy', 'steering-tech',
  'hook-auto', 'hook-manual', 'skill', 'unknown',
];

function nodeTypeArb(): fc.Arbitrary<NodeType> {
  return fc.constantFrom(...NODE_TYPES);
}

function graphNodeArb(): fc.Arbitrary<GraphNode> {
  return fc.record({
    id: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9/_.-]{0,30}$/),
    label: fc.string({ minLength: 1, maxLength: 20 }),
    type: nodeTypeArb(),
    workspaceFolder: fc.constant('Workspace'),
    filePath: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9/_.-]{0,30}$/),
    resolved: fc.constant(true),
    source: fc.constant('local' as const),
  });
}

function uniqueNodesArb(min: number, max: number): fc.Arbitrary<GraphNode[]> {
  return fc.array(graphNodeArb(), { minLength: min, maxLength: max })
    .map(nodes => {
      const seen = new Set<string>();
      return nodes.filter(n => {
        if (seen.has(n.id)) { return false; }
        seen.add(n.id);
        return true;
      });
    });
}

function graphArb(): fc.Arbitrary<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  return uniqueNodesArb(0, 15).chain(nodes => {
    if (nodes.length < 2) {
      return fc.constant({ nodes, edges: [] as GraphEdge[] });
    }
    const edgeArb = fc.record({
      source: fc.constantFrom(...nodes.map(n => n.id)),
      target: fc.constantFrom(...nodes.map(n => n.id)),
      type: fc.constant('wiki-link' as const),
    }).filter(e => e.source !== e.target);

    return fc.array(edgeArb, { minLength: 0, maxLength: 10 })
      .map(edges => ({ nodes, edges }));
  });
}

describe('MermaidGenerator Property-Based Tests', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 1.1**
   * Property: output always contains "flowchart TD"
   */
  describe('Property: output always contains "flowchart TD"', function () {
    it('any graph produces output with flowchart TD', function () {
      fc.assert(
        fc.property(graphArb(), function ({ nodes, edges }) {
          const output = generateMermaidFlowchart(nodes, edges);
          assert.ok(
            output.includes('flowchart TD'),
            'Output must contain "flowchart TD"',
          );
        }),
        { numRuns: 200 },
      );
    });
  });

  /**
   * **Validates: Requirements 1.4**
   * Property: all sanitized IDs match /^[a-zA-Z0-9_]+$/
   */
  describe('Property: all sanitized IDs match valid pattern', function () {
    it('sanitizeNodeId always produces valid Mermaid IDs', function () {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          function (input) {
            const result = sanitizeNodeId(input);
            if (result.length === 0) { return; }
            assert.ok(
              /^[a-zA-Z0-9_]+$/.test(result),
              `Invalid ID: "${result}" from input "${input}"`,
            );
          },
        ),
        { numRuns: 300 },
      );
    });
  });

  /**
   * **Validates: Requirements 4.1**
   * Property: number of node lines in output <= maxNodes
   */
  describe('Property: node count in output <= maxNodes', function () {
    it('output never exceeds maxNodes node definitions', function () {
      fc.assert(
        fc.property(
          uniqueNodesArb(0, 20),
          fc.integer({ min: 1, max: 10 }),
          function (nodes, maxNodes) {
            const output = generateMermaidFlowchart(nodes, [], maxNodes);
            // Count node definition lines (lines with shape syntax)
            const nodeLines = output.split('\n').filter(line => {
              const trimmed = line.trim();
              return trimmed.length > 0
                && !trimmed.startsWith('%%')
                && !trimmed.startsWith('flowchart')
                && !trimmed.startsWith('classDef')
                && !trimmed.startsWith('class ')
                && !trimmed.includes(' --> ');
            });
            assert.ok(
              nodeLines.length <= maxNodes,
              `Expected <= ${maxNodes} nodes, got ${nodeLines.length}`,
            );
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * **Validates: Requirements 1.5**
   * Property: no unclosed quotes in output (balanced quote pairs)
   */
  describe('Property: no unclosed quotes in output', function () {
    it('output has balanced double quotes', function () {
      fc.assert(
        fc.property(graphArb(), function ({ nodes, edges }) {
          const output = generateMermaidFlowchart(nodes, edges);
          const quoteCount = (output.match(/"/g) || []).length;
          assert.strictEqual(
            quoteCount % 2, 0,
            `Unbalanced quotes: ${quoteCount} quotes found`,
          );
        }),
        { numRuns: 200 },
      );
    });
  });

  /**
   * **Validates: Requirements 7.7**
   * Property: output length is bounded (linear growth, not exponential)
   */
  describe('Property: output length is bounded', function () {
    it('output length grows linearly with node count', function () {
      fc.assert(
        fc.property(uniqueNodesArb(0, 20), function (nodes) {
          const output = generateMermaidFlowchart(nodes, []);
          // Each node contributes at most ~200 chars (ID + label + shape + class)
          // Header is ~150 chars, classDefs ~200 chars
          const maxExpected = 400 + nodes.length * 250;
          assert.ok(
            output.length <= maxExpected,
            `Output too large: ${output.length} chars for ${nodes.length} nodes (max ${maxExpected})`,
          );
        }),
        { numRuns: 200 },
      );
    });
  });
});
