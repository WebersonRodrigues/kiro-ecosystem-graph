/**
 * Health Panel — Brain Health Insights (Toggle Panel)
 *
 * DOM overlay panel that computes and displays ecosystem health metrics:
 * - Orphan count (nodes with zero connections)
 * - Hub node (highest degree)
 * - Least documented type (NodeType with fewest nodes)
 * - Cognitive weight per NodeType
 * - Island count (connected components via BFS)
 *
 * Hidden by default. Toggled via a small button in the top-right corner.
 * Relies on global variables from webview.js: COLOR_MAP, graphData, degreeMap
 */

// ─────────────────────────────────────────────────────────────────────────────
// Panel Creation (hidden by default, toggled via button)
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  // Toggle button — inserted into the advanced-toolbar (same row as Heatmap/Constellation/Synaptic)
  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'health-toggle-btn';
  toggleBtn.title = 'Brain Health';
  toggleBtn.textContent = '\u2764'; // heart symbol
  toggleBtn.style.cssText = 'background:#2a2a2a;color:#888;border:1px solid #444;border-radius:3px;font-size:10px;padding:2px 6px;cursor:pointer;';

  // Insert into advanced-toolbar if it exists, otherwise append to body with fixed position
  var advToolbar = document.getElementById('advanced-toolbar');
  if (advToolbar) {
    advToolbar.appendChild(toggleBtn);
  } else {
    // Fallback: wait for toolbar to be created, then insert
    var observer = new MutationObserver(function(mutations, obs) {
      var tb = document.getElementById('advanced-toolbar');
      if (tb) {
        tb.appendChild(toggleBtn);
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Panel — hidden by default
  var panel = document.createElement('div');
  panel.id = 'health-panel';
  panel.style.position = 'fixed';
  panel.style.top = '38px';
  panel.style.right = '12px';
  panel.style.zIndex = '150';
  panel.style.width = '180px';
  panel.style.background = 'rgba(26,26,26,0.95)';
  panel.style.border = '1px solid #333';
  panel.style.borderRadius = '6px';
  panel.style.padding = '8px 10px';
  panel.style.fontSize = '10px';
  panel.style.color = '#ccc';
  panel.style.fontFamily = 'sans-serif';
  panel.style.lineHeight = '1.5';
  panel.style.pointerEvents = 'none';
  panel.style.display = 'none'; // hidden by default
  panel.innerHTML = '<div style="font-size:11px;font-weight:bold;color:#fff;margin-bottom:4px;">Brain Health</div><div id="health-content">No data</div>';
  document.body.appendChild(panel);

  // Toggle behavior
  toggleBtn.addEventListener('click', function () {
    var isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    toggleBtn.style.background = isVisible ? '#2a2a2a' : 'rgba(74,158,255,0.9)';
    toggleBtn.style.color = isVisible ? '#888' : '#fff';
    toggleBtn.style.borderColor = isVisible ? '#444' : '#4A9EFF';
  });
})();

// ─────────────────────────────────────────────────────────────────────────────
// Island Detection (BFS Connected Components)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute connected components using BFS.
 * Treats edges as undirected.
 * @param {{ nodes: any[], links: any[] }} data
 * @returns {{ count: number, sizes: number[] }}
 */
// eslint-disable-next-line no-unused-vars
function computeIslands(data) {
  if (!data || !data.nodes || data.nodes.length === 0) {
    return { count: 0, sizes: [] };
  }

  // Build adjacency list (undirected)
  var adjacency = {};
  data.nodes.forEach(function (n) {
    adjacency[n.id] = [];
  });
  data.links.forEach(function (link) {
    var sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    var targetId = typeof link.target === 'object' ? link.target.id : link.target;
    if (adjacency[sourceId]) { adjacency[sourceId].push(targetId); }
    if (adjacency[targetId]) { adjacency[targetId].push(sourceId); }
  });

  var visited = {};
  var components = [];

  data.nodes.forEach(function (node) {
    if (visited[node.id]) { return; }

    // BFS from this node
    var queue = [node.id];
    var componentSize = 0;
    visited[node.id] = true;

    while (queue.length > 0) {
      var current = queue.shift();
      componentSize++;

      var neighbors = adjacency[current] || [];
      for (var i = 0; i < neighbors.length; i++) {
        if (!visited[neighbors[i]]) {
          visited[neighbors[i]] = true;
          queue.push(neighbors[i]);
        }
      }
    }

    components.push(componentSize);
  });

  return { count: components.length, sizes: components.sort(function (a, b) { return b - a; }) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Panel Update
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute and display health metrics in the panel.
 * @param {{ nodes: any[], links: any[] }} data - Current graph data
 * @param {Map<string, number>} degrees - Node id -> degree map
 */
// eslint-disable-next-line no-unused-vars
function updateHealthPanel(data, degrees) {
  var content = document.getElementById('health-content');
  if (!content) { return; }

  if (!data || !data.nodes || data.nodes.length === 0) {
    content.innerHTML = 'No data';
    return;
  }

  var html = '';

  // 1. Orphan count
  var orphanCount = 0;
  data.nodes.forEach(function (n) {
    if ((degrees.get(n.id) || 0) === 0) { orphanCount++; }
  });
  html += '<div style="margin-bottom:4px;"><span style="color:#888;">Orphans:</span> ' + orphanCount + '</div>';

  // 2. Hub node (highest degree)
  var hubNode = null;
  var maxDegree = 0;
  data.nodes.forEach(function (n) {
    var d = degrees.get(n.id) || 0;
    if (d > maxDegree) {
      maxDegree = d;
      hubNode = n;
    }
  });

  if (hubNode && maxDegree > 0) {
    html += '<div style="margin-bottom:4px;"><span style="color:#888;">Hub:</span> ' +
      '<span style="color:' + (COLOR_MAP[hubNode.type] || '#607D8B') + ';">' + hubNode.label + '</span>' +
      ' <span style="color:#666;">(' + maxDegree + ')</span></div>';
  } else {
    html += '<div style="margin-bottom:4px;color:#666;">No connections yet</div>';
  }

  // 3. Least documented type (NodeType with fewest nodes)
  var typeCounts = {};
  data.nodes.forEach(function (n) {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  });
  var leastType = null;
  var leastCount = Infinity;
  Object.keys(typeCounts).forEach(function (type) {
    if (typeCounts[type] < leastCount) {
      leastCount = typeCounts[type];
      leastType = type;
    }
  });
  if (leastType) {
    html += '<div style="margin-bottom:4px;"><span style="color:#888;">Least doc:</span> ' +
      '<span style="color:' + (COLOR_MAP[leastType] || '#607D8B') + ';">' + leastType + '</span>' +
      ' <span style="color:#666;">(' + leastCount + ')</span></div>';
  }

  // 4. Cognitive weight per NodeType
  var totalDegree = 0;
  var typeDegrees = {};
  data.nodes.forEach(function (n) {
    var d = degrees.get(n.id) || 0;
    totalDegree += d;
    typeDegrees[n.type] = (typeDegrees[n.type] || 0) + d;
  });

  var weights = [];
  Object.keys(typeDegrees).forEach(function (type) {
    var pct = totalDegree > 0 ? (typeDegrees[type] / totalDegree) * 100 : 0;
    weights.push({ type: type, percentage: pct });
  });
  weights.sort(function (a, b) { return b.percentage - a.percentage; });

  if (weights.length > 0 && totalDegree > 0) {
    html += '<div style="margin-bottom:4px;"><span style="color:#888;">Cognitive:</span></div>';
    weights.forEach(function (w, idx) {
      var color = idx === 0 ? (COLOR_MAP[w.type] || '#607D8B') : '#888';
      html += '<div style="padding-left:6px;color:' + color + ';">' +
        w.type + ': ' + w.percentage.toFixed(0) + '%</div>';
    });
  } else {
    html += '<div style="margin-bottom:4px;color:#666;">No connections yet</div>';
  }

  // 5. Island count
  var islands = computeIslands(data);
  html += '<div style="margin-top:4px;"><span style="color:#888;">Islands:</span> ';
  if (islands.count <= 1) {
    html += '<span style="color:#4CAF50;">Fully connected</span>';
  } else {
    html += islands.count + ' <span style="color:#666;">(' + islands.sizes.join(', ') + ')</span>';
  }
  html += '</div>';

  content.innerHTML = html;
}
