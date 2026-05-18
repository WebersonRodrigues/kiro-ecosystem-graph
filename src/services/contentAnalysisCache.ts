import { createHash } from 'crypto';

import type { ContentMetrics } from './contentAnalyzer';

/**
 * Internal cache entry storing metrics and access timestamp for LRU eviction.
 */
interface CacheEntry {
  metrics: ContentMetrics;
  lastAccessed: number;
}

/**
 * LRU in-memory cache for ContentMetrics keyed by content hash.
 * Maximum capacity defaults to 500 entries. When full, the least recently
 * used entry is evicted on the next `set()` call.
 */
export class ContentAnalysisCache {
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly pathToHash: Map<string, string> = new Map();
  private readonly maxCapacity: number;

  constructor(maxCapacity = 500) {
    this.maxCapacity = maxCapacity;
  }

  /**
   * Retrieves cached metrics by content hash. Updates lastAccessed on hit.
   */
  get(contentHash: string): ContentMetrics | undefined {
    const entry = this.cache.get(contentHash);
    if (!entry) {
      return undefined;
    }
    entry.lastAccessed = Date.now();
    // Move to end of Map for LRU ordering (delete + re-insert)
    this.cache.delete(contentHash);
    this.cache.set(contentHash, entry);
    return entry.metrics;
  }

  /**
   * Stores metrics in the cache keyed by content hash.
   * Evicts the least recently used entry if at capacity.
   */
  set(contentHash: string, metrics: ContentMetrics): void {
    if (this.cache.has(contentHash)) {
      this.cache.delete(contentHash);
    } else if (this.cache.size >= this.maxCapacity) {
      this.evictLRU();
    }
    this.cache.set(contentHash, { metrics, lastAccessed: Date.now() });
  }

  /**
   * Registers the mapping from a file path to its content hash.
   * Used for path-based invalidation.
   */
  registerPath(filePath: string, contentHash: string): void {
    this.pathToHash.set(filePath, contentHash);
  }

  /**
   * Invalidates the cache entry associated with a file path.
   * Removes both the path→hash mapping and the hash→metrics entry.
   */
  invalidateByPath(filePath: string): void {
    const hash = this.pathToHash.get(filePath);
    if (hash) {
      this.cache.delete(hash);
      this.pathToHash.delete(filePath);
    }
  }

  /**
   * Clears all cache entries and path mappings.
   */
  clear(): void {
    this.cache.clear();
    this.pathToHash.clear();
  }

  /**
   * Returns the current number of cached entries.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Evicts the least recently used entry (first item in Map iteration order).
   */
  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }
}

/**
 * Computes an MD5 hex hash of the given content string.
 * Used as cache key for content-based deduplication.
 */
export function computeContentHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}
