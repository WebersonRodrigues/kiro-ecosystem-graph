import * as assert from 'assert';

import {
  sanitizeNodeId,
  escapeLabel,
  getNodeShape,
  getNodeClass,
  getClassDefs,
  truncateNodes,
  generateMermaidFlowchart,
} from '../../services/mermaidGenerator';
import type { GraphNode, GraphEdge } from '../../types';

function createNode(id: string, label: string, type: GraphNode['type'] = 'steering-domain'): GraphNode {
  return {
    id,
    label,
    type,
    workspaceFolder: 'Workspace',
    filePath: id,
    resolved: true,
    source: 'local',
  };
}

function createEdge(source: string, target: string): GraphEdge {
  return { source, target, type: 'wiki-link' };
}

describe('MermaidGenerator', function () {
  describe('sanitizeNodeId', function () {
    it('replaces special characters with underscores', function () {
      assert.strictEqual(sanitizeNodeId('path/to/file.md'), 'path_to_file_md');
    });

    it('removes leading underscores', function () {
      assert.strictEqual(sanitizeNodeId('/leading/path'), 'leading_path');
    });

    it('removes trailing underscores', function () {
      assert.strictEqual(sanitizeNodeId('trailing/'), 'trailing');
    });

    it('collapses consecutive underscores', function () {
      assert.strictEqual(sanitizeNodeId('a///b'), 'a_b');
    });

    it('handles already valid IDs', function () {
      assert.strictEqual(sanitizeNodeId('validId123'), 'validId123');
    });

    it('handles complex paths with dots and dashes', function () {
      assert.strictEqual(sanitizeNodeId('.kiro/steering/flow-pedido.md'), 'kiro_steering_flow_pedido_md');
    });
  });

  describe('escapeLabel', function () {
    it('escapes double quotes', function () {
      assert.strictEqual(escapeLabel('say "hello"'), 'say #quot;hello#quot;');
    });

    it('escapes square brackets', function () {
      assert.strictEqual(escapeLabel('[test]'), '#lsqb;test#rsqb;');
    });

    it('escapes pipes', function () {
      assert.strictEqual(escapeLabel('a|b'), 'a#pipe;b');
    });

    it('escapes parentheses', function () {
      assert.strictEqual(escapeLabel('fn(x)'), 'fn#lpar;x#rpar;');
    });

    it('handles labels with no special characters', function () {
      assert.strictEqual(escapeLabel('simple label'), 'simple label');
    });
  });

  describe('getNodeShape', function () {
    it('returns rounded rect for steering types', function () {
      const shape = getNodeShape('steering-flow');
      assert.strictEqual(shape.open, '(["');
      assert.strictEqual(shape.close, '"])');
    });

    it('returns hexagon for hook-auto', function () {
      const shape = getNodeShape('hook-auto');
      assert.strictEqual(shape.open, '{{"');
      assert.strictEqual(shape.close, '"}}');
    });

    it('returns hexagon for hook-manual', function () {
      const shape = getNodeShape('hook-manual');
      assert.strictEqual(shape.open, '{{"');
      assert.strictEqual(shape.close, '"}}');
    });

    it('returns circle for skill', function () {
      const shape = getNodeShape('skill');
      assert.strictEqual(shape.open, '(("');
      assert.strictEqual(shape.close, '"))');
    });

    it('returns rectangle for unknown types', function () {
      const shape = getNodeShape('unknown');
      assert.strictEqual(shape.open, '["');
      assert.strictEqual(shape.close, '"]');
    });
  });

  describe('getNodeClass', function () {
    it('maps steering types to "steering"', function () {
      assert.strictEqual(getNodeClass('steering-flow'), 'steering');
      assert.strictEqual(getNodeClass('steering-domain'), 'steering');
    });

    it('maps hook types to "hook"', function () {
      assert.strictEqual(getNodeClass('hook-auto'), 'hook');
      assert.strictEqual(getNodeClass('hook-manual'), 'hook');
    });

    it('maps skill to "skill"', function () {
      assert.strictEqual(getNodeClass('skill'), 'skill');
    });

    it('maps unknown to "unknown"', function () {
      assert.strictEqual(getNodeClass('unknown'), 'unknown');
    });
  });

  describe('getClassDefs', function () {
    it('contains classDef for steering', function () {
      const defs = getClassDefs();
      assert.ok(defs.includes('classDef steering'));
    });

    it('contains classDef for hook', function () {
      const defs = getClassDefs();
      assert.ok(defs.includes('classDef hook'));
    });

    it('contains classDef for skill', function () {
      const defs = getClassDefs();
      assert.ok(defs.includes('classDef skill'));
    });

    it('contains fill colors', function () {
      const defs = getClassDefs();
      assert.ok(defs.includes('fill:#4CAF50'));
      assert.ok(defs.includes('fill:#FF9800'));
      assert.ok(defs.includes('fill:#2196F3'));
    });
  });

  describe('truncateNodes', function () {
    it('returns all nodes when count <= maxNodes', function () {
      const nodes = [createNode('a', 'A'), createNode('b', 'B')];
      const edges: GraphEdge[] = [];
      const result = truncateNodes(nodes, edges, 5);
      assert.strictEqual(result.length, 2);
    });

    it('returns top N by degree when count > maxNodes', function () {
      const nodes = [
        createNode('a', 'A'),
        createNode('b', 'B'),
        createNode('c', 'C'),
      ];
      const edges = [
        createEdge('a', 'b'),
        createEdge('a', 'c'),
        createEdge('b', 'c'),
      ];
      // a has degree 2, b has degree 2, c has degree 2
      // With maxNodes=2, should return 2 nodes
      const result = truncateNodes(nodes, edges, 2);
      assert.strictEqual(result.length, 2);
    });

    it('prioritizes nodes with higher degree', function () {
      const nodes = [
        createNode('hub', 'Hub'),
        createNode('leaf1', 'Leaf1'),
        createNode('leaf2', 'Leaf2'),
        createNode('leaf3', 'Leaf3'),
      ];
      const edges = [
        createEdge('hub', 'leaf1'),
        createEdge('hub', 'leaf2'),
        createEdge('hub', 'leaf3'),
      ];
      // hub has degree 3, leaves have degree 1
      const result = truncateNodes(nodes, edges, 2);
      assert.ok(result.some(n => n.id === 'hub'));
    });
  });

  describe('generateMermaidFlowchart', function () {
    it('output starts with flowchart TD', function () {
      const nodes = [createNode('a', 'NodeA')];
      const edges: GraphEdge[] = [];
      const output = generateMermaidFlowchart(nodes, edges);
      assert.ok(output.includes('flowchart TD'));
    });

    it('all node IDs are present in output', function () {
      const nodes = [
        createNode('path/a.md', 'A'),
        createNode('path/b.md', 'B'),
      ];
      const edges: GraphEdge[] = [];
      const output = generateMermaidFlowchart(nodes, edges);
      assert.ok(output.includes('path_a_md'));
      assert.ok(output.includes('path_b_md'));
    });

    it('edges only between included nodes', function () {
      const nodes = [
        createNode('a', 'A'),
        createNode('b', 'B'),
      ];
      const edges = [
        createEdge('a', 'b'),
        createEdge('a', 'excluded'),
      ];
      const output = generateMermaidFlowchart(nodes, edges);
      assert.ok(output.includes('a --> b'));
      assert.ok(!output.includes('excluded'));
    });

    it('empty graph produces valid output with comment', function () {
      const output = generateMermaidFlowchart([], []);
      assert.ok(output.includes('flowchart TD'));
      assert.ok(output.includes('%% No nodes'));
    });

    it('class assignments are present for each node', function () {
      const nodes = [
        createNode('a', 'A', 'steering-flow'),
        createNode('b', 'B', 'hook-auto'),
      ];
      const output = generateMermaidFlowchart(nodes, []);
      assert.ok(output.includes('class a steering'));
      assert.ok(output.includes('class b hook'));
    });

    it('includes truncation comment when nodes exceed maxNodes', function () {
      const nodes = Array.from({ length: 5 }, (_, i) => createNode(`n${i}`, `N${i}`));
      const edges: GraphEdge[] = [];
      const output = generateMermaidFlowchart(nodes, edges, 3);
      assert.ok(output.includes('Showing 3 of 5'));
      assert.ok(output.includes('2 omitted'));
    });
  });
});
