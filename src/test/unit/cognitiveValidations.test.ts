import * as assert from 'assert';
import { computeFragileLinks } from '../../services/cognitiveValidations';
import type { GraphNode, GraphEdge } from '../../types';

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

describe('CognitiveValidations — computeFragileLinks()', function () {
  it('includes backtick-ref edges from always-loaded sources', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'always' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].sourceLabel, 'a');
  });

  it('includes backtick-ref edges from auto-loaded sources', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'auto' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 1);
  });

  it('includes backtick-ref edges from hook sources', function () {
    const nodes: GraphNode[] = [
      makeNode('hook.json', { type: 'hook-auto', metadata: { inclusion: 'fileMatch' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'hook.json', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 1);
  });

  it('excludes backtick-ref edges from fileMatch sources', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'fileMatch' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('excludes backtick-ref edges from manual sources', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'manual' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('excludes non-backtick-ref edges', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'always' } }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'wiki-link' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('returns empty when all sources are fileMatch/manual', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: { inclusion: 'fileMatch' } }),
      makeNode('b.md', { metadata: { inclusion: 'manual' } }),
      makeNode('c.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'c.md', type: 'backtick-ref' },
      { source: 'b.md', target: 'c.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 0);
  });

  it('mixed sources: only includes always/auto/hook edges', function () {
    const nodes: GraphNode[] = [
      makeNode('always.md', { metadata: { inclusion: 'always' } }),
      makeNode('manual.md', { metadata: { inclusion: 'manual' } }),
      makeNode('hook.json', { type: 'hook-manual' }),
      makeNode('target.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'always.md', target: 'target.md', type: 'backtick-ref' },
      { source: 'manual.md', target: 'target.md', type: 'backtick-ref' },
      { source: 'hook.json', target: 'target.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 2);
    const sources = result.map((r) => r.source);
    assert.ok(sources.includes('always.md'));
    assert.ok(sources.includes('hook.json'));
    assert.ok(!sources.includes('manual.md'));
  });

  it('source without metadata defaults to always (included)', function () {
    const nodes: GraphNode[] = [
      makeNode('a.md', { metadata: undefined }),
      makeNode('b.md'),
    ];
    const edges: GraphEdge[] = [
      { source: 'a.md', target: 'b.md', type: 'backtick-ref' },
    ];
    const result = computeFragileLinks(nodes, edges);
    assert.strictEqual(result.length, 1);
  });
});
