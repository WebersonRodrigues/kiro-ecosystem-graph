import * as assert from 'assert';
import { GraphDataStore } from '../../services/graphDataStore';
import type { ParseResult, GraphNode, Reference } from '../../types';

function createParseResult(
  nodeId: string,
  references: Partial<Reference>[] = [],
): ParseResult {
  const node: GraphNode = {
    id: nodeId,
    label: nodeId.split('/').pop()!.replace(/\.md$/, ''),
    type: 'steering-domain',
    workspaceFolder: 'Workspace',
    filePath: nodeId,
    resolved: true,
  };

  const refs: Reference[] = references.map((r) => ({
    source: nodeId,
    target: r.target || '',
    type: r.type || 'wiki-link',
    line: r.line || 1,
  }));

  return { node, references: refs };
}

describe('GraphDataStore', function () {
  describe('upsertFile()', function () {
    it('adds node and edges', function () {
      const store = new GraphDataStore();
      const result = createParseResult('.kiro/steering/flow-deploy.md', [
        { target: '.kiro/steering/help-faq.md', type: 'wiki-link' },
      ]);

      store.upsertFile(result);

      const nodes = store.getNodes();
      const edges = store.getEdges();

      assert.strictEqual(nodes.length, 2); // source + unresolved target
      assert.strictEqual(edges.length, 1);
      assert.strictEqual(edges[0].source, '.kiro/steering/flow-deploy.md');
      assert.strictEqual(edges[0].target, '.kiro/steering/help-faq.md');
    });

    it('creates unresolved placeholder for ecosystem targets', function () {
      const store = new GraphDataStore();
      const result = createParseResult('.kiro/steering/flow-deploy.md', [
        { target: '.kiro/steering/unknown-steering.md', type: 'backtick-ref' },
      ]);

      store.upsertFile(result);

      const nodes = store.getNodes();
      const targetNode = nodes.find((n) => n.id === '.kiro/steering/unknown-steering.md');
      assert.ok(targetNode, 'Target node should exist');
      assert.strictEqual(targetNode!.resolved, false);
      assert.strictEqual(targetNode!.label, 'unknown-steering');
    });

    it('skips non-ecosystem targets (defense-in-depth)', function () {
      const store = new GraphDataStore();
      const result: ParseResult = {
        node: {
          id: '.kiro/steering/test.md',
          label: 'test',
          type: 'steering-domain',
          workspaceFolder: 'Workspace',
          filePath: '.kiro/steering/test.md',
          resolved: true,
        },
        references: [
          {
            source: '.kiro/steering/test.md',
            target: 'src/service.ts',
            type: 'wiki-link',
            line: 1,
          },
        ],
      };

      store.upsertFile(result);

      const nodes = store.getNodes();
      const edges = store.getEdges();

      // Only the source node should exist, no edge or target node for .ts
      assert.strictEqual(nodes.length, 1);
      assert.strictEqual(edges.length, 0);
    });

    it('replaces edges on re-parse (isolation property)', function () {
      const store = new GraphDataStore();

      // First parse: references A and B
      const result1 = createParseResult('.kiro/steering/source.md', [
        { target: '.kiro/steering/target-a.md', type: 'wiki-link' },
        { target: '.kiro/steering/target-b.md', type: 'wiki-link' },
      ]);
      store.upsertFile(result1);
      assert.strictEqual(store.getEdges().length, 2);

      // Second parse: only references C (A and B removed)
      const result2 = createParseResult('.kiro/steering/source.md', [
        { target: '.kiro/steering/target-c.md', type: 'wiki-link' },
      ]);
      store.upsertFile(result2);

      const edges = store.getEdges();
      assert.strictEqual(edges.length, 1);
      assert.strictEqual(edges[0].target, '.kiro/steering/target-c.md');
    });

    it('does not affect edges from other sources on re-parse', function () {
      const store = new GraphDataStore();

      // Source A references target X
      const resultA = createParseResult('.kiro/steering/source-a.md', [
        { target: '.kiro/steering/target-x.md', type: 'wiki-link' },
      ]);
      store.upsertFile(resultA);

      // Source B references target Y
      const resultB = createParseResult('.kiro/steering/source-b.md', [
        { target: '.kiro/steering/target-y.md', type: 'wiki-link' },
      ]);
      store.upsertFile(resultB);

      // Re-parse source A with no references
      const resultA2 = createParseResult('.kiro/steering/source-a.md', []);
      store.upsertFile(resultA2);

      const edges = store.getEdges();
      // Only source B's edge should remain
      assert.strictEqual(edges.length, 1);
      assert.strictEqual(edges[0].source, '.kiro/steering/source-b.md');
    });
  });

  describe('removeFile()', function () {
    it('removes node and all associated edges', function () {
      const store = new GraphDataStore();

      // Add source with reference to target
      const result = createParseResult('.kiro/steering/source.md', [
        { target: '.kiro/steering/target.md', type: 'wiki-link' },
      ]);
      store.upsertFile(result);

      // Add another file referencing source
      const result2 = createParseResult('.kiro/steering/other.md', [
        { target: '.kiro/steering/source.md', type: 'backtick-ref' },
      ]);
      store.upsertFile(result2);

      // Remove source
      store.removeFile('.kiro/steering/source.md');

      const nodes = store.getNodes();
      const edges = store.getEdges();

      // Source node should be gone
      assert.ok(!nodes.find((n) => n.id === '.kiro/steering/source.md'));
      // All edges involving source should be gone
      assert.ok(!edges.find((e) => e.source === '.kiro/steering/source.md'));
      assert.ok(!edges.find((e) => e.target === '.kiro/steering/source.md'));
    });

    it('does not affect unrelated nodes and edges', function () {
      const store = new GraphDataStore();

      const result1 = createParseResult('.kiro/steering/a.md', [
        { target: '.kiro/steering/b.md', type: 'wiki-link' },
      ]);
      store.upsertFile(result1);

      const result2 = createParseResult('.kiro/steering/c.md', [
        { target: '.kiro/steering/d.md', type: 'wiki-link' },
      ]);
      store.upsertFile(result2);

      store.removeFile('.kiro/steering/a.md');

      const edges = store.getEdges();
      assert.strictEqual(edges.length, 1);
      assert.strictEqual(edges[0].source, '.kiro/steering/c.md');
    });
  });

  describe('getSerializableGraph()', function () {
    it('returns correct structure', function () {
      const store = new GraphDataStore();
      const result = createParseResult('.kiro/steering/test.md', [
        { target: '.kiro/steering/other.md', type: 'wiki-link' },
      ]);
      store.upsertFile(result);

      const graph = store.getSerializableGraph();
      assert.ok(Array.isArray(graph.nodes));
      assert.ok(Array.isArray(graph.edges));
      assert.strictEqual(graph.nodes.length, 2);
      assert.strictEqual(graph.edges.length, 1);
    });

    it('returns empty graph when no files added', function () {
      const store = new GraphDataStore();
      const graph = store.getSerializableGraph();
      assert.deepStrictEqual(graph, { nodes: [], edges: [] });
    });
  });
});
