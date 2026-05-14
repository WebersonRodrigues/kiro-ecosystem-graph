/**
 * Ecosystem Graph — Settings Panel
 *
 * Builds and manages the settings panel UI with real-time controls.
 * Relies on global `updateSetting()`, `restartSimulation()`, and `settings`
 * defined in webview.js.
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // Settings Panel Construction
  // ─────────────────────────────────────────────────────────────────────────

  var panel = document.getElementById('settings-panel');
  if (!panel) { return; }

  // Build panel inner HTML
  panel.innerHTML = buildPanelHTML();

  // ─────────────────────────────────────────────────────────────────────────
  // Toggle Button (top-right gear icon)
  // ─────────────────────────────────────────────────────────────────────────

  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'settings-toggle-btn';
  toggleBtn.textContent = '\u2699';
  toggleBtn.title = 'Toggle Settings';
  toggleBtn.setAttribute('aria-label', 'Toggle Settings Panel');

  // Style the toggle button
  toggleBtn.style.cssText = [
    'position: fixed',
    'top: 8px',
    'right: 8px',
    'z-index: 200',
    'background: rgba(26, 26, 26, 0.9)',
    'border: 1px solid #333',
    'border-radius: 4px',
    'color: #ccc',
    'font-size: 18px',
    'width: 30px',
    'height: 30px',
    'cursor: pointer',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'padding: 0',
    'line-height: 1',
  ].join('; ');

  document.body.appendChild(toggleBtn);

  toggleBtn.addEventListener('click', function () {
    panel.classList.toggle('visible');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Wire Controls
  // ─────────────────────────────────────────────────────────────────────────

  wireSlider('slider-centerForce', 'centerForce', parseFloat);
  wireSlider('slider-repulsionForce', 'repulsionForce', parseFloat);
  wireSlider('slider-linkForce', 'linkForce', parseFloat);
  wireSlider('slider-linkDistance', 'linkDistance', parseFloat);
  wireSlider('slider-nodeSizeMultiplier', 'nodeSizeMultiplier', parseFloat);
  wireSlider('slider-linkWidth', 'linkWidth', parseFloat);

  wireCheckbox('toggle-showArrows', 'showArrows');
  wireCheckbox('toggle-showOnlyExisting', 'showOnlyExisting');
  wireCheckbox('toggle-showOrphans', 'showOrphans');

  wireRadioGroup('labelMode', 'labelMode');

  // Animate button
  var animateBtn = document.getElementById('btn-animate');
  if (animateBtn) {
    animateBtn.addEventListener('click', function () {
      if (typeof restartSimulation === 'function') {
        restartSimulation();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Initialize from saved settings
  // ─────────────────────────────────────────────────────────────────────────

  initializeValues();

  // ─────────────────────────────────────────────────────────────────────────
  // Helper Functions
  // ─────────────────────────────────────────────────────────────────────────

  function buildPanelHTML() {
    return [
      '<div class="panel-title">Settings</div>',

      // Forces section
      '<div class="settings-section">',
      '<div class="section-header">Forces</div>',
      buildSliderRow('Center', 'slider-centerForce', 0, 0.2, 0.01, 0.05),
      buildSliderRow('Repulsion', 'slider-repulsionForce', -300, 0, 10, -150),
      buildSliderRow('Link strength', 'slider-linkForce', 0, 1, 0.05, 0.3),
      buildSliderRow('Link distance', 'slider-linkDistance', 20, 200, 5, 70),
      '</div>',

      // Display section
      '<div class="settings-section">',
      '<div class="section-header">Display</div>',
      buildSliderRow('Node size', 'slider-nodeSizeMultiplier', 0.5, 3, 0.1, 1),
      buildSliderRow('Link width', 'slider-linkWidth', 0.1, 3, 0.1, 0.5),
      buildCheckboxRow('Show arrows', 'toggle-showArrows', false),
      buildLabelModeRow(),
      '</div>',

      // Filters section
      '<div class="settings-section">',
      '<div class="section-header">Filters</div>',
      buildCheckboxRow('Only existing files', 'toggle-showOnlyExisting', false),
      buildCheckboxRow('Show orphan nodes', 'toggle-showOrphans', true),
      '</div>',

      // Animate button
      '<div class="settings-section">',
      '<button id="btn-animate" class="settings-btn">Animate</button>',
      '</div>',
    ].join('');
  }

  function buildSliderRow(label, id, min, max, step, defaultVal) {
    return [
      '<div class="setting-row">',
      '<label class="setting-label" for="' + id + '">' + label + '</label>',
      '<div class="setting-control">',
      '<input type="range" id="' + id + '"',
      ' min="' + min + '" max="' + max + '" step="' + step + '"',
      ' value="' + defaultVal + '" class="settings-slider" />',
      '<span class="setting-value" id="' + id + '-value">' + defaultVal + '</span>',
      '</div>',
      '</div>',
    ].join('');
  }

  function buildCheckboxRow(label, id, defaultChecked) {
    var checked = defaultChecked ? ' checked' : '';
    return [
      '<div class="setting-row setting-row-toggle">',
      '<label class="setting-label" for="' + id + '">' + label + '</label>',
      '<input type="checkbox" id="' + id + '"' + checked + ' class="settings-checkbox" />',
      '</div>',
    ].join('');
  }

  function buildLabelModeRow() {
    return [
      '<div class="setting-row setting-row-radio">',
      '<span class="setting-label">Labels</span>',
      '<div class="radio-group">',
      '<label class="radio-option"><input type="radio" name="labelMode" value="on" /> On</label>',
      '<label class="radio-option"><input type="radio" name="labelMode" value="off" /> Off</label>',
      '<label class="radio-option"><input type="radio" name="labelMode" value="auto" checked /> Auto</label>',
      '</div>',
      '</div>',
    ].join('');
  }

  function wireSlider(id, settingKey, parser) {
    var slider = document.getElementById(id);
    var valueDisplay = document.getElementById(id + '-value');
    if (!slider) { return; }

    slider.addEventListener('input', function () {
      var val = parser(slider.value);
      if (valueDisplay) { valueDisplay.textContent = val; }
      if (typeof updateSetting === 'function') {
        updateSetting(settingKey, val);
      }
    });
  }

  function wireCheckbox(id, settingKey) {
    var checkbox = document.getElementById(id);
    if (!checkbox) { return; }

    checkbox.addEventListener('change', function () {
      if (typeof updateSetting === 'function') {
        updateSetting(settingKey, checkbox.checked);
      }
    });
  }

  function wireRadioGroup(name, settingKey) {
    var radios = document.querySelectorAll('input[name="' + name + '"]');
    radios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        if (radio.checked && typeof updateSetting === 'function') {
          updateSetting(settingKey, radio.value);
        }
      });
    });
  }

  function initializeValues() {
    // Read from global settings object (defined in webview.js)
    if (typeof settings === 'undefined') { return; }

    setSliderValue('slider-centerForce', settings.centerForce);
    setSliderValue('slider-repulsionForce', settings.repulsionForce);
    setSliderValue('slider-linkForce', settings.linkForce);
    setSliderValue('slider-linkDistance', settings.linkDistance);
    setSliderValue('slider-nodeSizeMultiplier', settings.nodeSizeMultiplier);
    setSliderValue('slider-linkWidth', settings.linkWidth);

    setCheckboxValue('toggle-showArrows', settings.showArrows);
    setCheckboxValue('toggle-showOnlyExisting', settings.showOnlyExisting);
    setCheckboxValue('toggle-showOrphans', settings.showOrphans);

    setRadioValue('labelMode', settings.labelMode);
  }

  function setSliderValue(id, value) {
    var slider = document.getElementById(id);
    var valueDisplay = document.getElementById(id + '-value');
    if (slider) {
      slider.value = value;
      if (valueDisplay) { valueDisplay.textContent = value; }
    }
  }

  function setCheckboxValue(id, value) {
    var checkbox = document.getElementById(id);
    if (checkbox) { checkbox.checked = !!value; }
  }

  function setRadioValue(name, value) {
    var radios = document.querySelectorAll('input[name="' + name + '"]');
    radios.forEach(function (radio) {
      radio.checked = (radio.value === value);
    });
  }

})();
