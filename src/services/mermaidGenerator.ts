import type { GraphNode, GraphEdge, NodeType } from '../types';

/**
 * Maximum number of nodes in a Mermaid export to avoid rendering issues.
 */
const DEFAULT_MAX_NODES = 50;

/**
 * Color mapping for Mermaid classDef styles, matching the graph visualization.
 */
const MERMAID_CLASS_COLORS: Record<string, string> = {
  steering: '#4CAF50',
  hook: '#FF9800',
  skill: '#2196F3',
  unknown: '#9E9E9E',
};

/**
 * Sanitizes a file path into a valid Mermaid node ID.
 * Replaces special characters with underscores, collapses consecutive
 * underscores, and removes leading/trailing underscores.
 */
export function sanitizeNodeId(filePath: string): string {
  return filePath
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');
}

/**
 * Escapes special Mermaid characters in labels to prevent syntax errors.
 * Replaces quotes, brackets, pipes, and parentheses with Mermaid HTML entities.
 */
export function escapeLabel(label: string): string {
  return label
    .replace(/"/g, '#quot;')
    .replace(/\[/g, '#lsqb;')
    .replace(/\]/g, '#rsqb;')
    .replace(/\|/g, '#pipe;')
    .replace(/\(/g, '#lpar;')
    .replace(/\)/g, '#rpar;');
}

/**
 * Returns the Mermaid shape delimiters for a given NodeType.
 * - Steerings: rounded rectangle (["..."])
 * - Hooks: hexagon ({{"..."}})
 * - Skills: circle (("..."))
 * - Other: rectangle ["..."]
 */
export function getNodeShape(nodeType: NodeType): { open: string; close: string } {
  if (nodeType.startsWith('steering-')) {
    return { open: '(["', close: '"])' };
  }
  if (nodeType === 'hook-auto' || nodeType === 'hook-manual') {
    return { open: '{{"', close: '"}}' };
  }
  if (nodeType === 'skill') {
    return { open: '(("', close: '"))' };
  }
  return { open: '["', close: '"]' };
}

/**
 * Maps a NodeType to its Mermaid CSS class name.
 */
export function getNodeClass(nodeType: NodeType): string {
  if (nodeType.startsWith('steering-')) {
    return 'steering';
  }
  if (nodeType === 'hook-auto' || nodeType === 'hook-manual') {
    return 'hook';
  }
  if (nodeType === 'skill') {
    return 'skill';
  }
  return 'unknown';
}

/**
 * Generates classDef lines for Mermaid styling.
 * Each class corresponds to a node category with its assigned color.
 */
export function getClassDefs(): string {
  const lines: string[] = [];
  for (const [className, color] of Object.entries(MERMAID_CLASS_COLORS)) {
    lines.push(`  classDef ${className} fill:${color},stroke:#333,color:#fff`);
  }
  return lines.join('\n');
}

/**
 * Selects the top N most connected nodes by degree (incoming + outgoing edges).
 * Returns all nodes if count is within the limit.
 */
export function truncateNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxNodes: number,
): GraphNode[] {
  if (nodes.length <= maxNodes) {
    return nodes;
  }

  const degree = new Map<string, number>();
  for (const node of nodes) {
    degree.set(node.id, 0);
  }
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  }

  return [...nodes]
    .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))
    .slice(0, maxNodes);
}

/**
 * Generates a complete Mermaid flowchart string from graph nodes and edges.
 * Includes header comments, node definitions, edges, class definitions,
 * and class assignments. Truncates large graphs to maxNodes.
 */
export function generateMermaidFlowchart(
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxNodes: number = DEFAULT_MAX_NODES,
): string {
  const lines: string[] = [];

  lines.push('%% Kiro Ecosystem Graph — Mermaid Export');
  lines.push(`%% Generated: ${new Date().toISOString()}`);
  lines.push('%% Colors: green=steering, orange=hook, blue=skill');
  lines.push('flowchart TD');
  lines.push('');

  if (nodes.length === 0) {
    lines.push('  %% No nodes in the current view');
    return lines.join('\n');
  }

  const selected = truncateNodes(nodes, edges, maxNodes);
  const selectedIds = new Set(selected.map(n => n.id));

  if (selected.length < nodes.length) {
    const omitted = nodes.length - selected.length;
    lines.push(`  %% Showing ${selected.length} of ${nodes.length} nodes (${omitted} omitted)`);
    lines.push('');
  }

  lines.push('  %% Nodes');
  for (const node of selected) {
    const id = sanitizeNodeId(node.id);
    const label = escapeLabel(node.label);
    const shape = getNodeShape(node.type);
    lines.push(`  ${id}${shape.open}${label}${shape.close}`);
  }

  lines.push('');
  lines.push('  %% Edges');
  for (const edge of edges) {
    if (!selectedIds.has(edge.source) || !selectedIds.has(edge.target)) {
      continue;
    }
    const sourceId = sanitizeNodeId(edge.source);
    const targetId = sanitizeNodeId(edge.target);
    lines.push(`  ${sourceId} --> ${targetId}`);
  }

  lines.push('');
  lines.push('  %% Class Definitions');
  lines.push(getClassDefs());

  lines.push('');
  lines.push('  %% Class Assignments');
  for (const node of selected) {
    const cls = getNodeClass(node.type);
    const id = sanitizeNodeId(node.id);
    lines.push(`  class ${id} ${cls}`);
  }

  return lines.join('\n');
}
