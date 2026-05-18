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
        if ((incomingMap[n.id] || 0) === 0 && (outgoingMap[n.id] || 0) === 0) {
          steeringsSoltos.push({ id: n.id, label: n.label });
        }
      }
    });

    // 2. Vinculos Frageis: edges with weight=1 AND type='backtick-ref'
    var vinculosFrageis = [];
    data.links.forEach(function(link) {
      var w = link.weight || 1;
      if (w === 1 && link.type === 'backtick-ref') {
        var s = typeof link.source === 'object' ? link.source.id : link.source;
        var t = typeof link.target === 'object' ? link.target.id : link.target;
        var sNode = data.nodes.find(function(n) { return n.id === s; });
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

    // 6. Context Overload: always-included steerings that may overflow the context window
    var contextOverload = [];
    var totalAlwaysLines = 0;
    data.nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
        var inclusion = (n.metadata && n.metadata.inclusion) || 'always';
        var lineCount = (n.metadata && n.metadata.lineCount) || 0;
        if (inclusion === 'always' || inclusion === 'auto') {
          totalAlwaysLines += lineCount;
          if (lineCount > 350) {
            contextOverload.push({ id: n.id, label: n.label, lineCount: lineCount });
          }
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
          hooksWithoutInstruction.push({ id: n.id, label: n.label });
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

    return {
      steeringsSoltos: steeringsSoltos,
      vinculosFrageis: vinculosFrageis,
      arquivosSemContexto: arquivosSemContexto,
      coverageGaps: coverageGaps,
      weakInstructions: weakInstructions,
      contextOverload: contextOverload,
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
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Panel Rendering
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Render the analysis results into the panel.
   * @param {object} analysis
   */
  function renderPanel(analysis) {
    var content = document.getElementById('cognitive-content');
    if (!content) { return; }

    // Store latest analysis for export button
    latestAnalysis = analysis;

    // Show/hide export button based on analysis availability
    exportBtn.style.display = analysis ? 'inline-block' : 'none';

    if (!analysis) {
      content.innerHTML = '<span style="color:#666;">No data available</span>';
      return;
    }

    var html = '';

    // Orphan Steerings
    html += '<div style="margin-bottom:6px;"><span style="color:#FF9800;font-weight:bold;">Orphan Steerings</span>';
    if (analysis.steeringsSoltos.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#FF9800;">' + analysis.steeringsSoltos.length + '</span>';
      analysis.steeringsSoltos.slice(0, 5).forEach(function(item) {
        html += '<div style="padding-left:6px;"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + '</a></div>';
      });
      if (analysis.steeringsSoltos.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.steeringsSoltos.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Fragile Links
    html += '<div style="margin-bottom:6px;"><span style="color:#F44336;font-weight:bold;">Fragile Links</span>';
    if (analysis.vinculosFrageis.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#F44336;">' + analysis.vinculosFrageis.length + '</span>';
      analysis.vinculosFrageis.slice(0, 5).forEach(function(item) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;">' + escapeHtml(item.sourceLabel) + ' \u2192 ' + escapeHtml(item.targetLabel) + '</div>';
      });
      if (analysis.vinculosFrageis.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.vinculosFrageis.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Isolated Files
    html += '<div style="margin-bottom:6px;"><span style="color:#9C27B0;font-weight:bold;">Isolated Files</span>';
    if (analysis.arquivosSemContexto.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#9C27B0;">' + analysis.arquivosSemContexto.length + '</span>';
      analysis.arquivosSemContexto.slice(0, 5).forEach(function(item) {
        html += '<div style="padding-left:6px;"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + '</a></div>';
      });
      if (analysis.arquivosSemContexto.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.arquivosSemContexto.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Coverage Gaps
    html += '<div style="margin-bottom:6px;"><span style="color:#00BCD4;font-weight:bold;">Coverage Gaps</span>';
    if (analysis.coverageGaps.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#00BCD4;">' + analysis.coverageGaps.length + '</span>';
      analysis.coverageGaps.slice(0, 5).forEach(function(item) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;">' + escapeHtml(item.folder) + '</div>';
      });
      if (analysis.coverageGaps.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.coverageGaps.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Weak Instructions
    html += '<div style="margin-bottom:6px;"><span style="color:#FFC107;font-weight:bold;">Weak Instructions</span>';
    if (analysis.weakInstructions.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#FFC107;">' + analysis.weakInstructions.length + '</span>';
      analysis.weakInstructions.slice(0, 5).forEach(function(item) {
        html += '<div style="padding-left:6px;"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + item.lineCount + ' lines)</a></div>';
      });
      if (analysis.weakInstructions.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.weakInstructions.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Context Overload
    html += '<div style="margin-bottom:6px;"><span style="color:#E91E63;font-weight:bold;">Context Overload</span>';
    if (analysis.contextOverload.length === 0 && analysis.totalAlwaysLines <= 500) {
      html += ' <span style="color:#4CAF50;">OK</span>';
    } else {
      html += ' <span style="color:#E91E63;">' + analysis.totalAlwaysLines + ' lines</span>';
      analysis.contextOverload.slice(0, 5).forEach(function(item) {
        html += '<div style="padding-left:6px;"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + item.lineCount + ' lines, max 350)</a></div>';
      });
      if (analysis.contextOverload.length > 5) {
        html += '<div style="padding-left:6px;color:#666;font-size:9px;">...and ' + (analysis.contextOverload.length - 5) + ' more</div>';
      }
    }
    html += '</div>';

    // Instruction-Access Gap
    var gapCount = analysis.hooksWithoutInstruction.length + analysis.steeringsWithoutAccess.length;
    html += '<div style="margin-bottom:6px;"><span style="color:#8BC34A;font-weight:bold;">Instruction \u2194 Access</span>';
    if (gapCount === 0) {
      html += ' <span style="color:#4CAF50;">OK</span>';
    } else {
      html += ' <span style="color:#8BC34A;">' + gapCount + '</span>';
      if (analysis.hooksWithoutInstruction.length > 0) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;font-style:italic;">Hooks without instruction:</div>';
        analysis.hooksWithoutInstruction.slice(0, 3).forEach(function(item) {
          html += '<div style="padding-left:10px;"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + '</a></div>';
        });
      }
      if (analysis.steeringsWithoutAccess.length > 0) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;font-style:italic;">Steerings without access:</div>';
        analysis.steeringsWithoutAccess.slice(0, 3).forEach(function(item) {
          html += '<div style="padding-left:10px;"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + '</a></div>';
        });
      }
    }
    html += '</div>';

    // ─── New Cognitive Assertiveness Sections ───

    // Dead Loops
    html += '<div style="margin-bottom:6px;"><span style="color:#FF5722;font-weight:bold;">Dead Loops</span>';
    if (!analysis.deadLoops || analysis.deadLoops.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#FF5722;">' + analysis.deadLoops.length + '</span>';
      analysis.deadLoops.slice(0, 3).forEach(function(loop) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;">' + loop.size + ' nodes: ' + loop.nodes.map(function(n) { return escapeHtml(n.label); }).join(' \u2192 ') + '</div>';
      });
    }
    html += '</div>';

    // Hops to Reach
    html += '<div style="margin-bottom:6px;"><span style="color:#FF7043;font-weight:bold;">Hops to Reach</span>';
    if (!analysis.hopsToReach || analysis.hopsToReach.length === 0) {
      html += ' <span style="color:#4CAF50;">OK</span>';
    } else {
      html += ' <span style="color:#FF7043;">' + analysis.hopsToReach.length + '</span>';
      analysis.hopsToReach.slice(0, 5).forEach(function(item) {
        var hopsText = (item.hops >= 999 || item.hops === null || item.hops === undefined) ? '\u221E' : item.hops;
        html += '<div style="padding-left:6px;"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + hopsText + ' hops)</a></div>';
      });
    }
    html += '</div>';

    // Duplicate Intent
    html += '<div style="margin-bottom:6px;"><span style="color:#AB47BC;font-weight:bold;">Duplicate Intent</span>';
    if (!analysis.duplicateIntent || analysis.duplicateIntent.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#AB47BC;">' + analysis.duplicateIntent.length + '</span>';
      analysis.duplicateIntent.slice(0, 3).forEach(function(pair) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;">' + escapeHtml(pair.nodeA.label) + ' \u2194 ' + escapeHtml(pair.nodeB.label) + ' (' + pair.overlap + '%)</div>';
      });
    }
    html += '</div>';

    // Passive Knowledge
    html += '<div style="margin-bottom:6px;"><span style="color:#78909C;font-weight:bold;">Passive Knowledge</span>';
    if (!analysis.passiveKnowledge || analysis.passiveKnowledge.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#78909C;">' + analysis.passiveKnowledge.length + '</span>';
      analysis.passiveKnowledge.slice(0, 5).forEach(function(item) {
        html += '<div style="padding-left:6px;"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + item.actionablePercent + '% actionable)</a></div>';
      });
    }
    html += '</div>';

    // Signal-to-Noise
    html += '<div style="margin-bottom:6px;"><span style="color:#FFAB40;font-weight:bold;">Signal-to-Noise</span>';
    if (!analysis.signalToNoise || analysis.signalToNoise.length === 0) {
      html += ' <span style="color:#4CAF50;">OK</span>';
    } else {
      html += ' <span style="color:#FFAB40;">' + analysis.signalToNoise.length + '</span>';
      analysis.signalToNoise.slice(0, 5).forEach(function(item) {
        html += '<div style="padding-left:6px;"><a href="#" class="cognitive-node-link" data-node-id="' + escapeAttr(item.id) + '" style="color:#ccc;text-decoration:underline;cursor:pointer;font-size:9px;">' + escapeHtml(item.label) + ' (' + item.signalRatio + '% signal)</a></div>';
      });
    }
    html += '</div>';

    // Contradictions
    html += '<div style="margin-bottom:6px;"><span style="color:#D32F2F;font-weight:bold;">Contradictions</span>';
    if (!analysis.contradictions || analysis.contradictions.length === 0) {
      html += ' <span style="color:#4CAF50;">0</span>';
    } else {
      html += ' <span style="color:#D32F2F;">' + analysis.contradictions.length + '</span>';
      analysis.contradictions.slice(0, 3).forEach(function(c) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;">' + escapeHtml(c.nodeA.label) + ' vs ' + escapeHtml(c.nodeB.label) + ' (' + escapeHtml(c.conflictType) + ')</div>';
      });
    }
    html += '</div>';

    // Hook Coverage
    html += '<div style="margin-bottom:6px;"><span style="color:#26A69A;font-weight:bold;">Hook Coverage</span>';
    if (analysis.hookCoverageMap && analysis.hookCoverageMap.uncovered.length === 0) {
      html += ' <span style="color:#4CAF50;">10/10</span>';
    } else if (analysis.hookCoverageMap) {
      var coveredCount = analysis.hookCoverageMap.covered.length;
      html += ' <span style="color:#26A69A;">' + coveredCount + '/10</span>';
      analysis.hookCoverageMap.uncovered.slice(0, 5).forEach(function(item) {
        html += '<div style="padding-left:6px;color:#888;font-size:9px;">\u2717 ' + escapeHtml(item.event) + '</div>';
      });
    }
    html += '</div>';

    // Decision Path
    html += '<div style="margin-bottom:6px;"><span style="color:#5C6BC0;font-weight:bold;">Decision Path</span>';
    if (analysis.decisionPathCompleteness) {
      var dpGaps = analysis.decisionPathCompleteness.hooksWithoutDecisionSteering.length + analysis.decisionPathCompleteness.steeringsWithoutHook.length;
      if (dpGaps === 0) {
        html += ' <span style="color:#4CAF50;">OK</span>';
      } else {
        html += ' <span style="color:#5C6BC0;">' + dpGaps + ' gaps</span>';
        if (analysis.decisionPathCompleteness.hooksWithoutDecisionSteering.length > 0) {
          html += '<div style="padding-left:6px;color:#888;font-size:9px;font-style:italic;">Hooks without steering:</div>';
          analysis.decisionPathCompleteness.hooksWithoutDecisionSteering.slice(0, 3).forEach(function(item) {
            html += '<div style="padding-left:10px;color:#888;font-size:9px;">' + escapeHtml(item.label) + '</div>';
          });
        }
        if (analysis.decisionPathCompleteness.steeringsWithoutHook.length > 0) {
          html += '<div style="padding-left:6px;color:#888;font-size:9px;font-style:italic;">Steerings without hook:</div>';
          analysis.decisionPathCompleteness.steeringsWithoutHook.slice(0, 3).forEach(function(item) {
            html += '<div style="padding-left:10px;color:#888;font-size:9px;">' + escapeHtml(item.label) + '</div>';
          });
        }
      }
    }
    html += '</div>';

    // Quality Gate
    html += '<div style="margin-bottom:6px;"><span style="color:#7E57C2;font-weight:bold;">Quality Gate</span>';
    if (analysis.qualityGate) {
      var qgLevel = analysis.qualityGate.maturityLevel;
      var qgColor = qgLevel === 2 ? '#4CAF50' : qgLevel === 1 ? '#FFC107' : '#F44336';
      var qgLabel = qgLevel === 2 ? 'Complete' : qgLevel === 1 ? 'Partial' : 'No Gate';
      html += ' <span style="color:' + qgColor + ';">Level ' + qgLevel + ' (' + qgLabel + ')</span>';
    }
    html += '</div>';

    // DML Protection
    html += '<div style="margin-bottom:6px;"><span style="color:#EF5350;font-weight:bold;">DML Protection</span>';
    if (analysis.dmlProtection) {
      var dmlLevel = analysis.dmlProtection.maturityLevel;
      var dmlColor = dmlLevel === 2 ? '#4CAF50' : dmlLevel === 1 ? '#FFC107' : '#F44336';
      var dmlLabel = dmlLevel === 2 ? 'Smart' : dmlLevel === 1 ? 'Blind Block' : 'No Protection';
      html += ' <span style="color:' + dmlColor + ';">Level ' + dmlLevel + ' (' + dmlLabel + ')</span>';
    }
    html += '</div>';

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
 */
// eslint-disable-next-line no-unused-vars
function updateCognitivePanel(data, degrees, workspaceFolders) {
  if (typeof CognitivePanel !== 'undefined') {
    var analysis = CognitivePanel.computeAnalysis(data, degrees, workspaceFolders);
    CognitivePanel.renderPanel(analysis);
  }
}
