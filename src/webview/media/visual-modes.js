/**
 * Ecosystem Graph — Visual Modes
 *
 * Provides state flags and helper functions for advanced visual modes.
 * This module does NOT render anything — it supplies data/state that
 * webview.js reads during its Canvas 2D rendering passes.
 *
 * Features:
 *  - Activity Heatmap (color temperature by mtime)
 *  - Complexity Score (node radius scaling by lineCount)
 *  - Dependency Depth (eccentricity badge)
 *  - Depth of Field (opacity/blur falloff from center)
 *  - Constellation Mode (MST per type group)
 *  - Synaptic Strength (edge brightness by source mtime)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Color map reference (same as webview.js — used by constellation mode)
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable no-unused-vars */

var VISUAL_MODES_COLOR_MAP = {
  'steering-flow': '#4A9EFF',
  'steering-help': '#4CAF50',
  'steering-playbook': '#FF9800',
  'steering-observability': '#9C27B0',
  'steering-domain': '#009688',
  'code-file': '#90A4AE',
  'module': '#FFC107',
  'entity': '#E91E63',
  'unknown': '#607D8B'
};

// ─────────────────────────────────────────────────────────────────────────────
// Activity Heatmap (Requirement 6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether activity heatmap mode is currently active.
 * When true, webview.js should override node colors with heatmap values.
 * @type {boolean}
 */
var activityHeatmapActive = false;

/**
 * Enable activity heatmap mode.
 * Nodes will be colored by recency of file modification.
 */
function enableActivityHeatmap() {
  activityHeatmapActive = true;
}

/**
 * Disable activity heatmap mode.
 * Nodes revert to their original type-based COLOR_MAP colors.
 */
function disableActivityHeatmap() {
  activityHeatmapActive = false;
}

/**
 * Compute heatmap color for a node based on its mtime.
 * Color interpolation: 0 days since edit -> #FF4444 (hot red),
 * 30+ days -> #4444FF (cold blue). Linear RGB interpolation.
 *
 * @param {number|undefined|null} mtime - Last modification timestamp (ms)
 * @returns {string|null} CSS rgb() color string, or null if mtime unavailable
 */
function getHeatmapColor(mtime) {
  if (!mtime) return null;
  var daysSinceEdit = (Date.now() - mtime) / (24 * 60 * 60 * 1000);
  var ratio = Math.min(daysSinceEdit / 30, 1); // 0 = just edited, 1 = 30+ days
  // Interpolate: red(0) -> blue(1)
  var r = Math.round(255 * (1 - ratio) + 68 * ratio);
  var g = Math.round(68 * (1 - ratio) + 68 * ratio);
  var b = Math.round(68 * (1 - ratio) + 255 * ratio);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

/**
 * Determine if a node should have increased pulse animation.
 * Nodes edited within the last 7 days get enhanced pulse.
 *
 * @param {number|undefined|null} mtime - Last modification timestamp (ms)
 * @returns {boolean} True if node was edited within 7 days
 */
function shouldPulseIntensely(mtime) {
  if (!mtime) return false;
  var daysSinceEdit = (Date.now() - mtime) / (24 * 60 * 60 * 1000);
  return daysSinceEdit <= 7;
}

// ─────────────────────────────────────────────────────────────────────────────
// Complexity Score (Requirement 7)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute node radius scaled by line count (complexity).
 * 100 lines = baseSize, 500+ lines = baseSize * 2.
 *
 * @param {number|undefined|null} lineCount - Number of lines in the file
 * @param {number} baseSize - Base node radius (e.g. NODE_BASE_SIZE)
 * @returns {number} Scaled radius
 */
function getComplexityRadius(lineCount, baseSize) {
  if (!lineCount || lineCount <= 0) return baseSize;
  // Scale: 100 lines = baseSize, 500+ lines = baseSize * 2
  var scale = 1 + Math.min(lineCount / 500, 1);
  return baseSize * scale;
}

/**
 * Determine if a node should show a complexity warning indicator.
 * Threshold: 500+ lines triggers an orange triangle warning.
 *
 * @param {number|undefined|null} lineCount - Number of lines in the file
 * @returns {boolean} True if lineCount >= 500
 */
function shouldShowComplexityWarning(lineCount) {
  return lineCount != null && lineCount >= 500;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dependency Depth Display (Requirement 8)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the badge data for a node's dependency depth (eccentricity).
 * Returns text and color for rendering a numeric badge on the node.
 *
 * - Infinity -> infinity symbol, orange (unreachable/island node)
 * - >= 4 -> numeric, orange (potentially isolated)
 * - < 4 -> numeric, gray (normal)
 * - null/undefined -> no badge
 *
 * @param {number|undefined|null} eccentricity - Max shortest path from this node
 * @returns {{text: string, color: string}|null} Badge data or null
 */
function getDependencyBadge(eccentricity) {
  if (eccentricity === undefined || eccentricity === null) return null;
  if (eccentricity === Infinity) return { text: '\u221E', color: '#FF9800' };
  if (eccentricity >= 4) return { text: String(eccentricity), color: '#FF9800' };
  return { text: String(eccentricity), color: '#888888' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Depth of Field (Requirement 13)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether depth of field mode is currently active.
 * When true, webview.js should adjust opacity and blur based on distance from center.
 * @type {boolean}
 */
var depthOfFieldActive = false;

/**
 * Enable depth of field mode.
 * Nodes farther from center appear with reduced opacity and blur.
 */
function enableDepthOfField() {
  depthOfFieldActive = true;
}

/**
 * Disable depth of field mode.
 * All nodes render with uniform sharpness.
 */
function disableDepthOfField() {
  depthOfFieldActive = false;
}

/**
 * Compute depth of field factors for a node based on its distance from center.
 * Returns opacity multiplier (0.5 to 1.0) and blur multiplier (0.5 to 1.0).
 *
 * - Nodes within 50% of maxDistance: full sharpness (1.0, 1.0)
 * - Nodes from 50% to 100%: linear falloff to (0.5, 0.5)
 *
 * @param {number} nodeX - Node X coordinate in graph space
 * @param {number} nodeY - Node Y coordinate in graph space
 * @param {number} maxDistance - Maximum node distance from center in the graph
 * @returns {{opacity: number, blur: number}} Multiplier factors
 */
function getDepthOfFieldFactors(nodeX, nodeY, maxDistance) {
  if (!depthOfFieldActive || maxDistance <= 0) return { opacity: 1, blur: 1 };
  var dist = Math.sqrt(nodeX * nodeX + nodeY * nodeY);
  var ratio = dist / maxDistance;
  if (ratio <= 0.5) return { opacity: 1, blur: 1 };
  // Linear falloff from 50% to 100% of max distance
  var falloff = (ratio - 0.5) / 0.5; // 0 at 50%, 1 at 100%
  return {
    opacity: 1 - falloff * 0.5,
    blur: 1 - falloff * 0.5
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constellation Mode (Requirement 14)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether constellation mode is currently active.
 * When true, webview.js should render MST edges as a background layer.
 * @type {boolean}
 */
var constellationModeActive = false;

/**
 * Array of MST edges to render as constellation lines.
 * Each entry: { sourceId, targetId, color }
 * @type {Array<{sourceId: string, targetId: string, color: string}>}
 */
var constellationEdges = [];

/**
 * Enable constellation mode. Computes MST per type group using Kruskal's
 * algorithm with union-find, then stores edges for background rendering.
 *
 * @param {{nodes: Array<{type: string, x?: number, y?: number}>}} graphData - Current graph data
 */
function enableConstellationMode(graphData) {
  constellationModeActive = true;
  constellationEdges = computeConstellationMST(graphData);
}

/**
 * Disable constellation mode. Clears all constellation edges.
 */
function disableConstellationMode() {
  constellationModeActive = false;
  constellationEdges = [];
}

/**
 * Compute minimum spanning tree edges per type group using Kruskal's algorithm.
 * Groups nodes by type, then for each group with 2+ nodes, computes pairwise
 * Euclidean distances, sorts by distance, and builds MST via union-find.
 *
 * @param {{nodes: Array<{type: string, x?: number, y?: number}>}} graphData - Graph data
 * @returns {Array<{sourceX: number, sourceY: number, targetX: number, targetY: number, color: string}>}
 */
function computeConstellationMST(graphData) {
  var edges = [];
  if (!graphData || !graphData.nodes) return edges;

  // Group nodes by type
  var groups = {};
  graphData.nodes.forEach(function(n) {
    var type = n.type || 'unknown';
    if (!groups[type]) groups[type] = [];
    groups[type].push(n);
  });

  Object.keys(groups).forEach(function(type) {
    var nodes = groups[type];
    if (nodes.length < 2) return;
    var color = VISUAL_MODES_COLOR_MAP[type] || '#607D8B';

    // Compute all pairwise distances
    var candidates = [];
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = (nodes[i].x || 0) - (nodes[j].x || 0);
        var dy = (nodes[i].y || 0) - (nodes[j].y || 0);
        candidates.push({
          a: i,
          b: j,
          dist: Math.sqrt(dx * dx + dy * dy),
          nodeA: nodes[i],
          nodeB: nodes[j]
        });
      }
    }
    candidates.sort(function(a, b) { return a.dist - b.dist; });

    // Union-Find
    var parent = [];
    for (var k = 0; k < nodes.length; k++) parent[k] = k;

    function find(x) {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]]; // path compression
        x = parent[x];
      }
      return x;
    }

    function union(x, y) {
      parent[find(x)] = find(y);
    }

    // Kruskal's: pick shortest edges that don't form cycles
    var edgeCount = 0;
    for (var e = 0; e < candidates.length && edgeCount < nodes.length - 1; e++) {
      var c = candidates[e];
      if (find(c.a) !== find(c.b)) {
        union(c.a, c.b);
        edges.push({
          sourceId: c.nodeA.id,
          targetId: c.nodeB.id,
          color: color
        });
        edgeCount++;
      }
    }
  });

  return edges;
}

// ─────────────────────────────────────────────────────────────────────────────
// Synaptic Strength (Requirement 15)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether synaptic strength mode is currently active.
 * When true, webview.js should vary edge opacity/width based on source mtime.
 * @type {boolean}
 */
var synapticStrengthActive = false;

/**
 * Enable synaptic strength mode.
 * Edges from recently-edited sources appear brighter and thicker.
 */
function enableSynapticStrength() {
  synapticStrengthActive = true;
}

/**
 * Disable synaptic strength mode.
 * Edges revert to default EDGE_DEFAULT_OPACITY and EDGE_DEFAULT_WIDTH.
 */
function disableSynapticStrength() {
  synapticStrengthActive = false;
}

/**
 * Compute edge style (opacity and width) based on source node mtime.
 *
 * - Within 7 days: opacity 0.7, width 1.5px (full brightness)
 * - 30+ days: opacity 0.05, width 0.3px (minimum brightness)
 * - Between 7-30 days: linear interpolation
 *
 * @param {number|undefined|null} sourceMtime - Source node's last modification timestamp (ms)
 * @returns {{opacity: number, width: number}|null} Style object, or null if mtime unavailable
 */
function getSynapticStrengthStyle(sourceMtime) {
  if (!synapticStrengthActive || !sourceMtime) return null;
  var daysSinceEdit = (Date.now() - sourceMtime) / (24 * 60 * 60 * 1000);

  if (daysSinceEdit <= 7) return { opacity: 0.7, width: 1.5 };
  if (daysSinceEdit >= 30) return { opacity: 0.05, width: 0.3 };

  // Linear interpolation between 7 and 30 days
  var ratio = (daysSinceEdit - 7) / (30 - 7);
  return {
    opacity: 0.7 - ratio * 0.65,
    width: 1.5 - ratio * 1.2
  };
}

/* eslint-enable no-unused-vars */
