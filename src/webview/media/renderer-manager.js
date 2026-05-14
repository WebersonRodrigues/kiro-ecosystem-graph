/**
 * Renderer Manager — Unified interface for 2D/3D graph rendering.
 *
 * Manages the lifecycle of ForceGraph (2D) and ForceGraph3D instances,
 * providing a single API for mode switching, data updates, and settings.
 *
 * Persists render mode via vscode getState/setState.
 * Lazy-loads the 3D library only when first needed.
 */

// eslint-disable-next-line no-unused-vars
var RendererManager = (function () {
  'use strict';

  var currentMode = '2d'; // '2d' or '3d'
  var instance = null;
  var container = null;
  var currentGraphData = null;
  var currentSettings = null;
  var isSwitching = false;
  var is3DLibLoaded = false;
  var onModeChangeCallback = null;

  /**
   * Initialize the renderer with saved mode or default '2d'.
   * @param {HTMLElement} containerEl - DOM element to render into
   * @param {object} graphData - { nodes: [], links: [] }
   * @param {object} settings - Graph physics/visual settings
   * @param {function} [onModeChange] - Callback when mode changes
   * @returns {object} The created graph instance
   */
  function init(containerEl, graphData, settings, onModeChange) {
    container = containerEl;
    currentGraphData = graphData;
    currentSettings = settings;
    onModeChangeCallback = onModeChange || null;

    // Restore persisted mode
    if (typeof vscode !== 'undefined') {
      var state = vscode.getState();
      if (state && state.renderMode && (state.renderMode === '2d' || state.renderMode === '3d')) {
        currentMode = state.renderMode;
      }
    }

    // If 3D requested but lib not loaded, fall back to 2D for now and load async
    if (currentMode === '3d' && !is3DLibLoaded) {
      currentMode = '2d';
      // Attempt to load 3D lib in background, then switch
      load3DLib().then(function (success) {
        if (success) {
          setMode('3d');
        }
      });
    }

    instance = create2DInstance();
    return instance;
  }

  /**
   * Switch between '2d' and '3d' modes.
   * @param {string} mode - '2d' or '3d'
   * @returns {Promise<boolean>} Whether the switch succeeded
   */
  function setMode(mode) {
    if (mode === currentMode) { return Promise.resolve(true); }
    if (isSwitching) { return Promise.resolve(false); }
    if (mode !== '2d' && mode !== '3d') { return Promise.resolve(false); }

    isSwitching = true;

    if (mode === '3d' && !is3DLibLoaded) {
      return load3DLib().then(function (success) {
        if (!success) {
          isSwitching = false;
          return false;
        }
        return performSwitch(mode);
      });
    }

    return Promise.resolve(performSwitch(mode));
  }

  /**
   * Perform the actual mode switch (destroy old, create new).
   */
  function performSwitch(mode) {
    destroy();
    currentMode = mode;
    persistMode();

    if (mode === '3d') {
      instance = create3DInstance();
    } else {
      instance = create2DInstance();
    }

    isSwitching = false;

    if (onModeChangeCallback) {
      onModeChangeCallback(currentMode, instance);
    }

    return true;
  }

  /**
   * Update graph data on the active instance.
   * @param {object} graphData - { nodes: [], links: [] }
   */
  function updateData(graphData) {
    currentGraphData = graphData;
    if (instance) {
      instance.graphData(graphData);
    }
  }

  /**
   * Apply a single setting to the active instance without recreating.
   * @param {string} key - Setting key (e.g., 'centerForce', 'repulsionForce')
   * @param {*} value - Setting value
   */
  function applySetting(key, value) {
    if (!instance) { return; }
    if (!currentSettings) { currentSettings = {}; }
    currentSettings[key] = value;

    switch (key) {
      case 'centerForce':
        instance.d3Force('center', value > 0 ? window.d3.forceCenter() : null);
        if (value > 0 && instance.d3Force('center')) {
          instance.d3Force('center').strength && instance.d3Force('center').strength(value);
        }
        instance.d3ReheatSimulation();
        break;
      case 'repulsionForce':
        if (instance.d3Force('charge')) {
          instance.d3Force('charge').strength(value);
        }
        instance.d3ReheatSimulation();
        break;
      case 'linkForce':
        if (instance.d3Force('link')) {
          instance.d3Force('link').strength(value);
        }
        instance.d3ReheatSimulation();
        break;
      case 'linkDistance':
        if (instance.d3Force('link')) {
          instance.d3Force('link').distance(value);
        }
        instance.d3ReheatSimulation();
        break;
      default:
        // Other settings may require instance method calls
        break;
    }
  }

  /**
   * @returns {boolean} Whether current mode is 3D
   */
  function is3D() {
    return currentMode === '3d';
  }

  /**
   * @returns {string} Current mode ('2d' or '3d')
   */
  function getMode() {
    return currentMode;
  }

  /**
   * @returns {object|null} Current graph instance
   */
  function getInstance() {
    return instance;
  }

  /**
   * Destroy the current instance and free resources.
   */
  function destroy() {
    if (!instance) { return; }

    if (currentMode === '3d') {
      // Dispose Three.js resources
      try {
        var renderer = instance.renderer && instance.renderer();
        if (renderer) {
          renderer.dispose();
        }
        var scene = instance.scene && instance.scene();
        if (scene) {
          scene.traverse(function (obj) {
            if (obj.geometry) { obj.geometry.dispose(); }
            if (obj.material) {
              if (Array.isArray(obj.material)) {
                obj.material.forEach(function (m) { m.dispose(); });
              } else {
                obj.material.dispose();
              }
            }
          });
        }
      } catch (e) {
        // Graceful cleanup failure
      }
    }

    // Remove DOM content
    if (instance._destructor) {
      instance._destructor();
    } else if (container) {
      container.innerHTML = '';
    }

    instance = null;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  function create2DInstance() {
    if (typeof ForceGraph === 'undefined') { return null; }
    var graph = ForceGraph()(container);
    if (currentGraphData) {
      graph.graphData(currentGraphData);
    }
    return graph;
  }

  function create3DInstance() {
    if (typeof ForceGraph3D === 'undefined') { return null; }
    var graph = ForceGraph3D()(container);
    graph.backgroundColor('#0d0d0d');
    if (currentGraphData) {
      graph.graphData(currentGraphData);
    }
    return graph;
  }

  /**
   * Lazy-load the 3d-force-graph script.
   * @returns {Promise<boolean>}
   */
  function load3DLib() {
    if (is3DLibLoaded) { return Promise.resolve(true); }

    return new Promise(function (resolve) {
      // Look for the 3D script URI in a data attribute on the container or body
      var scriptSrc = document.body.getAttribute('data-3d-graph-uri');
      if (!scriptSrc) {
        resolve(false);
        return;
      }

      var script = document.createElement('script');
      var nonce = document.body.getAttribute('data-nonce') || '';
      if (nonce) { script.setAttribute('nonce', nonce); }
      script.src = scriptSrc;
      script.onload = function () {
        is3DLibLoaded = true;
        resolve(true);
      };
      script.onerror = function () {
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  function persistMode() {
    if (typeof vscode !== 'undefined') {
      var state = vscode.getState() || {};
      state.renderMode = currentMode;
      vscode.setState(state);
    }
  }

  return {
    init: init,
    setMode: setMode,
    updateData: updateData,
    applySetting: applySetting,
    is3D: is3D,
    getMode: getMode,
    getInstance: getInstance,
    destroy: destroy
  };
})();
