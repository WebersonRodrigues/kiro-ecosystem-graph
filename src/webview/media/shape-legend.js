/**
 * Shape Legend — Node Shape Indicator
 *
 * Renders inline SVG shapes showing the mapping between node types and shapes:
 * - Circle: steerings
 * - Diamond: skills
 * - Triangle: hooks
 *
 * Positioned bottom-left, above the stats overlay and Export/Snapshot buttons.
 * Only shows shapes for types that exist in the current graph data.
 * Compact (max 120px wide) to not obstruct the graph.
 *
 * Relies on global COLOR_MAP from webview.js.
 */

// eslint-disable-next-line no-unused-vars
var ShapeLegend = (function () {
  'use strict';

  // Create legend container
  var container = document.createElement('div');
  container.id = 'shape-legend';
  container.style.position = 'fixed';
  container.style.bottom = '44px';
  container.style.left = '12px';
  container.style.zIndex = '100';
  container.style.background = 'rgba(26,26,26,0.9)';
  container.style.border = '1px solid #333';
  container.style.borderRadius = '4px';
  container.style.padding = '4px 6px';
  container.style.fontSize = '9px';
  container.style.color = '#aaa';
  container.style.fontFamily = 'sans-serif';
  container.style.maxWidth = '120px';
  container.style.pointerEvents = 'none';
  container.style.display = 'none';
  document.body.appendChild(container);

  /**
   * Build SVG circle shape.
   * @param {string} color
   * @returns {string} SVG markup
   */
  function svgCircle(color) {
    return '<svg width="10" height="10" style="vertical-align:middle;margin-right:3px;"><circle cx="5" cy="5" r="4" fill="' + color + '"/></svg>';
  }

  /**
   * Build SVG diamond shape (rotated square).
   * @param {string} color
   * @returns {string} SVG markup
   */
  function svgDiamond(color) {
    return '<svg width="10" height="10" style="vertical-align:middle;margin-right:3px;"><rect x="2" y="2" width="6" height="6" fill="' + color + '" transform="rotate(45 5 5)"/></svg>';
  }

  /**
   * Build SVG triangle shape.
   * @param {string} color
   * @returns {string} SVG markup
   */
  function svgTriangle(color) {
    return '<svg width="10" height="10" style="vertical-align:middle;margin-right:3px;"><polygon points="5,1 1,9 9,9" fill="' + color + '"/></svg>';
  }

  /**
   * Rebuild the shape legend based on current graph data.
   * @param {{ nodes: any[], links: any[] }} data
   */
  function rebuild(data) {
    if (!data || !data.nodes || data.nodes.length === 0) {
      container.style.display = 'none';
      return;
    }

    var hasSteering = false;
    var hasSkill = false;
    var hasHook = false;
    var steeringColor = '#4A9EFF';
    var skillColor = '#B388FF';
    var hookColor = '#64B5F6';

    data.nodes.forEach(function(n) {
      if (n.type && n.type.indexOf('steering-') === 0) { hasSteering = true; }
      if (n.type === 'skill') { hasSkill = true; }
      if (n.type === 'hook-manual' || n.type === 'hook-auto') { hasHook = true; }
    });

    // Use COLOR_MAP values if available
    if (typeof COLOR_MAP !== 'undefined') {
      steeringColor = COLOR_MAP['steering-flow'] || steeringColor;
      skillColor = COLOR_MAP['skill'] || skillColor;
      hookColor = COLOR_MAP['hook-manual'] || hookColor;
    }

    if (!hasSteering && !hasSkill && !hasHook) {
      container.style.display = 'none';
      return;
    }

    var html = '';
    if (hasSteering) {
      html += '<div style="margin-bottom:2px;">' + svgCircle(steeringColor) + '<span>Steerings</span></div>';
    }
    if (hasSkill) {
      html += '<div style="margin-bottom:2px;">' + svgDiamond(skillColor) + '<span>Skills</span></div>';
    }
    if (hasHook) {
      html += '<div>' + svgTriangle(hookColor) + '<span>Hooks</span></div>';
    }

    container.innerHTML = html;
    container.style.display = 'block';
  }

  return {
    rebuild: rebuild
  };
})();

/**
 * Update the shape legend with current graph data.
 * Called from webview.js after graph data refresh.
 * @param {{ nodes: any[], links: any[] }} data
 */
// eslint-disable-next-line no-unused-vars
function updateShapeLegend(data) {
  if (typeof ShapeLegend !== 'undefined') {
    ShapeLegend.rebuild(data);
  }
}
