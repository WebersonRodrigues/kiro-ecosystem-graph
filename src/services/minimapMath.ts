/**
 * MinimapMath — Pure coordinate mapping functions for the minimap overlay.
 *
 * All functions are pure (no side effects) and testable in Node.js.
 * Used by the webview minimap module for coordinate transformations.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface MinimapBounds {
  width: number;
  height: number;
}

export interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MinimapDot {
  x: number;
  y: number;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MINIMAP_PADDING_FACTOR = 0.9;
const NODE_THRESHOLD = 15;

// ─────────────────────────────────────────────────────────────────────────────
// Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the bounding box of all graph nodes.
 * Returns zero bounds for empty arrays or when all nodes share the same position.
 */
export function computeGraphBounds(nodes: { x: number; y: number }[]): GraphBounds {
  if (nodes.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    if (node.x < minX) { minX = node.x; }
    if (node.x > maxX) { maxX = node.x; }
    if (node.y < minY) { minY = node.y; }
    if (node.y > maxY) { maxY = node.y; }
  }

  // Handle degenerate case: all nodes at same position
  if (maxX - minX === 0) {
    minX -= 1;
    maxX += 1;
  }
  if (maxY - minY === 0) {
    minY -= 1;
    maxY += 1;
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Compute the uniform scale and offsets used for graph↔minimap mapping.
 * Uses aspect-fit with 90% padding to keep dots away from edges.
 */
function computeScaleAndOffset(
  graphBounds: GraphBounds,
  minimapBounds: MinimapBounds,
): { scale: number; offsetX: number; offsetY: number } {
  const graphWidth = graphBounds.maxX - graphBounds.minX;
  const graphHeight = graphBounds.maxY - graphBounds.minY;

  const scaleX = minimapBounds.width / graphWidth;
  const scaleY = minimapBounds.height / graphHeight;
  const scale = Math.min(scaleX, scaleY) * MINIMAP_PADDING_FACTOR;

  const offsetX = (minimapBounds.width - graphWidth * scale) / 2;
  const offsetY = (minimapBounds.height - graphHeight * scale) / 2;

  return { scale, offsetX, offsetY };
}

/**
 * Map a graph coordinate to minimap coordinate space.
 * Result is always within [0, width] × [0, height] of the minimap bounds.
 */
export function mapGraphToMinimap(
  graphX: number,
  graphY: number,
  graphBounds: GraphBounds,
  minimapBounds: MinimapBounds,
): { x: number; y: number } {
  const { scale, offsetX, offsetY } = computeScaleAndOffset(graphBounds, minimapBounds);

  return {
    x: (graphX - graphBounds.minX) * scale + offsetX,
    y: (graphY - graphBounds.minY) * scale + offsetY,
  };
}

/**
 * Map a minimap coordinate back to graph coordinate space.
 * Inverse of mapGraphToMinimap.
 */
export function mapMinimapToGraph(
  minimapX: number,
  minimapY: number,
  graphBounds: GraphBounds,
  minimapBounds: MinimapBounds,
): { x: number; y: number } {
  const { scale, offsetX, offsetY } = computeScaleAndOffset(graphBounds, minimapBounds);

  return {
    x: (minimapX - offsetX) / scale + graphBounds.minX,
    y: (minimapY - offsetY) / scale + graphBounds.minY,
  };
}

/**
 * Compute the viewport indicator rectangle in minimap coordinates.
 * Represents the currently visible area of the main graph canvas.
 */
export function computeViewportIndicator(
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
  panX: number,
  panY: number,
  graphBounds: GraphBounds,
  minimapBounds: MinimapBounds,
): ViewportRect {
  const { scale, offsetX, offsetY } = computeScaleAndOffset(graphBounds, minimapBounds);

  // Visible area in graph coordinates
  const visibleLeft = -panX / zoom;
  const visibleTop = -panY / zoom;
  const visibleWidth = canvasWidth / zoom;
  const visibleHeight = canvasHeight / zoom;

  // Map top-left corner to minimap
  const x = (visibleLeft - graphBounds.minX) * scale + offsetX;
  const y = (visibleTop - graphBounds.minY) * scale + offsetY;

  // Scale dimensions to minimap
  const width = visibleWidth * scale;
  const height = visibleHeight * scale;

  // Ensure minimum size of 10px and cap at minimap dimensions
  return {
    x,
    y,
    width: Math.max(10, Math.min(width, minimapBounds.width)),
    height: Math.max(10, Math.min(height, minimapBounds.height)),
  };
}

/**
 * Determine whether the minimap should be visible.
 * Shows when there are >= 15 visible nodes AND the setting is enabled.
 */
export function shouldShowMinimap(
  visibleNodeCount: number,
  settingEnabled: boolean,
): boolean {
  if (!settingEnabled) {
    return false;
  }
  return visibleNodeCount >= NODE_THRESHOLD;
}

/**
 * Clamp a drag position to stay within minimap bounds.
 */
export function clampDragPosition(
  x: number,
  y: number,
  minimapBounds: MinimapBounds,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, minimapBounds.width)),
    y: Math.max(0, Math.min(y, minimapBounds.height)),
  };
}
