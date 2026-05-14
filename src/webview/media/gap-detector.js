/**
 * Ecosystem Graph — Gap Detector
 *
 * Computes gap detection metrics on the in-memory graph data:
 * - Suggested connections (semantic similarity between unconnected nodes)
 * - Dead zones (nodes with stale mtime)
 * - Coverage map (steering file count per workspace folder)
 * - Redundancy pairs (nodes sharing common outgoing targets)
 *
 * All functions operate purely on the graph data passed in — no filesystem
 * access or extension host communication needed.
 */

// eslint-disable-next-line no-unused-vars
var GapDetector = (function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // Suggested Connections
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute suggested connections between unconnected nodes based on label
   * similarity. Tokenizes labels by splitting on `-`, `_`, `.` and computes
   * Jaccard similarity of token sets. Returns pairs with similarity >= 0.5
   * and at least 2 shared tokens.
   *
   * @param {{ nodes: Array<{id: string, label: string}>, links: Array<{source: string|object, target: string|object}> }} graphData
   * @returns {Array<{source: string, target: string, sharedTerms: string[], score: number}>}
   *
   * Validates: Requirements 1.1, 1.3
   */
  function computeSuggestedConnections(graphData) {
    var suggestions = [];
    var nodes = graphData.nodes;

    // Build set of existing edges for quick lookup (bidirectional)
    var existingEdges = new Set();
    graphData.links.forEach(function (link) {
      var s = typeof link.source === 'object' ? link.source.id : link.source;
      var t = typeof link.target === 'object' ? link.target.id : link.target;
      existingEdges.add(s + '->' + t);
      existingEdges.add(t + '->' + s);
    });

    /**
     * Tokenize a node label by splitting on common separators.
     * Filters out tokens shorter than 3 characters.
     * @param {string} label
     * @returns {string[]}
     */
    function tokenize(label) {
      return label.toLowerCase().split(/[-_.]/).filter(function (t) {
        return t.length > 2;
      });
    }

    // Compare all unconnected pairs using Jaccard similarity
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var a = nodes[i];
        var b = nodes[j];

        // Skip if already connected
        if (existingEdges.has(a.id + '->' + b.id)) { continue; }

        var tokensA = tokenize(a.label);
        var tokensB = tokenize(b.label);

        // Compute intersection
        var intersection = tokensA.filter(function (t) {
          return tokensB.indexOf(t) !== -1;
        });

        // Require at least 2 shared tokens
        if (intersection.length >= 2) {
          // Compute union size for Jaccard
          var union = new Set(tokensA.concat(tokensB));
          var similarity = intersection.length / union.size;

          if (similarity >= 0.5) {
            suggestions.push({
              source: a.id,
              target: b.id,
              sharedTerms: intersection,
              score: similarity
            });
          }
        }
      }
    }

    return suggestions;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Dead Zones Detection
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Detect dead zone nodes — files not modified in 30+ days.
   * Uses the mtime metadata provided by the extension host.
   *
   * @param {{ nodes: Array<{id: string, metadata?: {mtime?: number}}>, links: any[] }} graphData
   * @param {number} currentTime - Current timestamp in milliseconds (Date.now())
   * @returns {Array<{nodeId: string, daysSinceEdit: number}>}
   *
   * Validates: Requirements 2.2, 2.4
   */
  function computeDeadZones(graphData, currentTime) {
    var deadZones = [];
    var oneDayMs = 24 * 60 * 60 * 1000;

    graphData.nodes.forEach(function (node) {
      if (node.metadata && node.metadata.mtime) {
        var daysSinceEdit = Math.floor((currentTime - node.metadata.mtime) / oneDayMs);
        if (daysSinceEdit >= 30) {
          deadZones.push({
            nodeId: node.id,
            daysSinceEdit: daysSinceEdit
          });
        }
      }
    });

    return deadZones;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Coverage Map
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute coverage map — count steering files per workspace folder and
   * assign coverage levels: high (5+), medium (2-4), low (1), none (0).
   *
   * @param {{ nodes: Array<{id: string, workspaceFolder?: string}>, links: any[] }} graphData
   * @param {string[]} workspaceFolders - List of all workspace folder names
   * @returns {Array<{folder: string, fileCount: number, level: 'high'|'medium'|'low'|'none'}>}
   *
   * Validates: Requirements 3.1, 3.3, 3.4
   */
  function computeCoverageMap(graphData, workspaceFolders) {
    // Initialize counts for each known folder
    var folderCounts = {};
    workspaceFolders.forEach(function (f) {
      folderCounts[f] = 0;
    });

    // Count nodes per folder
    graphData.nodes.forEach(function (node) {
      if (node.workspaceFolder && folderCounts[node.workspaceFolder] !== undefined) {
        folderCounts[node.workspaceFolder]++;
      }
    });

    // Build coverage entries with level classification
    var coverage = [];
    Object.keys(folderCounts).forEach(function (folder) {
      var count = folderCounts[folder];
      var level;
      if (count >= 5) {
        level = 'high';
      } else if (count >= 2) {
        level = 'medium';
      } else if (count >= 1) {
        level = 'low';
      } else {
        level = 'none';
      }
      coverage.push({
        folder: folder,
        fileCount: count,
        level: level
      });
    });

    return coverage;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Redundancy Detector
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Detect redundancy pairs — nodes that share 3 or more common outgoing
   * targets. Indicates potential knowledge duplication.
   *
   * @param {{ nodes: Array<{id: string}>, links: Array<{source: string|object, target: string|object}> }} graphData
   * @returns {Array<{nodeA: string, nodeB: string, sharedTargets: string[]}>}
   *
   * Validates: Requirements 9.1, 9.5
   */
  function computeRedundancyPairs(graphData) {
    var pairs = [];

    // Build outgoing targets per node
    var outgoing = {};
    graphData.nodes.forEach(function (n) {
      outgoing[n.id] = [];
    });

    graphData.links.forEach(function (link) {
      var s = typeof link.source === 'object' ? link.source.id : link.source;
      var t = typeof link.target === 'object' ? link.target.id : link.target;
      if (outgoing[s]) {
        outgoing[s].push(t);
      }
    });

    // Compare all pairs of nodes for shared outgoing targets
    var nodeIds = Object.keys(outgoing);
    for (var i = 0; i < nodeIds.length; i++) {
      for (var j = i + 1; j < nodeIds.length; j++) {
        var a = nodeIds[i];
        var b = nodeIds[j];
        var targetsA = outgoing[a];
        var targetsB = outgoing[b];

        var shared = targetsA.filter(function (t) {
          return targetsB.indexOf(t) !== -1;
        });

        if (shared.length >= 3) {
          pairs.push({
            nodeA: a,
            nodeB: b,
            sharedTargets: shared
          });
        }
      }
    }

    return pairs;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  return {
    computeSuggestedConnections: computeSuggestedConnections,
    computeDeadZones: computeDeadZones,
    computeCoverageMap: computeCoverageMap,
    computeRedundancyPairs: computeRedundancyPairs
  };
})();
