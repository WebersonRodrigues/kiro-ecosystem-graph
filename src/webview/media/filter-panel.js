/**
 * Ecosystem Graph — Filter Panel
 *
 * Builds and manages the filter/search UI: text search input, NodeType toggle
 * buttons, and workspace folder toggle buttons. Relies on global state and
 * functions defined in webview.js:
 *   - searchFilter, visibleTypes, visibleFolders (state)
 *   - reapplyFilters() (re-render graph with current filters)
 *   - graphData (current graph data for extracting folders)
 *   - COLOR_MAP (node type colors)
 */

// eslint-disable-next-line no-unused-vars
var rebuildFilterToggles;

(function () {
  'use strict';

  var filterTogglesContainer = document.getElementById('filter-toggles');
  var searchInput = document.getElementById('search-input');

  if (!filterTogglesContainer || !searchInput) { return; }

  // ─────────────────────────────────────────────────────────────────────────
  // Search Input Wiring
  // ─────────────────────────────────────────────────────────────────────────

  searchInput.addEventListener('input', function () {
    searchFilter = searchInput.value.trim();
    reapplyFilters();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Toggle Button Styles (injected once)
  // ─────────────────────────────────────────────────────────────────────────

  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '.filter-toggle-btn {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 4px;',
    '  padding: 3px 7px;',
    '  border-radius: 3px;',
    '  border: 1px solid #444;',
    '  background: #1a1a1a;',
    '  color: #ccc;',
    '  font-size: 10px;',
    '  cursor: pointer;',
    '  transition: opacity 0.15s, border-color 0.15s;',
    '  user-select: none;',
    '}',
    '.filter-toggle-btn.active {',
    '  opacity: 1;',
    '  border-color: #4A9EFF;',
    '}',
    '.filter-toggle-btn.inactive {',
    '  opacity: 0.4;',
    '  border-color: #333;',
    '}',
    '.filter-toggle-btn:hover {',
    '  opacity: 0.85;',
    '}',
    '.filter-dot {',
    '  width: 7px;',
    '  height: 7px;',
    '  border-radius: 50%;',
    '  flex-shrink: 0;',
    '}',
    '.filter-section-label {',
    '  font-size: 9px;',
    '  color: #666;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.3px;',
    '  margin-top: 4px;',
    '  width: 100%;',
    '}',
  ].join('\n');
  document.head.appendChild(styleEl);

  // ─────────────────────────────────────────────────────────────────────────
  // Build Toggle Buttons
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Rebuild all filter toggle buttons (type + folder).
   * Called on initial load and when graph data updates with new folders.
   */
  rebuildFilterToggles = function () {
    filterTogglesContainer.innerHTML = '';

    // Section: Node Types
    var typeLabel = document.createElement('div');
    typeLabel.className = 'filter-section-label';
    typeLabel.textContent = 'Types';
    filterTogglesContainer.appendChild(typeLabel);

    var types = getTypesInData();
    types.forEach(function (type) {
      var btn = createToggleButton(type, COLOR_MAP[type] || '#607D8B', 'type');
      btn.classList.add(visibleTypes.has(type) ? 'active' : 'inactive');
      filterTogglesContainer.appendChild(btn);
    });

    // Section: Workspace Folders (dynamic from graph data)
    var allFolders = getAllFolders();
    if (allFolders.length > 0) {
      var folderLabel = document.createElement('div');
      folderLabel.className = 'filter-section-label';
      folderLabel.textContent = 'Folders';
      filterTogglesContainer.appendChild(folderLabel);

      allFolders.forEach(function (folder) {
        var btn = createToggleButton(folder, '#4A9EFF', 'folder');
        btn.classList.add(visibleFolders.has(folder) ? 'active' : 'inactive');
        filterTogglesContainer.appendChild(btn);
      });
    }
  };

  /**
   * Create a single toggle button element.
   * @param {string} label - Display text
   * @param {string} dotColor - Color for the dot indicator
   * @param {string} category - 'type' or 'folder'
   * @returns {HTMLElement}
   */
  function createToggleButton(label, dotColor, category) {
    var btn = document.createElement('button');
    btn.className = 'filter-toggle-btn';
    btn.setAttribute('data-category', category);
    btn.setAttribute('data-value', label);

    var dot = document.createElement('span');
    dot.className = 'filter-dot';
    dot.style.background = dotColor;

    var text = document.createElement('span');
    text.textContent = label;

    btn.appendChild(dot);
    btn.appendChild(text);

    btn.addEventListener('click', function () {
      handleToggleClick(btn, category, label);
    });

    return btn;
  }

  /**
   * Handle toggle button click — add/remove from visibleTypes or visibleFolders.
   * @param {HTMLElement} btn
   * @param {string} category - 'type' or 'folder'
   * @param {string} value - The type name or folder name
   */
  function handleToggleClick(btn, category, value) {
    var targetSet = category === 'type' ? visibleTypes : visibleFolders;

    if (targetSet.has(value)) {
      targetSet.delete(value);
      btn.classList.remove('active');
      btn.classList.add('inactive');
    } else {
      targetSet.add(value);
      btn.classList.remove('inactive');
      btn.classList.add('active');
    }

    reapplyFilters();
  }

  /**
   * Get all unique node types present in the current graph data.
   * Only shows types that actually have nodes — no phantom toggles.
   * @returns {string[]}
   */
  function getTypesInData() {
    if (typeof graphData === 'undefined' || !graphData.nodes || graphData.nodes.length === 0) {
      return Object.keys(COLOR_MAP);
    }
    var types = new Set();
    graphData.nodes.forEach(function (n) {
      if (n.type) { types.add(n.type); }
    });
    return Array.from(types).sort();
  }

  /**
   * Get all unique workspace folders from the current graph data.
   * @returns {string[]}
   */
  function getAllFolders() {
    if (typeof graphData === 'undefined' || !graphData.nodes) { return []; }
    var folders = new Set();
    graphData.nodes.forEach(function (n) {
      if (n.workspaceFolder) { folders.add(n.workspaceFolder); }
    });
    return Array.from(folders).sort();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Initial Build (type toggles only — folders come when graph data arrives)
  // ─────────────────────────────────────────────────────────────────────────

  rebuildFilterToggles();

})();
