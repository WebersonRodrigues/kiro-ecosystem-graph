/**
 * Interactions Panel — Focus Mode, Path Finder, Cluster Mode
 *
 * Manages three advanced interaction modes for the Ecosystem Graph:
 * - Focus Mode: double-click a node to see only its 1-hop neighborhood
 * - Path Finder: select two nodes to compute and highlight shortest path (BFS)
 * - Cluster Mode: group nodes by type into brain-lobe-like clusters
 *
 * Relies on global variables from webview.js:
 *   graph, graphData, degreeMap, highlightedNodes, highlightedLinks,
 *   COLOR_MAP, reapplyFilters, applyFilters, vscode
 */

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/** @type {boolean} Whether focus mode is active */
var focusModeActive = false;

/** @type {string|null} ID of the focused node */
var focusModeNodeId = null;

/** @type {{ nodes: any[], links: any[] }|null} Original graph data before focus */
var focusModeOriginalData = null;

/** @type {boolean} Whether path finder mode is active */
var pathFinderActive = false;

/** @type {string|null} Path finder source node ID */
var pathFinderSource = null;

/** @type {string|null} Path finder target node ID */
var pathFinderTarget = null;

/** @type {string[]|null} Current computed path (array of node IDs) */
var pathFinderPath = null;

/** @type {boolean} Whether cluster mode is active */
var clusterModeActive = false;

/** @type {Object<string, {x: number, y: number}>} Cluster center positions per type */
var clusterCenters = {};

/** @type {number|null} Timer for distinguishing single-click from double-click */
var clickTimer = null;

/** @type {number} Timestamp of last click for double-click detection */
var lastClickTime = 0;

// ─────────────────────────────────────────────────────────────────────────────
// UI Elements
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  // --- Focus Mode: "Return to full graph" button ---
  var focusBtn = document.createElement('button');
  focusBtn.id = 'focus-mode-exit-btn';
  focusBtn.textContent = 'Return to full graph';
  focusBtn.style.position = 'fixed';
  focusBtn.style.top = '12px';
  focusBtn.style.left = '50%';
  focusBtn.style.transform = 'translateX(-50%)';
  focusBtn.style.zIndex = '200';
  focusBtn.style.padding = '6px 14px';
  focusBtn.style.background = 'rgba(74,158,255,0.9)';
  focusBtn.style.color = '#fff';
  focusBtn.style.border = 'none';
  focusBtn.style.borderRadius = '4px';
  focusBtn.style.fontSize = '11px';
  focusBtn.style.fontFamily = 'sans-serif';
  focusBtn.style.cursor = 'pointer';
  focusBtn.style.display = 'none';
  focusBtn.addEventListener('click', function () {
    if (window.is3DActive && typeof exit3DFocusMode === 'function') {
      exit3DFocusMode();
    } else {
      exitFocusMode();
    }
  });
  document.body.appendChild(focusBtn);

  // --- Path Finder REMOVED (usability issues) ---

  // --- Cluster Mode toggle button (positioned next to search input) ---
  var clusterBtn = document.createElement('button');
  clusterBtn.id = 'cluster-mode-btn';
  clusterBtn.textContent = 'Cluster';
  clusterBtn.style.position = 'fixed';
  clusterBtn.style.top = '8px';
  clusterBtn.style.left = '212px';
  clusterBtn.style.zIndex = '200';
  clusterBtn.style.padding = '5px 10px';
  clusterBtn.style.background = 'rgba(40,40,40,0.9)';
  clusterBtn.style.color = '#ccc';
  clusterBtn.style.border = '1px solid #555';
  clusterBtn.style.borderRadius = '4px';
  clusterBtn.style.fontSize = '10px';
  clusterBtn.style.fontFamily = 'sans-serif';
  clusterBtn.style.cursor = 'pointer';
  clusterBtn.addEventListener('click', function () {
    if (clusterModeActive) {
      exitClusterMode();
    } else {
      enterClusterMode();
    }
  });
  document.body.appendChild(clusterBtn);

  // --- Expand Mode toggle button (next to Cluster) ---
  var expandActive = false;
  var expandBtn = document.createElement('button');
  expandBtn.id = 'expand-mode-btn';
  expandBtn.textContent = 'Expand';
  expandBtn.style.position = 'fixed';
  expandBtn.style.top = '8px';
  expandBtn.style.left = '275px';
  expandBtn.style.zIndex = '200';
  expandBtn.style.padding = '5px 10px';
  expandBtn.style.background = 'rgba(40,40,40,0.9)';
  expandBtn.style.color = '#ccc';
  expandBtn.style.border = '1px solid #555';
  expandBtn.style.borderRadius = '4px';
  expandBtn.style.fontSize = '10px';
  expandBtn.style.fontFamily = 'sans-serif';
  expandBtn.style.cursor = 'pointer';
  expandBtn.addEventListener('click', function () {
    // Determine which graph instance to use (2D or 3D)
    var activeGraph = (typeof is3DActive !== 'undefined' && is3DActive && typeof graph3DInstance !== 'undefined' && graph3DInstance) ? graph3DInstance : graph;
    if (expandActive) {
      // Restore normal repulsion
      expandActive = false;
      expandBtn.style.background = 'rgba(40,40,40,0.9)';
      expandBtn.style.color = '#ccc';
      expandBtn.style.borderColor = '#555';
      var chargeForce = activeGraph.d3Force('charge');
      if (chargeForce) { chargeForce.strength(settings.repulsionForce); }
      activeGraph.d3ReheatSimulation();
    } else {
      // Increase repulsion to spread nodes apart
      expandActive = true;
      expandBtn.style.background = 'rgba(74,158,255,0.9)';
      expandBtn.style.color = '#fff';
      expandBtn.style.borderColor = '#4A9EFF';
      var chargeForce2 = activeGraph.d3Force('charge');
      if (chargeForce2) { chargeForce2.strength(-500); }
      activeGraph.d3ReheatSimulation();
    }
  });
  document.body.appendChild(expandBtn);

  // --- Cluster labels container ---
  var clusterLabels = document.createElement('div');
  clusterLabels.id = 'cluster-labels';
  clusterLabels.style.position = 'fixed';
  clusterLabels.style.top = '0';
  clusterLabels.style.left = '0';
  clusterLabels.style.width = '100%';
  clusterLabels.style.height = '100%';
  clusterLabels.style.pointerEvents = 'none';
  clusterLabels.style.zIndex = '50';
  clusterLabels.style.display = 'none';
  document.body.appendChild(clusterLabels);
})();

// ─────────────────────────────────────────────────────────────────────────────
// Focus Mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enter focus mode: show only the given node and its 1-hop neighbors.
 * @param {any} node - The node to focus on
 */
// eslint-disable-next-line no-unused-vars
function enterFocusMode(node) {
  if (focusModeActive) { exitFocusMode(); }

  focusModeActive = true;
  focusModeNodeId = node.id;
  focusModeOriginalData = { nodes: graphData.nodes.slice(), links: graphData.links.slice() };

  // Find 1-hop neighbor IDs
  var neighborIds = new Set();
  neighborIds.add(node.id);

  graphData.links.forEach(function (link) {
    var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    var targetId = typeof link.target === 'object' ? link.target.id : link.target;
    if (sourceId === node.id) { neighborIds.add(targetId); }
    if (targetId === node.id) { neighborIds.add(sourceId); }
  });

  // Filter nodes and edges
  var filteredNodes = graphData.nodes.filter(function (n) {
    return neighborIds.has(n.id);
  });
  var filteredLinks = graphData.links.filter(function (link) {
    var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    var targetId = typeof link.target === 'object' ? link.target.id : link.target;
    return neighborIds.has(sourceId) && neighborIds.has(targetId);
  });

  var filteredData = { nodes: filteredNodes, links: filteredLinks };
  graph.graphData(filteredData);

  // Center and zoom to fit after a short delay for layout
  setTimeout(function () {
    graph.zoomToFit(400, 40);
  }, 300);

  // Show exit button
  var btn = document.getElementById('focus-mode-exit-btn');
  if (btn) { btn.style.display = 'block'; }
}

/**
 * Exit focus mode: restore original graph data and reapply filters.
 */
// eslint-disable-next-line no-unused-vars
function exitFocusMode() {
  if (!focusModeActive) { return; }

  focusModeActive = false;
  focusModeNodeId = null;

  if (focusModeOriginalData) {
    graphData.nodes = focusModeOriginalData.nodes;
    graphData.links = focusModeOriginalData.links;
    focusModeOriginalData = null;
  }

  reapplyFilters();

  // Hide exit button
  var btn = document.getElementById('focus-mode-exit-btn');
  if (btn) { btn.style.display = 'none'; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Double-Click Detection (overrides onNodeClick)
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  // Override the graph's onNodeClick to distinguish single-click from double-click
  graph.onNodeClick(function (node) {
    var now = Date.now();
    var timeSinceLastClick = now - lastClickTime;
    lastClickTime = now;

    // If within 250ms of last click on same logic, treat as double-click
    if (timeSinceLastClick < 250) {
      // Double-click: enter focus mode
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      // Don't enter focus mode if path finder is active (path finder uses clicks)
      if (!pathFinderActive) {
        enterFocusMode(node);
      }
      return;
    }

    // Single-click: delay to see if double-click follows
    if (clickTimer) { clearTimeout(clickTimer); }
    clickTimer = setTimeout(function () {
      clickTimer = null;
      // Single-click behavior
      if (pathFinderActive) {
        handlePathFinderClick(node);
      } else {
        // Default: open file
        vscode.postMessage({ type: 'openFile', filePath: node.filePath });
      }
    }, 250);
  });
})();

// ─────────────────────────────────────────────────────────────────────────────
// Path Finder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enter path finder mode.
 */
function enterPathFinderMode() {
  pathFinderActive = true;
  pathFinderSource = null;
  pathFinderTarget = null;
  pathFinderPath = null;

  // Update button style
  var btn = document.getElementById('path-finder-btn');
  if (btn) {
    btn.style.background = 'rgba(74,158,255,0.9)';
    btn.style.color = '#fff';
    btn.style.borderColor = '#4A9EFF';
  }

  // Show status
  var status = document.getElementById('path-finder-status');
  if (status) {
    status.style.display = 'block';
    status.textContent = 'Click source node...';
  }

  // Clear any existing path highlights
  clearPathHighlights();
}

/**
 * Exit path finder mode.
 */
function exitPathFinderMode() {
  pathFinderActive = false;
  pathFinderSource = null;
  pathFinderTarget = null;
  pathFinderPath = null;

  // Update button style
  var btn = document.getElementById('path-finder-btn');
  if (btn) {
    btn.style.background = 'rgba(40,40,40,0.9)';
    btn.style.color = '#ccc';
    btn.style.borderColor = '#555';
  }

  // Hide status
  var status = document.getElementById('path-finder-status');
  if (status) { status.style.display = 'none'; }

  // Clear highlights
  clearPathHighlights();
}

/**
 * Handle a node click while in path finder mode.
 * @param {any} node - The clicked node
 */
function handlePathFinderClick(node) {
  if (!pathFinderSource) {
    // First click: set source
    pathFinderSource = node.id;
    highlightedNodes.add(node.id);

    var status = document.getElementById('path-finder-status');
    if (status) {
      status.textContent = 'Source: ' + node.label + ' — click target node...';
    }
  } else if (!pathFinderTarget) {
    // Second click: set target and compute path
    pathFinderTarget = node.id;

    var path = computeShortestPath(pathFinderSource, pathFinderTarget, graphData);
    pathFinderPath = path;

    var status2 = document.getElementById('path-finder-status');
    if (path) {
      // Highlight path nodes and edges
      highlightPath(path);
      if (status2) {
        status2.textContent = 'Path length: ' + (path.length - 1) + ' hops';
        status2.style.color = '#4CAF50';
      }
    } else {
      if (status2) {
        status2.textContent = 'No path found \u2014 nodes are in different islands';
        status2.style.color = '#FF9800';
      }
    }
  }
}

/**
 * Highlight all nodes and edges along a path.
 * @param {string[]} path - Array of node IDs forming the path
 */
function highlightPath(path) {
  clearPathHighlights();

  for (var i = 0; i < path.length; i++) {
    highlightedNodes.add(path[i]);
  }

  // Highlight edges along the path
  for (var j = 0; j < path.length - 1; j++) {
    var a = path[j];
    var b = path[j + 1];
    // Add both directions since edges might be stored either way
    highlightedLinks.add(a + '->' + b);
    highlightedLinks.add(b + '->' + a);
  }
}

/**
 * Clear path finder highlights.
 */
function clearPathHighlights() {
  highlightedNodes.clear();
  highlightedLinks.clear();
}

/**
 * Compute shortest path between two nodes using BFS on undirected graph.
 * @param {string} sourceId - Source node ID
 * @param {string} targetId - Target node ID
 * @param {{ nodes: any[], links: any[] }} data - Graph data
 * @returns {string[]|null} Array of node IDs forming the path, or null if no path exists
 */
// eslint-disable-next-line no-unused-vars
function computeShortestPath(sourceId, targetId, data) {
  // Build adjacency (undirected)
  var adj = {};
  data.nodes.forEach(function (n) { adj[n.id] = []; });
  data.links.forEach(function (link) {
    var s = typeof link.source === 'object' ? link.source.id : link.source;
    var t = typeof link.target === 'object' ? link.target.id : link.target;
    if (adj[s]) { adj[s].push(t); }
    if (adj[t]) { adj[t].push(s); }
  });

  // BFS
  var visited = {};
  var parent = {};
  var queue = [sourceId];
  visited[sourceId] = true;
  parent[sourceId] = null;

  while (queue.length > 0) {
    var current = queue.shift();
    if (current === targetId) {
      // Reconstruct path
      var path = [];
      var node = targetId;
      while (node !== null) {
        path.unshift(node);
        node = parent[node];
      }
      return path;
    }
    var neighbors = adj[current] || [];
    for (var i = 0; i < neighbors.length; i++) {
      if (!visited[neighbors[i]]) {
        visited[neighbors[i]] = true;
        parent[neighbors[i]] = current;
        queue.push(neighbors[i]);
      }
    }
  }
  return null; // No path
}

// ─────────────────────────────────────────────────────────────────────────────
// Cluster Mode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enter cluster mode: apply forceX/forceY pulling nodes toward type-based centers.
 */
// eslint-disable-next-line no-unused-vars
function enterClusterMode() {
  if (clusterModeActive) { return; }
  clusterModeActive = true;

  // Determine which graph instance to use
  var activeGraph = (typeof is3DActive !== 'undefined' && is3DActive && typeof graph3DInstance !== 'undefined' && graph3DInstance) ? graph3DInstance : graph;

  // Compute active types from current graph data
  var typeCounts = {};
  graphData.nodes.forEach(function (n) {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  });

  var types = Object.keys(typeCounts);
  if (types.length === 0) { return; }

  // Compute cluster centers evenly on a circle
  var angleStep = (2 * Math.PI) / types.length;
  var radius = 200;
  clusterCenters = {};
  types.forEach(function (type, i) {
    clusterCenters[type] = {
      x: radius * Math.cos(i * angleStep),
      y: radius * Math.sin(i * angleStep)
    };
  });

  // Apply clustering forces using d3Force API
  activeGraph.d3Force('clusterX', function (alpha) {
    graphData.nodes.forEach(function (node) {
      var center = clusterCenters[node.type];
      if (center && node.vx !== undefined) {
        node.vx += (center.x - node.x) * alpha * 0.4;
      }
    });
  });
  activeGraph.d3Force('clusterY', function (alpha) {
    graphData.nodes.forEach(function (node) {
      var center = clusterCenters[node.type];
      if (center && node.vy !== undefined) {
        node.vy += (center.y - node.y) * alpha * 0.4;
      }
    });
  });

  activeGraph.d3ReheatSimulation();

  // Update button style
  var btn = document.getElementById('cluster-mode-btn');
  if (btn) {
    btn.style.background = 'rgba(74,158,255,0.9)';
    btn.style.color = '#fff';
    btn.style.borderColor = '#4A9EFF';
  }

  // Show cluster labels
  renderClusterLabels(types);
}

/**
 * Exit cluster mode: remove clustering forces and reheat simulation.
 */
// eslint-disable-next-line no-unused-vars
function exitClusterMode() {
  if (!clusterModeActive) { return; }
  clusterModeActive = false;
  clusterCenters = {};

  // Determine which graph instance to use
  var activeGraph = (typeof is3DActive !== 'undefined' && is3DActive && typeof graph3DInstance !== 'undefined' && graph3DInstance) ? graph3DInstance : graph;

  // Remove clustering forces
  activeGraph.d3Force('clusterX', null);
  activeGraph.d3Force('clusterY', null);
  activeGraph.d3ReheatSimulation();

  // Update button style
  var btn = document.getElementById('cluster-mode-btn');
  if (btn) {
    btn.style.background = 'rgba(40,40,40,0.9)';
    btn.style.color = '#ccc';
    btn.style.borderColor = '#555';
  }

  // Hide cluster labels
  var labels = document.getElementById('cluster-labels');
  if (labels) {
    labels.style.display = 'none';
    labels.innerHTML = '';
  }
}

/**
 * Render subtle labels at cluster center positions.
 * Uses screen-space coordinates derived from graph coordinates.
 * @param {string[]} types - Active node types
 */
function renderClusterLabels(types) {
  var container = document.getElementById('cluster-labels');
  if (!container) { return; }

  container.innerHTML = '';
  container.style.display = 'block';

  types.forEach(function (type) {
    var center = clusterCenters[type];
    if (!center) { return; }

    var label = document.createElement('div');
    label.className = 'cluster-label';
    label.textContent = type;
    label.style.position = 'absolute';
    label.style.fontSize = '9px';
    label.style.fontFamily = 'sans-serif';
    label.style.color = COLOR_MAP[type] || '#607D8B';
    label.style.opacity = '0.5';
    label.style.whiteSpace = 'nowrap';
    label.style.pointerEvents = 'none';
    label.dataset.type = type;
    container.appendChild(label);
  });

  // Update label positions on each frame
  updateClusterLabelPositions();
}

/**
 * Update cluster label screen positions based on current graph transform.
 * Called periodically while cluster mode is active.
 */
function updateClusterLabelPositions() {
  if (!clusterModeActive) { return; }

  var container = document.getElementById('cluster-labels');
  if (!container) { return; }

  var labels = container.querySelectorAll('.cluster-label');
  labels.forEach(function (label) {
    var type = label.dataset.type;
    var center = clusterCenters[type];
    if (!center) { return; }

    // Convert graph coordinates to screen coordinates
    var screenPos = graph.graph2ScreenCoords(center.x, center.y);
    label.style.left = screenPos.x + 'px';
    label.style.top = screenPos.y + 'px';
    label.style.transform = 'translate(-50%, -50%)';
  });

  // Schedule next update
  requestAnimationFrame(updateClusterLabelPositions);
}

// ─────────────────────────────────────────────────────────────────────────────
// Background Click Handler (clear path finder on background click)
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  // Override onBackgroundClick to include path finder clearing
  // The original behavior (updateHighlightsWithPropagation(null), hideTooltip) is replicated here
  graph.onBackgroundClick(function () {
    // Original behavior from webview.js
    updateHighlightsWithPropagation(null);
    hideTooltip();

    // Clear path finder if active
    if (pathFinderActive && pathFinderPath) {
      pathFinderSource = null;
      pathFinderTarget = null;
      pathFinderPath = null;
      clearPathHighlights();

      var status = document.getElementById('path-finder-status');
      if (status) {
        status.textContent = 'Click source node...';
        status.style.color = '#aaa';
      }
    }
  });
})();
