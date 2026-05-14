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
