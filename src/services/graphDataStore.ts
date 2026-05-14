import * as path from 'path';
import { GraphNode, GraphEdge, ParseResult, SerializedGraph } from '../types';
import { NodeClassifier } from './nodeClassifier';

/**
 * In-memory store for the ecosystem graph.
 * Maintains nodes and edges with support for incremental updates —
 * only the nodes/edges associated with a changed file are modified on upsert.
 */
export class GraphDataStore {
  /** Map of node id → GraphNode for O(1) lookup */
  private nodes: Map<string, GraphNode> = new Map();

  /** All edges in the graph */
  private edges: GraphEdge[] = [];

  /** Classifier for determining node types */
  private readonly nodeClassifier: NodeClassifier;

  constructor(nodeClassifier?: NodeClassifier) {
    this.nodeClassifier = nodeClassifier || new NodeClassifier();
  }

  /**
   * Returns all nodes currently in the graph.
   */
  getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Returns all edges currently in the graph.
   */
  getEdges(): GraphEdge[] {
    return [...this.edges];
  }

  /**
   * Adds or updates nodes and edges for a single parsed file.
   * Only modifies nodes/edges associated with the changed file (isolation property).
   *
   * Steps:
   * 1. Remove existing edges where source matches the file's node id
   * 2. Add/update the file's node
   * 3. For each reference, ensure target node exists (create as unresolved if not)
   * 4. Add new edges from the references
   *
   * @param result - The parse result containing the file's node and its references
   */
  upsertFile(result: ParseResult): void {
    const { node, references } = result;

    // 1. Remove existing edges where source matches this file's node id
    this.edges = this.edges.filter(edge => edge.source !== node.id);

    // 2. Add or update the file's node
    this.nodes.set(node.id, node);

    // 3. For each reference, ensure target node exists
    for (const ref of references) {
      if (!this.nodes.has(ref.target)) {
        // Create unresolved placeholder node for the target
        const label = this.deriveLabelFromPath(ref.target);
        const fileName = path.basename(ref.target);
        const nodeType = this.nodeClassifier.classify(fileName, '', true);
        const unresolvedNode: GraphNode = {
          id: ref.target,
          label,
          type: nodeType,
          workspaceFolder: '',
          filePath: ref.target,
          resolved: false,
        };
        this.nodes.set(ref.target, unresolvedNode);
      }
    }

    // 4. Add new edges from the references
    for (const ref of references) {
      const edge: GraphEdge = {
        source: ref.source,
        target: ref.target,
        type: ref.type,
      };
      this.edges.push(edge);
    }
  }

  /**
   * Removes a node and all edges where source OR target matches the given file path.
   *
   * @param filePath - The node id (relative path) of the file to remove
   */
  removeFile(filePath: string): void {
    // Remove the node
    this.nodes.delete(filePath);

    // Remove all edges where source or target matches
    this.edges = this.edges.filter(
      edge => edge.source !== filePath && edge.target !== filePath
    );
  }

  /**
   * Returns a serializable representation of the graph (no circular references).
   * Suitable for sending to the webview via postMessage.
   */
  getSerializableGraph(): SerializedGraph {
    return {
      nodes: this.getNodes(),
      edges: this.getEdges(),
    };
  }

  /**
   * Derives a display label from a file path.
   * Uses the basename without extension.
   *
   * @param targetPath - The file path to derive a label from
   * @returns The basename without extension
   */
  private deriveLabelFromPath(targetPath: string): string {
    const basename = path.basename(targetPath);
    const ext = path.extname(basename);
    return ext ? basename.slice(0, -ext.length) : basename;
  }
}
