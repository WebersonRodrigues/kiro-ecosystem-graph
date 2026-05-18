/**
 * Cognitive Analysis Panel — Brain Insights (Toggle Panel)
 *
 * DOM overlay panel that computes and displays cognitive analysis metrics:
 * - Orphan Steerings: steering nodes with 0 incoming + 0 outgoing edges
 * - Fragile Links: edges with weight=1 AND type='backtick-ref'
 * - Isolated Files: nodes with 0 total edges
 * - Coverage Gaps: workspace folders with 0 steering files
 * - Suggestions: actionable recommendations based on detected issues
 *
 * Hidden by default. Toggled via a brain button in the advanced-toolbar.
 * Relies on global variables from webview.js: COLOR_MAP, graphData, degreeMap, graph
 */

// eslint-disable-next-line no-unused-vars
var CognitivePanel = (function () {
  'use strict';

  // Module-scoped variable to store latest analysis result for export
  var latestAnalysis = null;

  // ─────────────────────────────────────────────────────────────────────────
  // Panel Creation (hidden by default, toggled via button)
  // ─────────────────────────────────────────────────────────────────────────

  // Toggle button — inserted into the advanced-toolbar
  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'cognitive-toggle-btn';
  toggleBtn.title = 'Cognitive Analysis';
  toggleBtn.textContent = '\u{1F9E0}'; // brain unicode
  toggleBtn.style.cssText = 'background:#2a2a2a;color:#888;border:1px solid #444;border-radius:3px;font-size:10px;padding:2px 6px;cursor:pointer;';

  // Insert into advanced-toolbar if it exists, otherwise wait
  var advToolbar = document.getElementById('advanced-toolbar');
  if (advToolbar) {
    advToolbar.appendChild(toggleBtn);
  } else {
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
  panel.id = 'cognitive-panel';
  panel.style.position = 'fixed';
  panel.style.top = '38px';
  panel.style.right = '200px';
  panel.style.zIndex = '150';
  panel.style.width = '210px';
  panel.style.maxHeight = '400px';
  panel.style.overflowY = 'auto';
  panel.style.background = 'rgba(26,26,26,0.95)';
  panel.style.border = '1px solid #333';
  panel.style.borderRadius = '6px';
  panel.style.padding = '8px 10px';
  panel.style.fontSize = '10px';
  panel.style.color = '#ccc';
  panel.style.fontFamily = 'sans-serif';
  panel.style.lineHeight = '1.5';
  panel.style.pointerEvents = 'auto';
  panel.style.display = 'none';

  // Build panel header with export button
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';

  var title = document.createElement('span');
  title.style.cssText = 'font-size:11px;font-weight:bold;color:#fff;';
  title.textContent = 'Cognitive Analysis';

  var exportBtn = document.createElement('button');
  exportBtn.id = 'cognitive-export-btn';
  exportBtn.title = 'Export as Markdown';
  exportBtn.innerHTML = 'Export';
  exportBtn.style.cssText = 'background:#2a2a2a;color:#ccc;border:1px solid #555;border-radius:3px;font-size:9px;padding:3px 6px;cursor:pointer;display:none;';

  header.appendChild(title);
  header.appendChild(exportBtn);

  var contentDiv = document.createElement('div');
  contentDiv.id = 'cognitive-content';
  contentDiv.textContent = 'No data';

  panel.appendChild(header);
  panel.appendChild(contentDiv);
  document.body.appendChild(panel);

  // Export button click handler — uses global vscode API from webview.js
  exportBtn.addEventListener('click', function () {
    if (latestAnalysis && typeof vscode !== 'undefined') {
      vscode.postMessage({ type: 'exportCognitiveAnalysis', data: latestAnalysis });
    }
  });

  // Hover effect for export button
  exportBtn.addEventListener('mouseenter', function () {
    exportBtn.style.background = '#3a3a3a';
    exportBtn.style.color = '#fff';
    exportBtn.style.borderColor = '#4A9EFF';
  });
  exportBtn.addEventListener('mouseleave', function () {
    exportBtn.style.background = '#2a2a2a';
    exportBtn.style.color = '#ccc';
    exportBtn.style.borderColor = '#555';
  });

  // Toggle behavior
  toggleBtn.addEventListener('click', function () {
    var isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    toggleBtn.style.background = isVisible ? '#2a2a2a' : 'rgba(74,158,255,0.9)';
    toggleBtn.style.color = isVisible ? '#888' : '#fff';
    toggleBtn.style.borderColor = isVisible ? '#444' : '#4A9EFF';
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Cognitive Analysis Computation
  // ─────────────────────────────────────────────────────────────────────────

  // ─── Graph Validations ─────────────────────────────────────────────────

  /**
   * Tarjan's SCC algorithm to find strongly connected components.
   * @param {any[]} nodes
   * @param {any[]} links
   * @returns {string[][]} Array of SCCs (each SCC is array of node IDs)
   */
  function tarjanSCC(nodes, links) {
    var adj = {};
    nodes.forEach(function(n) { adj[n.id] = []; });
    links.forEach(function(link) {
      var s = typeof link.source === 'object' ? link.source.id : link.source;
      var t = typeof link.target === 'object' ? link.target.id : link.target;
      if (adj[s]) { adj[s].push(t); }
    });

    var index = 0;
    var stack = [];
    var onStack = {};
    var indices = {};
    var lowlinks = {};
    var sccs = [];

    function strongconnect(v) {
      indices[v] = index;
      lowlinks[v] = index;
      index++;
      stack.push(v);
      onStack[v] = true;

      var neighbors = adj[v] || [];
      for (var i = 0; i < neighbors.length; i++) {
        var w = neighbors[i];
        if (indices[w] === undefined) {
          strongconnect(w);
          lowlinks[v] = Math.min(lowlinks[v], lowlinks[w]);
        } else if (onStack[w]) {
          lowlinks[v] = Math.min(lowlinks[v], indices[w]);
        }
      }

      if (lowlinks[v] === indices[v]) {
        var scc = [];
        var w2;
        do {
          w2 = stack.pop();
          onStack[w2] = false;
          scc.push(w2);
        } while (w2 !== v);
        sccs.push(scc);
      }
    }

    nodes.forEach(function(n) {
      if (indices[n.id] === undefined) {
        strongconnect(n.id);
      }
    });

    return sccs;
  }

  /**
   * Detect dead loops: isolated cycles with no external entry.
   * @param {any[]} nodes
   * @param {any[]} links
   * @returns {{ nodes: {id:string, label:string}[], size: number }[]}
   */
  function detectDeadLoops(nodes, links) {
    var sccs = tarjanSCC(nodes, links);
    var cycles = sccs.filter(function(scc) { return scc.length > 1; });
    var nodeMap = {};
    nodes.forEach(function(n) { nodeMap[n.id] = n; });

    var deadLoops = [];
    for (var i = 0; i < cycles.length; i++) {
      var cycle = cycles[i];
      var cycleSet = {};
      cycle.forEach(function(id) { cycleSet[id] = true; });

      var hasExternalEntry = false;
      for (var j = 0; j < links.length; j++) {
        var link = links[j];
        var t = typeof link.target === 'object' ? link.target.id : link.target;
        var s = typeof link.source === 'object' ? link.source.id : link.source;
        if (cycleSet[t] && !cycleSet[s]) {
          hasExternalEntry = true;
          break;
        }
      }

      if (!hasExternalEntry) {
        var loopNodes = cycle.map(function(id) {
          var n = nodeMap[id];
          return { id: id, label: n ? n.label : id };
        });
        deadLoops.push({ nodes: loopNodes, size: cycle.length });
      }
    }

    return deadLoops;
  }

  /**
   * Compute hops to reach from entry points using BFS.
   * Entry points: nodes with inclusion=always|auto OR type hook-auto|hook-manual.
   * @param {any[]} nodes
   * @param {any[]} links
   * @returns {{ id: string, label: string, hops: number }[]}
   */
  function computeHopsToReach(nodes, links) {
    // Build adjacency list (source→target direction)
    var adj = {};
    nodes.forEach(function(n) { adj[n.id] = []; });
    links.forEach(function(link) {
      var s = typeof link.source === 'object' ? link.source.id : link.source;
      var t = typeof link.target === 'object' ? link.target.id : link.target;
      if (adj[s]) { adj[s].push(t); }
    });

    // Identify entry points
    var distance = {};
    var queue = [];
    nodes.forEach(function(n) {
      var inclusion = (n.metadata && n.metadata.inclusion) || '';
      var isEntry = inclusion === 'always' || inclusion === 'auto' ||
        n.type === 'hook-auto' || n.type === 'hook-manual';
      if (isEntry) {
        distance[n.id] = 0;
        queue.push(n.id);
      }
    });

    // BFS from all entry points
    var head = 0;
    while (head < queue.length) {
      var current = queue[head++];
      var neighbors = adj[current] || [];
      for (var i = 0; i < neighbors.length; i++) {
        var neighbor = neighbors[i];
        if (distance[neighbor] === undefined) {
          distance[neighbor] = distance[current] + 1;
          queue.push(neighbor);
        }
      }
    }

    // Filter steerings with distance >= 4
    var alerts = [];
    nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
        var hops = distance[n.id];
        if (hops === undefined || hops >= 4) {
          alerts.push({
            id: n.id,
            label: n.label,
            hops: hops === undefined ? 999 : hops,
          });
        }
      }
    });

    return alerts;
  }

  // ─── Content Validations ───────────────────────────────────────────────

  /**
   * Detect duplicate intent between always-loaded steerings using Jaccard similarity.
   * @param {any[]} nodes
   * @returns {{ nodeA: {id,label}, nodeB: {id,label}, overlap: number }[]}
   */
  function detectDuplicateIntent(nodes) {
    var alwaysSteerings = nodes.filter(function(n) {
      return n.type && n.type.indexOf('steering-') === 0 &&
        n.metadata &&
        (n.metadata.inclusion === 'always' || n.metadata.inclusion === 'auto') &&
        n.metadata.keywords && n.metadata.keywords.length > 0;
    });

    var duplicates = [];
    for (var i = 0; i < alwaysSteerings.length - 1; i++) {
      for (var j = i + 1; j < alwaysSteerings.length; j++) {
        var score = computeDuplicateScore(alwaysSteerings[i], alwaysSteerings[j]);
        if (score > 0.6) {
          duplicates.push({
            nodeA: { id: alwaysSteerings[i].id, label: alwaysSteerings[i].label },
            nodeB: { id: alwaysSteerings[j].id, label: alwaysSteerings[j].label },
            overlap: Math.round(score * 100),
          });
        }
      }
    }

    return duplicates;
  }

  /**
   * Compute combined similarity score between two steering nodes.
   */
  function computeDuplicateScore(nodeA, nodeB) {
    var kwA = new Set(nodeA.metadata.keywords || []);
    var kwB = new Set(nodeB.metadata.keywords || []);
    var jaccard = computeJaccard(kwA, kwB);

    var headersA = new Set(nodeA.metadata.sectionHeaders || []);
    var headersB = new Set(nodeB.metadata.sectionHeaders || []);
    var maxHeaders = Math.max(headersA.size, headersB.size, 1);
    var headerIntersection = setIntersectionSize(headersA, headersB);
    var headerOverlap = headerIntersection / maxHeaders;

    return jaccard * 0.7 + headerOverlap * 0.3;
  }

  /**
   * Compute Jaccard coefficient between two sets.
   */
  function computeJaccard(setA, setB) {
    if (setA.size === 0 && setB.size === 0) { return 0; }
    var intersection = setIntersectionSize(setA, setB);
    var union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Count intersection size between two sets.
   */
  function setIntersectionSize(setA, setB) {
    var count = 0;
    setA.forEach(function(item) {
      if (setB.has(item)) { count++; }
    });
    return count;
  }

  /**
   * Detect passive knowledge: steerings with < 10% actionable lines.
   * @param {any[]} nodes
   * @returns {{ id: string, label: string, actionablePercent: number }[]}
   */
  function detectPassiveKnowledge(nodes) {
    var passive = [];
    nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
        var ratio = (n.metadata && n.metadata.actionableRatio !== undefined)
          ? n.metadata.actionableRatio : 1.0;
        if (ratio < 0.10) {
          passive.push({
            id: n.id,
            label: n.label,
            actionablePercent: Math.round(ratio * 100),
          });
        }
      }
    });
    return passive;
  }

  /**
   * Detect low signal-to-noise: steerings with 10% <= ratio < 20%.
   * @param {any[]} nodes
   * @returns {{ id: string, label: string, signalRatio: number }[]}
   */
  function detectLowSignalToNoise(nodes) {
    var lowSignal = [];
    nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
        var ratio = (n.metadata && n.metadata.actionableRatio !== undefined)
          ? n.metadata.actionableRatio : 1.0;
        if (ratio >= 0.10 && ratio < 0.20) {
          lowSignal.push({
            id: n.id,
            label: n.label,
            signalRatio: Math.round(ratio * 100),
          });
        }
      }
    });
    return lowSignal;
  }

  /**
   * Opposite imperative pairs for contradiction detection.
   */
  var OPPOSITE_PAIRS = [
    ['always', 'never'],
    ['use', 'avoid'],
    ['use', 'do_not'],
    ['prefer', 'avoid'],
    ['must', 'do_not'],
    ['shall', 'do_not'],
  ];

  /**
   * Check if two patterns form an opposite pair.
   */
  function isOpposite(patternA, patternB) {
    for (var i = 0; i < OPPOSITE_PAIRS.length; i++) {
      var pair = OPPOSITE_PAIRS[i];
      if ((patternA === pair[0] && patternB === pair[1]) ||
          (patternA === pair[1] && patternB === pair[0])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Detect contradictions between always-loaded steerings.
   * @param {any[]} nodes
   * @returns {Array}
   */
  function detectContradictions(nodes) {
    var alwaysSteerings = nodes.filter(function(n) {
      return n.type && n.type.indexOf('steering-') === 0 &&
        n.metadata &&
        (n.metadata.inclusion === 'always' || n.metadata.inclusion === 'auto') &&
        n.metadata.imperativeLines && n.metadata.imperativeLines.length > 0;
    });

    var contradictions = [];
    for (var i = 0; i < alwaysSteerings.length - 1; i++) {
      for (var j = i + 1; j < alwaysSteerings.length; j++) {
        var found = findContradictions(alwaysSteerings[i], alwaysSteerings[j]);
        for (var k = 0; k < found.length; k++) {
          contradictions.push(found[k]);
        }
      }
    }

    return contradictions;
  }

  /**
   * Find contradictions between two steering nodes.
   */
  function findContradictions(nodeA, nodeB) {
    var linesA = nodeA.metadata.imperativeLines;
    var linesB = nodeB.metadata.imperativeLines;
    var results = [];

    for (var a = 0; a < linesA.length; a++) {
      for (var b = 0; b < linesB.length; b++) {
        if (isOpposite(linesA[a].pattern, linesB[b].pattern) &&
            linesA[a].subject === linesB[b].subject) {
          results.push({
            nodeA: { id: nodeA.id, label: nodeA.label },
            nodeB: { id: nodeB.id, label: nodeB.label },
            snippetA: linesA[a].text,
            snippetB: linesB[b].text,
            conflictType: linesA[a].pattern + ' vs ' + linesB[b].pattern,
          });
        }
      }
    }

    return results;
  }

  /**
   * Detect stale content: steering nodes not modified in a long time with high connectivity.
   * @param {any[]} nodes
   * @param {any[]} links
   * @param {object} incomingMap
   * @param {object} outgoingMap
   * @returns {{ id: string, label: string, stalenessDays: number, degree: number, riskScore: number }[]}
   */
  function detectStaleContentWebview(nodes, links, incomingMap, outgoingMap) {
    var STALENESS_THRESHOLD = 90;
    var DEGREE_THRESHOLD = 3;
    var now = Date.now();
    var results = [];

    nodes.forEach(function(n) {
      if (!n.type || n.type.indexOf('steering-') !== 0) { return; }
      if (!n.metadata || n.metadata.mtime == null) { return; }

      var stalenessDays = Math.floor((now - n.metadata.mtime) / (1000 * 60 * 60 * 24));
      if (stalenessDays < STALENESS_THRESHOLD) { return; }

      var degree = (incomingMap[n.id] || 0) + (outgoingMap[n.id] || 0);
      if (degree < DEGREE_THRESHOLD) { return; }

      results.push({
        id: n.id,
        label: n.label,
        stalenessDays: stalenessDays,
        degree: degree,
        riskScore: stalenessDays * degree,
      });
    });

    results.sort(function(a, b) { return b.riskScore - a.riskScore; });
    return results;
  }

  /**
   * Compute link suggestions between steerings with keyword overlap but no direct edge.
   * Excludes pairs already flagged by Duplicate Intent.
   * @param {any[]} nodes
   * @param {any[]} links
   * @param {any[]} duplicateIntentPairs
   * @returns {{ nodeA: {id,label}, nodeB: {id,label}, similarityScore: number, sharedKeywords: string[] }[]}
   */
  function computeLinkSuggestionsWebview(nodes, links, duplicateIntentPairs) {
    var THRESHOLD = 30;
    var MAX_RESULTS = 10;

    // Filter steering nodes with keywords
    var steeringNodes = nodes.filter(function(n) {
      return n.type && n.type.indexOf('steering-') === 0 &&
        n.metadata && n.metadata.keywords && n.metadata.keywords.length > 0;
    });

    // Build connected pair set (bidirectional)
    var connectedSet = {};
    links.forEach(function(e) {
      connectedSet[e.source + '|||' + e.target] = true;
      connectedSet[e.target + '|||' + e.source] = true;
    });

    // Build duplicate intent set
    var duplicateSet = {};
    (duplicateIntentPairs || []).forEach(function(pair) {
      duplicateSet[pair.nodeA.id + '|||' + pair.nodeB.id] = true;
      duplicateSet[pair.nodeB.id + '|||' + pair.nodeA.id] = true;
    });

    var candidates = [];
    for (var i = 0; i < steeringNodes.length; i++) {
      for (var j = i + 1; j < steeringNodes.length; j++) {
        var a = steeringNodes[i];
        var b = steeringNodes[j];
        var pairKey = a.id + '|||' + b.id;

        if (connectedSet[pairKey]) { continue; }
        if (duplicateSet[pairKey]) { continue; }

        var kwA = a.metadata.keywords;
        var kwB = b.metadata.keywords;
        var overlap = computeKeywordOverlapWebview(kwA, kwB);

        if (overlap < THRESHOLD || overlap >= 60) { continue; }

        var setB = {};
        kwB.forEach(function(kw) { setB[kw] = true; });
        var shared = kwA.filter(function(kw) { return setB[kw]; });

        candidates.push({
          nodeA: { id: a.id, label: a.label },
          nodeB: { id: b.id, label: b.label },
          similarityScore: overlap,
          sharedKeywords: shared,
        });
      }
    }

    candidates.sort(function(a, b) { return b.similarityScore - a.similarityScore; });
    return candidates.slice(0, MAX_RESULTS);
  }

  /**
   * Compute keyword overlap (webview version).
   * @param {string[]} kwA
   * @param {string[]} kwB
   * @returns {number}
   */
  function computeKeywordOverlapWebview(kwA, kwB) {
    if (!kwA || !kwB || kwA.length === 0 || kwB.length === 0) { return 0; }
    var setA = {};
    kwA.forEach(function(k) { setA[k] = true; });
    var setB = {};
    kwB.forEach(function(k) { setB[k] = true; });
    var intersection = 0;
    Object.keys(setA).forEach(function(k) { if (setB[k]) { intersection++; } });
    var minSize = Math.min(Object.keys(setA).length, Object.keys(setB).length);
    if (minSize === 0) { return 0; }
    return Math.round((intersection / minSize) * 100);
  }

  // ─── Semantic Coherence (Rule 21) ──────────────────────────────────────

  var SEMANTIC_KEYWORD_SETS = {
    'steering-policy': ['security', 'auth', 'permission', 'access', 'compliance', 'governance', 'guard', 'policy', 'rule', 'restrict', 'allow', 'deny', 'segurança', 'permissão', 'acesso', 'política', 'regra'],
    'steering-tech': ['deploy', 'pipeline', 'infrastructure', 'architecture', 'stack', 'database', 'migration', 'ci', 'cd', 'docker', 'kubernetes', 'api', 'endpoint', 'server', 'tecnologia', 'arquitetura', 'infraestrutura'],
    'steering-flow': ['flow', 'step', 'sequence', 'process', 'workflow', 'trigger', 'action', 'state', 'transition', 'fluxo', 'etapa', 'processo', 'sequência'],
    'steering-domain': ['domain', 'entity', 'model', 'business', 'rule', 'logic', 'convention', 'pattern', 'domínio', 'entidade', 'modelo', 'negócio', 'regra', 'convenção', 'padrão'],
    'steering-product': ['product', 'feature', 'user', 'story', 'requirement', 'backlog', 'sprint', 'roadmap', 'produto', 'funcionalidade', 'usuário', 'requisito'],
    'steering-agent': ['agent', 'persona', 'prompt', 'llm', 'ai', 'behavior', 'instruction', 'context', 'agente', 'comportamento', 'instrução', 'contexto'],
    'steering-help': ['help', 'faq', 'question', 'answer', 'guide', 'tutorial', 'howto', 'ajuda', 'pergunta', 'resposta', 'guia'],
    'steering-playbook': ['playbook', 'runbook', 'incident', 'procedure', 'checklist', 'step', 'recovery', 'procedimento', 'incidente', 'recuperação'],
    'steering-observability': ['observability', 'monitoring', 'logging', 'tracing', 'alert', 'metric', 'dashboard', 'sla', 'observabilidade', 'monitoramento', 'alerta', 'métrica'],
  };

  /**
   * Compute semantic coherence alerts (webview version).
   * @param {any[]} nodes
   * @returns {{ id: string, label: string, filePath: string, nodeType: string, coherencePercent: number, offTopicHeaders: string[] }[]}
   */
  function computeSemanticCoherenceWebview(nodes) {
    var alerts = [];
    nodes.forEach(function(n) {
      if (!n.type || n.type.indexOf('steering-') !== 0) { return; }
      if (n.type === 'unknown') { return; }
      var keywordSet = SEMANTIC_KEYWORD_SETS[n.type];
      if (!keywordSet) { return; }
      var headers = (n.metadata && n.metadata.sectionHeaders) || [];
      if (headers.length === 0) { return; }
      var offTopicHeaders = [];
      headers.forEach(function(header) {
        var tokens = header.toLowerCase().split(/[^a-záàâãéèêíïóôõöúçñü]+/).filter(function(t) { return t.length > 0; });
        var isOnTopic = tokens.some(function(token) { return keywordSet.indexOf(token) !== -1; });
        if (!isOnTopic) { offTopicHeaders.push(header); }
      });
      var coherence = (headers.length - offTopicHeaders.length) / headers.length;
      if (coherence < 0.70) {
        alerts.push({ id: n.id, label: n.label, filePath: n.filePath || n.id, nodeType: n.type, coherencePercent: coherence, offTopicHeaders: offTopicHeaders });
      }
    });
    return alerts;
  }

  // ─── Circular Hook Dependencies (Rule 22) ─────────────────────────────

  /**
   * Detect circular dependencies between hooks and steerings using DFS with coloring.
   * Only reports cycles containing at least one hook node.
   * @param {any[]} nodes
   * @param {any[]} links
   * @param {number} [maxDepth=10]
   * @returns {{ nodes: {id:string, label:string, type:string}[], cycleLength: number }[]}
   */
  function detectCircularHookDependenciesWebview(nodes, links, maxDepth) {
    if (!maxDepth) { maxDepth = 10; }

    // Filter to hooks and steerings with resolved !== false
    var relevant = nodes.filter(function(n) {
      if (n.resolved === false) { return false; }
      return isHookNodeWebview(n) || (n.type && n.type.indexOf('steering-') === 0);
    });

    var nodeIds = {};
    var nodeMap = {};
    relevant.forEach(function(n) { nodeIds[n.id] = true; nodeMap[n.id] = n; });

    // Build adjacency list
    var adj = {};
    relevant.forEach(function(n) { adj[n.id] = []; });
    links.forEach(function(link) {
      var s = typeof link.source === 'object' ? link.source.id : link.source;
      var t = typeof link.target === 'object' ? link.target.id : link.target;
      if (nodeIds[s] && nodeIds[t]) { adj[s].push(t); }
    });

    // DFS with coloring
    var WHITE = 0, GRAY = 1, BLACK = 2;
    var color = {};
    relevant.forEach(function(n) { color[n.id] = WHITE; });
    var rawCycles = [];

    function dfs(node, path) {
      if (path.length > maxDepth) { return; }
      color[node] = GRAY;
      path.push(node);
      var neighbors = adj[node] || [];
      for (var i = 0; i < neighbors.length; i++) {
        var neighbor = neighbors[i];
        if (color[neighbor] === GRAY) {
          var cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) { rawCycles.push(path.slice(cycleStart)); }
        } else if (color[neighbor] === WHITE) {
          dfs(neighbor, path);
        }
      }
      path.pop();
      color[node] = BLACK;
    }

    relevant.forEach(function(n) {
      if (color[n.id] === WHITE) { dfs(n.id, []); }
    });

    // Filter and deduplicate
    var seen = {};
    var results = [];
    for (var i = 0; i < rawCycles.length; i++) {
      var cycle = rawCycles[i];
      var hasHook = cycle.some(function(id) { return nodeMap[id] && isHookNodeWebview(nodeMap[id]); });
      if (!hasHook) { continue; }
      var key = canonicalizeCycleWebview(cycle);
      if (seen[key]) { continue; }
      seen[key] = true;
      var cycleNodes = cycle.map(function(id) {
        var n = nodeMap[id];
        return { id: id, label: n ? n.label : id, type: n ? n.type : 'unknown' };
      });
      results.push({ nodes: cycleNodes, cycleLength: cycle.length });
    }
    return results;
  }

  function isHookNodeWebview(node) {
    return node.type === 'hook-auto' || node.type === 'hook-manual';
  }

  function canonicalizeCycleWebview(cycle) {
    if (cycle.length === 0) { return ''; }
    var minIdx = 0;
    for (var i = 1; i < cycle.length; i++) {
      if (cycle[i] < cycle[minIdx]) { minIdx = i; }
    }
    var rotated = cycle.slice(minIdx).concat(cycle.slice(0, minIdx));
    return rotated.join('|||');
  }

  // ─── Structure Validations ─────────────────────────────────────────────

  /**
   * All IDE events available for hook coverage mapping.
   */
  var ALL_IDE_EVENTS = [
    'fileEdited', 'fileCreated', 'fileDeleted', 'userTriggered',
    'promptSubmit', 'agentStop', 'preToolUse', 'postToolUse',
    'preTaskExecution', 'postTaskExecution',
  ];

  /**
   * Compute hook coverage map: which IDE events have hooks configured.
   * @param {any[]} nodes
   * @returns {{ covered: {event,hookCount}[], uncovered: {event}[] }}
   */
  function computeHookCoverageMap(nodes) {
    var coverage = {};
    ALL_IDE_EVENTS.forEach(function(event) { coverage[event] = 0; });

    nodes.forEach(function(n) {
      if (n.type === 'hook-auto' || n.type === 'hook-manual') {
        var whenType = n.metadata && n.metadata.whenType;
        if (whenType && coverage[whenType] !== undefined) {
          coverage[whenType]++;
        }
      }
    });

    var covered = [];
    var uncovered = [];
    ALL_IDE_EVENTS.forEach(function(event) {
      if (coverage[event] > 0) {
        covered.push({ event: event, hookCount: coverage[event] });
      } else {
        uncovered.push({ event: event });
      }
    });

    return { covered: covered, uncovered: uncovered };
  }

  /**
   * Decision keywords for decision path completeness check.
   */
  var DECISION_KEYWORDS = [
    'decide', 'choose', 'when', 'condition', 'criteria',
    'decida', 'escolha', 'quando', 'condição', 'critério',
  ];

  /**
   * Check decision path completeness: hook→steering chains.
   * @param {any[]} nodes
   * @param {any[]} links
   * @returns {{ hooksWithoutDecisionSteering: Array, steeringsWithoutHook: Array }}
   */
  function checkDecisionPathCompleteness(nodes, links) {
    var steeringIds = new Set();
    nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
        steeringIds.add(n.id);
      }
    });

    // Build hook→steering edges
    var hookToSteerings = {};
    var steeringFromHooks = new Set();
    links.forEach(function(link) {
      var s = typeof link.source === 'object' ? link.source.id : link.source;
      var t = typeof link.target === 'object' ? link.target.id : link.target;
      var sourceNode = nodes.find(function(n) { return n.id === s; });
      if (sourceNode && (sourceNode.type === 'hook-auto' || sourceNode.type === 'hook-manual')) {
        if (steeringIds.has(t)) {
          if (!hookToSteerings[s]) { hookToSteerings[s] = []; }
          hookToSteerings[s].push(t);
          steeringFromHooks.add(t);
        }
      }
    });

    // Hooks without any steering reference
    var hooksWithoutDecisionSteering = [];
    nodes.forEach(function(n) {
      if (n.type === 'hook-auto' || n.type === 'hook-manual') {
        var steerings = hookToSteerings[n.id] || [];
        if (steerings.length === 0) {
          hooksWithoutDecisionSteering.push({
            id: n.id, label: n.label, gap: 'no-steering',
          });
        }
      }
    });

    // Decision steerings without hook trigger
    var steeringsWithoutHook = [];
    nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0 && hasDecisionContent(n)) {
        var inclusion = (n.metadata && n.metadata.inclusion) || 'always';
        if (inclusion !== 'always' && inclusion !== 'auto') {
          if (!steeringFromHooks.has(n.id)) {
            steeringsWithoutHook.push({
              id: n.id, label: n.label, gap: 'no-hook',
            });
          }
        }
      }
    });

    return {
      hooksWithoutDecisionSteering: hooksWithoutDecisionSteering,
      steeringsWithoutHook: steeringsWithoutHook,
    };
  }

  /**
   * Check if a node has decision-related content in its keywords.
   */
  function hasDecisionContent(node) {
    var keywords = (node.metadata && node.metadata.keywords) || [];
    for (var i = 0; i < keywords.length; i++) {
      if (DECISION_KEYWORDS.indexOf(keywords[i].toLowerCase()) !== -1) {
        return true;
      }
    }
    return false;
  }

  /**
   * Keywords for quality gate detection.
   */
  var REVIEW_KEYWORDS_HOOK = [
    'review', 'validate', 'check', 'verify', 'lint', 'test',
    'quality', 'standard', 'convention', 'padrão', 'qualidade',
    'validar', 'verificar',
  ];

  var QUALITY_GATE_KEYWORDS = [
    'review', 'code-review', 'quality', 'standard', 'convention',
    'test', 'lint', 'ci', 'pipeline', 'approval',
    'merge-request', 'pull-request',
  ];

  /**
   * Check quality gate maturity level.
   * @param {any[]} nodes
   * @param {any[]} links
   * @returns {object} QualityGateResult
   */
  function checkQualityGate(nodes, links) {
    var selfReviewHooks = findSelfReviewHooks(nodes);
    var qualitySteerings = findQualitySteerings(nodes);
    var postTaskReviewHooks = findPostTaskReviewHooks(nodes, links, qualitySteerings);

    var hasSelfReview = selfReviewHooks.length > 0;
    var hasQualitySteering = qualitySteerings.length > 0;
    var hasPostTaskReview = postTaskReviewHooks.length > 0;

    var maturityLevel = 0;
    if (hasSelfReview && hasQualitySteering && hasPostTaskReview) {
      maturityLevel = 2;
    } else if (hasSelfReview || hasQualitySteering) {
      maturityLevel = 1;
    }

    return {
      maturityLevel: maturityLevel,
      selfReviewHooks: selfReviewHooks.map(function(n) { return { id: n.id, label: n.label }; }),
      qualitySteerings: qualitySteerings.map(function(n) { return { id: n.id, label: n.label }; }),
      postTaskReviewHooks: postTaskReviewHooks.map(function(n) { return { id: n.id, label: n.label }; }),
      missing: {
        needsSelfReview: !hasSelfReview,
        needsQualitySteering: !hasQualitySteering,
        needsPostTaskReview: !hasPostTaskReview,
      },
    };
  }

  /**
   * Find hooks with preToolUse/postToolUse that have review keywords.
   */
  function findSelfReviewHooks(nodes) {
    return nodes.filter(function(n) {
      if (n.type !== 'hook-auto' && n.type !== 'hook-manual') { return false; }
      var whenType = n.metadata && n.metadata.whenType;
      if (whenType !== 'preToolUse' && whenType !== 'postToolUse') { return false; }
      var desc = ((n.metadata && n.metadata.description) || '').toLowerCase();
      var label = n.label.toLowerCase();
      return REVIEW_KEYWORDS_HOOK.some(function(kw) {
        return desc.indexOf(kw) !== -1 || label.indexOf(kw) !== -1;
      });
    });
  }

  /**
   * Find steerings with quality gate keywords.
   */
  function findQualitySteerings(nodes) {
    return nodes.filter(function(n) {
      if (!n.type || n.type.indexOf('steering-') !== 0) { return false; }
      var keywords = (n.metadata && n.metadata.keywords) || [];
      var label = n.label.toLowerCase();
      return QUALITY_GATE_KEYWORDS.some(function(kw) {
        return keywords.indexOf(kw) !== -1 || label.indexOf(kw) !== -1;
      });
    });
  }

  /**
   * Find post-task hooks that reference quality steerings.
   */
  function findPostTaskReviewHooks(nodes, links, qualitySteerings) {
    var qualityIds = new Set();
    qualitySteerings.forEach(function(n) { qualityIds.add(n.id); });

    return nodes.filter(function(n) {
      if (n.type !== 'hook-auto' && n.type !== 'hook-manual') { return false; }
      var whenType = n.metadata && n.metadata.whenType;
      if (whenType !== 'postTaskExecution' && whenType !== 'agentStop') { return false; }
      return links.some(function(link) {
        var s = typeof link.source === 'object' ? link.source.id : link.source;
        var t = typeof link.target === 'object' ? link.target.id : link.target;
        return s === n.id && qualityIds.has(t);
      });
    });
  }

  /**
   * Keywords for DML protection detection.
   */
  var DML_KEYWORDS_HOOK = [
    'sql', 'database', 'query', 'insert', 'update', 'delete',
    'drop', 'truncate', 'alter', 'banco', 'dml', 'migration', 'schema',
  ];

  var DML_KEYWORDS_STEERING = [
    'database', 'sql', 'dml', 'migration', 'backup', 'rollback',
    'transaction', 'production', 'staging', 'environment',
  ];

  var RISK_KEYWORDS = [
    'risk', 'danger', 'impact', 'rollback', 'backup', 'production',
    'warning', 'confirm', 'perigo', 'risco', 'impacto', 'reversível',
    'irreversível', 'destructive', 'destrutivo',
  ];

  /**
   * Check DML protection maturity level.
   * @param {any[]} nodes
   * @param {any[]} links
   * @returns {object} DmlProtectionResult
   */
  function checkDmlProtection(nodes, links) {
    var dmlHooks = findDmlHooks(nodes);
    var dmlSteerings = findDmlSteerings(nodes);
    var riskSteerings = findRiskSteerings(dmlSteerings);
    var hooksWithRiskSteering = findHooksWithRiskSteering(dmlHooks, links, riskSteerings);

    var hasDmlHook = dmlHooks.length > 0;
    var hasDmlSteering = dmlSteerings.length > 0;
    var hasRiskIntegration = hooksWithRiskSteering.length > 0;

    var maturityLevel = 0;
    if (hasDmlHook && hasRiskIntegration) {
      maturityLevel = 2;
    } else if (hasDmlHook || hasDmlSteering) {
      maturityLevel = 1;
    }

    return {
      maturityLevel: maturityLevel,
      dmlHooks: dmlHooks.map(function(n) { return { id: n.id, label: n.label }; }),
      dmlSteerings: dmlSteerings.map(function(n) { return { id: n.id, label: n.label }; }),
      riskSteerings: riskSteerings.map(function(n) { return { id: n.id, label: n.label }; }),
      hooksWithRiskSteering: hooksWithRiskSteering.map(function(n) { return { id: n.id, label: n.label }; }),
      missing: {
        needsDmlHook: !hasDmlHook,
        needsDmlSteering: !hasDmlSteering,
        needsRiskIntegration: !hasRiskIntegration,
      },
    };
  }

  /**
   * Find preToolUse hooks with DML keywords.
   */
  function findDmlHooks(nodes) {
    return nodes.filter(function(n) {
      if (n.type !== 'hook-auto' && n.type !== 'hook-manual') { return false; }
      var whenType = n.metadata && n.metadata.whenType;
      if (whenType !== 'preToolUse') { return false; }
      var desc = ((n.metadata && n.metadata.description) || '').toLowerCase();
      var label = n.label.toLowerCase();
      return DML_KEYWORDS_HOOK.some(function(kw) {
        return desc.indexOf(kw) !== -1 || label.indexOf(kw) !== -1;
      });
    });
  }

  /**
   * Find steerings with DML protection keywords.
   */
  function findDmlSteerings(nodes) {
    return nodes.filter(function(n) {
      if (!n.type || n.type.indexOf('steering-') !== 0) { return false; }
      var keywords = (n.metadata && n.metadata.keywords) || [];
      var label = n.label.toLowerCase();
      return DML_KEYWORDS_STEERING.some(function(kw) {
        return keywords.indexOf(kw) !== -1 || label.indexOf(kw) !== -1;
      });
    });
  }

  /**
   * Filter DML steerings that also have risk assessment keywords.
   */
  function findRiskSteerings(dmlSteerings) {
    return dmlSteerings.filter(function(n) {
      var keywords = (n.metadata && n.metadata.keywords) || [];
      return RISK_KEYWORDS.some(function(kw) {
        return keywords.indexOf(kw) !== -1;
      });
    });
  }

  /**
   * Find DML hooks that reference risk-assessment steerings.
   */
  function findHooksWithRiskSteering(dmlHooks, links, riskSteerings) {
    var riskIds = new Set();
    riskSteerings.forEach(function(n) { riskIds.add(n.id); });

    return dmlHooks.filter(function(hook) {
      return links.some(function(link) {
        var s = typeof link.source === 'object' ? link.source.id : link.source;
        var t = typeof link.target === 'object' ? link.target.id : link.target;
        return s === hook.id && riskIds.has(t);
      });
    });
  }

  /**
   * Evaluate whether a hook prompt is self-sufficient.
   * Criteria: non-empty, >= 20 words, contains imperative verbs.
   * @param {string} content
   * @returns {boolean}
   */
  function isPromptSelfSufficient(content) {
    if (!content) { return false; }
    var words = content.trim().split(/\s+/);
    if (words.length < 20) { return false; }
    var imperativePattern = /\b(analise|verifique|garanta|implemente|crie|remova|adicione|corrija|valide|reporte|documente|teste|refatore|otimize|configure|monitore|ensure|verify|check|validate|create|remove|add|fix|report|document|test|refactor|optimize|configure|monitor|analyze|review|implement|always|never|must|shall|should)\b/i;
    return imperativePattern.test(content);
  }

  // ─── Guardrail Coverage Analysis (Rule 23) ─────────────────────────────

  var GUARDRAIL_RISK_PATTERNS_WV = {
    database: {
      hookPatterns: ['sql', 'database', 'query', 'dml', 'migration'],
      steeringPatterns: ['database', 'sql', 'banco', 'dados', 'migration', 'query'],
    },
    deploy: {
      hookPatterns: ['deploy', 'publish', 'push', 'release', 'ship'],
      steeringPatterns: ['deploy', 'release', 'publish', 'publicação', 'ship', 'rollback'],
    },
    secrets: {
      hookPatterns: ['write', 'file', 'create'],
      steeringPatterns: ['secret', 'credential', 'env', 'token', 'password', 'chave', 'segredo', 'api-key'],
    },
    tests: {
      hookPatterns: ['test', 'coverage', 'teste', 'cobertura'],
      steeringPatterns: ['test', 'testing', 'tdd', 'coverage', 'teste', 'cobertura'],
    },
    infrastructure: {
      hookPatterns: ['terraform', 'docker', 'k8s', 'kubernetes', 'cloudformation', 'ansible', 'helm'],
      steeringPatterns: ['infra', 'infrastructure', 'terraform', 'docker', 'kubernetes', 'cloud', 'devops'],
    },
  };

  var ALL_RISK_CATEGORIES_WV = ['database', 'deploy', 'secrets', 'tests', 'infrastructure'];

  function checkHookForCategoryWv(nodes, category) {
    var patterns = GUARDRAIL_RISK_PATTERNS_WV[category].hookPatterns;
    return nodes.some(function(n) {
      if (n.type !== 'hook-auto' && n.type !== 'hook-manual') { return false; }
      var desc = ((n.metadata && n.metadata.description) || '').toLowerCase();
      var prompt = ((n.metadata && n.metadata.hookPrompt) || '').toLowerCase();
      var label = n.label.toLowerCase();
      return patterns.some(function(p) { return desc.indexOf(p) !== -1 || prompt.indexOf(p) !== -1 || label.indexOf(p) !== -1; });
    });
  }

  function checkSteeringForCategoryWv(nodes, category) {
    var patterns = GUARDRAIL_RISK_PATTERNS_WV[category].steeringPatterns;
    return nodes.some(function(n) {
      if (!n.type || n.type.indexOf('steering-') !== 0) { return false; }
      var keywords = ((n.metadata && n.metadata.keywords) || []).map(function(k) { return k.toLowerCase(); });
      var label = n.label.toLowerCase();
      return patterns.some(function(p) { return keywords.indexOf(p) !== -1 || label.indexOf(p) !== -1; });
    });
  }

  function isCategoryRelevantWv(nodes, category, dmlLevel) {
    if (category === 'database' && (dmlLevel || 0) >= 1) { return false; }
    if (category === 'tests') {
      return nodes.some(function(n) { return n.type === 'hook-auto' || n.type === 'hook-manual'; });
    }
    return checkHookForCategoryWv(nodes, category) || checkSteeringForCategoryWv(nodes, category);
  }

  function analyzeGuardrailCoverageWebview(nodes, dmlLevel) {
    var categories = ALL_RISK_CATEGORIES_WV.map(function(category) {
      var hasHook = checkHookForCategoryWv(nodes, category);
      var hasSteering = checkSteeringForCategoryWv(nodes, category);
      var isRelevant = isCategoryRelevantWv(nodes, category, dmlLevel);
      var maturityLevel = (hasHook && hasSteering) ? 2 : (hasHook || hasSteering) ? 1 : 0;
      var suggestion = undefined;
      if (isRelevant && maturityLevel < 2) {
        var missing = (!hasHook && !hasSteering) ? 'both' : !hasHook ? 'hook' : 'steering';
        suggestion = { text: 'Consider adding ' + missing + ' for ' + category + ' protection', missing: missing, example: '' };
      }
      return { category: category, maturityLevel: maturityLevel, hasHook: hasHook, hasSteering: hasSteering, isRelevant: isRelevant, suggestion: suggestion };
    });
    var relevant = categories.filter(function(c) { return c.isRelevant; });
    var overallMaturity = relevant.length > 0 ? relevant.reduce(function(s, c) { return s + c.maturityLevel; }, 0) / relevant.length : 0;
    return { categories: categories, overallMaturity: overallMaturity };
  }

  // ─── Instruction Specificity (Rule 24) ─────────────────────────────────

  var TECHNOLOGY_MARKERS_WV = [
    'typescript', 'javascript', 'react', 'angular', 'vue', 'svelte',
    'node', 'express', 'fastify', 'nest', 'next', 'nuxt',
    'sql', 'postgres', 'mysql', 'mongodb', 'redis', 'dynamodb',
    'docker', 'kubernetes', 'terraform', 'aws', 'azure', 'gcp',
    'python', 'java', 'rust', 'go', 'ruby', 'php', 'csharp',
    'webpack', 'esbuild', 'vite', 'rollup', 'parcel',
    'eslint', 'prettier', 'jest', 'mocha', 'vitest', 'cypress',
    'git', 'github', 'gitlab', 'npm', 'yarn', 'pnpm',
    'rest', 'graphql', 'grpc', 'websocket', 'http', 'https',
    'json', 'yaml', 'toml', 'xml', 'csv', 'markdown',
  ];

  var FILE_EXTENSION_MARKERS_WV = [
    '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.rs', '.go',
    '.md', '.json', '.yaml', '.yml', '.toml', '.xml', '.html', '.css',
    '.env', '.config', '.lock', '.sql', '.sh', '.dockerfile',
  ];

  var PATH_PREFIX_MARKERS_WV = [
    'src/', 'dist/', 'test/', 'tests/', 'lib/', 'bin/',
    'config/', 'scripts/', '.kiro/', '.github/', '.vscode/',
    'node_modules/', 'packages/', 'apps/',
  ];

  var CAMEL_CASE_RE_WV = /[a-z][a-zA-Z]*[A-Z][a-zA-Z]*/;
  var PASCAL_CASE_RE_WV = /[A-Z][a-z]+[A-Z][a-zA-Z]*/;
  var MEASURABLE_UNIT_RE_WV = /\b\d+\s*(ms|s|lines?|words?|chars?|bytes?|kb|mb|%)\b/i;
  var MEASURABLE_OP_RE_WV = /[<>=!]+\s*\d+/;

  function hasSpecificityMarkerWv(lineText) {
    var lower = lineText.toLowerCase();
    var words = lower.split(/[^a-z0-9]+/).filter(function(w) { return w.length > 0; });
    if (TECHNOLOGY_MARKERS_WV.some(function(t) { return words.indexOf(t) !== -1; })) { return true; }
    if (FILE_EXTENSION_MARKERS_WV.some(function(ext) { return lower.indexOf(ext) !== -1; })) { return true; }
    if (PATH_PREFIX_MARKERS_WV.some(function(p) { return lower.indexOf(p) !== -1; })) { return true; }
    if (lineText.indexOf('`') !== -1) { return true; }
    if (CAMEL_CASE_RE_WV.test(lineText)) { return true; }
    if (PASCAL_CASE_RE_WV.test(lineText)) { return true; }
    if (MEASURABLE_UNIT_RE_WV.test(lineText)) { return true; }
    if (MEASURABLE_OP_RE_WV.test(lineText)) { return true; }
    return false;
  }

  function analyzeInstructionSpecificityWebview(nodes) {
    var alerts = [];
    var totalScore = 0;
    var analyzedCount = 0;

    nodes.forEach(function(n) {
      if (!n.type || n.type.indexOf('steering-') !== 0) { return; }
      var lines = n.metadata && n.metadata.imperativeLines;
      if (!lines || lines.length === 0) { return; }

      analyzedCount++;
      var specificCount = 0;
      for (var i = 0; i < lines.length; i++) {
        if (hasSpecificityMarkerWv(lines[i].text)) { specificCount++; }
      }
      var score = Math.round((specificCount / lines.length) * 100);
      totalScore += score;

      if (score < 50) {
        var vagueLines = lines.filter(function(l) { return !hasSpecificityMarkerWv(l.text); });
        alerts.push({
          id: n.id,
          label: n.label,
          score: score,
          vagueCount: vagueLines.length,
          specificCount: specificCount,
          vagueExamples: vagueLines.slice(0, 3).map(function(l) { return l.text; }),
        });
      }
    });

    var averageScore = analyzedCount > 0 ? Math.round(totalScore / analyzedCount) : 100;
    return { alerts: alerts, averageScore: averageScore };
  }

  // ─── Context Budget Estimator (Rule 25) ────────────────────────────────

  var DEFAULT_MAX_BUDGET_WV = 200000;

  /**
   * Estimates token count for a content string.
   * Heuristic: Math.ceil(wordCount * 1.3).
   */
  function estimateTokenCountWebview(content) {
    if (!content) { return 0; }
    var words = content.split(/\s+/).filter(function(w) { return w.length > 0; });
    if (words.length === 0) { return 0; }
    return Math.ceil(words.length * 1.3);
  }

  /**
   * Checks if a node is an always-loaded steering.
   */
  function isAlwaysLoadedSteeringWebview(node) {
    if (!node.type || node.type.indexOf('steering-') !== 0) { return false; }
    var meta = node.metadata;
    if (!meta) { return false; }
    return meta.alwaysApply === true || meta.autoInclusion === true;
  }

  /**
   * Extracts content from a steering node for token estimation.
   */
  function getSteeringContentWebview(node) {
    var meta = node.metadata;
    if (meta && meta.content) { return meta.content; }
    if (meta && meta.imperativeLines && meta.imperativeLines.length > 0) {
      return meta.imperativeLines.map(function(l) { return l.text; }).join(' ');
    }
    return node.label || '';
  }

  /**
   * Estimates context budget consumption by always-loaded steerings.
   * @param {any[]} nodes
   * @returns {{ totalTokens: number, budgetPercent: number, maxBudget: number, perSteering: Array, suggestion?: string }}
   */
  function estimateContextBudgetWebview(nodes) {
    var maxBudget = DEFAULT_MAX_BUDGET_WV;
    var alwaysSteerings = nodes.filter(isAlwaysLoadedSteeringWebview);

    var perSteering = alwaysSteerings.map(function(node) {
      var content = getSteeringContentWebview(node);
      var tokens = estimateTokenCountWebview(content);
      var percent = Math.round((tokens / maxBudget) * 100);
      return { id: node.id, label: node.label, tokens: tokens, percent: percent };
    });

    var totalTokens = perSteering.reduce(function(sum, s) { return sum + s.tokens; }, 0);
    var budgetPercent = Math.round((totalTokens / maxBudget) * 100);

    var suggestion = budgetPercent > 15
      ? 'Consider reviewing always-loaded steerings \u2014 they consume ' + budgetPercent + '% of the estimated context budget.'
      : undefined;

    return { totalTokens: totalTokens, budgetPercent: budgetPercent, maxBudget: maxBudget, perSteering: perSteering, suggestion: suggestion };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Jailbreak Protection (Rule 26)
  // ─────────────────────────────────────────────────────────────────────────

  var IDENTITY_LOCK_PATTERNS_WV = [
    'i am kiro', 'my identity', 'never change persona',
    'do not impersonate', 'you are kiro',
  ];

  var STRONG_LANGUAGE_PATTERNS_WV = ['NEVER', 'FORBIDDEN', 'MUST NOT', 'DO NOT', 'ABSOLUTELY'];

  var DESTRUCTIVE_TOOL_PATTERNS_WV = ['delete', 'remove', 'drop', 'destroy', 'truncate', 'force'];

  var STOP_WORDS_WV = { 'the': 1, 'a': 1, 'an': 1, 'is': 1, 'are': 1, 'to': 1, 'for': 1, 'of': 1, 'in': 1, 'on': 1, 'with': 1, 'and': 1, 'or': 1, 'that': 1, 'this': 1, 'it': 1, 'be': 1 };

  function analyzeJailbreakProtectionWebview(nodes) {
    var hasIdentityLock = detectIdentityLockWebview(nodes);
    var strongRuleCount = countStrongLanguageWebview(nodes);
    var redundantRuleCount = countRedundantRulesWebview(nodes);
    var destructiveHookCount = countDestructiveHooksWebview(nodes);
    var hasAbsoluteRules = hasIdentityLock || strongRuleCount >= 3;
    var hasBlockingHooks = destructiveHookCount >= 1;
    var hasRedundancy = redundantRuleCount >= 1;
    var maturityLevel = (hasAbsoluteRules && hasBlockingHooks && hasRedundancy) ? 2 :
      (hasAbsoluteRules || hasBlockingHooks) ? 1 : 0;
    var suggestions = [];
    if (maturityLevel < 2) {
      if (!hasIdentityLock && strongRuleCount < 3) {
        suggestions.push('Consider adding identity lock statements to always-loaded steerings.');
      }
      if (destructiveHookCount === 0) {
        suggestions.push('Consider adding preToolUse hooks for destructive operations.');
      }
      if (redundantRuleCount === 0 && maturityLevel >= 1) {
        suggestions.push('Consider reinforcing critical rules by repeating them in 2+ steerings.');
      }
    }
    return { maturityLevel: maturityLevel, hasIdentityLock: hasIdentityLock, strongRuleCount: strongRuleCount, redundantRuleCount: redundantRuleCount, destructiveHookCount: destructiveHookCount, suggestions: suggestions };
  }

  function detectIdentityLockWebview(nodes) {
    var steerings = nodes.filter(isAlwaysLoadedSteeringWebview);
    for (var i = 0; i < steerings.length; i++) {
      var lines = getCheckableLinesWebview(steerings[i]);
      for (var j = 0; j < lines.length; j++) {
        var lower = lines[j].toLowerCase();
        for (var k = 0; k < IDENTITY_LOCK_PATTERNS_WV.length; k++) {
          if (lower.indexOf(IDENTITY_LOCK_PATTERNS_WV[k]) !== -1) { return true; }
        }
      }
    }
    return false;
  }

  function getCheckableLinesWebview(node) {
    var lines = [];
    var meta = node.metadata || {};
    if (meta.imperativeLines) {
      meta.imperativeLines.forEach(function(imp) { lines.push(imp.text); });
    }
    if (meta.content) {
      var contentLines = meta.content.split('\n').slice(0, 10);
      contentLines.forEach(function(cl) { lines.push(cl); });
    }
    return lines;
  }

  function countStrongLanguageWebview(nodes) {
    var count = 0;
    var steerings = nodes.filter(isAlwaysLoadedSteeringWebview);
    for (var i = 0; i < steerings.length; i++) {
      var lines = getAllNodeLinesWebview(steerings[i]);
      for (var j = 0; j < lines.length; j++) {
        for (var k = 0; k < STRONG_LANGUAGE_PATTERNS_WV.length; k++) {
          if (lines[j].indexOf(STRONG_LANGUAGE_PATTERNS_WV[k]) !== -1) { count++; break; }
        }
      }
    }
    return count;
  }

  function getAllNodeLinesWebview(node) {
    var lines = [];
    var meta = node.metadata || {};
    if (meta.imperativeLines) {
      meta.imperativeLines.forEach(function(imp) { lines.push(imp.text); });
    }
    if (meta.content) {
      meta.content.split('\n').forEach(function(cl) { lines.push(cl); });
    }
    return lines;
  }

  function countRedundantRulesWebview(nodes) {
    var steerings = nodes.filter(isAlwaysLoadedSteeringWebview);
    var subjectMap = {};
    for (var i = 0; i < steerings.length; i++) {
      var lines = (steerings[i].metadata && steerings[i].metadata.imperativeLines) || [];
      for (var j = 0; j < lines.length; j++) {
        var subject = extractSubjectWebview(lines[j].text);
        if (!subject) { continue; }
        if (!subjectMap[subject]) { subjectMap[subject] = {}; }
        subjectMap[subject][steerings[i].id] = true;
      }
    }
    var count = 0;
    Object.keys(subjectMap).forEach(function(s) {
      if (Object.keys(subjectMap[s]).length >= 2) { count++; }
    });
    return count;
  }

  function extractSubjectWebview(lineText) {
    var words = lineText.toLowerCase().split(/\s+/).filter(function(w) {
      return w.length > 2 && !STOP_WORDS_WV[w];
    });
    return words.slice(0, 4).join(' ');
  }

  function countDestructiveHooksWebview(nodes) {
    var count = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.type !== 'hook-auto') { continue; }
      if (!n.metadata || n.metadata.whenType !== 'preToolUse') { continue; }
      var text = ((n.metadata.description || '') + ' ' + (n.metadata.hookPrompt || '') + ' ' + (n.label || '')).toLowerCase();
      for (var j = 0; j < DESTRUCTIVE_TOOL_PATTERNS_WV.length; j++) {
        if (text.indexOf(DESTRUCTIVE_TOOL_PATTERNS_WV[j]) !== -1) { count++; break; }
      }
    }
    return count;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Conflict Resolution Priority (Rule 27)
  // ─────────────────────────────────────────────────────────────────────────

  var PRIORITY_LANGUAGE_PATTERNS_WV = [
    'priority', 'precedence', 'overrides', 'takes priority',
    'in case of conflict', 'higher priority', 'lower priority',
    'has priority over', 'prioridade', 'prevalece',
    'em caso de conflito', 'tem prioridade sobre', 'sobrepõe', 'precedência',
  ];

  function getAllContentLinesWebview(node) {
    var meta = node.metadata || {};
    if (meta.content) { return meta.content.split('\n'); }
    if (meta.imperativeLines && meta.imperativeLines.length > 0) {
      return meta.imperativeLines.map(function(l) { return l.text; });
    }
    return [];
  }

  function analyzeConflictResolutionWebview(nodes, contradictionCount) {
    var effectiveContradictions = contradictionCount || 0;
    var alwaysSteerings = nodes.filter(isAlwaysLoadedSteeringWebview);
    var alwaysLoadedCount = alwaysSteerings.length;
    var statements = [];
    for (var i = 0; i < alwaysSteerings.length; i++) {
      var lines = getAllContentLinesWebview(alwaysSteerings[i]);
      for (var j = 0; j < lines.length; j++) {
        var lowerLine = lines[j].toLowerCase();
        for (var k = 0; k < PRIORITY_LANGUAGE_PATTERNS_WV.length; k++) {
          if (lowerLine.indexOf(PRIORITY_LANGUAGE_PATTERNS_WV[k]) !== -1) {
            statements.push({ steeringId: alwaysSteerings[i].id, text: lines[j].trim() });
            break;
          }
        }
      }
    }
    var hasPriorityDefined = statements.length > 0;
    var isRelevant = effectiveContradictions > 0 || alwaysLoadedCount >= 3;
    var suggestion = (!hasPriorityDefined && isRelevant)
      ? 'Consider defining a priority hierarchy between steerings to resolve potential contradictions. Example: "In case of conflict, security-policies takes priority over code-conventions."'
      : undefined;
    return { hasPriorityDefined: hasPriorityDefined, priorityStatements: statements, suggestion: suggestion };
  }

  // ─── Feedback Loop Completeness (Rule 28) ──────────────────────────────

  var FL_MIN_ACTION_WORD_COUNT = 20;
  var FL_MIN_COMPONENTS_TO_FLAG = 3;
  var FL_POST_EVENT_TYPES = ['postTaskExecution', 'postToolUse'];

  function getConnectedSteeringIdsWebview(nodeId, nodes, links) {
    var ids = [];
    for (var i = 0; i < links.length; i++) {
      var s = typeof links[i].source === 'object' ? links[i].source.id : links[i].source;
      var t = typeof links[i].target === 'object' ? links[i].target.id : links[i].target;
      var otherId = s === nodeId ? t : (t === nodeId ? s : null);
      if (!otherId) { continue; }
      var otherNode = nodes.find(function(n) { return n.id === otherId; });
      if (otherNode && otherNode.type && otherNode.type.indexOf('steering-') === 0) {
        ids.push(otherId);
      }
    }
    return ids;
  }

  function analyzeFeedbackLoopsWebview(nodes, links) {
    var hooks = nodes.filter(function(n) {
      return n.type === 'hook-auto' || n.type === 'hook-manual';
    });
    var completeLoops = 0;
    var incompleteLoops = [];

    for (var i = 0; i < hooks.length; i++) {
      var hook = hooks[i];
      var decision = getConnectedSteeringIdsWebview(hook.id, nodes, links).length > 0;
      var prompt = (hook.metadata && hook.metadata.hookPrompt) || (hook.metadata && hook.metadata.description) || '';
      var words = prompt.split(/\s+/).filter(function(w) { return w.length > 0; });
      var action = words.length >= FL_MIN_ACTION_WORD_COUNT;
      var verification = false;
      var connSteerings = getConnectedSteeringIdsWebview(hook.id, nodes, links);
      if (connSteerings.length > 0) {
        var postHooks = nodes.filter(function(n) {
          return (n.type === 'hook-auto' || n.type === 'hook-manual') &&
            n.id !== hook.id &&
            FL_POST_EVENT_TYPES.indexOf(n.metadata && n.metadata.whenType) !== -1;
        });
        for (var p = 0; p < postHooks.length; p++) {
          var postSteerings = getConnectedSteeringIdsWebview(postHooks[p].id, nodes, links);
          var hasShared = connSteerings.some(function(s) { return postSteerings.indexOf(s) !== -1; });
          if (hasShared) { verification = true; break; }
        }
      }
      var count = 1 + (decision ? 1 : 0) + (action ? 1 : 0) + (verification ? 1 : 0);
      if (count === 4) {
        completeLoops++;
      } else if (count < FL_MIN_COMPONENTS_TO_FLAG) {
        var missing = [];
        if (!decision) { missing.push('Decision'); }
        if (!action) { missing.push('Action'); }
        if (!verification) { missing.push('Verification'); }
        incompleteLoops.push({
          hookId: hook.id, hookLabel: hook.label,
          hasDetection: true, hasDecision: decision,
          hasAction: action, hasVerification: verification, missing: missing,
        });
      }
    }
    var suggestion;
    if (incompleteLoops.length > 0) {
      var counts = { Decision: 0, Action: 0, Verification: 0 };
      incompleteLoops.forEach(function(loop) {
        loop.missing.forEach(function(c) { if (counts[c] !== undefined) { counts[c]++; } });
      });
      var sorted = Object.keys(counts).filter(function(k) { return counts[k] > 0; })
        .sort(function(a, b) { return counts[b] - counts[a]; });
      var mostCommon = sorted.slice(0, 2).join(', ');
      suggestion = 'Consider completing feedback loops for ' + incompleteLoops.length + ' hook(s) \u2014 most commonly missing: ' + mostCommon + '.';
    }
    return { completeLoops: completeLoops, incompleteLoops: incompleteLoops, suggestion: suggestion };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Health Score Computation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute unified health score from analysis data.
   * Formula: connectivity×0.3 + contentQuality×0.25 + completeness×0.25 + maturity×0.2
   * @param {object} analysis - Partial analysis result with issue arrays
   * @param {number} totalNodes - Total number of nodes in the graph
   * @returns {{ score: number, connectivity: number, contentQuality: number, completeness: number, maturity: number }}
   */
  function computeHealthScore(analysis, totalNodes) {
    if (totalNodes === 0) {
      return { score: 0, connectivity: 0, contentQuality: 0, completeness: 0, maturity: 0 };
    }

    var connectivityIssues = analysis.steeringsSoltos.length + analysis.vinculosFrageis.length +
      analysis.arquivosSemContexto.length + analysis.coverageGaps.length +
      (analysis.deadLoops || []).length + (analysis.hopsToReach || []).length;
    var connectivity = Math.round(Math.max(0, 100 - (connectivityIssues / totalNodes) * 100));

    var contentIssues = (analysis.passiveKnowledge || []).length + (analysis.signalToNoise || []).length +
      (analysis.duplicateIntent || []).length + (analysis.contradictions || []).length;
    var contentQuality = Math.round(Math.max(0, 100 - (contentIssues / totalNodes) * 100));

    var completenessIssues = analysis.hooksWithoutInstruction.length + analysis.steeringsWithoutAccess.length +
      analysis.weakInstructions.length + analysis.contextOverload.length;
    var completeness = Math.round(Math.max(0, 100 - (completenessIssues / totalNodes) * 100));

    var qg = (analysis.qualityGate ? analysis.qualityGate.maturityLevel : 0) / 2 * 100;
    var dml = (analysis.dmlProtection ? analysis.dmlProtection.maturityLevel : 0) / 2 * 100;
    var hc = analysis.hookCoverageMap ? (analysis.hookCoverageMap.covered.length / 10) * 100 : 0;
    var dpIssues = (analysis.decisionPathCompleteness ?
      analysis.decisionPathCompleteness.hooksWithoutDecisionSteering.length +
      analysis.decisionPathCompleteness.steeringsWithoutHook.length : 0);
    var dp = dpIssues === 0 ? 100 : Math.max(0, 100 - dpIssues * 20);
    var maturity = Math.round((qg + dml + hc + dp) / 4);

    var score = Math.round(connectivity * 0.3 + contentQuality * 0.25 + completeness * 0.25 + maturity * 0.2);
    return { score: score, connectivity: connectivity, contentQuality: contentQuality, completeness: completeness, maturity: maturity };
  }

  /**
   * Compute cognitive analysis from graph data.
   * @param {{ nodes: any[], links: any[] }} data
   * @param {Map<string, number>} degrees
   * @param {string[]} workspaceFolders
   * @returns {object} analysis result
   */
  function computeAnalysis(data, degrees, workspaceFolders) {
    if (!data || !data.nodes || data.nodes.length === 0) {
      return null;
    }

    // Build incoming/outgoing maps
    var incomingMap = {};
    var outgoingMap = {};
    data.nodes.forEach(function(n) {
      incomingMap[n.id] = 0;
      outgoingMap[n.id] = 0;
    });
    data.links.forEach(function(link) {
      var s = typeof link.source === 'object' ? link.source.id : link.source;
      var t = typeof link.target === 'object' ? link.target.id : link.target;
      if (outgoingMap[s] !== undefined) { outgoingMap[s]++; }
      if (incomingMap[t] !== undefined) { incomingMap[t]++; }
    });

    // 1. Steerings Soltos: steering nodes with 0 incoming + 0 outgoing
    // Exclude external/global nodes with resolved: true
    var steeringsSoltos = [];
    data.nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
        // Skip external/global resolved nodes
        if (n.source && n.source !== 'local' && n.resolved !== false) { return; }
        var inclusion = (n.metadata && n.metadata.inclusion) || 'always';
        // Exclude fileMatch/manual — don't need cross-references
        if (inclusion === 'fileMatch' || inclusion === 'manual') { return; }
        if ((incomingMap[n.id] || 0) === 0 && (outgoingMap[n.id] || 0) === 0) {
          steeringsSoltos.push({ id: n.id, label: n.label });
        }
      }
    });

    // 2. Vinculos Frageis: edges with weight=1 AND type='backtick-ref'
    //    ONLY from always/auto steerings or hooks
    var vinculosFrageis = [];
    data.links.forEach(function(link) {
      var w = link.weight || 1;
      if (w === 1 && link.type === 'backtick-ref') {
        var s = typeof link.source === 'object' ? link.source.id : link.source;
        var t = typeof link.target === 'object' ? link.target.id : link.target;
        var sNode = data.nodes.find(function(n) { return n.id === s; });

        // Filter: only flag if source is always/auto steering or hook
        if (sNode) {
          var sType = sNode.type || '';
          var isHook = (sType === 'hook-auto' || sType === 'hook-manual');
          if (!isHook) {
            var sInclusion = (sNode.metadata && sNode.metadata.inclusion) || 'always';
            if (sInclusion === 'fileMatch' || sInclusion === 'manual') { return; }
          }
        }

        var tNode = data.nodes.find(function(n) { return n.id === t; });
        vinculosFrageis.push({
          source: s,
          target: t,
          sourceLabel: sNode ? sNode.label : s,
          targetLabel: tNode ? tNode.label : t
        });
      }
    });

    // 3. Arquivos sem Contexto: nodes with 0 total edges
    // Exclude external/global nodes with resolved: true
    var arquivosSemContexto = [];
    data.nodes.forEach(function(n) {
      // Skip external/global resolved nodes
      if (n.source && n.source !== 'local' && n.resolved !== false) { return; }
      // Exclude hooks and skills — activated by independent mechanisms
      if (n.type === 'hook-auto' || n.type === 'hook-manual' || n.type === 'skill') { return; }
      var totalEdges = (incomingMap[n.id] || 0) + (outgoingMap[n.id] || 0);
      if (totalEdges === 0) {
        arquivosSemContexto.push({ id: n.id, label: n.label, type: n.type });
      }
    });

    // 4. Coverage Gaps: workspace folders with 0 steering files
    var coverageGaps = [];
    if (workspaceFolders && workspaceFolders.length > 0) {
      var folderSteeringCount = {};
      workspaceFolders.forEach(function(f) { folderSteeringCount[f] = 0; });
      data.nodes.forEach(function(n) {
        if (n.type && n.type.indexOf('steering-') === 0 && n.workspaceFolder) {
          if (folderSteeringCount[n.workspaceFolder] !== undefined) {
            folderSteeringCount[n.workspaceFolder]++;
          }
        }
      });
      workspaceFolders.forEach(function(f) {
        if (folderSteeringCount[f] === 0) {
          coverageGaps.push({ folder: f });
        }
      });
    }

    // 5. Weak Instructions: steering files with very few lines (< 10 lines = weak prompt)
    var weakInstructions = [];
    data.nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
        var lineCount = (n.metadata && n.metadata.lineCount) || 0;
        if (lineCount > 0 && lineCount < 10) {
          weakInstructions.push({ id: n.id, label: n.label, lineCount: lineCount });
        }
      }
    });

    // 6. Context Overload: only always-loaded steerings count for overload
    //    auto steerings alert separately at 1000+ lines (modularization opportunity)
    var contextOverload = [];
    var totalAlwaysLines = 0;
    var largeDomainSteerings = [];
    data.nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
        var inclusion = (n.metadata && n.metadata.inclusion) || 'always';
        var lineCount = (n.metadata && n.metadata.lineCount) || 0;
        // Exclude fileMatch/manual — not always-loaded
        if (inclusion === 'fileMatch' || inclusion === 'manual') { return; }
        if (inclusion === 'always') {
          totalAlwaysLines += lineCount;
          if (lineCount > 350) {
            contextOverload.push({ id: n.id, label: n.label, lineCount: lineCount });
          }
        } else if (inclusion === 'auto' && lineCount > 1000) {
          // Auto steerings: only alert at 1000+ lines (modularization opportunity)
          largeDomainSteerings.push({ id: n.id, label: n.label, lineCount: lineCount });
        }
      }
    });

    // 7. Instruction-Access Gap: hooks without steering references (access without instruction)
    //    and steerings not referenced by any hook (instruction without access trigger)
    var hooksWithoutInstruction = [];
    var steeringsWithoutAccess = [];
    var steeringIds = new Set();
    var steeringsReferencedByHooks = new Set();

    data.nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
        steeringIds.add(n.id);
      }
    });

    data.nodes.forEach(function(n) {
      if (n.type === 'hook-auto' || n.type === 'hook-manual') {
        // Check if this hook has any edge pointing to a steering
        var hasSteeringRef = false;
        data.links.forEach(function(link) {
          var s = typeof link.source === 'object' ? link.source.id : link.source;
          var t = typeof link.target === 'object' ? link.target.id : link.target;
          if (s === n.id && steeringIds.has(t)) {
            hasSteeringRef = true;
            steeringsReferencedByHooks.add(t);
          }
        });
        if (!hasSteeringRef) {
          // Evaluate prompt sufficiency — use hookPrompt with fallback to description
          var promptContent = (n.metadata && n.metadata.hookPrompt) || (n.metadata && n.metadata.description) || '';
          if (!isPromptSelfSufficient(promptContent)) {
            hooksWithoutInstruction.push({ id: n.id, label: n.label });
          }
        }
      }
    });

    // Steerings that no hook references (have instruction but no automated access/trigger)
    data.nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
        var inclusion = (n.metadata && n.metadata.inclusion) || 'always';
        // Only flag manual/fileMatch steerings — always-included ones don't need a hook trigger
        if (inclusion !== 'always' && inclusion !== 'auto' && !steeringsReferencedByHooks.has(n.id)) {
          steeringsWithoutAccess.push({ id: n.id, label: n.label, inclusion: inclusion });
        }
      }
    });

    // 8. Suggestions: actionable recommendations
    var sugestoes = [];
    if (steeringsSoltos.length > 0) {
      sugestoes.push('Consider adding cross-references to the ' + steeringsSoltos.length + ' orphan steering(s) to integrate them into the knowledge network.');
    }
    if (vinculosFrageis.length > 0) {
      sugestoes.push('Strengthen the ' + vinculosFrageis.length + ' fragile link(s) by adding additional cross-references between the connected nodes.');
    }
    if (arquivosSemContexto.length > 0) {
      sugestoes.push('Add context to the ' + arquivosSemContexto.length + ' isolated file(s) by referencing them in steerings or other ecosystem files.');
    }
    if (coverageGaps.length > 0) {
      sugestoes.push('Create steering files for the ' + coverageGaps.length + ' workspace folder(s) with no coverage.');
    }
    if (weakInstructions.length > 0) {
      sugestoes.push('Expand the ' + weakInstructions.length + ' weak steering(s) with fewer than 10 lines — short files make poor instructions for the AI agent.');
    }
    if (contextOverload.length > 0) {
      sugestoes.push('Break down ' + contextOverload.length + ' large always-loaded steering(s) (350+ lines) into smaller focused files to avoid context window overflow.');
    }
    if (largeDomainSteerings.length > 0) {
      sugestoes.push(largeDomainSteerings.length + ' domain steering(s) exceed 1000 lines. Consider splitting into sub-steerings that reference each other, loading only what the context needs.');
    }
    if (totalAlwaysLines > 500) {
      sugestoes.push('Total always-loaded steering content is ' + totalAlwaysLines + ' lines — consider switching some to "inclusion: manual" or "inclusion: fileMatch" to reduce context window usage.');
    }
    if (hooksWithoutInstruction.length > 0) {
      sugestoes.push(hooksWithoutInstruction.length + ' hook(s) have no steering reference — they have access/trigger but no instruction context. Link them to relevant steerings.');
    }
    if (steeringsWithoutAccess.length > 0) {
      sugestoes.push(steeringsWithoutAccess.length + ' non-always steering(s) are never referenced by hooks — they have instruction but no automated access trigger.');
    }

    // 9. New cognitive assertiveness validations
    var deadLoops = detectDeadLoops(data.nodes, data.links);
    var hopsToReach = computeHopsToReach(data.nodes, data.links);
    var duplicateIntent = detectDuplicateIntent(data.nodes);
    var passiveKnowledge = detectPassiveKnowledge(data.nodes);
    var signalToNoise = detectLowSignalToNoise(data.nodes);
    var contradictions = detectContradictions(data.nodes);
    var hookCoverageMap = computeHookCoverageMap(data.nodes);
    var decisionPathCompleteness = checkDecisionPathCompleteness(data.nodes, data.links);
    var qualityGate = checkQualityGate(data.nodes, data.links);
    var dmlProtection = checkDmlProtection(data.nodes, data.links);

    // 10. Broken External Links: external nodes with resolved: false
    var brokenExternalLinks = [];
    data.nodes.forEach(function(n) {
      if (n.source && n.source !== 'local' && n.resolved === false) {
        brokenExternalLinks.push({ id: n.id, label: n.label, targetPath: n.filePath || n.id });
      }
    });

    // 12. Stale Content Detection (Rule 20)
    var staleContent = detectStaleContentWebview(data.nodes, data.links, incomingMap, outgoingMap);

    // 13. Link Recommender (Suggested Connections)
    var suggestedConnections = computeLinkSuggestionsWebview(data.nodes, data.links, duplicateIntent);

    // 14. Semantic Coherence (Rule 21)
    var semanticCoherence = computeSemanticCoherenceWebview(data.nodes);

    // 15. Circular Hook Dependencies (Rule 22)
    var circularHookDependencies = detectCircularHookDependenciesWebview(data.nodes, data.links);

    // 16. Guardrail Coverage Analysis (Rule 23)
    var guardrailCoverage = analyzeGuardrailCoverageWebview(data.nodes, dmlProtection.maturityLevel);

    // 17. Instruction Specificity Score (Rule 24)
    var instructionSpecificity = analyzeInstructionSpecificityWebview(data.nodes);

    // 18. Context Budget Estimator (Rule 25)
    var contextBudget = estimateContextBudgetWebview(data.nodes);

    // 19. Jailbreak Protection (Rule 26)
    var jailbreakProtection = analyzeJailbreakProtectionWebview(data.nodes);

    // 20. Conflict Resolution Priority (Rule 27)
    var conflictResolution = analyzeConflictResolutionWebview(data.nodes, contradictions.length);

    // 21. Feedback Loop Completeness (Rule 28)
    var feedbackLoops = analyzeFeedbackLoopsWebview(data.nodes, data.links);

    // 11. Cross-Workspace Topology: group external nodes by workspace
    var crossWorkspaceTopology = [];
    var workspaceGroups = {};
    data.nodes.forEach(function(n) {
      if (n.source && n.source !== 'local' && n.workspaceFolder) {
        if (!workspaceGroups[n.workspaceFolder]) {
          workspaceGroups[n.workspaceFolder] = { resolved: 0, unresolved: 0, source: n.source };
        }
        if (n.resolved === false) {
          workspaceGroups[n.workspaceFolder].unresolved++;
        } else {
          workspaceGroups[n.workspaceFolder].resolved++;
        }
      }
    });
    Object.keys(workspaceGroups).forEach(function(ws) {
      var group = workspaceGroups[ws];
      var total = group.resolved + group.unresolved;
      crossWorkspaceTopology.push({
        workspace: ws,
        source: group.source,
        totalNodes: total,
        resolvedNodes: group.resolved,
        unresolvedNodes: group.unresolved,
        status: group.unresolved > 0 ? 'partially-connected' : 'connected',
      });
    });

    // 10. Suggestions for new validations
    if (deadLoops.length > 0) {
      sugestoes.push(deadLoops.length + ' dead loop(s) detected — isolated cycles with no external entry. Add an entry point that references at least one node in each cycle.');
    }
    if (hopsToReach.length > 0) {
      sugestoes.push(hopsToReach.length + ' steering(s) are 4+ hops from any entry point. Create direct shortcuts from entry points to reduce navigation depth.');
    }
    if (duplicateIntent.length > 0) {
      sugestoes.push(duplicateIntent.length + ' pair(s) of steerings have >60% keyword overlap. Consolidate them or differentiate their scopes to reduce redundancy.');
    }
    if (passiveKnowledge.length > 0) {
      sugestoes.push(passiveKnowledge.length + ' steering(s) have <10% actionable content. Add imperative instructions (use, always, never, must) to make them actionable.');
    }
    if (signalToNoise.length > 0) {
      sugestoes.push(signalToNoise.length + ' steering(s) have 10-20% actionable content. Condense descriptive text and increase instruction density.');
    }
    if (contradictions.length > 0) {
      sugestoes.push(contradictions.length + ' contradiction(s) detected between always-loaded steerings. Resolve conflicts by unifying rules or defining distinct scopes.');
    }
    if (hookCoverageMap.uncovered.length > 0) {
      sugestoes.push(hookCoverageMap.uncovered.length + ' IDE event(s) have no hooks configured. Evaluate if automation is needed for: ' + hookCoverageMap.uncovered.map(function(e) { return e.event; }).join(', ') + '.');
    }
    if (decisionPathCompleteness.hooksWithoutDecisionSteering.length > 0 || decisionPathCompleteness.steeringsWithoutHook.length > 0) {
      var gaps = decisionPathCompleteness.hooksWithoutDecisionSteering.length + decisionPathCompleteness.steeringsWithoutHook.length;
      sugestoes.push(gaps + ' decision path gap(s) found. Complete hook\u2192steering chains to give the agent full detect\u2192decide\u2192execute capability.');
    }
    if (qualityGate.maturityLevel < 2) {
      var qgMissing = [];
      if (qualityGate.missing.needsSelfReview) { qgMissing.push('self-review hook (preToolUse/postToolUse)'); }
      if (qualityGate.missing.needsQualitySteering) { qgMissing.push('quality gate steering'); }
      if (qualityGate.missing.needsPostTaskReview) { qgMissing.push('post-task review hook'); }
      sugestoes.push('Quality Gate at level ' + qualityGate.maturityLevel + '/2. Missing: ' + qgMissing.join(', ') + '.');
    }
    if (dmlProtection.maturityLevel < 2) {
      var dmlMissing = [];
      if (dmlProtection.missing.needsDmlHook) { dmlMissing.push('preToolUse hook with DML keywords'); }
      if (dmlProtection.missing.needsDmlSteering) { dmlMissing.push('DML protection steering'); }
      if (dmlProtection.missing.needsRiskIntegration) { dmlMissing.push('hook\u2192risk-steering integration'); }
      sugestoes.push('DML Protection at level ' + dmlProtection.maturityLevel + '/2. Missing: ' + dmlMissing.join(', ') + '.');
    }
    if (circularHookDependencies.length > 0) {
      sugestoes.push(circularHookDependencies.length + ' circular hook dependency cycle(s) detected — hooks and steerings forming loops that could cause infinite agent execution. Break the circular references.');
    }

    return {
      steeringsSoltos: steeringsSoltos,
      vinculosFrageis: vinculosFrageis,
      arquivosSemContexto: arquivosSemContexto,
      coverageGaps: coverageGaps,
      weakInstructions: weakInstructions,
      contextOverload: contextOverload,
      largeDomainSteerings: largeDomainSteerings,
      totalAlwaysLines: totalAlwaysLines,
      hooksWithoutInstruction: hooksWithoutInstruction,
      steeringsWithoutAccess: steeringsWithoutAccess,
      sugestoes: sugestoes,
      deadLoops: deadLoops,
      hopsToReach: hopsToReach,
      duplicateIntent: duplicateIntent,
      passiveKnowledge: passiveKnowledge,
      signalToNoise: signalToNoise,
      contradictions: contradictions,
      hookCoverageMap: hookCoverageMap,
      decisionPathCompleteness: decisionPathCompleteness,
      qualityGate: qualityGate,
      dmlProtection: dmlProtection,
      brokenExternalLinks: brokenExternalLinks,
      crossWorkspaceTopology: crossWorkspaceTopology,
      staleContent: staleContent,
      suggestedConnections: suggestedConnections,
      semanticCoherence: semanticCoherence,
      circularHookDependencies: circularHookDependencies,
      guardrailCoverage: guardrailCoverage,
      instructionSpecificity: instructionSpecificity,
      contextBudget: contextBudget,
      jailbreakProtection: jailbreakProtection,
      conflictResolution: conflictResolution,
      feedbackLoops: feedbackLoops,
      healthScore: computeHealthScore({
        steeringsSoltos: steeringsSoltos,
        vinculosFrageis: vinculosFrageis,
        arquivosSemContexto: arquivosSemContexto,
        coverageGaps: coverageGaps,
        weakInstructions: weakInstructions,
        contextOverload: contextOverload,
        hooksWithoutInstruction: hooksWithoutInstruction,
        steeringsWithoutAccess: steeringsWithoutAccess,
        deadLoops: deadLoops,
        hopsToReach: hopsToReach,
        duplicateIntent: duplicateIntent,
        passiveKnowledge: passiveKnowledge,
        signalToNoise: signalToNoise,
        contradictions: contradictions,
        hookCoverageMap: hookCoverageMap,
        decisionPathCompleteness: decisionPathCompleteness,
        qualityGate: qualityGate,
        dmlProtection: dmlProtection,
      }, data.nodes.length),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Fix Buttons — DISABLED (UX not suitable for 210px panel; use Export instead)
  // Backend (fixPromptGenerator + webviewProvider handler) remains intact for future use.
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // Ecosystem Maturity — Phase Detection (Webview)
  // ─────────────────────────────────────────────────────────────────────────

  var PHASE_NAMES = {
    1: 'Foundation',
    2: 'Domain Knowledge',
    3: 'Flows & Security',
    4: 'Automation',
    5: 'Evolution',
  };

  /**
   * Detect ecosystem phase from graph data and analysis result.
   * @param {{ nodes: any[], links: any[] }} data
   * @param {object} analysis
   * @returns {{ phase: number, phaseName: string, progressPercent: number, criteriaMet: string[], criteriaRemaining: string[] }}
   */
  function detectPhaseWebview(data, analysis) {
    if (!data || !data.nodes) {
      return { phase: 1, phaseName: 'Foundation', progressPercent: 0, criteriaMet: [], criteriaRemaining: ['project-overview', 'code-conventions', 'domain-steering'] };
    }

    var steerings = data.nodes.filter(function(n) { return n.type && n.type.indexOf('steering-') === 0; });
    var hooks = data.nodes.filter(function(n) { return n.type === 'hook-auto' || n.type === 'hook-manual'; });
    var hasFlowOrPolicy = steerings.some(function(n) { return n.type === 'steering-flow' || n.type === 'steering-policy'; });
    var hookEventCount = (analysis && analysis.hookCoverageMap) ? analysis.hookCoverageMap.covered.length : 0;
    var qualityLevel = (analysis && analysis.qualityGate) ? analysis.qualityGate.maturityLevel : 0;
    var dmlLevel = (analysis && analysis.dmlProtection) ? analysis.dmlProtection.maturityLevel : 0;

    var phase = 1;
    if (hookEventCount >= 5 && qualityLevel === 2 && dmlLevel >= 1) {
      phase = 5;
    } else if (hooks.length >= 3 && qualityLevel >= 1) {
      phase = 4;
    } else if (hasFlowOrPolicy && hooks.length >= 1) {
      phase = 3;
    } else if (steerings.length > 2) {
      phase = 2;
    }

    var criteria = computeCriteriaWebview(phase, steerings, hooks, analysis);
    var total = criteria.met.length + criteria.remaining.length;
    var progress = total === 0 ? 100 : Math.round((criteria.met.length / total) * 100);

    return {
      phase: phase,
      phaseName: PHASE_NAMES[phase],
      progressPercent: progress,
      criteriaMet: criteria.met,
      criteriaRemaining: criteria.remaining,
    };
  }

  /**
   * Compute criteria met/remaining for a given phase.
   */
  function computeCriteriaWebview(phase, steerings, hooks, analysis) {
    var met = [];
    var remaining = [];

    switch (phase) {
    case 1: {
      var hasOverview = steerings.some(function(n) { return n.label.toLowerCase().indexOf('project-overview') !== -1 || n.label.toLowerCase().indexOf('project overview') !== -1; });
      var hasConventions = steerings.some(function(n) { return n.label.toLowerCase().indexOf('code-conventions') !== -1 || n.label.toLowerCase().indexOf('code conventions') !== -1; });
      var hasDomain = steerings.some(function(n) { return n.type === 'steering-domain' || n.type === 'steering-tech'; });
      hasOverview ? met.push('project-overview') : remaining.push('project-overview');
      hasConventions ? met.push('code-conventions') : remaining.push('code-conventions');
      hasDomain ? met.push('domain-steering') : remaining.push('domain-steering');
      break;
    }
    case 2: {
      var domainTech = steerings.filter(function(n) { return n.type === 'steering-domain' || n.type === 'steering-tech'; });
      domainTech.length >= 3 ? met.push('3-domain-steerings') : remaining.push('3-domain-steerings');
      steerings.some(function(n) { return n.type === 'steering-policy'; }) ? met.push('security-policy') : remaining.push('security-policy');
      steerings.some(function(n) { return n.type === 'steering-flow'; }) ? met.push('flow-steering') : remaining.push('flow-steering');
      break;
    }
    case 3: {
      steerings.some(function(n) { return n.type === 'steering-flow'; }) ? met.push('flow-steering') : remaining.push('flow-steering');
      steerings.some(function(n) { return n.type === 'steering-policy'; }) ? met.push('security-policy') : remaining.push('security-policy');
      hooks.length >= 1 ? met.push('first-hook') : remaining.push('first-hook');
      hooks.length >= 3 ? met.push('3-hooks') : remaining.push('3-hooks');
      break;
    }
    case 4: {
      var ql = (analysis && analysis.qualityGate) ? analysis.qualityGate.maturityLevel : 0;
      var hec = (analysis && analysis.hookCoverageMap) ? analysis.hookCoverageMap.covered.length : 0;
      hooks.length >= 3 ? met.push('3-hooks') : remaining.push('3-hooks');
      ql >= 1 ? met.push('quality-gate-partial') : remaining.push('quality-gate-partial');
      hec >= 5 ? met.push('hook-coverage-5') : remaining.push('hook-coverage-5');
      ql === 2 ? met.push('quality-gate-complete') : remaining.push('quality-gate-complete');
      break;
    }
    case 5: {
      var hec5 = (analysis && analysis.hookCoverageMap) ? analysis.hookCoverageMap.covered.length : 0;
      var ql5 = (analysis && analysis.qualityGate) ? analysis.qualityGate.maturityLevel : 0;
      var dml5 = (analysis && analysis.dmlProtection) ? analysis.dmlProtection.maturityLevel : 0;
      hec5 >= 5 ? met.push('hook-coverage-5') : remaining.push('hook-coverage-5');
      ql5 === 2 ? met.push('quality-gate-complete') : remaining.push('quality-gate-complete');
      dml5 >= 1 ? met.push('dml-protection') : remaining.push('dml-protection');
      hec5 >= 8 ? met.push('hook-coverage-8') : remaining.push('hook-coverage-8');
      break;
    }
    }

    return { met: met, remaining: remaining };
  }

  /**
   * Get next step suggestion based on remaining criteria.
   */
  function getNextStepWebview(phaseResult) {
    if (phaseResult.criteriaRemaining.length === 0) { return null; }

    var suggestions = [
      { criteria: 'project-overview', fileName: 'project-overview.md', fileType: 'steering', description: 'Describe your project, stack, and conventions', templateKey: 'project-overview', targetDir: '.kiro/steering' },
      { criteria: 'code-conventions', fileName: 'code-conventions.md', fileType: 'steering', description: 'Define coding conventions and formatting rules', templateKey: 'domain-knowledge', targetDir: '.kiro/steering' },
      { criteria: 'domain-steering', fileName: 'domain-knowledge.md', fileType: 'steering', description: 'Document domain rules and business logic', templateKey: 'domain-knowledge', targetDir: '.kiro/steering' },
      { criteria: '3-domain-steerings', fileName: 'domain-knowledge.md', fileType: 'steering', description: 'Add more domain/tech steerings (need 3+)', templateKey: 'domain-knowledge', targetDir: '.kiro/steering' },
      { criteria: 'security-policy', fileName: 'security-policy.md', fileType: 'steering', description: 'Define security rules and access policies', templateKey: 'security-policy', targetDir: '.kiro/steering' },
      { criteria: 'flow-steering', fileName: 'flow-steering.md', fileType: 'steering', description: 'Document workflow steps and process flows', templateKey: 'flow-steering', targetDir: '.kiro/steering' },
      { criteria: 'first-hook', fileName: 'pre-tool-use.json', fileType: 'hook', description: 'Add a preToolUse hook for automated validation', templateKey: 'pre-tool-use-hook', targetDir: '.kiro/hooks' },
      { criteria: '3-hooks', fileName: 'post-task-execution.json', fileType: 'hook', description: 'Add more hooks covering different events', templateKey: 'post-task-hook', targetDir: '.kiro/hooks' },
      { criteria: 'quality-gate-partial', fileName: 'pre-tool-use.json', fileType: 'hook', description: 'Add a quality gate hook', templateKey: 'pre-tool-use-hook', targetDir: '.kiro/hooks' },
      { criteria: 'hook-coverage-5', fileName: 'post-task-execution.json', fileType: 'hook', description: 'Increase hook coverage to 5+ IDE events', templateKey: 'post-task-hook', targetDir: '.kiro/hooks' },
      { criteria: 'quality-gate-complete', fileName: 'post-task-execution.json', fileType: 'hook', description: 'Complete quality gate (post-task review)', templateKey: 'post-task-hook', targetDir: '.kiro/hooks' },
      { criteria: 'dml-protection', fileName: 'pre-tool-use.json', fileType: 'hook', description: 'Add DML protection hook', templateKey: 'pre-tool-use-hook', targetDir: '.kiro/hooks' },
      { criteria: 'hook-coverage-8', fileName: 'post-task-execution.json', fileType: 'hook', description: 'Increase hook coverage to 8+ IDE events', templateKey: 'post-task-hook', targetDir: '.kiro/hooks' },
    ];

    for (var i = 0; i < suggestions.length; i++) {
      if (phaseResult.criteriaRemaining.indexOf(suggestions[i].criteria) !== -1) {
        return suggestions[i];
      }
    }
    return null;
  }

  /**
   * Render the Ecosystem Maturity onboarding section.
   * @param {{ nodes: any[], links: any[] }} data
   * @param {object} analysis
   * @returns {string} HTML string
   */
  function renderOnboardingSection(data, analysis) {
    var phaseResult = detectPhaseWebview(data, analysis);
    var nextStep = getNextStepWebview(phaseResult);

    // Check collapsed state from localStorage
    var collapsed = false;
    try { collapsed = localStorage.getItem('onboarding-collapsed') === 'true'; } catch (e) { /* ignore */ }

    var sectionStyle = collapsed ? 'display:none;' : '';
    var toggleIcon = collapsed ? '\u25B6' : '\u25BC';

    var html = '<div style="margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:8px;">';
    html += '<div id="onboarding-header" style="display:flex;align-items:center;cursor:pointer;margin-bottom:4px;">';
    html += '<span id="onboarding-toggle-icon" style="font-size:8px;margin-right:4px;color:#888;">' + toggleIcon + '</span>';
    html += '<span style="font-size:11px;font-weight:bold;color:#4A9EFF;">Ecosystem Maturity</span>';
    html += '</div>';

    html += '<div id="onboarding-body" style="' + sectionStyle + '">';

    // Phase steps indicator
    html += '<div style="display:flex;gap:2px;margin-bottom:6px;">';
    for (var p = 1; p <= 5; p++) {
      var isActive = p === phaseResult.phase;
      var isPast = p < phaseResult.phase;
      var dotColor = isActive ? '#4A9EFF' : isPast ? '#4CAF50' : '#444';
      var dotBorder = isActive ? '2px solid #4A9EFF' : '1px solid ' + dotColor;
      html += '<div style="flex:1;text-align:center;">';
      html += '<div style="width:12px;height:12px;border-radius:50%;background:' + dotColor + ';border:' + dotBorder + ';margin:0 auto;"></div>';
      html += '<div style="font-size:7px;color:' + (isActive ? '#4A9EFF' : '#666') + ';margin-top:2px;">' + p + '</div>';
      html += '</div>';
    }
    html += '</div>';

    // Phase name and progress
    html += '<div style="font-size:10px;color:#fff;margin-bottom:4px;">Phase ' + phaseResult.phase + ': ' + escapeHtml(phaseResult.phaseName) + '</div>';

    // Progress bar
    html += '<div style="background:#333;border-radius:3px;height:6px;margin-bottom:6px;overflow:hidden;">';
    html += '<div style="background:#4A9EFF;height:100%;width:' + phaseResult.progressPercent + '%;border-radius:3px;transition:width 0.3s;"></div>';
    html += '</div>';
    html += '<div style="font-size:8px;color:#888;margin-bottom:6px;">' + phaseResult.progressPercent + '% complete</div>';

    // Next step suggestion or completion message
    if (!nextStep) {
      html += '<div style="font-size:9px;color:#4CAF50;font-weight:bold;">\u2705 Ecosystem complete! Focus on maintenance and evolution.</div>';
    } else {
      html += '<div style="font-size:9px;color:#ccc;margin-bottom:4px;">';
      html += '<span style="color:#FF9800;">Next:</span> ' + escapeHtml(nextStep.description);
      html += '</div>';
    }

    html += '</div>'; // onboarding-body
    html += '</div>'; // outer container

    return html;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Panel Rendering
  /**
   * Render health score and trend in the panel header area.
   * Occupies max one line between title and export button.
   */
  function renderHeaderScore(analysis, statsHistoryData) {
    var existing = document.getElementById('cognitive-health-score');
    if (existing) { existing.remove(); }

    if (!analysis || !analysis.healthScore) { return; }

    var score = analysis.healthScore.score;
    var scoreColor = score >= 75 ? '#4CAF50' : score >= 50 ? '#FF9800' : '#F44336';

    var scoreSpan = document.createElement('span');
    scoreSpan.id = 'cognitive-health-score';
    scoreSpan.style.cssText = 'font-size:10px;margin-left:6px;white-space:nowrap;';

    var scoreText = '<span style="color:' + scoreColor + ';font-weight:bold;">' + score + '/100</span>';

    // Trend indicator from statsHistory
    var trendText = '';
    if (statsHistoryData && statsHistoryData.length > 0) {
      var previousScore = null;
      for (var i = statsHistoryData.length - 1; i >= 0; i--) {
        if (statsHistoryData[i].healthScore !== undefined) {
          previousScore = statsHistoryData[i].healthScore;
          break;
        }
      }
      if (previousScore !== null) {
        var delta = score - previousScore;
        var arrow = delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '\u2192';
        var trendColor = delta > 0 ? '#4CAF50' : delta < 0 ? '#F44336' : '#666';
        trendText = ' <span style="color:' + trendColor + ';">' + arrow + Math.abs(delta) + '</span>';
      }
    }

    scoreSpan.innerHTML = scoreText + trendText;

    // Insert after title, before export button
    title.parentNode.insertBefore(scoreSpan, exportBtn);
  }

  /**
   * Render the analysis results into the panel.
   * @param {object} analysis
   * @param {Array} statsHistoryData - Optional stats history for trend calculation
   * @param {{ nodes: any[], links: any[] }} graphData - Raw graph data for onboarding section
   */
  function renderPanel(analysis, statsHistoryData, graphData) {
    var content = document.getElementById('cognitive-content');
    if (!content) { return; }

    // Store latest analysis for export button
    latestAnalysis = analysis;

    // Show/hide export button based on analysis availability
    exportBtn.style.display = analysis ? 'inline-block' : 'none';

    if (!analysis) {
      content.innerHTML = '<span style="color:#666;">No data available</span>';
      // Remove score display from header
      var existingScore = document.getElementById('cognitive-health-score');
      if (existingScore) { existingScore.remove(); }
      return;
    }

    // Render health score in header (between title and export button)
    renderHeaderScore(analysis, statsHistoryData);

    var html = '';

    // ─── Ecosystem Maturity (Onboarding Section) ───
    html += renderOnboardingSection(graphData, analysis);

    // Orphan Steerings
    html += '<div style="margin-bottom:6px;"><span data-fix-header="orphan-steerings" style="color:#FF9800;font-weight:bold;">Orphan Steerings</span>';
    if (analysis.steeringsSoltos.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#FF9800;">' + analysis.steeringsSoltos.length + '</span>';
      analysis.steeringsSoltos.slice(0, 5).forEach(function(item, idx) {
        html += '<div style="padding-left:6px;" data-fix-item="orphan-steerings" data-fix-idx="' + idx + '"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + '</a></div>';
      });
      if (analysis.steeringsSoltos.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.steeringsSoltos.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Fragile Links
    html += '<div style="margin-bottom:6px;"><span data-fix-header="fragile-links" style="color:#F44336;font-weight:bold;">Fragile Links</span>';
    if (analysis.vinculosFrageis.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#F44336;">' + analysis.vinculosFrageis.length + '</span>';
      analysis.vinculosFrageis.slice(0, 5).forEach(function(item, idx) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;" data-fix-item="fragile-links" data-fix-idx="' + idx + '">' + escapeHtml(item.sourceLabel) + ' \u2192 ' + escapeHtml(item.targetLabel) + '</div>';
      });
      if (analysis.vinculosFrageis.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.vinculosFrageis.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Isolated Files
    html += '<div style="margin-bottom:6px;"><span data-fix-header="isolated-files" style="color:#9C27B0;font-weight:bold;">Isolated Files</span>';
    if (analysis.arquivosSemContexto.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#9C27B0;">' + analysis.arquivosSemContexto.length + '</span>';
      analysis.arquivosSemContexto.slice(0, 5).forEach(function(item, idx) {
        html += '<div style="padding-left:6px;" data-fix-item="isolated-files" data-fix-idx="' + idx + '"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + '</a></div>';
      });
      if (analysis.arquivosSemContexto.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.arquivosSemContexto.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Coverage Gaps
    html += '<div style="margin-bottom:6px;"><span data-fix-header="coverage-gaps" style="color:#00BCD4;font-weight:bold;">Coverage Gaps</span>';
    if (analysis.coverageGaps.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#00BCD4;">' + analysis.coverageGaps.length + '</span>';
      analysis.coverageGaps.slice(0, 5).forEach(function(item, idx) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;" data-fix-item="coverage-gaps" data-fix-idx="' + idx + '">' + escapeHtml(item.folder) + '</div>';
      });
      if (analysis.coverageGaps.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.coverageGaps.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Weak Instructions
    html += '<div style="margin-bottom:6px;"><span data-fix-header="weak-instructions" style="color:#FFC107;font-weight:bold;">Weak Instructions</span>';
    if (analysis.weakInstructions.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#FFC107;">' + analysis.weakInstructions.length + '</span>';
      analysis.weakInstructions.slice(0, 5).forEach(function(item, idx) {
        html += '<div style="padding-left:6px;" data-fix-item="weak-instructions" data-fix-idx="' + idx + '"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + item.lineCount + ' lines)</a></div>';
      });
      if (analysis.weakInstructions.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.weakInstructions.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Context Overload
    html += '<div style="margin-bottom:6px;"><span data-fix-header="context-overload" style="color:#E91E63;font-weight:bold;">Context Overload</span>';
    if (analysis.contextOverload.length === 0 && analysis.totalAlwaysLines <= 500) {
      html += ' <span style="color:#4CAF50;">OK</span>';
    } else {
      html += ' <span style="color:#E91E63;">' + analysis.totalAlwaysLines + ' lines</span>';
      analysis.contextOverload.slice(0, 5).forEach(function(item, idx) {
        html += '<div style="padding-left:6px;" data-fix-item="context-overload" data-fix-idx="' + idx + '"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + item.lineCount + ' lines, max 350)</a></div>';
      });
      if (analysis.contextOverload.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.contextOverload.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Instruction-Access Gap
    var gapCount = analysis.hooksWithoutInstruction.length + analysis.steeringsWithoutAccess.length;
    html += '<div style="margin-bottom:6px;"><span data-fix-header="hooks-without-instruction" style="color:#8BC34A;font-weight:bold;">Instruction \u2194 Access</span>';
    if (gapCount === 0) {
      html += ' <span style="color:#4CAF50;">OK</span>';
    } else {
      html += ' <span style="color:#8BC34A;">' + gapCount + '</span>';
      if (analysis.hooksWithoutInstruction.length > 0) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;font-style:italic;">Hooks without instruction:</div>';
        analysis.hooksWithoutInstruction.slice(0, 3).forEach(function(item, idx) {
          html += '<div style="padding-left:10px;" data-fix-item="hooks-without-instruction" data-fix-idx="' + idx + '"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + '</a></div>';
        });
      }
      if (analysis.steeringsWithoutAccess.length > 0) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;font-style:italic;">Steerings without access:</div>';
        analysis.steeringsWithoutAccess.slice(0, 3).forEach(function(item, idx) {
          html += '<div style="padding-left:10px;" data-fix-item="steerings-without-access" data-fix-idx="' + idx + '"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + '</a></div>';
        });
      }
    }
    html += '</div>';

    // ─── New Cognitive Assertiveness Sections ───

    // Dead Loops
    html += '<div style="margin-bottom:6px;"><span data-fix-header="dead-loops" style="color:#FF5722;font-weight:bold;">Dead Loops</span>';
    if (!analysis.deadLoops || analysis.deadLoops.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#FF5722;">' + analysis.deadLoops.length + '</span>';
      analysis.deadLoops.slice(0, 3).forEach(function(loop, idx) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;" data-fix-item="dead-loops" data-fix-idx="' + idx + '">' + loop.size + ' nodes: ' + loop.nodes.map(function(n) { return escapeHtml(n.label); }).join(' \u2192 ') + '</div>';
      });
    }
    html += '</div>';

    // Hops to Reach
    html += '<div style="margin-bottom:6px;"><span data-fix-header="hops-to-reach" style="color:#FF7043;font-weight:bold;">Hops to Reach</span>';
    if (!analysis.hopsToReach || analysis.hopsToReach.length === 0) {
      html += ' <span style="color:#4CAF50;">OK</span>';
    } else {
      html += ' <span style="color:#FF7043;">' + analysis.hopsToReach.length + '</span>';
      analysis.hopsToReach.slice(0, 5).forEach(function(item, idx) {
        var hopsText = (item.hops >= 999 || item.hops === null || item.hops === undefined) ? '\u221E' : item.hops;
        html += '<div style="padding-left:6px;" data-fix-item="hops-to-reach" data-fix-idx="' + idx + '"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + hopsText + ' hops)</a></div>';
      });
    }
    html += '</div>';

    // Duplicate Intent
    html += '<div style="margin-bottom:6px;"><span data-fix-header="duplicate-intent" style="color:#AB47BC;font-weight:bold;">Duplicate Intent</span>';
    if (!analysis.duplicateIntent || analysis.duplicateIntent.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#AB47BC;">' + analysis.duplicateIntent.length + '</span>';
      analysis.duplicateIntent.slice(0, 3).forEach(function(pair, idx) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;" data-fix-item="duplicate-intent" data-fix-idx="' + idx + '">' + escapeHtml(pair.nodeA.label) + ' \u2194 ' + escapeHtml(pair.nodeB.label) + ' (' + pair.overlap + '%)</div>';
      });
    }
    html += '</div>';

    // Passive Knowledge
    html += '<div style="margin-bottom:6px;"><span data-fix-header="passive-knowledge" style="color:#78909C;font-weight:bold;">Passive Knowledge</span>';
    if (!analysis.passiveKnowledge || analysis.passiveKnowledge.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#78909C;">' + analysis.passiveKnowledge.length + '</span>';
      analysis.passiveKnowledge.slice(0, 5).forEach(function(item, idx) {
        html += '<div style="padding-left:6px;" data-fix-item="passive-knowledge" data-fix-idx="' + idx + '"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + item.actionablePercent + '% actionable)</a></div>';
      });
    }
    html += '</div>';

    // Signal-to-Noise
    html += '<div style="margin-bottom:6px;"><span data-fix-header="signal-to-noise" style="color:#FFAB40;font-weight:bold;">Signal-to-Noise</span>';
    if (!analysis.signalToNoise || analysis.signalToNoise.length === 0) {
      html += ' <span style="color:#4CAF50;">OK</span>';
    } else {
      html += ' <span style="color:#FFAB40;">' + analysis.signalToNoise.length + '</span>';
      analysis.signalToNoise.slice(0, 5).forEach(function(item, idx) {
        html += '<div style="padding-left:6px;" data-fix-item="signal-to-noise" data-fix-idx="' + idx + '"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + item.signalRatio + '% signal)</a></div>';
      });
    }
    html += '</div>';

    // Contradictions
    html += '<div style="margin-bottom:6px;"><span data-fix-header="contradictions" style="color:#D32F2F;font-weight:bold;">Contradictions</span>';
    if (!analysis.contradictions || analysis.contradictions.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#D32F2F;">' + analysis.contradictions.length + '</span>';
      analysis.contradictions.slice(0, 3).forEach(function(c, idx) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;" data-fix-item="contradictions" data-fix-idx="' + idx + '">' + escapeHtml(c.nodeA.label) + ' vs ' + escapeHtml(c.nodeB.label) + ' (' + escapeHtml(c.conflictType) + ')</div>';
      });
    }
    html += '</div>';

    // Hook Coverage
    html += '<div style="margin-bottom:6px;"><span data-fix-header="hook-coverage" style="color:#26A69A;font-weight:bold;">Hook Coverage</span>';
    if (analysis.hookCoverageMap && analysis.hookCoverageMap.uncovered.length === 0) {
      html += ' <span style="color:#4CAF50;">10/10</span>';
    } else if (analysis.hookCoverageMap) {
      var coveredCount = analysis.hookCoverageMap.covered.length;
      html += ' <span style="color:#26A69A;">' + coveredCount + '/10</span>';
      analysis.hookCoverageMap.uncovered.slice(0, 5).forEach(function(item, idx) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;" data-fix-item="hook-coverage" data-fix-idx="' + idx + '">\u2717 ' + escapeHtml(item.event) + '</div>';
      });
    }
    html += '</div>';

    // Decision Path
    html += '<div style="margin-bottom:6px;"><span data-fix-header="decision-path" style="color:#5C6BC0;font-weight:bold;">Decision Path</span>';
    if (analysis.decisionPathCompleteness) {
      var dpGaps = analysis.decisionPathCompleteness.hooksWithoutDecisionSteering.length + analysis.decisionPathCompleteness.steeringsWithoutHook.length;
      if (dpGaps === 0) {
        html += ' <span style="color:#4CAF50;">OK</span>';
      } else {
        html += ' <span style="color:#5C6BC0;">' + dpGaps + ' gaps</span>';
        if (analysis.decisionPathCompleteness.hooksWithoutDecisionSteering.length > 0) {
          html += '<div style="padding-left:6px;color:#888;font-size:9px;font-style:italic;">Hooks without steering:</div>';
          analysis.decisionPathCompleteness.hooksWithoutDecisionSteering.slice(0, 3).forEach(function(item, idx) {
            html += '<div style="padding-left:10px;color:#888;font-size:9px;" data-fix-item="decision-path" data-fix-idx="' + idx + '">' + escapeHtml(item.label) + '</div>';
          });
        }
        if (analysis.decisionPathCompleteness.steeringsWithoutHook.length > 0) {
          html += '<div style="padding-left:6px;color:#888;font-size:9px;font-style:italic;">Steerings without hook:</div>';
          analysis.decisionPathCompleteness.steeringsWithoutHook.slice(0, 3).forEach(function(item, idx) {
            var dpIdx = analysis.decisionPathCompleteness.hooksWithoutDecisionSteering.length + idx;
            html += '<div style="padding-left:10px;color:#888;font-size:9px;" data-fix-item="decision-path" data-fix-idx="' + dpIdx + '">' + escapeHtml(item.label) + '</div>';
          });
        }
      }
    }
    html += '</div>';

    // Quality Gate
    html += '<div style="margin-bottom:6px;"><span data-fix-header="quality-gate" style="color:#7E57C2;font-weight:bold;">Quality Gate</span>';
    if (analysis.qualityGate) {
      var qgLevel = analysis.qualityGate.maturityLevel;
      var qgColor = qgLevel === 2 ? '#4CAF50' : qgLevel === 1 ? '#FFC107' : '#F44336';
      var qgLabel = qgLevel === 2 ? 'Complete' : qgLevel === 1 ? 'Partial' : 'No Gate';
      html += ' <span style="color:' + qgColor + ';">Level ' + qgLevel + ' (' + qgLabel + ')</span>';
    }
    html += '</div>';

    // DML Protection
    html += '<div style="margin-bottom:6px;"><span data-fix-header="dml-protection" style="color:#EF5350;font-weight:bold;">DML Protection</span>';
    if (analysis.dmlProtection) {
      var dmlLevel = analysis.dmlProtection.maturityLevel;
      var dmlColor = dmlLevel === 2 ? '#4CAF50' : dmlLevel === 1 ? '#FFC107' : '#F44336';
      var dmlLabel = dmlLevel === 2 ? 'Smart' : dmlLevel === 1 ? 'Blind Block' : 'No Protection';
      html += ' <span style="color:' + dmlColor + ';">Level ' + dmlLevel + ' (' + dmlLabel + ')</span>';
    }
    html += '</div>';

    // Stale Content (Rule 20)
    if (analysis.staleContent && analysis.staleContent.length > 0) {
      html += '<div style="margin-bottom:6px;"><span data-fix-header="stale-content" style="color:#FF6F00;font-weight:bold;">Stale Content</span>';
      html += ' <span style="color:#FF6F00;">' + analysis.staleContent.length + '</span>';
      analysis.staleContent.slice(0, 5).forEach(function(item, idx) {
        html += '<div style="padding-left:6px;" data-fix-item="stale-content" data-fix-idx="' + idx + '"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + item.stalenessDays + 'd, ' + item.degree + ' conn, risk:' + item.riskScore + ')</a></div>';
      });
      if (analysis.staleContent.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.staleContent.length - 5) + ' more</div>';
      }
      html += '</div>';
    }

    // Suggested Connections (Link Recommender)
    if (analysis.suggestedConnections && analysis.suggestedConnections.length > 0) {
      html += '<div style="margin-bottom:6px;"><span style="color:#26A69A;font-weight:bold;">Conexões Sugeridas</span>';
      html += ' <span style="color:#26A69A;">' + analysis.suggestedConnections.length + '</span>';
      analysis.suggestedConnections.slice(0, 5).forEach(function(item) {
        html += '<div style="padding-left:6px;color:#aaa;font-size:9px;">';
        html += escapeHtml(item.nodeA.label) + ' \u2194 ' + escapeHtml(item.nodeB.label) + ' (' + item.similarityScore + '%)';
        html += ' <a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.nodeA.id) + '" style="color:#26A69A;text-decoration:underline;cursor:pointer;font-size:8px;">Link</a>';
        html += '</div>';
      });
      if (analysis.suggestedConnections.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.suggestedConnections.length - 5) + ' more</div>';
      }
      html += '</div>';
    }

    // Semantic Coherence (Rule 21)
    html += '<div style="margin-bottom:6px;"><span style="color:#AB47BC;font-weight:bold;">\uD83C\uDFAF Semantic Coherence</span>';
    if (!analysis.semanticCoherence || analysis.semanticCoherence.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#AB47BC;">' + analysis.semanticCoherence.length + '</span>';
      analysis.semanticCoherence.slice(0, 5).forEach(function(item) {
        var pct = Math.round(item.coherencePercent * 100);
        var pctColor = pct < 50 ? '#F44336' : '#FF9800';
        html += '<div style="padding-left:6px;">';
        html += '<a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + '</a>';
        html += ' <span style="color:' + pctColor + ';font-size:9px;">' + pct + '%</span>';
        html += '<div style="padding-left:6px;color:#888;font-size:8px;">Off-topic: ' + item.offTopicHeaders.slice(0, 3).map(function(h) { return escapeHtml(h); }).join(', ') + '</div>';
        html += '</div>';
      });
      if (analysis.semanticCoherence.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.semanticCoherence.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Circular Hook Dependencies (Rule 22)
    if (analysis.circularHookDependencies && analysis.circularHookDependencies.length > 0) {
      html += '<div style="margin-bottom:6px;"><span style="color:#E65100;font-weight:bold;">\u26A0\uFE0F Circular Hook Dependencies</span>';
      html += ' <span style="color:#E65100;">' + analysis.circularHookDependencies.length + '</span>';
      analysis.circularHookDependencies.slice(0, 5).forEach(function(cycle) {
        var nodeLabels = cycle.nodes.map(function(n) {
          var typeTag = n.type.indexOf('hook') !== -1 ? 'hook' : 'steering';
          return escapeHtml(n.label) + ' [' + typeTag + ']';
        }).join(' \u2192 ');
        html += '<div style="padding-left:6px;color:#aaa;font-size:9px;">' + nodeLabels + '</div>';
      });
      if (analysis.circularHookDependencies.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.circularHookDependencies.length - 5) + ' more</div>';
      }
      html += '</div>';
    }

    // Guardrail Suggestions (Rule 23)
    if (analysis.guardrailCoverage && analysis.guardrailCoverage.categories) {
      var guardrailSuggestions = analysis.guardrailCoverage.categories.filter(function(c) {
        return c.isRelevant && c.maturityLevel < 2 && c.suggestion;
      });
      if (guardrailSuggestions.length > 0) {
        html += '<div style="margin-bottom:6px;border-top:1px solid #333;padding-top:6px;">';
        html += '<span style="color:#42A5F5;font-weight:bold;">\uD83D\uDCA1 Guardrail Suggestions</span>';
        html += ' <span style="color:#42A5F5;">' + guardrailSuggestions.length + '</span>';
        guardrailSuggestions.forEach(function(cat) {
          var levelColor = cat.maturityLevel === 0 ? '#90CAF9' : '#64B5F6';
          var present = cat.hasHook ? 'hook' : cat.hasSteering ? 'steering' : 'none';
          html += '<div style="padding-left:6px;color:#90CAF9;font-size:9px;">';
          html += '<strong>' + escapeHtml(cat.category) + '</strong> (level ' + cat.maturityLevel + ')';
          html += ' <span style="color:#666;">present: ' + present + ', missing: ' + escapeHtml(cat.suggestion.missing) + '</span>';
          html += '</div>';
        });
        html += '</div>';
      }
    }

    // Instruction Specificity (Rule 24)
    if (analysis.instructionSpecificity && analysis.instructionSpecificity.alerts && analysis.instructionSpecificity.alerts.length > 0) {
      html += '<div style="margin-bottom:6px;border-top:1px solid #333;padding-top:6px;">';
      html += '<span style="color:#42A5F5;font-weight:bold;">\uD83C\uDFAF Instruction Specificity</span>';
      html += ' <span style="color:#42A5F5;">' + analysis.instructionSpecificity.alerts.length + '</span>';
      analysis.instructionSpecificity.alerts.forEach(function(alert) {
        html += '<div style="padding-left:6px;color:#90CAF9;font-size:9px;">';
        html += '<strong>' + escapeHtml(alert.label) + '</strong>';
        html += ' <span style="color:#64B5F6;">score: ' + alert.score + '%</span>';
        html += ' <span style="color:#666;">vague: ' + alert.vagueCount + '</span>';
        if (alert.vagueExamples && alert.vagueExamples.length > 0) {
          alert.vagueExamples.forEach(function(ex) {
            html += '<div style="padding-left:10px;color:#78909C;font-size:8px;font-style:italic;">\u2022 ' + escapeHtml(ex) + '</div>';
          });
        }
        html += '</div>';
      });
      html += '</div>';
    }

    // Context Budget (Rule 25)
    if (analysis.contextBudget) {
      var cb = analysis.contextBudget;
      var barColor = cb.budgetPercent <= 15 ? '#4CAF50' : cb.budgetPercent <= 30 ? '#FFC107' : '#F44336';
      var barWidth = Math.min(cb.budgetPercent, 100);
      html += '<div style="margin-bottom:6px;border-top:1px solid #333;padding-top:6px;">';
      html += '<span style="color:#90A4AE;font-weight:bold;">\uD83D\uDCCA Context Budget</span>';
      html += '<div style="margin:3px 0;background:#333;border-radius:3px;height:6px;overflow:hidden;">';
      html += '<div style="width:' + barWidth + '%;height:100%;background:' + barColor + ';border-radius:3px;"></div>';
      html += '</div>';
      if (cb.perSteering.length === 0) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">No always-loaded steerings found</div>';
      } else {
        html += '<div style="padding-left:6px;color:#B0BEC5;font-size:9px;">' + cb.totalTokens + ' tokens (' + cb.budgetPercent + '% of ' + cb.maxBudget + ')</div>';
        cb.perSteering.forEach(function(s) {
          html += '<div style="padding-left:10px;color:#78909C;font-size:8px;">\u2022 ' + escapeHtml(s.label) + ': ' + s.tokens + ' tokens (' + s.percent + '%)</div>';
        });
      }
      if (cb.suggestion) {
        html += '<div style="padding-left:6px;color:#FFC107;font-size:8px;margin-top:2px;">\u26A0 ' + escapeHtml(cb.suggestion) + '</div>';
      }
      html += '</div>';
    }

    // Jailbreak Protection (Rule 26)
    if (analysis.jailbreakProtection) {
      var jp = analysis.jailbreakProtection;
      var jpBadge = jp.maturityLevel === 2 ? '\uD83D\uDFE2 Level 2 (Reinforced)' :
        jp.maturityLevel === 1 ? '\uD83D\uDFE1 Level 1 (Basic)' : '\u26AA Level 0 (No protection)';
      html += '<div style="margin-bottom:6px;border-top:1px solid #333;padding-top:6px;">';
      html += '<span style="color:#90A4AE;font-weight:bold;">\uD83D\uDEE1\uFE0F Jailbreak Protection</span>';
      html += '<div style="padding-left:6px;color:#B0BEC5;font-size:9px;margin-top:2px;">' + jpBadge + '</div>';
      html += '<div style="padding-left:6px;color:#78909C;font-size:8px;">';
      html += 'Identity Lock: ' + (jp.hasIdentityLock ? '\u2713' : '\u2717') + ' | ';
      html += 'Strong Rules: ' + jp.strongRuleCount + ' | ';
      html += 'Redundant: ' + jp.redundantRuleCount + ' | ';
      html += 'Destructive Hooks: ' + jp.destructiveHookCount;
      html += '</div>';
      if (jp.suggestions.length > 0) {
        jp.suggestions.forEach(function(s) {
          html += '<div style="padding-left:6px;color:#90A4AE;font-size:8px;margin-top:1px;">\uD83D\uDCA1 ' + escapeHtml(s) + '</div>';
        });
      }
      html += '</div>';
    }

    // Conflict Resolution Priority (Rule 27)
    if (analysis.conflictResolution && (analysis.conflictResolution.priorityStatements.length > 0 || analysis.conflictResolution.suggestion)) {
      html += '<div style="margin-bottom:6px;border-top:1px solid #333;padding-top:6px;">';
      html += '<span style="color:#90A4AE;font-weight:bold;">\u2696\uFE0F Conflict Resolution</span>';
      if (analysis.conflictResolution.hasPriorityDefined) {
        html += ' <span style="color:#4CAF50;">Defined</span>';
        analysis.conflictResolution.priorityStatements.slice(0, 5).forEach(function(stmt) {
          html += '<div style="padding-left:6px;color:#78909C;font-size:8px;">\u2022 ' + escapeHtml(stmt.text) + ' <span style="color:#555;">(' + escapeHtml(stmt.steeringId) + ')</span></div>';
        });
        if (analysis.conflictResolution.priorityStatements.length > 5) {
          html += '<div style="padding-left:6px;color:#666;font-size:8px;">...and ' + (analysis.conflictResolution.priorityStatements.length - 5) + ' more</div>';
        }
      } else if (analysis.conflictResolution.suggestion) {
        html += '<div style="padding-left:6px;color:#90A4AE;font-size:8px;margin-top:2px;">\uD83D\uDCA1 ' + escapeHtml(analysis.conflictResolution.suggestion) + '</div>';
      }
      html += '</div>';
    }

    // Feedback Loop Completeness (Rule 28)
    if (analysis.feedbackLoops && (analysis.feedbackLoops.completeLoops > 0 || analysis.feedbackLoops.incompleteLoops.length > 0)) {
      html += '<div style="margin-bottom:6px;border-top:1px solid #333;padding-top:6px;">';
      html += '<span style="color:#90A4AE;font-weight:bold;">\uD83D\uDD04 Feedback Loops</span>';
      html += '<div style="padding-left:6px;color:#aaa;font-size:9px;margin-top:2px;">' + analysis.feedbackLoops.completeLoops + ' complete loop(s), ' + analysis.feedbackLoops.incompleteLoops.length + ' incomplete loop(s)</div>';
      if (analysis.feedbackLoops.incompleteLoops.length > 0) {
        analysis.feedbackLoops.incompleteLoops.slice(0, 5).forEach(function(entry) {
          html += '<div style="padding-left:6px;color:#78909C;font-size:8px;">\u2022 ' + escapeHtml(entry.hookLabel) + ' — missing: ' + entry.missing.join(', ') + '</div>';
        });
        if (analysis.feedbackLoops.incompleteLoops.length > 5) {
          html += '<div style="padding-left:6px;color:#666;font-size:8px;">...and ' + (analysis.feedbackLoops.incompleteLoops.length - 5) + ' more</div>';
        }
      }
      if (analysis.feedbackLoops.suggestion) {
        html += '<div style="padding-left:6px;color:#90A4AE;font-size:8px;margin-top:2px;">\uD83D\uDCA1 ' + escapeHtml(analysis.feedbackLoops.suggestion) + '</div>';
      }
      html += '</div>';
    }

    // Suggestions
    if (analysis.sugestoes.length > 0) {
      html += '<div style="margin-top:6px;border-top:1px solid #333;padding-top:6px;"><span style="color:#4A9EFF;font-weight:bold;">Suggestions</span>';
      analysis.sugestoes.forEach(function(s) {
        html += '<div style="padding-left:6px;color:#aaa;font-size:9px;">\u2022 ' + escapeHtml(s) + '</div>';
      });
      html += '</div>';
    }

    content.innerHTML = html;

    // Wire click-to-highlight for node links
    var links = content.querySelectorAll('.cognitive-node-link');
    links.forEach(function(el) {
      el.addEventListener('click', function(e) {
        e.preventDefault();
        var nodeId = el.getAttribute('data-node-id');
        if (nodeId && typeof graph !== 'undefined' && typeof graphData !== 'undefined') {
          var node = graphData.nodes.find(function(n) { return n.id === nodeId; });
          if (node && node.x != null && node.y != null) {
            graph.centerAt(node.x, node.y, 500);
            graph.zoom(2, 500);
          }
        }
      });
    });

    // Wire onboarding section collapse toggle
    var onboardingHeader = document.getElementById('onboarding-header');
    if (onboardingHeader) {
      onboardingHeader.addEventListener('click', function() {
        var body = document.getElementById('onboarding-body');
        var icon = document.getElementById('onboarding-toggle-icon');
        if (body && icon) {
          var isHidden = body.style.display === 'none';
          body.style.display = isHidden ? '' : 'none';
          icon.textContent = isHidden ? '\u25BC' : '\u25B6';
          try { localStorage.setItem('onboarding-collapsed', isHidden ? 'false' : 'true'); } catch (e) { /* ignore */ }
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) { return ''; }
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    if (!str) { return ''; }
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  return {
    computeAnalysis: computeAnalysis,
    renderPanel: renderPanel
  };
})();

/**
 * Update the cognitive panel with current graph data.
 * Called from webview.js after graph data refresh.
 * @param {{ nodes: any[], links: any[] }} data
 * @param {Map<string, number>} degrees
 * @param {string[]} workspaceFolders
 * @param {Array} statsHistoryData - Optional stats history for trend
 */
// eslint-disable-next-line no-unused-vars
function updateCognitivePanel(data, degrees, workspaceFolders, statsHistoryData) {
  if (typeof CognitivePanel !== 'undefined') {
    var analysis = CognitivePanel.computeAnalysis(data, degrees, workspaceFolders);
    CognitivePanel.renderPanel(analysis, statsHistoryData, data);
  }
}
