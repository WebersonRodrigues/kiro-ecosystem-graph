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
  panel.innerHTML = '<div style="font-size:11px;font-weight:bold;color:#fff;margin-bottom:4px;">Cognitive Analysis</div><div id="cognitive-content">No data</div>';
  document.body.appendChild(panel);

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
    var steeringsSoltos = [];
    data.nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) {
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
    var arquivosSemContexto = [];
    data.nodes.forEach(function(n) {
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

    // 5. Suggestions: actionable recommendations
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

    return {
      steeringsSoltos: steeringsSoltos,
      vinculosFrageis: vinculosFrageis,
      arquivosSemContexto: arquivosSemContexto,
      coverageGaps: coverageGaps,
      sugestoes: sugestoes
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
