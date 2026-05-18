/**
 * Ecosystem Graph — Minimap Navigation Module
 *
 * Renders a bird's-eye view of the entire graph in a small canvas overlay
 * (bottom-right corner). Shows all nodes as colored dots with a viewport
 * indicator rectangle. Supports click-to-navigate and drag-to-pan.
 *
 * Relies on global: COLOR_MAP, settings, graph, graphData, applyFilters
 * defined in webview.js.
 */

// eslint-disable-next-line no-unused-vars
var MinimapModule = (function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // Constants
  // ─────────────────────────────────────────────────────────────────────────

  var MINIMAP_WIDTH = 150;
  var MINIMAP_HEIGHT = 100;
  var MINIMAP_MARGIN = 10;
  var NODE_THRESHOLD = 15;
  var DOT_RADIUS = 3;
  var PADDING_FACTOR = 0.9;
  var PAN_TRANSITION_MS = 200;

  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  var canvas = null;
  var ctx = null;
  var visible = false;
  var isDragging = false;
  var lastNodes = [];
  var lastGraphBounds = null;

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'minimap-canvas';
    canvas.width = MINIMAP_WIDTH;
    canvas.height = MINIMAP_HEIGHT;
    canvas.style.cssText = [
      'position: fixed',
      'bottom: ' + MINIMAP_MARGIN + 'px',
      'right: ' + MINIMAP_MARGIN + 'px',
      'width: ' + MINIMAP_WIDTH + 'px',
      'height: ' + MINIMAP_HEIGHT + 'px',
      'background: rgba(0, 0, 0, 0.7)',
      'border: 1px solid rgba(255, 255, 255, 0.3)',
      'border-radius: 4px',
      'z-index: 150',
      'cursor: pointer',
      'display: none',
      'pointer-events: auto',
    ].join('; ');

    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');

    // Event listeners
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('wheel', onWheel);

    // Prevent context menu on minimap
    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Coordinate Math (mirrors minimapMath.ts logic for webview use)
  // ─────────────────────────────────────────────────────────────────────────

  function computeGraphBounds(nodes) {
    if (nodes.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    var minX = Infinity, maxX = -Infinity;
    var minY = Infinity, maxY = -Infinity;

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.x === undefined || n.y === undefined) { continue; }
      if (n.x < minX) { minX = n.x; }
      if (n.x > maxX) { maxX = n.x; }
      if (n.y < minY) { minY = n.y; }
      if (n.y > maxY) { maxY = n.y; }
    }

    if (minX === Infinity) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    // Handle degenerate case
    if (maxX - minX === 0) { minX -= 1; maxX += 1; }
    if (maxY - minY === 0) { minY -= 1; maxY += 1; }

    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }

  function computeScaleAndOffset(graphBounds) {
    var graphWidth = graphBounds.maxX - graphBounds.minX;
    var graphHeight = graphBounds.maxY - graphBounds.minY;

    var scaleX = MINIMAP_WIDTH / graphWidth;
    var scaleY = MINIMAP_HEIGHT / graphHeight;
    var scale = Math.min(scaleX, scaleY) * PADDING_FACTOR;

    var offsetX = (MINIMAP_WIDTH - graphWidth * scale) / 2;
    var offsetY = (MINIMAP_HEIGHT - graphHeight * scale) / 2;

    return { scale: scale, offsetX: offsetX, offsetY: offsetY };
  }

  function mapGraphToMinimap(graphX, graphY, graphBounds) {
    var so = computeScaleAndOffset(graphBounds);
    return {
      x: (graphX - graphBounds.minX) * so.scale + so.offsetX,
      y: (graphY - graphBounds.minY) * so.scale + so.offsetY,
    };
  }

  function mapMinimapToGraph(minimapX, minimapY, graphBounds) {
    var so = computeScaleAndOffset(graphBounds);
    return {
      x: (minimapX - so.offsetX) / so.scale + graphBounds.minX,
      y: (minimapY - so.offsetY) / so.scale + graphBounds.minY,
    };
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(val, max));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────────────────

  function render(nodes, graphBounds) {
    if (!ctx) { return; }

    ctx.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    // Draw dots for each node
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.x === undefined || node.y === undefined) { continue; }

      var pos = mapGraphToMinimap(node.x, node.y, graphBounds);
      var color = getNodeColor(node.type);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, DOT_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    // Draw viewport indicator
    drawViewportIndicator(graphBounds);
  }

  function drawViewportIndicator(graphBounds) {
    if (typeof graph === 'undefined') { return; }

    var container = document.getElementById('graph');
    if (!container) { return; }

    var canvasWidth = container.clientWidth;
    var canvasHeight = container.clientHeight;
    var zoom = graph.zoom();
    var center = graph.centerAt();

    // Compute visible area in graph coords
    var visibleWidth = canvasWidth / zoom;
    var visibleHeight = canvasHeight / zoom;
    var visibleLeft = (center ? center.x : 0) - visibleWidth / 2;
    var visibleTop = (center ? center.y : 0) - visibleHeight / 2;

    // Map to minimap coords
    var so = computeScaleAndOffset(graphBounds);
    var x = (visibleLeft - graphBounds.minX) * so.scale + so.offsetX;
    var y = (visibleTop - graphBounds.minY) * so.scale + so.offsetY;
    var w = visibleWidth * so.scale;
    var h = visibleHeight * so.scale;

    // Clamp dimensions
    w = Math.max(10, Math.min(w, MINIMAP_WIDTH));
    h = Math.max(10, Math.min(h, MINIMAP_HEIGHT));

    // Draw viewport rectangle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  function getNodeColor(type) {
    if (typeof COLOR_MAP !== 'undefined' && COLOR_MAP[type]) {
      return COLOR_MAP[type];
    }
    return '#607D8B';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interaction Handlers
  // ─────────────────────────────────────────────────────────────────────────

  function getMinimapCoords(event) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: clamp(event.clientX - rect.left, 0, MINIMAP_WIDTH),
      y: clamp(event.clientY - rect.top, 0, MINIMAP_HEIGHT),
    };
  }

  function onClick(event) {
    if (isDragging) { return; }
    event.stopPropagation();

    if (!lastGraphBounds) { return; }

    var coords = getMinimapCoords(event);
    var graphCoords = mapMinimapToGraph(coords.x, coords.y, lastGraphBounds);

    // Pan to clicked position with smooth transition
    if (typeof graph !== 'undefined') {
      graph.centerAt(graphCoords.x, graphCoords.y, PAN_TRANSITION_MS);
    }
  }

  function onMouseDown(event) {
    event.stopPropagation();
    event.preventDefault();
    isDragging = true;
  }

  function onMouseMove(event) {
    if (!isDragging) { return; }
    event.stopPropagation();
    event.preventDefault();

    if (!lastGraphBounds) { return; }

    var coords = getMinimapCoords(event);
    var graphCoords = mapMinimapToGraph(coords.x, coords.y, lastGraphBounds);

    // Real-time pan (no transition for smooth dragging)
    if (typeof graph !== 'undefined') {
      graph.centerAt(graphCoords.x, graphCoords.y, 0);
    }
  }

  function onMouseUp(event) {
    if (isDragging) {
      event.stopPropagation();
      isDragging = false;
    }
  }

  function onWheel(event) {
    // Prevent scroll wheel from affecting the main graph when over minimap
    event.stopPropagation();
    event.preventDefault();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Visibility
  // ─────────────────────────────────────────────────────────────────────────

  function updateVisibility(nodeCount) {
    var settingEnabled = typeof settings !== 'undefined'
      ? (settings.showMinimap !== false)
      : true;

    var shouldShow = settingEnabled && nodeCount >= NODE_THRESHOLD;

    if (shouldShow && !visible) {
      canvas.style.display = 'block';
      visible = true;
    } else if (!shouldShow && visible) {
      canvas.style.display = 'none';
      visible = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  function update(nodes) {
    if (!canvas) { init(); }

    lastNodes = nodes;
    lastGraphBounds = computeGraphBounds(nodes);

    updateVisibility(nodes.length);

    if (visible) {
      render(nodes, lastGraphBounds);
    }
  }

  function isVisible() {
    return visible;
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    update: update,
    updateVisibility: function () {
      if (lastNodes) {
        updateVisibility(lastNodes.length);
      }
    },
    isVisible: isVisible,
  };

})();
