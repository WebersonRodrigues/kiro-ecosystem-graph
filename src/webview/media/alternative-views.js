/**
 * Alternative Views — Timeline and Hierarchy
 *
 * Manages alternative visualization modes that temporarily replace the force-graph.
 * Both views hide the force-graph canvas and render a DOM-based layout in a container div.
 *
 * Timeline View: Nodes arranged on X-axis by birthtime, Y-axis grouped by type (swim lanes).
 * Hierarchy View: Nodes arranged in levels by degree centrality (highest degree at top).
 *
 * Relies on global variables from webview.js: COLOR_MAP, graphData, degreeMap
 */

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

/** @type {boolean} Whether timeline view is currently active */
var timelineViewActive = false;

/** @type {boolean} Whether hierarchy view is currently active */
var hierarchyViewActive = false;

/** @type {HTMLElement|null} The container div for alternative view rendering */
var altViewContainer = null;

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create the alt-view-container div and hide the force-graph canvas.
 * @param {HTMLElement} parentContainer - The parent element to append the container to
 * @returns {HTMLElement} The created container
 */
function createAltViewContainer(parentContainer) {
  // Hide force-graph
  var graphEl = document.getElementById('graph');
  if (graphEl) { graphEl.style.display = 'none'; }

  // Create container
  var container = document.createElement('div');
  container.id = 'alt-view-container';
  container.style.position = 'absolute';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.background = '#0d0d0d';
  container.style.overflow = 'auto';
  container.style.zIndex = '50';
  parentContainer.appendChild(container);
  altViewContainer = container;
  return container;
}

/**
 * Remove the alt-view-container and restore the force-graph canvas.
 */
function removeAltViewContainer() {
  if (altViewContainer && altViewContainer.parentNode) {
    altViewContainer.parentNode.removeChild(altViewContainer);
  }
  altViewContainer = null;

  // Show force-graph again
  var graphEl = document.getElementById('graph');
  if (graphEl) { graphEl.style.display = ''; }
}

/**
 * Create a node circle element for the alternative views.
 * @param {object} node - Graph node
 * @param {number} x - X position in pixels
 * @param {number} y - Y position in pixels
 * @param {number} radius - Circle radius
 * @returns {HTMLElement}
 */
function createNodeCircle(node, x, y, radius) {
  var color = COLOR_MAP[node.type] || COLOR_MAP['unknown'] || '#607D8B';

  var el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.left = (x - radius) + 'px';
  el.style.top = (y - radius) + 'px';
  el.style.width = (radius * 2) + 'px';
  el.style.height = (radius * 2) + 'px';
  el.style.borderRadius = '50%';
  el.style.background = color;
  el.style.boxShadow = '0 0 6px ' + color;
  el.style.cursor = 'pointer';
  el.style.zIndex = '10';
  el.title = node.label + ' (' + node.type + ')';

  // Label below the circle
  var label = document.createElement('div');
  label.style.position = 'absolute';
  label.style.top = (radius * 2 + 2) + 'px';
  label.style.left = '50%';
  label.style.transform = 'translateX(-50%)';
  label.style.fontSize = '9px';
  label.style.color = '#ccc';
  label.style.whiteSpace = 'nowrap';
  label.style.textAlign = 'center';
  label.style.pointerEvents = 'none';
  label.textContent = node.label;
  el.appendChild(label);

  return el;
}

/**
 * Create an SVG overlay for rendering edges.
 * @param {number} width
 * @param {number} height
 * @returns {SVGElement}
 */
function createSvgOverlay(width, height) {
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '5';
  return svg;
}

/**
 * Format a timestamp as a short date string (MMM YYYY).
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string}
 */
function formatMonthYear(timestamp) {
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var d = new Date(timestamp);
  return months[d.getMonth()] + ' ' + d.getFullYear();
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline View
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enter timeline view: hide force-graph, render nodes on a horizontal timeline.
 * X-axis: birthtime mapped proportionally to container width.
 * Y-axis: grouped by type (swim lanes, one row per type).
 * Edges rendered as SVG curved arcs (quadratic bezier).
 * Nodes without birthtime go to leftmost position with "?" label.
 *
 * @param {{ nodes: any[], links: any[] }} data - Graph data
 * @param {HTMLElement} container - Parent container (usually document.body)
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
// eslint-disable-next-line no-unused-vars
function enterTimelineView(data, container) {
  if (timelineViewActive) { return; }
  timelineViewActive = true;

  var viewContainer = createAltViewContainer(container);
  var width = viewContainer.clientWidth || window.innerWidth;
  var height = viewContainer.clientHeight || window.innerHeight;

  // Padding
  var paddingLeft = 80;
  var paddingRight = 40;
  var paddingTop = 40;
  var paddingBottom = 60;
  var usableWidth = width - paddingLeft - paddingRight;
  var usableHeight = height - paddingTop - paddingBottom;

  // Collect unique types for swim lanes
  var types = [];
  data.nodes.forEach(function (n) {
    if (types.indexOf(n.type) === -1) { types.push(n.type); }
  });
  types.sort();

  var laneHeight = types.length > 0 ? usableHeight / types.length : usableHeight;

  // Determine time range from birthtimes
  var minTime = Infinity;
  var maxTime = -Infinity;
  var nodesWithTime = [];
  var nodesWithoutTime = [];

  data.nodes.forEach(function (n) {
    var birthtime = n.metadata && n.metadata.birthtime ? n.metadata.birthtime : null;
    if (birthtime && birthtime > 0) {
      if (birthtime < minTime) { minTime = birthtime; }
      if (birthtime > maxTime) { maxTime = birthtime; }
      nodesWithTime.push(n);
    } else {
      nodesWithoutTime.push(n);
    }
  });

  // If no valid times, use a default range
  if (minTime === Infinity || maxTime === -Infinity) {
    minTime = Date.now() - 365 * 24 * 60 * 60 * 1000;
    maxTime = Date.now();
  }

  // Ensure range is at least 1 day
  if (maxTime - minTime < 86400000) {
    maxTime = minTime + 86400000;
  }

  var timeRange = maxTime - minTime;

  // Reserve leftmost 40px for nodes without birthtime
  var unknownZoneWidth = nodesWithoutTime.length > 0 ? 40 : 0;
  var timelineWidth = usableWidth - unknownZoneWidth;

  // Map node positions
  var nodePositions = {}; // nodeId -> { x, y }
  var nodeRadius = 6;

  // Position nodes with birthtime
  nodesWithTime.forEach(function (n) {
    var birthtime = n.metadata.birthtime;
    var xRatio = (birthtime - minTime) / timeRange;
    var x = paddingLeft + unknownZoneWidth + xRatio * timelineWidth;
    var typeIndex = types.indexOf(n.type);
    var y = paddingTop + typeIndex * laneHeight + laneHeight / 2;
    nodePositions[n.id] = { x: x, y: y };
  });

  // Position nodes without birthtime at leftmost
  nodesWithoutTime.forEach(function (n, idx) {
    var x = paddingLeft + 15;
    var typeIndex = types.indexOf(n.type);
    var y = paddingTop + typeIndex * laneHeight + laneHeight / 2;
    // Offset slightly if multiple nodes in same lane have no time
    y += (idx % 3 - 1) * 14;
    nodePositions[n.id] = { x: x, y: y };
  });

  // Determine total content height (may exceed viewport)
  var contentHeight = Math.max(height, paddingTop + types.length * laneHeight + paddingBottom + 40);
  var contentWidth = Math.max(width, paddingLeft + usableWidth + paddingRight);

  // Create SVG overlay for edges
  var svg = createSvgOverlay(contentWidth, contentHeight);
  viewContainer.appendChild(svg);

  // Render edges as quadratic bezier arcs
  data.links.forEach(function (link) {
    var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    var targetId = typeof link.target === 'object' ? link.target.id : link.target;
    var srcPos = nodePositions[sourceId];
    var tgtPos = nodePositions[targetId];
    if (!srcPos || !tgtPos) { return; }

    // Quadratic bezier with control point above/below midpoint
    var midX = (srcPos.x + tgtPos.x) / 2;
    var midY = (srcPos.y + tgtPos.y) / 2;
    var dx = tgtPos.x - srcPos.x;
    var dy = tgtPos.y - srcPos.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    // Arc height proportional to distance, direction based on relative Y
    var arcHeight = Math.min(dist * 0.3, 60);
    var controlY = midY - arcHeight;

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    var d = 'M ' + srcPos.x + ' ' + srcPos.y +
            ' Q ' + midX + ' ' + controlY + ' ' + tgtPos.x + ' ' + tgtPos.y;
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(150,150,150,0.15)');
    path.setAttribute('stroke-width', '1');
    svg.appendChild(path);
  });

  // Render swim lane backgrounds and type labels
  types.forEach(function (type, idx) {
    var laneY = paddingTop + idx * laneHeight;
    var color = COLOR_MAP[type] || '#607D8B';

    // Lane background (subtle stripe)
    var lane = document.createElement('div');
    lane.style.position = 'absolute';
    lane.style.left = '0';
    lane.style.top = laneY + 'px';
    lane.style.width = contentWidth + 'px';
    lane.style.height = laneHeight + 'px';
    lane.style.background = idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
    lane.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    lane.style.pointerEvents = 'none';
    viewContainer.appendChild(lane);

    // Type label on the left
    var typeLabel = document.createElement('div');
    typeLabel.style.position = 'absolute';
    typeLabel.style.left = '6px';
    typeLabel.style.top = (laneY + laneHeight / 2 - 7) + 'px';
    typeLabel.style.fontSize = '9px';
    typeLabel.style.color = color;
    typeLabel.style.fontFamily = 'sans-serif';
    typeLabel.style.whiteSpace = 'nowrap';
    typeLabel.style.pointerEvents = 'none';
    typeLabel.textContent = type;
    viewContainer.appendChild(typeLabel);
  });

  // Render date axis at bottom
  var axisY = paddingTop + types.length * laneHeight + 20;
  var monthCount = Math.max(2, Math.ceil(timeRange / (30 * 24 * 60 * 60 * 1000)));
  var labelCount = Math.min(monthCount, 12); // max 12 labels
  var step = timeRange / labelCount;

  for (var i = 0; i <= labelCount; i++) {
    var t = minTime + i * step;
    var xPos = paddingLeft + unknownZoneWidth + (i / labelCount) * timelineWidth;

    // Tick mark
    var tick = document.createElement('div');
    tick.style.position = 'absolute';
    tick.style.left = xPos + 'px';
    tick.style.top = axisY + 'px';
    tick.style.width = '1px';
    tick.style.height = '6px';
    tick.style.background = 'rgba(255,255,255,0.3)';
    viewContainer.appendChild(tick);

    // Date label
    var dateLabel = document.createElement('div');
    dateLabel.style.position = 'absolute';
    dateLabel.style.left = (xPos - 20) + 'px';
    dateLabel.style.top = (axisY + 8) + 'px';
    dateLabel.style.fontSize = '8px';
    dateLabel.style.color = '#888';
    dateLabel.style.fontFamily = 'sans-serif';
    dateLabel.style.width = '40px';
    dateLabel.style.textAlign = 'center';
    dateLabel.style.pointerEvents = 'none';
    dateLabel.textContent = formatMonthYear(t);
    viewContainer.appendChild(dateLabel);
  }

  // Axis line
  var axisLine = document.createElement('div');
  axisLine.style.position = 'absolute';
  axisLine.style.left = (paddingLeft + unknownZoneWidth) + 'px';
  axisLine.style.top = axisY + 'px';
  axisLine.style.width = timelineWidth + 'px';
  axisLine.style.height = '1px';
  axisLine.style.background = 'rgba(255,255,255,0.2)';
  viewContainer.appendChild(axisLine);

  // Render node circles
  data.nodes.forEach(function (n) {
    var pos = nodePositions[n.id];
    if (!pos) { return; }
    var circle = createNodeCircle(n, pos.x, pos.y, nodeRadius);
    viewContainer.appendChild(circle);

    // "?" indicator for nodes without birthtime
    var hasBirthtime = n.metadata && n.metadata.birthtime && n.metadata.birthtime > 0;
    if (!hasBirthtime) {
      var unknownLabel = document.createElement('div');
      unknownLabel.style.position = 'absolute';
      unknownLabel.style.top = '-12px';
      unknownLabel.style.left = '50%';
      unknownLabel.style.transform = 'translateX(-50%)';
      unknownLabel.style.fontSize = '8px';
      unknownLabel.style.color = '#ff9800';
      unknownLabel.style.fontWeight = 'bold';
      unknownLabel.style.pointerEvents = 'none';
      unknownLabel.textContent = '?';
      circle.appendChild(unknownLabel);
    }
  });

  // Title
  var title = document.createElement('div');
  title.style.position = 'absolute';
  title.style.top = '10px';
  title.style.left = '50%';
  title.style.transform = 'translateX(-50%)';
  title.style.fontSize = '12px';
  title.style.color = '#fff';
  title.style.fontFamily = 'sans-serif';
  title.style.fontWeight = 'bold';
  title.style.pointerEvents = 'none';
  title.textContent = 'Timeline View';
  viewContainer.appendChild(title);

  // Unknown zone label
  if (nodesWithoutTime.length > 0) {
    var unknownZoneLabel = document.createElement('div');
    unknownZoneLabel.style.position = 'absolute';
    unknownZoneLabel.style.left = (paddingLeft) + 'px';
    unknownZoneLabel.style.top = (axisY + 8) + 'px';
    unknownZoneLabel.style.fontSize = '8px';
    unknownZoneLabel.style.color = '#ff9800';
    unknownZoneLabel.style.fontFamily = 'sans-serif';
    unknownZoneLabel.style.pointerEvents = 'none';
    unknownZoneLabel.textContent = '?';
    viewContainer.appendChild(unknownZoneLabel);
  }
}

/**
 * Exit timeline view: remove alt-view-container, restore force-graph.
 *
 * Validates: Requirements 4.5
 */
// eslint-disable-next-line no-unused-vars
function exitTimelineView() {
  if (!timelineViewActive) { return; }
  timelineViewActive = false;
  removeAltViewContainer();
}

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchy View
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enter hierarchy view: hide force-graph, render nodes in a top-down tree layout.
 * Level 0: nodes with highest degree (top 10% or max degree nodes).
 * Level N+1: nodes referenced by level N that aren't already placed.
 * Horizontal distribution within each level (evenly spaced).
 * Edges as straight diagonal lines.
 *
 * @param {{ nodes: any[], links: any[] }} data - Graph data
 * @param {Map<string, number>} degrees - Node id -> degree map
 * @param {HTMLElement} container - Parent container (usually document.body)
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
// eslint-disable-next-line no-unused-vars
function enterHierarchyView(data, degrees, container) {
  if (hierarchyViewActive) { return; }
  hierarchyViewActive = true;

  var viewContainer = createAltViewContainer(container);
  var width = viewContainer.clientWidth || window.innerWidth;
  var height = viewContainer.clientHeight || window.innerHeight;

  // Padding
  var paddingLeft = 40;
  var paddingRight = 40;
  var paddingTop = 50;
  var paddingBottom = 40;
  var usableWidth = width - paddingLeft - paddingRight;

  // Build adjacency (outgoing references)
  var outgoing = {}; // nodeId -> [targetIds]
  var incoming = {}; // nodeId -> [sourceIds]
  data.nodes.forEach(function (n) {
    outgoing[n.id] = [];
    incoming[n.id] = [];
  });
  data.links.forEach(function (link) {
    var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    var targetId = typeof link.target === 'object' ? link.target.id : link.target;
    if (outgoing[sourceId]) { outgoing[sourceId].push(targetId); }
    if (incoming[targetId]) { incoming[targetId].push(sourceId); }
  });

  // Determine level 0: top 10% by degree, minimum 1 node
  var sortedByDegree = data.nodes.slice().sort(function (a, b) {
    return (degrees.get(b.id) || 0) - (degrees.get(a.id) || 0);
  });

  var topCount = Math.max(1, Math.ceil(data.nodes.length * 0.1));
  // Also include all nodes with max degree
  var maxDegree = sortedByDegree.length > 0 ? (degrees.get(sortedByDegree[0].id) || 0) : 0;

  var placed = {}; // nodeId -> level
  var levels = []; // levels[i] = [nodeIds at level i]

  // Level 0: top 10% or all nodes with max degree
  var level0 = [];
  for (var i = 0; i < sortedByDegree.length; i++) {
    var nodeDegree = degrees.get(sortedByDegree[i].id) || 0;
    if (i < topCount || nodeDegree === maxDegree) {
      level0.push(sortedByDegree[i].id);
      placed[sortedByDegree[i].id] = 0;
    } else {
      break;
    }
  }
  levels.push(level0);

  // BFS to assign levels: nodes referenced by level N go to level N+1
  var currentLevel = 0;
  var maxLevels = 20; // safety limit
  while (currentLevel < maxLevels) {
    var nextLevel = [];
    var currentNodes = levels[currentLevel];
    if (!currentNodes || currentNodes.length === 0) { break; }

    currentNodes.forEach(function (nodeId) {
      // Outgoing references from this node
      var targets = outgoing[nodeId] || [];
      targets.forEach(function (targetId) {
        if (placed[targetId] === undefined) {
          placed[targetId] = currentLevel + 1;
          nextLevel.push(targetId);
        }
      });
      // Also consider incoming (nodes that reference this one)
      var sources = incoming[nodeId] || [];
      sources.forEach(function (sourceId) {
        if (placed[sourceId] === undefined) {
          placed[sourceId] = currentLevel + 1;
          nextLevel.push(sourceId);
        }
      });
    });

    if (nextLevel.length === 0) { break; }
    levels.push(nextLevel);
    currentLevel++;
  }

  // Place any remaining unplaced nodes in the last level + 1
  var unplaced = [];
  data.nodes.forEach(function (n) {
    if (placed[n.id] === undefined) {
      unplaced.push(n.id);
      placed[n.id] = levels.length;
    }
  });
  if (unplaced.length > 0) {
    levels.push(unplaced);
  }

  // Calculate layout positions
  var levelHeight = Math.min(80, (height - paddingTop - paddingBottom) / Math.max(levels.length, 1));
  var nodeRadius = 6;
  var nodePositions = {}; // nodeId -> { x, y }

  levels.forEach(function (levelNodes, levelIdx) {
    var y = paddingTop + levelIdx * levelHeight + levelHeight / 2;
    var count = levelNodes.length;
    var spacing = count > 1 ? usableWidth / (count - 1) : usableWidth / 2;

    levelNodes.forEach(function (nodeId, nodeIdx) {
      var x;
      if (count === 1) {
        x = paddingLeft + usableWidth / 2;
      } else {
        x = paddingLeft + nodeIdx * spacing;
      }
      nodePositions[nodeId] = { x: x, y: y };
    });
  });

  // Determine total content height
  var contentHeight = Math.max(height, paddingTop + levels.length * levelHeight + paddingBottom);
  var contentWidth = Math.max(width, paddingLeft + usableWidth + paddingRight);

  // Create SVG overlay for edges
  var svg = createSvgOverlay(contentWidth, contentHeight);
  viewContainer.appendChild(svg);

  // Render edges as straight diagonal lines
  data.links.forEach(function (link) {
    var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    var targetId = typeof link.target === 'object' ? link.target.id : link.target;
    var srcPos = nodePositions[sourceId];
    var tgtPos = nodePositions[targetId];
    if (!srcPos || !tgtPos) { return; }

    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(srcPos.x));
    line.setAttribute('y1', String(srcPos.y));
    line.setAttribute('x2', String(tgtPos.x));
    line.setAttribute('y2', String(tgtPos.y));
    line.setAttribute('stroke', 'rgba(150,150,150,0.15)');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  });

  // Render level labels on the left
  levels.forEach(function (levelNodes, levelIdx) {
    var y = paddingTop + levelIdx * levelHeight + levelHeight / 2;
    var levelLabel = document.createElement('div');
    levelLabel.style.position = 'absolute';
    levelLabel.style.left = '6px';
    levelLabel.style.top = (y - 6) + 'px';
    levelLabel.style.fontSize = '9px';
    levelLabel.style.color = '#666';
    levelLabel.style.fontFamily = 'sans-serif';
    levelLabel.style.pointerEvents = 'none';
    levelLabel.textContent = 'L' + levelIdx;
    viewContainer.appendChild(levelLabel);
  });

  // Render node circles
  data.nodes.forEach(function (n) {
    var pos = nodePositions[n.id];
    if (!pos) { return; }
    var circle = createNodeCircle(n, pos.x, pos.y, nodeRadius);
    viewContainer.appendChild(circle);
  });

  // Title
  var title = document.createElement('div');
  title.style.position = 'absolute';
  title.style.top = '10px';
  title.style.left = '50%';
  title.style.transform = 'translateX(-50%)';
  title.style.fontSize = '12px';
  title.style.color = '#fff';
  title.style.fontFamily = 'sans-serif';
  title.style.fontWeight = 'bold';
  title.style.pointerEvents = 'none';
  title.textContent = 'Hierarchy View';
  viewContainer.appendChild(title);
}

/**
 * Exit hierarchy view: remove alt-view-container, restore force-graph.
 *
 * Validates: Requirements 5.5
 */
// eslint-disable-next-line no-unused-vars
function exitHierarchyView() {
  if (!hierarchyViewActive) { return; }
  hierarchyViewActive = false;
  removeAltViewContainer();
}
