# Implementation Plan: Ecosystem Graph Visual Upgrade

## Overview

Upgrade visual do Ecosystem Graph de grafo funcional basico para estetica de rede neural — cerebro digital vivo com nodes como sinapses brilhantes, edges como impulsos eletricos, e ambiente neural com profundidade. Mudancas concentradas em webview.js (rendering), webviewProvider.ts (script tag), e testes property-based com fast-check.

## Tasks

- [x] 1. Foundation — Background neural e simulacao continua
  - [x] 1.1 Update visual constants and simulation parameters in webview.js
    - Replace background color from #1e1e1e to #0d0d0d
    - Update NODE_BASE_SIZE to 4, NODE_SCALE_FACTOR to 1.5, LABEL_ZOOM_THRESHOLD to 1.5
    - Update settings defaults: centerForce=0.05, repulsionForce=-150, linkDistance=60, linkWidth=0.5
    - Update force-graph config: cooldownTime=Infinity, d3AlphaDecay=0.005, warmupTicks=100, d3VelocityDecay=0.4
    - Add new visual constants: GLOW_MIN_BLUR=8, GLOW_MAX_BLUR=20, EDGE_DEFAULT_OPACITY=0.12, EDGE_HOVER_OPACITY=0.7, EDGE_DEFAULT_WIDTH=0.5, EDGE_HOVER_WIDTH=1.5, PARTICLE_SPEED=0.008, PARTICLE_SIZE=1.5, PARTICLE_COUNT_BASE=1, PARTICLE_COUNT_MAX=3, AMBIENT_PARTICLE_COUNT=45
    - _Requirements: 2.1, 2.6, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1_

  - [x] 1.2 Implement ambient particles system in webview.js
    - Create initAmbientParticles(width, height) function generating 30-60 particles with random position, size (0.5-1.5px), opacity (0.1-0.3), and drift velocity
    - Create updateAmbientParticles(width, height) function for per-frame position updates with wrapping
    - Create renderAmbientParticles(ctx, width, height) function drawing particles as small dots
    - Initialize particles on graph creation and reinitialize on resize
    - _Requirements: 2.3, 2.4_

  - [x] 1.3 Implement radial gradient background rendering
    - Use force-graph's onRenderFramePre callback to render radial gradient (center color rgba(26,58,92,0.15) fading to transparent)
    - Render ambient particles in the same pre-render callback after gradient
    - Update ambient particle positions each frame
    - _Requirements: 2.2, 2.3_

- [x] 2. Node rendering — Glow/bloom e sizing correto
  - [x] 2.1 Rewrite nodeCanvasObject for glow effect and correct sizing
    - Apply shadowBlur proportional to node degree (min 8px, max 20px)
    - Set shadowColor to the node's COLOR_MAP color
    - Render node circle on top of glow for bright center with soft radial falloff
    - Use updated getNodeSize formula: (NODE_BASE_SIZE + degree * NODE_SCALE_FACTOR) * nodeSizeMultiplier
    - Reduce glow intensity proportionally when node is dimmed (not highlighted)
    - Update label rendering to use LABEL_ZOOM_THRESHOLD of 1.5
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.3, 4.4, 4.5, 7.1, 7.2_

  - [ ]* 2.2 Write property test for node size formula (Property 1)
    - **Property 1: Node size formula correctness**
    - For any degree (0-50) and nodeSizeMultiplier (0.5-3.0), size = (4 + degree * 1.5) * multiplier, always positive, monotonically increasing
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [ ]* 2.3 Write property test for glow blur bounds (Property 2)
    - **Property 2: Glow blur bounded by node size**
    - For any degree (0-50), shadowBlur between 8 and 20 inclusive, scaling proportionally
    - **Validates: Requirements 3.2**

  - [ ]* 2.4 Write property test for glow color matches type (Property 3)
    - **Property 3: Glow color matches node type color**
    - For any valid NodeType, shadowColor equals COLOR_MAP[type]
    - **Validates: Requirements 3.3**

  - [ ]* 2.5 Write property test for label visibility logic (Property 4)
    - **Property 4: Label visibility logic**
    - For any zoom (0.3-8.0) and labelMode ('on','off','auto'), shouldShowLabel returns correct boolean
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [ ] 3. Checkpoint — Verify background and node rendering
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Edge rendering — Colored edges, weight, and impulse particles
  - [x] 4.1 Implement edge weight computation (computeEdgeWeights)
    - Create computeEdgeWeights(links) function that collapses duplicate source→target pairs into single edges with weight property
    - Integrate into handleUpdateGraph before passing data to force-graph
    - _Requirements: 8.7_

  - [x] 4.2 Implement colored edges with source node color
    - Update linkColor to use COLOR_MAP color of source node at EDGE_DEFAULT_OPACITY (0.12), brightening to EDGE_HOVER_OPACITY (0.7) on hover
    - Update linkWidth to use EDGE_DEFAULT_WIDTH (0.5) scaled by weight, increasing to EDGE_HOVER_WIDTH (1.5) on hover
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 9.4_

  - [x] 4.3 Implement directional impulse particles on edges
    - Configure force-graph linkDirectionalParticles to return min(weight, 3) per edge
    - Set linkDirectionalParticleSpeed to 0.008
    - Set linkDirectionalParticleWidth to 1.5
    - Set linkDirectionalParticleColor to source node's COLOR_MAP color
    - _Requirements: 8.4, 8.5, 8.6, 9.3_

  - [ ]* 4.4 Write property test for edge color from source (Property 5)
    - **Property 5: Edge color derived from source node type**
    - For any edge, computed color equals COLOR_MAP[sourceNode.type]
    - **Validates: Requirements 8.5, 9.1, 9.3**

  - [ ]* 4.5 Write property test for edge weight computation (Property 6)
    - **Property 6: Edge weight computation collapses duplicates**
    - For any set of edges, output has unique source→target pairs with weight = count of originals, total weight = input count
    - **Validates: Requirements 8.7**

  - [ ]* 4.6 Write property test for particle count bounds (Property 7)
    - **Property 7: Particle count bounded by edge weight**
    - For any edge with weight W, particles = min(W, 3), at least 1 and at most 3
    - **Validates: Requirements 8.6**

- [ ] 5. Checkpoint — Verify edge rendering and particles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Stats overlay and settings panel fix
  - [x] 6.1 Implement ecosystem stats overlay in webview.js
    - Add stats DOM element (bottom-left, compact format: "N nodes · M edges · K types")
    - Create updateStats(nodes, edges) function called from handleUpdateGraph
    - Style with same dark theme as legend (semi-transparent background)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 6.2 Fix settings panel loading in webviewProvider.ts
    - Add the settings-panel.js script tag to the HTML output (before closing body tag, with nonce)
    - Ensure the settingsPanelUri variable (already declared) is used in the HTML
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 6.3 Write property test for stats computation (Property 11)
    - **Property 11: Stats computation correctness**
    - For any graph with N nodes, M edges, K types, stats produces exact counts and formatted string contains all three
    - **Validates: Requirements 11.1, 11.3**

  - [ ]* 6.4 Write property test for settings update (Property 12)
    - **Property 12: Settings update applies value to settings object**
    - For any valid key and value, updateSetting(key, value) results in settings[key] === value
    - **Validates: Requirements 1.5**

- [ ] 7. Ambient particles property test and classifier verification
  - [ ]* 7.1 Write property test for ambient particle initialization (Property 8)
    - **Property 8: Ambient particle initialization within bounds**
    - For any canvas dimensions, produces 30-60 particles with position in bounds, size 0.5-1.5, opacity 0.1-0.3, non-zero velocity
    - **Validates: Requirements 2.3, 2.4**

  - [ ]* 7.2 Write property test for node classifier (Property 9)
    - **Property 9: Node classifier prefix-based classification**
    - For any filename with known prefix, classify returns correct type; for code folder non-.md files returns 'code-file'; for no-match returns 'unknown'
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8**

  - [ ]* 7.3 Write property test for color map injectivity (Property 10)
    - **Property 10: Color map injectivity**
    - For any two distinct NodeTypes, their colors are different
    - **Validates: Requirements 12.9**

- [x] 8. Click-to-open verification and HTML body background
  - [x] 8.1 Update HTML body background color to #0d0d0d in webviewProvider.ts
    - Change the CSS body background from #1e1e1e to #0d0d0d
    - Add stats overlay HTML element to the body
    - Add CSS for stats overlay (position fixed, bottom-left, semi-transparent dark background)
    - _Requirements: 2.1, 2.6, 11.4_

  - [x] 8.2 Verify click-to-open functionality remains intact
    - Confirm onNodeClick handler still posts openFile message with node.filePath
    - Confirm handleOpenFile in webviewProvider.ts resolves paths across workspace folders
    - No code changes expected — verification only, fix if broken
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design uses JavaScript (webview.js) and TypeScript (webviewProvider.ts, nodeClassifier.ts, tests) — matching the existing codebase
- Property tests use fast-check (already in devDependencies)
- Test runner: mocha with ts-node (configured in package.json scripts)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major visual changes
- The extension already works — these are visual upgrades, not a rebuild
