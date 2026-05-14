/**
 * Ecosystem Graph — Webview JavaScript
 *
 * Runs inside the VS Code webview panel. Renders an interactive force-directed
 * graph with a neural network visual aesthetic using the ForceGraph library.
 *
 * ForceGraph is loaded globally via a script tag in the HTML.
 * Communication with the extension host is via acquireVsCodeApi().
 */

// ─────────────────────────────────────────────────────────────────────────────
// VS Code API
// ─────────────────────────────────────────────────────────────────────────────

// @ts-ignore — acquireVsCodeApi is injected by VS Code webview runtime
const vscode = acquireVsCodeApi();

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  'steering-flow': '#4A9EFF',
  'steering-help': '#4CAF50',
  'steering-playbook': '#FF9800',
  'steering-observability': '#9C27B0',
  'steering-domain': '#009688',
  'steering-policy': '#F44336',
  'steering-tech': '#00BCD4',
  'steering-product': '#8BC34A',
  'steering-agent': '#FF5722',
  'code-file': '#90A4AE',
  'module': '#FFC107',
  'entity': '#E91E63',
  'skill': '#B388FF',
  'hook-manual': '#64B5F6',
  'hook-auto': '#7C4DFF',
  'unknown': '#607D8B',
};

const NODE_BASE_SIZE = 4;
const NODE_SCALE_FACTOR = 1.5;
const LABEL_ZOOM_THRESHOLD = 1.5;
const LABEL_FONT_SIZE = 11;

// Glow effect
const GLOW_MIN_BLUR = 8;
const GLOW_MAX_BLUR = 20;

// Edge rendering
const EDGE_DEFAULT_OPACITY = 0.12;
const EDGE_HOVER_OPACITY = 0.7;
const EDGE_DEFAULT_WIDTH = 0.5;
const EDGE_HOVER_WIDTH = 1.5;

// Impulse particles
const PARTICLE_SPEED = 0.008;
const PARTICLE_SIZE = 1.5;
const PARTICLE_COUNT_BASE = 1;
const PARTICLE_COUNT_MAX = 3;

// Ambient background particles
const AMBIENT_PARTICLE_COUNT = 45;

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/** @type {{ nodes: any[], links: any[] }} */
let graphData = { nodes: [], links: [] };

/** @type {Map<string, number>} node id -> degree */
let degreeMap = new Map();

/** @type {any} Currently hovered node */
let hoveredNode = null;

/** @type {Set<string>} IDs of nodes adjacent to hovered node */
let highlightedNodes = new Set();

/** @type {Set<string>} Edge keys (source-target) connected to hovered node */
let highlightedLinks = new Set();

/** @type {Array<{x: number, y: number, size: number, opacity: number, vx: number, vy: number}>} */
let ambientParticles = [];

/** @type {Map<string, number>} nodeId -> propagation level (0=hovered, 1=first hop, 2=second hop) */
var propagationLevel = new Map();

/** @type {Array<number>} Active setTimeout IDs for propagation delays */
var propagationTimers = [];

/** @type {Array<{date: string, nodeCount: number, edgeCount: number}>} Stats history for sparkline */
var statsHistory = [];

/** @type {Array<{source: string, target: string, text: string}>} Edge annotations from extension */
var annotations = [];

/** @type {Array<{source: string, target: string, sharedTerms: string[], score: number}>} Gap detector: suggested connections */
var gapSuggestions = [];

/** @type {Array<{nodeId: string, daysSinceEdit: number}>} Gap detector: dead zone nodes */
var deadZones = [];

/** @type {Array<{folder: string, fileCount: number, level: string}>} Gap detector: coverage map */
var coverageMap = [];

/** @type {Array<{nodeA: string, nodeB: string, sharedTargets: string[]}>} Gap detector: redundancy pairs */
var redundancyPairs = [];

// Default settings — tuned for Obsidian-like graph appearance
// Based on d3-force defaults: charge=-30, link distance=30, center strength=1
// Obsidian uses stronger repulsion and longer link distances for readability
let settings = {
  centerForce: 0.05,
  repulsionForce: -150,
  linkForce: 0.3,
  linkDistance: 70,
  nodeSizeMultiplier: 1,
  linkWidth: 0.5,
  showArrows: false,
  labelMode: 'auto',
  showOnlyExisting: false,
  showOrphans: true,
};

// Load saved state
const savedState = vscode.getState();
if (savedState && savedState.settings) {
  settings = { ...settings, ...savedState.settings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Degree Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-compute degree (number of connections) for each node.
 * @param {{ nodes: any[], links: any[] }} data
 */
function computeDegrees(data) {
  degreeMap = new Map();
  data.nodes.forEach(function (n) {
    degreeMap.set(n.id, 0);
  });
  data.links.forEach(function (link) {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    degreeMap.set(sourceId, (degreeMap.get(sourceId) || 0) + 1);
    degreeMap.set(targetId, (degreeMap.get(targetId) || 0) + 1);
  });
}

/**
 * Get the rendered size of a node based on its degree.
 * @param {any} node
 * @returns {number}
 */
function getNodeSize(node) {
  const degree = degreeMap.get(node.id) || 0;
  return (NODE_BASE_SIZE + degree * NODE_SCALE_FACTOR) * settings.nodeSizeMultiplier;
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge Weight Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pre-compute edge weights by collapsing duplicate source→target pairs.
 * Multiple edges between the same source and target are merged into a single
 * edge with a weight property equal to the count of originals.
 * Also tracks all distinct reference types in the merged edges.
 * @param {Array} links - Raw links from graph data
 * @returns {Array} Deduplicated links with weight and types properties
 */
function computeEdgeWeights(links) {
  var weightMap = {};
  links.forEach(function(link) {
    var key = link.source + '->' + link.target;
    if (!weightMap[key]) {
      weightMap[key] = { source: link.source, target: link.target, weight: 0, type: link.type, types: [] };
    }
    weightMap[key].weight++;
    if (link.type && weightMap[key].types.indexOf(link.type) === -1) {
      weightMap[key].types.push(link.type);
    }
  });
  return Object.values(weightMap);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ambient Particles
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize ambient background particles with radial probability distribution.
 * Particles within 30% of canvas radius from center get 3x spawn probability
 * via rejection sampling.
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function initAmbientParticles(width, height) {
  ambientParticles = [];
  var centerX = width / 2;
  var centerY = height / 2;
  var canvasRadius = Math.min(width, height) / 2;
  var innerRadius = canvasRadius * 0.3; // 30% of canvas radius

  for (var i = 0; i < AMBIENT_PARTICLE_COUNT; i++) {
    var x, y;
    // Rejection sampling: generate random position, accept with higher probability near center
    var accepted = false;
    while (!accepted) {
      x = Math.random() * width;
      y = Math.random() * height;
      var dx = x - centerX;
      var dy = y - centerY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      // Particles within innerRadius: accept with probability 1.0 (3x base)
      // Particles outside innerRadius: accept with probability 1/3
      if (dist <= innerRadius) {
        accepted = true;
      } else {
        accepted = Math.random() < (1 / 3);
      }
    }

    ambientParticles.push({
      x: x,
      y: y,
      size: 0.5 + Math.random() * 1.0,       // 0.5 - 1.5 px
      opacity: 0.1 + Math.random() * 0.2,     // 0.1 - 0.3
      vx: (Math.random() - 0.5) * 0.2,        // -0.1 to 0.1 px/frame
      vy: (Math.random() - 0.5) * 0.2,        // -0.1 to 0.1 px/frame
    });
  }
}

/**
 * Update ambient particle positions per frame with screen wrapping.
 * Particles that drift off one edge reappear on the opposite side.
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function updateAmbientParticles(width, height) {
  for (var i = 0; i < ambientParticles.length; i++) {
    var p = ambientParticles[i];
    p.x += p.vx;
    p.y += p.vy;

    // Wrap horizontally
    if (p.x < 0) { p.x += width; }
    else if (p.x > width) { p.x -= width; }

    // Wrap vertically
    if (p.y < 0) { p.y += height; }
    else if (p.y > height) { p.y -= height; }
  }
}

/**
 * Render ambient particles as small white dots with individual opacity.
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function renderAmbientParticles(ctx, width, height) {
  for (var i = 0; i < ambientParticles.length; i++) {
    var p = ambientParticles[i];
    ctx.save();
    ctx.globalAlpha = p.opacity;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Brain Silhouette
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a subtle brain silhouette outline centered on the canvas.
 * Uses a simplified brain path scaled to fit ~60% of the canvas.
 * Very low opacity (0.04) so it's a background hint, not distracting.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function renderBrainSilhouette(ctx, width, height) {
  var scale = Math.min(width, height) * 0.0028;
  var offsetX = width / 2;
  var offsetY = height / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#4A9EFF';
  ctx.lineWidth = 1.5 / scale;
  ctx.beginPath();
  // Simplified brain outline (left hemisphere)
  ctx.moveTo(-20, -80);
  ctx.bezierCurveTo(-70, -90, -110, -60, -120, -20);
  ctx.bezierCurveTo(-130, 20, -110, 60, -80, 80);
  ctx.bezierCurveTo(-50, 100, -20, 95, -5, 85);
  // Central fissure
  ctx.bezierCurveTo(-3, 60, -2, 30, -1, 0);
  ctx.bezierCurveTo(-2, -30, -3, -60, -5, -75);
  // Right hemisphere
  ctx.moveTo(-5, -75);
  ctx.bezierCurveTo(10, -90, 50, -95, 80, -80);
  ctx.bezierCurveTo(110, -65, 125, -30, 120, 0);
  ctx.bezierCurveTo(115, 30, 100, 60, 75, 80);
  ctx.bezierCurveTo(50, 95, 20, 95, 5, 85);
  ctx.bezierCurveTo(3, 60, 2, 30, 1, 0);
  ctx.bezierCurveTo(2, -30, 3, -60, 5, -75);
  // Cerebellum (bottom)
  ctx.moveTo(-60, 75);
  ctx.bezierCurveTo(-40, 100, -10, 110, 0, 110);
  ctx.bezierCurveTo(10, 110, 40, 100, 60, 75);
  // Brain stem
  ctx.moveTo(-5, 105);
  ctx.bezierCurveTo(-8, 120, -5, 135, 0, 140);
  ctx.bezierCurveTo(5, 135, 8, 120, 5, 105);
  ctx.stroke();

  // Internal folds (sulci) — very subtle
  ctx.globalAlpha = 0.025;
  ctx.beginPath();
  // Left hemisphere folds
  ctx.moveTo(-90, -30);
  ctx.bezierCurveTo(-70, -20, -50, -25, -30, -40);
  ctx.moveTo(-100, 10);
  ctx.bezierCurveTo(-75, 20, -50, 15, -25, 5);
  ctx.moveTo(-85, 45);
  ctx.bezierCurveTo(-60, 55, -35, 50, -15, 40);
  // Right hemisphere folds
  ctx.moveTo(90, -30);
  ctx.bezierCurveTo(70, -20, 50, -25, 30, -40);
  ctx.moveTo(100, 10);
  ctx.bezierCurveTo(75, 20, 50, 15, 25, 5);
  ctx.moveTo(85, 45);
  ctx.bezierCurveTo(60, 55, 35, 50, 15, 40);
  ctx.stroke();

  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

const tooltip = document.getElementById('tooltip');

/**
 * Show tooltip near cursor with node info, connection counts, and top neighbors.
 * @param {any} node
 * @param {MouseEvent} event
 */
function showTooltip(node, event) {
  if (!tooltip) { return; }

  // Base info (existing)
  var html =
    '<strong>' + escapeHtml(node.label) + '</strong><br>' +
    '<span class="tooltip-type">' + escapeHtml(node.type) + '</span><br>' +
    '<span class="tooltip-path">' + escapeHtml(node.filePath) + '</span>';

  // Compute incoming and outgoing connections
  var incoming = 0;
  var outgoing = 0;
  var neighborIds = [];

  graphData.links.forEach(function (link) {
    var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    var targetId = typeof link.target === 'object' ? link.target.id : link.target;
    if (targetId === node.id) {
      incoming++;
      if (neighborIds.indexOf(sourceId) === -1) { neighborIds.push(sourceId); }
    }
    if (sourceId === node.id) {
      outgoing++;
      if (neighborIds.indexOf(targetId) === -1) { neighborIds.push(targetId); }
    }
  });

  // Connection counts
  html += '<br><span style="color:#4A9EFF">In: ' + incoming + ' \u00B7 Out: ' + outgoing + '</span>';

  // Top 3 most-connected neighbors (by degree), sorted descending
  if (neighborIds.length === 0) {
    html += '<br><span style="color:#888;font-size:9px">No connections</span>';
  } else {
    var neighborsWithDegree = neighborIds.map(function (id) {
      var n = graphData.nodes.find(function (nd) { return nd.id === id; });
      return { id: id, label: n ? n.label : id, degree: degreeMap.get(id) || 0 };
    });
    neighborsWithDegree.sort(function (a, b) { return b.degree - a.degree; });
    var top = neighborsWithDegree.slice(0, 3);
    var labels = top.map(function (n) { return n.label; });
    html += '<br><span style="color:#888;font-size:9px">Top: ' + labels.join(', ') + '</span>';
  }

  // Complexity warning in tooltip
  if (node.metadata && node.metadata.lineCount && node.metadata.lineCount >= 500) {
    html += '<br><span style="color:#FF9800;font-size:9px">\u26A0 Consider splitting (' + node.metadata.lineCount + ' lines)</span>';
  }

  // Enhanced hook tooltip: show trigger type, description, and referenced steerings
  if ((node.type === 'hook-manual' || node.type === 'hook-auto') && node.metadata) {
    if (node.metadata.whenType) {
      html += '<br><span style="color:#7C4DFF">Trigger: ' + escapeHtml(node.metadata.whenType) + '</span>';
    }
    if (node.metadata.description) {
      html += '<br><span style="color:#aaa;font-size:9px">' + escapeHtml(node.metadata.description) + '</span>';
    }
    if (node.metadata.referencedSteerings && node.metadata.referencedSteerings.length > 0) {
      html += '<br><span style="color:#888;font-size:9px">Steerings: ' +
        node.metadata.referencedSteerings.map(escapeHtml).join(', ') + '</span>';
    }
  }

  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  positionTooltip(event);
}

/**
 * Position tooltip near cursor, avoiding off-screen overflow.
 * @param {MouseEvent} event
 */
function positionTooltip(event) {
  if (!tooltip) { return; }
  const padding = 12;
  let x = event.clientX + padding;
  let y = event.clientY + padding;

  const rect = tooltip.getBoundingClientRect();
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  if (x + rect.width > viewW) {
    x = event.clientX - rect.width - padding;
  }
  if (y + rect.height > viewH) {
    y = event.clientY - rect.height - padding;
  }

  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

function hideTooltip() {
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────────────────────

function buildLegend() {
  const legend = document.getElementById('legend');
  if (!legend) { return; }

  // Only show types that actually exist in the graph data
  var typesInData = new Set();
  if (graphData && graphData.nodes) {
    graphData.nodes.forEach(function (n) {
      if (n.type) { typesInData.add(n.type); }
    });
  }

  // Fallback to all types if no data yet
  var types = typesInData.size > 0 ? Array.from(typesInData).sort() : Object.keys(COLOR_MAP);

  let html = '<div class="legend-title">Node Types</div>';
  types.forEach(function (type) {
    html +=
      '<div class="legend-item">' +
      '<span class="legend-dot" style="background:' + (COLOR_MAP[type] || '#607D8B') + '"></span>' +
      '<span class="legend-label">' + type + '</span>' +
      '</div>';
  });
  legend.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Overlay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update the ecosystem stats indicator (bottom-left).
 * Format: "N nodes · M edges · K types" with optional growth indicator.
 * @param {Array} nodes - Current visible nodes
 * @param {Array} edges - Current visible edges/links
 */
function updateStats(nodes, edges) {
  var statsEl = document.getElementById('stats');
  if (!statsEl) { return; }
  var typeCount = new Set(nodes.map(function(n) { return n.type; })).size;
  var text = nodes.length + ' nodes \u00B7 ' + edges.length + ' edges \u00B7 ' + typeCount + ' types';

  // Growth indicator
  if (statsHistory && statsHistory.length >= 2) {
    var oldest = statsHistory[0].nodeCount;
    var current = nodes.length;
    var growth = current - oldest;
    if (growth > 0) { text += ' \u00B7 +' + growth + ' this week'; }
    else if (growth < 0) { text += ' \u00B7 ' + growth + ' this week'; }
  }

  statsEl.textContent = text;
}

/**
 * Update the zoom/position debug indicator.
 * Shows current zoom level and center coordinates.
 * @param {number} zoom - Current zoom level (transform.k)
 * @param {number} x - Transform x offset
 * @param {number} y - Transform y offset
 */
function updateZoomDebug(zoom, x, y) {
  var el = document.getElementById('zoom-debug');
  if (!el) { return; }
  el.textContent = 'zoom: ' + zoom.toFixed(2) + ' | x: ' + x.toFixed(0) + ' | y: ' + y.toFixed(0);

  // Sync zoom slider value
  var slider = document.getElementById('zoom-slider');
  var sliderValue = document.getElementById('zoom-slider-value');
  if (slider) { slider.value = zoom; }
  if (sliderValue) { sliderValue.textContent = zoom.toFixed(2); }
}

// Wire zoom slider input to graph zoom
(function () {
  // Wait for DOM to be ready
  setTimeout(function () {
    var slider = document.getElementById('zoom-slider');
    if (slider) {
      slider.addEventListener('input', function () {
        var val = parseFloat(slider.value);
        graph.zoom(val, 300);
        var sliderValue = document.getElementById('zoom-slider-value');
        if (sliderValue) { sliderValue.textContent = val.toFixed(2); }
      });
    }
  }, 500);
})();

// ─────────────────────────────────────────────────────────────────────────────
// Highlight Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update highlight sets based on hovered node.
 * @param {any} node - The hovered node, or null to clear
 */
function updateHighlights(node) {
  highlightedNodes.clear();
  highlightedLinks.clear();

  if (!node) {
    hoveredNode = null;
    return;
  }

  hoveredNode = node;
  highlightedNodes.add(node.id);

  graphData.links.forEach(function (link) {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    if (sourceId === node.id || targetId === node.id) {
      highlightedNodes.add(sourceId);
      highlightedNodes.add(targetId);
      highlightedLinks.add(sourceId + '->' + targetId);
    }
  });
}

/**
 * Neural impulse ray propagation: highlight nodes with delayed expansion.
 * Level 0 = hovered node (immediate), Level 1 = 1-hop (150ms), Level 2 = 2-hop (300ms).
 * @param {any} node - The hovered node, or null to clear
 */
function updateHighlightsWithPropagation(node) {
  // Clear previous propagation
  clearPropagationTimers();
  highlightedNodes.clear();
  highlightedLinks.clear();
  propagationLevel.clear();

  if (!node) {
    hoveredNode = null;
    return;
  }

  hoveredNode = node;
  highlightedNodes.add(node.id);
  propagationLevel.set(node.id, 0);

  // Immediate: highlight direct edges and collect 1-hop neighbors
  var neighbors1 = [];
  graphData.links.forEach(function (link) {
    var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    var targetId = typeof link.target === 'object' ? link.target.id : link.target;
    if (sourceId === node.id || targetId === node.id) {
      highlightedLinks.add(sourceId + '->' + targetId);
      var neighborId = sourceId === node.id ? targetId : sourceId;
      if (neighbors1.indexOf(neighborId) === -1) {
        neighbors1.push(neighborId);
      }
    }
  });

  // 150ms: highlight 1-hop neighbors
  propagationTimers.push(setTimeout(function () {
    neighbors1.forEach(function (id) {
      highlightedNodes.add(id);
      propagationLevel.set(id, 1);
    });
  }, 150));

  // 300ms: highlight 2-hop neighbors
  propagationTimers.push(setTimeout(function () {
    neighbors1.forEach(function (n1Id) {
      graphData.links.forEach(function (link) {
        var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        var targetId = typeof link.target === 'object' ? link.target.id : link.target;
        if (sourceId === n1Id || targetId === n1Id) {
          var n2Id = sourceId === n1Id ? targetId : sourceId;
          if (!highlightedNodes.has(n2Id)) {
            highlightedNodes.add(n2Id);
            propagationLevel.set(n2Id, 2);
            highlightedLinks.add(sourceId + '->' + targetId);
          }
        }
      });
    });
  }, 300));
}

/**
 * Clear all active propagation timers.
 */
function clearPropagationTimers() {
  propagationTimers.forEach(function (t) { clearTimeout(t); });
  propagationTimers = [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Initialization
// ─────────────────────────────────────────────────────────────────────────────

const graphContainer = document.getElementById('graph');

// @ts-ignore — ForceGraph is loaded globally from force-graph script tag
const graph = ForceGraph()(graphContainer)
  .width(graphContainer.clientWidth)
  .height(graphContainer.clientHeight)
  .backgroundColor('#0d0d0d')
  // Zoom limits — prevent zooming too far in/out
  .minZoom(0.3)
  .maxZoom(4)
  // Simulation: continuous organic movement (never stops)
  .cooldownTime(Infinity)
  .warmupTicks(100)
  .d3AlphaDecay(0.005)
  .d3VelocityDecay(0.4)
  .linkDirectionalArrowLength(0)
  .nodeCanvasObject(function (node, ctx, globalScale) {
    const size = getNodeSize(node);
    var color;
    if (typeof activityHeatmapActive !== 'undefined' && activityHeatmapActive && node.metadata && node.metadata.mtime) {
      color = getHeatmapColor(node.metadata.mtime) || (COLOR_MAP[node.type] || COLOR_MAP['unknown']);
    } else {
      color = COLOR_MAP[node.type] || COLOR_MAP['unknown'];
    }
    const degree = degreeMap.get(node.id) || 0;
    const isHighlighted = hoveredNode ? highlightedNodes.has(node.id) : true;

    // Heartbeat pulse: sinusoidal opacity oscillation [0.85, 0.95] with ~2.5s period
    // Phase offset per node index for organic staggering
    var nodeIndex = graphData.nodes.indexOf(node);
    var heartbeatOpacity = 0.9 + 0.05 * Math.sin(2 * Math.PI * (Date.now() / 2500) + nodeIndex * 0.5);

    // Determine opacity based on propagation level and highlight state
    var opacity;
    if (hoveredNode) {
      var level = propagationLevel.get(node.id);
      if (level === 0) {
        opacity = heartbeatOpacity; // hovered node: full with heartbeat
      } else if (level === 1) {
        opacity = 0.7; // 1-hop neighbors
      } else if (level === 2) {
        opacity = 0.4; // 2-hop neighbors
      } else {
        opacity = 0.15; // not in propagation
      }
    } else {
      opacity = heartbeatOpacity; // no hover active, all nodes pulse
    }

    // Calculate glow blur proportional to degree, clamped to [GLOW_MIN_BLUR, GLOW_MAX_BLUR]
    var glowBlur;
    if (isHighlighted) {
      glowBlur = GLOW_MIN_BLUR + (degree / 50) * (GLOW_MAX_BLUR - GLOW_MIN_BLUR);
      glowBlur = Math.max(GLOW_MIN_BLUR, Math.min(GLOW_MAX_BLUR, glowBlur));
    } else {
      // Dimmed nodes get reduced glow (2-3px)
      glowBlur = 2 + (degree / 50) * 1;
    }

    // Draw node with glow effect (shadowBlur creates radial bloom)
    // Shape depends on node type: diamond for skills, triangle for hooks, circle for others
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.shadowBlur = glowBlur;
    ctx.shadowColor = color;

    if (node.type === 'skill') {
      // Diamond: rotated square (45 degrees)
      ctx.translate(node.x, node.y);
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.rect(-size, -size, size * 2, size * 2);
      ctx.fillStyle = color;
      ctx.fill();
    } else if (node.type === 'hook-manual' || node.type === 'hook-auto') {
      // Equilateral triangle
      var h = size * 2;
      ctx.beginPath();
      ctx.moveTo(node.x, node.y - h * 0.6);
      ctx.lineTo(node.x - h * 0.55, node.y + h * 0.4);
      ctx.lineTo(node.x + h * 0.55, node.y + h * 0.4);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      // Circle (existing steerings, code-file, etc.)
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.restore();

    // Pin indicator: subtle ring around pinned (fixed) nodes
    if (node.fx != null && node.fy != null) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    // New badge: small cyan dot for nodes created in last 7 days
    if (node.metadata && node.metadata.birthtime) {
      var ageMs = Date.now() - node.metadata.birthtime;
      var sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (ageMs < sevenDaysMs) {
        // Pulsing cyan dot at top-right of node
        var badgeX = node.x + size * 0.7;
        var badgeY = node.y - size * 0.7;
        var badgePulse = 0.7 + 0.3 * Math.sin(Date.now() / 500);
        ctx.save();
        ctx.globalAlpha = badgePulse;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 2.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#00E5FF';
        ctx.fill();
        ctx.restore();
      }
    }

    // Activity heatmap: override color if active
    if (typeof activityHeatmapActive !== 'undefined' && activityHeatmapActive && node.metadata && node.metadata.mtime) {
      var heatColor = getHeatmapColor(node.metadata.mtime);
      if (heatColor) { /* heatmap color is applied via the color variable at the top */ }
    }

    // Complexity warning: orange triangle for 500+ lines
    if (typeof shouldShowComplexityWarning === 'function' && node.metadata && shouldShowComplexityWarning(node.metadata.lineCount)) {
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#FF9800';
      ctx.font = (8 / globalScale) + 'px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u26A0', node.x + size + 2, node.y - size);
      ctx.restore();
    }

    // Dependency depth badge
    if (typeof getDependencyBadge === 'function' && node.metadata) {
      var badge = getDependencyBadge(node.metadata.eccentricity);
      if (badge) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = badge.color;
        ctx.font = 'bold ' + (7 / globalScale) + 'px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(badge.text, node.x - size - 2, node.y + 3);
        ctx.restore();
      }
    }

    // Snapshot compare: green glow for new nodes
    if (typeof snapshotCompareActive !== 'undefined' && snapshotCompareActive && snapshotDiff) {
      if (snapshotDiff.newNodes.indexOf(node.id) !== -1) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#4CAF50';
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
        ctx.fill();
        ctx.restore();
      }
    }

    // Label rendering based on mode and zoom threshold
    const shouldShowLabel = (
      settings.labelMode === 'on' ||
      (settings.labelMode === 'auto' && globalScale > LABEL_ZOOM_THRESHOLD)
    );

    if (shouldShowLabel && settings.labelMode !== 'off') {
      ctx.save();
      ctx.globalAlpha = isHighlighted ? 0.8 : 0.3;
      ctx.font = LABEL_FONT_SIZE / globalScale + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(node.label, node.x, node.y + size + 2);
      ctx.restore();
    }
  })
  .nodePointerAreaPaint(function (node, color, ctx) {
    // Invisible hit area for pointer events
    const size = getNodeSize(node);
    ctx.beginPath();
    ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  })
  .linkCanvasObject(function (link, ctx, globalScale) {
    var source = link.source;
    var target = link.target;
    // Ensure we have coordinates (force-graph resolves objects)
    if (!source || !target || source.x == null || target.x == null) { return; }

    var sourceId = typeof source === 'object' ? source.id : source;
    var targetId = typeof target === 'object' ? target.id : target;
    var key = sourceId + '->' + targetId;
    var isLinkHighlighted = highlightedLinks.has(key);

    // Determine line width using logarithmic scaling formula
    var weight = (link.weight && !isNaN(link.weight)) ? link.weight : 1;
    var scaledWidth = settings.linkWidth * (1 + Math.log2(weight));
    var baseWidth = Math.min(scaledWidth, 5);
    var lineWidth = isLinkHighlighted ? EDGE_HOVER_WIDTH : baseWidth;

    // Determine opacity
    var linkOpacity = isLinkHighlighted ? EDGE_HOVER_OPACITY : EDGE_DEFAULT_OPACITY;

    // Synaptic strength: override opacity/width based on source mtime
    if (typeof synapticStrengthActive !== 'undefined' && synapticStrengthActive) {
      var sourceNode2 = graphData.nodes.find(function(n) { return n.id === sourceId; });
      var synStyle = getSynapticStrengthStyle(sourceNode2 && sourceNode2.metadata ? sourceNode2.metadata.mtime : null);
      if (synStyle) {
        linkOpacity = synStyle.opacity;
        lineWidth = synStyle.width;
      }
    }

    // Get source and target node types for gradient colors
    var sourceNode = graphData.nodes.find(function(n) { return n.id === sourceId; });
    var targetNode = graphData.nodes.find(function(n) { return n.id === targetId; });
    var sourceColor = sourceNode ? (COLOR_MAP[sourceNode.type] || '#607D8B') : '#607D8B';
    var targetColor = targetNode ? (COLOR_MAP[targetNode.type] || '#607D8B') : '#607D8B';

    ctx.save();
    ctx.globalAlpha = linkOpacity;
    ctx.lineWidth = lineWidth;

    // Optimization: if same type, use single color instead of gradient
    if (sourceColor === targetColor) {
      ctx.strokeStyle = sourceColor;
    } else {
      var gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
      gradient.addColorStop(0, sourceColor);
      gradient.addColorStop(1, targetColor);
      ctx.strokeStyle = gradient;
    }

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.restore();

    // Render annotation text at edge midpoint (if annotations exist)
    if (typeof annotations !== 'undefined' && annotations && annotations.length > 0) {
      var annKey = sourceId + '->' + targetId;
      var annotation = annotations.find(function(a) { return (a.source + '->' + a.target) === annKey; });
      if (annotation) {
        var midX = (source.x + target.x) / 2;
        var midY = (source.y + target.y) / 2;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#FFC107';
        ctx.font = (8 / globalScale) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(annotation.text, midX, midY - 4);
        ctx.restore();
      }
    }

    // Snapshot compare: green for new edges
    if (typeof snapshotCompareActive !== 'undefined' && snapshotCompareActive && snapshotDiff) {
      var edgeKey = sourceId + '->' + targetId;
      if (snapshotDiff.newEdges.indexOf(edgeKey) !== -1) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  })
  .linkDirectionalParticles(function(link) {
    return Math.min(link.weight || 1, PARTICLE_COUNT_MAX);
  })
  .linkDirectionalParticleSpeed(PARTICLE_SPEED)
  .linkDirectionalParticleWidth(PARTICLE_SIZE)
  .linkDirectionalParticleColor(function(link) {
    var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    var sourceNode = graphData.nodes.find(function(n) { return n.id === sourceId; });
    return sourceNode ? (COLOR_MAP[sourceNode.type] || COLOR_MAP['unknown']) : '#607D8B';
  })
  .onRenderFramePre(function (ctx, globalScale) {
    var width = graphContainer.clientWidth;
    var height = graphContainer.clientHeight;

    // Skip rendering if canvas has no dimensions (panel minimized)
    if (width === 0 || height === 0) { return; }

    // Animate and render ambient particles
    updateAmbientParticles(width, height);
    renderAmbientParticles(ctx, width, height);

    // Constellation mode: render MST edges as background layer
    if (typeof constellationModeActive !== 'undefined' && constellationModeActive && constellationEdges.length > 0) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = '#5a8ab5'; // Neural blue-gray — distinct from node colors
      constellationEdges.forEach(function(edge) {
        var srcNode = graphData.nodes.find(function(n) { return n.id === edge.sourceId; });
        var tgtNode = graphData.nodes.find(function(n) { return n.id === edge.targetId; });
        if (srcNode && tgtNode && srcNode.x != null && tgtNode.x != null) {
          ctx.beginPath();
          ctx.moveTo(srcNode.x, srcNode.y);
          ctx.lineTo(tgtNode.x, tgtNode.y);
          ctx.stroke();
        }
      });
      ctx.restore();
    }
  })
  .onNodeClick(function (node) {
    vscode.postMessage({ type: 'openFile', filePath: node.filePath });
  })
  .onNodeHover(function (node, prevNode) {
    updateHighlightsWithPropagation(node);
    graphContainer.style.cursor = node ? 'pointer' : 'default';
  })
  .onLinkHover(function (link) {
    if (link) {
      var weight = (link.weight && !isNaN(link.weight)) ? link.weight : 1;
      var types = link.types && link.types.length > 0 ? link.types : (link.type ? [link.type] : ['unknown']);
      var html = '<strong>' + weight + ' reference' + (weight > 1 ? 's' : '') + '</strong>';
      html += '<br><span style="color:#888;font-size:9px">' + types.join(', ') + '</span>';
      if (tooltip) {
        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
      }
    } else {
      if (!hoveredNode && tooltip) {
        tooltip.style.display = 'none';
      }
    }
  })
  .onNodeDragEnd(function (node) {
    // Pin node at its current position after drag (fix x/y)
    node.fx = node.x;
    node.fy = node.y;
  })
  .onNodeRightClick(function (node) {
    // Unpin node: release from fixed position back to simulation
    node.fx = undefined;
    node.fy = undefined;
  })
  .onBackgroundClick(function () {
    updateHighlightsWithPropagation(null);
    hideTooltip();
  })
  .onZoom(function (transform) {
    updateZoomDebug(transform.k, transform.x, transform.y);
  });

// Apply initial force settings
applyForceSettings();

// Initialize ambient background particles
initAmbientParticles(graphContainer.clientWidth, graphContainer.clientHeight);

// ─────────────────────────────────────────────────────────────────────────────
// Resize Handling — keep graph filling the entire panel
// ─────────────────────────────────────────────────────────────────────────────

const resizeObserver = new ResizeObserver(function () {
  graph.width(graphContainer.clientWidth);
  graph.height(graphContainer.clientHeight);
  // Reinitialize ambient particles for new dimensions
  initAmbientParticles(graphContainer.clientWidth, graphContainer.clientHeight);
});
resizeObserver.observe(graphContainer);

// ─────────────────────────────────────────────────────────────────────────────
// Mouse move for tooltip positioning
// ─────────────────────────────────────────────────────────────────────────────

graphContainer.addEventListener('mousemove', function (event) {
  if (hoveredNode) {
    showTooltip(hoveredNode, event);
  } else {
    hideTooltip();
  }
});

graphContainer.addEventListener('mouseleave', function () {
  hideTooltip();
});

// ─────────────────────────────────────────────────────────────────────────────
// Force Settings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply current settings to the force-graph simulation.
 */
function applyForceSettings() {
  // Center force — d3's forceCenter uses .strength() (0-1)
  var centerForce = graph.d3Force('center');
  if (centerForce && centerForce.strength) {
    centerForce.strength(settings.centerForce);
  }

  // Charge (repulsion) force — d3's forceManyBody uses .strength() (negative = repel)
  var chargeForce = graph.d3Force('charge');
  if (chargeForce) {
    chargeForce.strength(settings.repulsionForce);
  }

  // Link force — d3's forceLink uses .strength() and .distance()
  var linkForce = graph.d3Force('link');
  if (linkForce) {
    linkForce.distance(settings.linkDistance);
    linkForce.strength(settings.linkForce);
  }

  // Show arrows — directional arrow length (0 = hidden, 4 = visible)
  graph.linkDirectionalArrowLength(settings.showArrows ? 4 : 0);
  graph.linkDirectionalArrowRelPos(1);

  // Reheat simulation to apply changes
  graph.d3ReheatSimulation();
}

// ─────────────────────────────────────────────────────────────────────────────
// State Persistence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save current state to VS Code webview state.
 */
function saveState() {
  const state = {
    settings: settings,
  };
  vscode.setState(state);
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Handling (Extension -> Webview)
// ─────────────────────────────────────────────────────────────────────────────

window.addEventListener('message', function (event) {
  const message = event.data;

  switch (message.type) {
    case 'updateGraph':
      if (message.statsHistory) { statsHistory = message.statsHistory; }
      if (message.annotations) { annotations = message.annotations; }
      handleUpdateGraph(message.data);
      if (message.snapshotList && typeof updateSnapshotList === 'function') {
        updateSnapshotList(message.snapshotList);
      }
      break;
    case 'snapshotData':
      if (typeof enterSnapshotCompare === 'function') {
        enterSnapshotCompare(graphData, message.snapshot);
      }
      break;
    case 'highlightNode':
      handleHighlightNode(message.nodeId);
      break;
  }
});

/**
 * Handle graph data update from extension.
 * @param {{ nodes: any[], edges: any[] }} data - SerializedGraph
 */
function handleUpdateGraph(data) {
  // Transform edges to links format expected by force-graph
  const nodes = data.nodes.map(function (n) {
    return {
      id: n.id,
      label: n.label,
      type: n.type,
      workspaceFolder: n.workspaceFolder,
      filePath: n.filePath,
      resolved: n.resolved,
      metadata: n.metadata,
    };
  });

  const links = data.edges.map(function (e) {
    return {
      source: e.source,
      target: e.target,
      type: e.type,
    };
  });

  const weightedLinks = computeEdgeWeights(links);
  graphData = { nodes: nodes, links: weightedLinks };
  computeDegrees(graphData);

  // Compute gap detection metrics
  if (typeof GapDetector !== 'undefined') {
    gapSuggestions = GapDetector.computeSuggestedConnections(graphData);
    deadZones = GapDetector.computeDeadZones(graphData, Date.now());
    var allFoldersArr = [];
    graphData.nodes.forEach(function(n) { if (n.workspaceFolder && allFoldersArr.indexOf(n.workspaceFolder) === -1) allFoldersArr.push(n.workspaceFolder); });
    coverageMap = GapDetector.computeCoverageMap(graphData, allFoldersArr);
    redundancyPairs = GapDetector.computeRedundancyPairs(graphData);
  } else {
    gapSuggestions = [];
    deadZones = [];
    coverageMap = [];
    redundancyPairs = [];
  }

  // Populate visibleFolders with all folders from graph data (if not yet populated)
  const allFolders = new Set();
  nodes.forEach(function (n) {
    if (n.workspaceFolder) { allFolders.add(n.workspaceFolder); }
  });
  // If visibleFolders is empty (first load), add all folders as visible
  if (visibleFolders.size === 0) {
    allFolders.forEach(function (f) { visibleFolders.add(f); });
  }

  // Notify filter panel to rebuild folder toggles (if available)
  if (typeof rebuildFilterToggles === 'function') {
    rebuildFilterToggles();
  }

  // Apply filters (showOnlyExisting, showOrphans, search, types, folders)
  const filteredData = applyFilters(graphData);

  graph.graphData(filteredData);

  // Update stats overlay
  updateStats(filteredData.nodes, filteredData.links);

  // Initial viewport: zoom 1.28x centered at graph origin (0,0)
  // Nodes cluster around origin due to centerForce — wait for simulation to position them
  setTimeout(function () {
    graph.centerAt(0, 0, 0);
    graph.zoom(1.28, 0);
  }, 500);

  // Rebuild legend with actual types from data
  buildLegend();

  // Update health panel (if health-panel.js is loaded)
  if (typeof updateHealthPanel === 'function') {
    updateHealthPanel(graphData, degreeMap);
  }

  // Update cognitive panel (if cognitive-panel.js is loaded)
  if (typeof updateCognitivePanel === 'function') {
    var workspaceFolders = [];
    graphData.nodes.forEach(function(n) {
      if (n.workspaceFolder && workspaceFolders.indexOf(n.workspaceFolder) === -1) {
        workspaceFolders.push(n.workspaceFolder);
      }
    });
    updateCognitivePanel(graphData, degreeMap, workspaceFolders);
  }

  // Update shape legend (if shape-legend.js is loaded)
  if (typeof updateShapeLegend === 'function') {
    updateShapeLegend(graphData);
  }

  // Show empty state message if no nodes
  const emptyMsg = document.getElementById('empty-message');
  if (emptyMsg) {
    emptyMsg.style.display = filteredData.nodes.length === 0 ? 'block' : 'none';
  }
}

/**
 * Handle highlight node request from extension.
 * @param {string} nodeId
 */
function handleHighlightNode(nodeId) {
  const node = graphData.nodes.find(function (n) { return n.id === nodeId; });
  if (node) {
    updateHighlightsWithPropagation(node);
    // Center view on the node
    graph.centerAt(node.x, node.y, 500);
    graph.zoom(2, 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter State (used by filter-panel.js)
// ─────────────────────────────────────────────────────────────────────────────

/** @type {string} Current search text (case-insensitive) */
// eslint-disable-next-line no-unused-vars
var searchFilter = '';

/** @type {Set<string>} Set of visible NodeTypes (all active by default) */
// eslint-disable-next-line no-unused-vars
var visibleTypes = new Set(Object.keys(COLOR_MAP));

/** @type {Set<string>} Set of visible workspace folders (all active by default) */
// eslint-disable-next-line no-unused-vars
var visibleFolders = new Set();

// ─────────────────────────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply current filter settings to graph data.
 * Considers: showOnlyExisting, showOrphans, searchFilter, visibleTypes, visibleFolders.
 * @param {{ nodes: any[], links: any[] }} data
 * @returns {{ nodes: any[], links: any[] }}
 */
function applyFilters(data) {
  let nodes = data.nodes;

  // Filter: show only existing files
  if (settings.showOnlyExisting) {
    nodes = nodes.filter(function (n) { return n.resolved !== false; });
  }

  // Filter: show orphans
  if (!settings.showOrphans) {
    const connectedIds = new Set();
    data.links.forEach(function (link) {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      connectedIds.add(sourceId);
      connectedIds.add(targetId);
    });
    nodes = nodes.filter(function (n) { return connectedIds.has(n.id); });
  }

  // Filter: by NodeType
  if (visibleTypes.size < Object.keys(COLOR_MAP).length) {
    nodes = nodes.filter(function (n) { return visibleTypes.has(n.type); });
  }

  // Filter: by workspace folder (only apply if visibleFolders is populated)
  if (visibleFolders.size > 0) {
    nodes = nodes.filter(function (n) { return visibleFolders.has(n.workspaceFolder); });
  }

  // Filter: by search text (case-insensitive contains on label)
  if (searchFilter && searchFilter.length > 0) {
    const lowerSearch = searchFilter.toLowerCase();
    nodes = nodes.filter(function (n) {
      return n.label && n.label.toLowerCase().indexOf(lowerSearch) !== -1;
    });
  }

  // Build visible node set
  const visibleIds = new Set(nodes.map(function (n) { return n.id; }));

  // Filter links: only show edges where both source and target are visible
  const links = data.links.filter(function (link) {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return visibleIds.has(sourceId) && visibleIds.has(targetId);
  });

  return { nodes: nodes, links: links };
}

/**
 * Re-apply all filters and update the graph rendering.
 * Called by filter-panel.js when search/type/folder filters change.
 */
// eslint-disable-next-line no-unused-vars
function reapplyFilters() {
  const filteredData = applyFilters(graphData);
  graph.graphData(filteredData);

  // Update health panel with filtered data
  if (typeof updateHealthPanel === 'function') {
    updateHealthPanel(filteredData, degreeMap);
  }

  // Update cognitive panel with filtered data
  if (typeof updateCognitivePanel === 'function') {
    var workspaceFolders = [];
    filteredData.nodes.forEach(function(n) {
      if (n.workspaceFolder && workspaceFolders.indexOf(n.workspaceFolder) === -1) {
        workspaceFolders.push(n.workspaceFolder);
      }
    });
    updateCognitivePanel(filteredData, degreeMap, workspaceFolders);
  }

  // Show/hide empty state message
  const emptyMsg = document.getElementById('empty-message');
  if (emptyMsg) {
    emptyMsg.style.display = filteredData.nodes.length === 0 ? 'block' : 'none';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings Update (called from settings panel — task 9.3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update a setting value and re-apply to graph.
 * Exposed globally for the settings panel to call.
 * @param {string} key
 * @param {any} value
 */
// eslint-disable-next-line no-unused-vars
function updateSetting(key, value) {
  settings[key] = value;
  applyForceSettings();
  saveState();

  // Re-apply filters if relevant settings changed
  if (key === 'showOnlyExisting' || key === 'showOrphans') {
    reapplyFilters();
  }
}

/**
 * Restart the force simulation (animate button).
 */
// eslint-disable-next-line no-unused-vars
function restartSimulation() {
  graph.d3ReheatSimulation();
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS in tooltip.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) { return ''; }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────

// Build the legend
buildLegend();

// Signal ready to extension host
vscode.postMessage({ type: 'ready' });

// ─── Advanced Mode Toggles ───
(function() {
  var toolbar = document.createElement('div');
  toolbar.id = 'advanced-toolbar';
  toolbar.style.cssText = 'position:fixed;top:12px;right:50px;z-index:100;display:flex;flex-wrap:wrap;gap:4px;max-width:250px;';

  var modes = [
    { id: 'toggle-heatmap', label: 'Heatmap', onEnable: function() { enableActivityHeatmap(); }, onDisable: function() { disableActivityHeatmap(); } },
    { id: 'toggle-constellation', label: 'Constellation', onEnable: function() { enableConstellationMode(graphData); }, onDisable: function() { disableConstellationMode(); } },
    { id: 'toggle-synaptic', label: 'Synaptic', onEnable: function() { enableSynapticStrength(); }, onDisable: function() { disableSynapticStrength(); } },
  ];

  modes.forEach(function(mode) {
    var btn = document.createElement('button');
    btn.id = mode.id;
    btn.textContent = mode.label;
    btn.style.cssText = 'background:#2a2a2a;color:#888;border:1px solid #444;border-radius:3px;font-size:8px;padding:2px 6px;cursor:pointer;';
    btn.dataset.active = 'false';
    btn.addEventListener('click', function() {
      var isActive = btn.dataset.active === 'true';
      if (isActive) {
        mode.onDisable();
        btn.dataset.active = 'false';
        btn.style.background = '#2a2a2a';
        btn.style.color = '#888';
        btn.style.borderColor = '#444';
      } else {
        mode.onEnable();
        btn.dataset.active = 'true';
        btn.style.background = 'rgba(74,158,255,0.9)';
        btn.style.color = '#fff';
        btn.style.borderColor = '#4A9EFF';
      }
    });
    toolbar.appendChild(btn);
  });

  document.body.appendChild(toolbar);
})();
