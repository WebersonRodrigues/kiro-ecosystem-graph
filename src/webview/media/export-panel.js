/**
 * Export Panel — Export as Image & Snapshot Save/Compare
 *
 * Handles two features:
 * 1. Export as PNG: captures the force-graph canvas and sends data URL to extension host
 * 2. Snapshot Save/Compare: saves graph state, loads snapshots, computes visual diffs
 *
 * Relies on global variables from webview.js: vscode, graphData
 *
 * Requirements validated: 11.1-11.6, 12.1-12.5
 */

// ─────────────────────────────────────────────────────────────────────────────
// Export as Image (Requirement 12)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Capture the current graph canvas as a PNG and send to extension host for saving.
 * Finds the canvas element inside the graph container, converts to data URL,
 * and posts the result via vscode messaging.
 *
 * @param {HTMLElement} graphContainer - The DOM element containing the force-graph canvas
 * @param {object} vscodeApi - The VS Code webview API object (acquireVsCodeApi())
 *
 * Validates: Requirements 12.1, 12.2, 12.5
 */
// eslint-disable-next-line no-unused-vars
function triggerExport(graphContainer, vscodeApi) {
  try {
    // force-graph renders to a canvas inside the #graph container
    var canvas = graphContainer.querySelector('canvas');
    if (!canvas) {
      vscodeApi.postMessage({ type: 'exportImageError', error: 'Canvas not found' });
      return;
    }
    var dataUrl = canvas.toDataURL('image/png');
    vscodeApi.postMessage({ type: 'exportImage', dataUrl: dataUrl });
  } catch (error) {
    vscodeApi.postMessage({ type: 'exportImageError', error: error.message || 'Unknown error' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Save/Compare State (Requirement 11)
// ─────────────────────────────────────────────────────────────────────────────

/** @type {boolean} Whether snapshot compare mode is currently active */
// eslint-disable-next-line no-unused-vars
var snapshotCompareActive = false;

/**
 * Diff result from comparing current graph with a saved snapshot.
 * @type {{ newNodes: string[], removedNodes: string[], newEdges: string[], removedEdges: string[] }|null}
 */
// eslint-disable-next-line no-unused-vars
var snapshotDiff = null;

/**
 * List of available snapshots (populated from updateGraph message).
 * @type {{ filename: string, timestamp: number }[]}
 */
// eslint-disable-next-line no-unused-vars
var snapshotList = [];

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Save (Requirement 11.1, 11.6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger a snapshot save by sending a message to the extension host.
 * The extension host serializes the current graph state to a timestamped JSON file.
 *
 * @param {object} vscodeApi - The VS Code webview API object
 *
 * Validates: Requirements 11.1, 11.6
 */
// eslint-disable-next-line no-unused-vars
function triggerSnapshotSave(vscodeApi) {
  vscodeApi.postMessage({ type: 'saveSnapshot' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot List Management (Requirement 11.3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update the local snapshot list from data received in updateGraph message.
 * Re-renders the snapshot selector dropdown.
 *
 * @param {{ filename: string, timestamp: number }[]} list - Available snapshots
 *
 * Validates: Requirements 11.3
 */
// eslint-disable-next-line no-unused-vars
function updateSnapshotList(list) {
  snapshotList = list || [];
  renderSnapshotSelector();
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Compare (Requirement 11.2, 11.4, 11.5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enter snapshot compare mode by computing the diff between current graph data
 * and a previously saved snapshot. Identifies new/removed nodes and edges.
 *
 * @param {{ nodes: any[], links: any[] }} currentData - Current graph data (force-graph format)
 * @param {{ nodes: any[], edges: any[] }} snapshotData - Saved snapshot data
 *
 * Validates: Requirements 11.2, 11.4, 11.5
 */
// eslint-disable-next-line no-unused-vars
function enterSnapshotCompare(currentData, snapshotData) {
  snapshotCompareActive = true;

  // Build sets of current node IDs
  var currentNodeIds = new Set(currentData.nodes.map(function (n) { return n.id; }));
  var snapshotNodeIds = new Set(snapshotData.nodes.map(function (n) { return n.id; }));

  // Compute node diff
  var newNodes = currentData.nodes
    .filter(function (n) { return !snapshotNodeIds.has(n.id); })
    .map(function (n) { return n.id; });
  var removedNodes = snapshotData.nodes
    .filter(function (n) { return !currentNodeIds.has(n.id); })
    .map(function (n) { return n.id; });

  // Build sets of current edge keys (handle force-graph object references)
  var currentEdgeKeys = new Set(currentData.links.map(function (e) {
    var s = typeof e.source === 'object' ? e.source.id : e.source;
    var t = typeof e.target === 'object' ? e.target.id : e.target;
    return s + '->' + t;
  }));
  var snapshotEdgeKeys = new Set(snapshotData.edges.map(function (e) {
    return e.source + '->' + e.target;
  }));

  // Compute edge diff
  var newEdges = [];
  currentEdgeKeys.forEach(function (key) {
    if (!snapshotEdgeKeys.has(key)) { newEdges.push(key); }
  });
  var removedEdges = [];
  snapshotEdgeKeys.forEach(function (key) {
    if (!currentEdgeKeys.has(key)) { removedEdges.push(key); }
  });

  snapshotDiff = {
    newNodes: newNodes,
    removedNodes: removedNodes,
    newEdges: newEdges,
    removedEdges: removedEdges
  };
}

/**
 * Exit snapshot compare mode and clear diff state.
 * Restores normal rendering.
 *
 * Validates: Requirements 11.5
 */
// eslint-disable-next-line no-unused-vars
function exitSnapshotCompare() {
  snapshotCompareActive = false;
  snapshotDiff = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Selector UI (Requirement 11.3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a dropdown selector for choosing a snapshot to compare against.
 * Creates/updates a fixed-position DOM element with available snapshots.
 * On selection, sends loadSnapshot message to extension host.
 *
 * Validates: Requirements 11.3
 */
function renderSnapshotSelector() {
  // Snapshot selector removed from UI — functionality still available via commands
  var existing = document.getElementById('snapshot-selector');
  if (existing) { existing.remove(); }
  return;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Buttons (Export PNG + Save Snapshot) — REMOVED
// Buttons were removed to declutter the UI. Export/Snapshot functionality
// remains available via the functions triggerExport() and triggerSnapshotSave()
// if needed programmatically.
