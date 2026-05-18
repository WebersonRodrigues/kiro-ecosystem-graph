import type { GraphNode } from '../types';
import type { ContentMetrics } from './contentAnalyzer';
import { analyzeContent } from './contentAnalyzer';
import { ContentAnalysisCache, computeContentHash } from './contentAnalysisCache';

/**
 * Provides content analysis metrics lazily — checks cache before computing.
 * Sits between the parser and the graph store as an optimization layer.
 */
export class LazyContentProvider {
  private readonly cache: ContentAnalysisCache;

  constructor(cache?: ContentAnalysisCache) {
    this.cache = cache ?? new ContentAnalysisCache();
  }

  /**
   * Ensures all steering nodes have content metrics populated.
   * For each steering node: checks cache → hit returns cached, miss computes and stores.
   * Non-steering nodes and nodes without content in the map are skipped.
   */
  ensureMetrics(nodes: GraphNode[], contentMap: Map<string, string>): GraphNode[] {
    for (const node of nodes) {
      if (!this.isSteeringNode(node)) {
        continue;
      }
      const content = contentMap.get(node.filePath);
      if (!content) {
        continue;
      }
      this.populateNodeMetrics(node, content);
    }
    return nodes;
  }

  /**
   * Computes or retrieves cached metrics for a single node and applies them.
   */
  private populateNodeMetrics(node: GraphNode, content: string): void {
    const hash = computeContentHash(content);
    const cached = this.cache.get(hash);

    if (cached) {
      this.applyMetrics(node, cached);
    } else {
      const metrics = analyzeContent(content);
      this.cache.set(hash, metrics);
      this.cache.registerPath(node.filePath, hash);
      this.applyMetrics(node, metrics);
    }
  }

  /**
   * Applies content metrics to a node's metadata.
   */
  private applyMetrics(node: GraphNode, metrics: ContentMetrics): void {
    node.metadata = {
      ...node.metadata,
      keywords: metrics.keywords,
      sectionHeaders: metrics.sectionHeaders,
      actionableRatio: metrics.actionableRatio,
      imperativeLines: metrics.imperativeLines,
    };
  }

  /**
   * Invalidates the cache entry for a given file path.
   */
  invalidate(filePath: string): void {
    this.cache.invalidateByPath(filePath);
  }

  /**
   * Returns the underlying cache instance (for testing).
   */
  getCache(): ContentAnalysisCache {
    return this.cache;
  }

  /**
   * Checks if a node is a steering type (eligible for content analysis).
   */
  private isSteeringNode(node: GraphNode): boolean {
    return node.type.startsWith('steering-');
  }
}
