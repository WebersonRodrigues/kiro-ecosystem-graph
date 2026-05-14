# Implementation Plan: Ecosystem Graph Advanced Intelligence

## Overview

Implements 15 features across 5 pillars (Gap Detection, Alternative Views, Content Intelligence, Advanced Interactions, Visual Enhancements) for the Ecosystem Graph VS Code extension. All rendering uses Canvas 2D. New extension host services are TypeScript, new webview modules are plain JavaScript.

## Tasks

- [x] 1. Foundation — Extend types and create core services
  - [x] 1.1 Extend types.ts with new interfaces and message types
    - Add `mtime`, `lineCount`, `eccentricity` to `GraphNode.metadata`
    - Add `AnnotationEntry`, `AnnotationStore`, `GraphSnapshot` interfaces
    - Extend `ExtensionMessage` union with `snapshotData` type
    - Extend `WebviewMessage` union with `saveAnnotation`, `deleteAnnotation`, `saveSnapshot`, `loadSnapshot`, `exportImage`, `exportImageError` types
    - _Requirements: 2.3, 7.1, 8.1, 10.2, 10.5, 11.1, 11.3, 12.2, 12.5_

  - [x] 1.2 Create AnnotationService (`src/services/annotationService.ts`)
    - Implement `load()`, `save(source, target, text)`, `delete(source, target)`, `getAll()` methods
    - Persist to `.kiro/ecosystem-graph-annotations.json`
    - Create file with empty JSON object if it doesn't exist on first save
    - Key format: `"source->target"`
    - _Requirements: 10.2, 10.5, 10.6_

  - [x] 1.3 Create SnapshotService (`src/services/snapshotService.ts`)
    - Implement `save(graph)`, `list()`, `load(filename)` methods
    - Persist to `.kiro/ecosystem-graph-snapshots/` directory with timestamped filenames
    - Create directory if it doesn't exist on first save
    - _Requirements: 11.1, 11.3, 11.6_

  - [ ]* 1.4 Write unit tests for AnnotationService
    - Test save/load/delete cycle
    - Test file creation on first save
    - _Requirements: 10.2, 10.6_

  - [ ]* 1.5 Write unit tests for SnapshotService
    - Test save/list/load cycle
    - Test directory creation on first save
    - _Requirements: 11.1, 11.6_

- [x] 2. Extension host enrichment — Metadata and eccentricity
  - [x] 2.1 Enrich node metadata with mtime and lineCount in extension.ts
    - In `initializeGraph()`: after stat call, also set `mtime` from `stat.mtime`
    - Read file content and count lines, set `lineCount` in metadata
    - Handle errors gracefully (omit metadata if stat/read fails)
    - Apply same enrichment in `handleFileChange()`
    - _Requirements: 2.1, 2.3, 2.5, 6.4, 7.1, 7.5_

  - [x] 2.2 Compute eccentricity (dependency depth) via BFS in extension.ts
    - After graph is fully built, run BFS from each node to compute max shortest path
    - Set `eccentricity` in node metadata (infinity for unreachable/island nodes)
    - Recompute on every graph change (file created/changed/deleted)
    - _Requirements: 8.1, 8.4, 8.5_

  - [x] 2.3 Instantiate AnnotationService and SnapshotService in extension.ts
    - Create instances in `activate()` alongside existing services
    - Pass to webviewProvider or handle messages in extension.ts
    - _Requirements: 10.5, 11.1_

  - [x] 2.4 Handle new message types in extension.ts / webviewProvider.ts
    - `saveAnnotation`: call `annotationService.save(source, target, text)`
    - `deleteAnnotation`: call `annotationService.delete(source, target)`
    - `saveSnapshot`: call `snapshotService.save(graph)`, send updated list
    - `loadSnapshot`: call `snapshotService.load(filename)`, send `snapshotData` message
    - `exportImage`: decode base64 data URL, save as PNG to workspace root with timestamp
    - `exportImageError`: show warning notification
    - _Requirements: 10.2, 11.1, 11.3, 12.3, 12.4, 12.5_

  - [x] 2.5 Include annotations and snapshot list in updateGraph message
    - Load annotations on startup via `annotationService.load()`
    - Include `annotations` array and `snapshotList` in the `updateGraph` postMessage payload
    - _Requirements: 10.5, 11.3_

- [ ] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [-] 4. Gap Detection — gap-detector.js
  - [x] 4.1 Create `src/webview/media/gap-detector.js` with suggested connections
    - Implement `computeSuggestedConnections(graphData)` returning `SuggestedEdge[]`
    - Tokenize node labels by splitting on `-`, `_`, `.`, camelCase boundaries
    - Compute Jaccard similarity of token sets for unconnected pairs
    - Return pairs with similarity >= 0.5 and at least 2 shared tokens
    - _Requirements: 1.1, 1.3_

  - [x] 4.2 Add dead zones detection to gap-detector.js
    - Implement `computeDeadZones(graphData, currentTime)` returning `DeadZoneNode[]`
    - Flag nodes with mtime older than 30 days (daysSinceEdit >= 30)
    - _Requirements: 2.2, 2.4_

  - [x] 4.3 Add coverage map computation to gap-detector.js
    - Implement `computeCoverageMap(graphData, workspaceFolders)` returning `CoverageEntry[]`
    - Count steering files per workspace folder
    - Assign levels: high (5+), medium (2-4), low (1), none (0)
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 4.4 Add redundancy detector to gap-detector.js
    - Implement `computeRedundancyPairs(graphData)` returning `RedundancyPair[]`
    - For each node, collect outgoing target IDs
    - Flag pairs sharing 3+ common outgoing targets
    - _Requirements: 9.1, 9.5_

  - [ ]* 4.5 Write property test for suggested connections
    - **Property 1: Suggested connections only exist between unconnected nodes**
    - **Validates: Requirements 1.1**

  - [ ]* 4.6 Write property test for redundancy detector
    - **Property 2: Redundancy pairs always share >= 3 common targets**
    - **Validates: Requirements 9.1**

- [ ] 5. Alternative Views — alternative-views.js
  - [x] 5.1 Create `src/webview/media/alternative-views.js` with timeline view
    - Implement `enterTimelineView(graphData, container)` and `exitTimelineView()`
    - Hide force-graph canvas, create DOM-based timeline layout
    - X-axis: birthtime mapped proportionally to container width
    - Y-axis: grouped by type (swim lanes)
    - Render edges as curved arcs (quadratic bezier)
    - Render date axis with monthly/weekly labels
    - Handle nodes without birthtime (leftmost position, "unknown date" indicator)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 Add hierarchy view to alternative-views.js
    - Implement `enterHierarchyView(graphData, degreeMap, container)` and `exitHierarchyView()`
    - Hide force-graph canvas, create DOM-based tree layout
    - Level 0: nodes with highest degree (top 10% or max degree)
    - Level N+1: nodes referenced by level N not already placed
    - Horizontal distribution within each level
    - Edges as straight diagonal lines
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6. Content Intelligence — visual-modes.js (part 1)
  - [x] 6.1 Create `src/webview/media/visual-modes.js` with activity heatmap
    - Implement `enableActivityHeatmap()` / `disableActivityHeatmap()`
    - Export `activityHeatmapActive` flag
    - Color interpolation: 0 days → `#FF4444` (hot), 30+ days → `#4444FF` (cold)
    - Linear interpolation in HSL space
    - Pulse animation intensity for nodes edited within 7 days
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 6.2 Add complexity score display logic to visual-modes.js
    - Export helper `getComplexityRadius(lineCount, baseSize)` for node scaling
    - Export helper `shouldShowComplexityWarning(lineCount)` (threshold: 500 lines)
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 6.3 Add dependency depth display logic to visual-modes.js
    - Export helper `getDependencyBadge(eccentricity)` returning badge text and color
    - Numeric badge on each node; orange highlight for eccentricity >= 4
    - Infinity symbol for unreachable nodes
    - _Requirements: 8.2, 8.3, 8.4_

- [ ] 7. Advanced Interactions — Annotation mode and export-panel.js
  - [x] 7.1 Create `src/webview/media/export-panel.js` with export as image
    - Implement `triggerExport(canvas, vscode)`: capture via `canvas.toDataURL('image/png')`, send to extension
    - Handle capture failure: send `exportImageError` message
    - _Requirements: 12.1, 12.2, 12.5_

  - [x] 7.2 Add snapshot save/compare to export-panel.js
    - Implement `triggerSnapshotSave(vscode)`: send `saveSnapshot` message
    - Implement `enterSnapshotCompare(currentData, snapshotData)` / `exitSnapshotCompare()`
    - Compute diff: newNodes, removedNodes, newEdges, removedEdges
    - Export `snapshotCompareActive` and `snapshotDiff` state
    - Implement snapshot selection UI: create a dropdown/list populated from `snapshotList` (received in updateGraph message) allowing user to pick which snapshot to compare against
    - On selection: send `loadSnapshot` message with chosen filename, receive `snapshotData` response, then call `enterSnapshotCompare`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ] 7.3 Add annotation mode state and input handling to webview.js
    - Add `annotationModeActive` toggle state
    - On edge click (when annotation mode active): show input field at edge midpoint
    - On submit: send `saveAnnotation` message to extension
    - On click annotated edge: pre-fill input with existing text
    - _Requirements: 10.1, 10.3, 10.4_

- [ ] 8. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Visual Enhancements — visual-modes.js (part 2)
  - [x] 9.1 Add depth of field mode to visual-modes.js
    - Implement `enableDepthOfField()` / `disableDepthOfField()`
    - Export `depthOfFieldActive` flag
    - Calculate node distance from (0,0) in graph coordinates
    - Linear falloff: center = full sharpness (opacity 1.0), max distance = reduced (opacity 0.5, shadowBlur halved)
    - Threshold at 50% of max distance
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 9.2 Add constellation mode to visual-modes.js
    - Implement `enableConstellationMode(graphData)` / `disableConstellationMode()`
    - Export `constellationModeActive` and `constellationEdges` array
    - Group nodes by type, compute MST per group using Kruskal's with union-find
    - Store MST edges with type color for background rendering
    - Lines: opacity 0.06, width 0.3px, type color from COLOR_MAP
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 9.3 Add synaptic strength mode to visual-modes.js
    - Implement `enableSynapticStrength()` / `disableSynapticStrength()`
    - Export `synapticStrengthActive` flag
    - Edge brightness based on source node mtime
    - Within 7 days: opacity 0.7, width 1.5px
    - 30+ days: opacity 0.05, width 0.3px
    - Linear interpolation between 7-day and 30-day thresholds
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [-] 10. Integration — Wire everything together
  - [x] 10.1 Update webviewProvider.ts HTML to include new script tags
    - Add script URIs for: gap-detector.js, alternative-views.js, visual-modes.js, export-panel.js
    - Add them to the HTML template before the closing `</body>` tag
    - Add to `localResourceRoots` if needed
    - _Requirements: all (scripts must be loaded for features to work)_

  - [x] 10.2 Update esbuild.config.js to copy new webview files
    - Add `gap-detector.js`, `alternative-views.js`, `visual-modes.js`, `export-panel.js` to `filesToCopy` array
    - _Requirements: all (build must include new files)_

  - [x] 10.3 Integrate gap-detector results into webview.js rendering
    - On `updateGraph` message: call gap-detector functions, store results
    - Render suggested connections as dashed lines with "?" at midpoint (use `ctx.setLineDash([4, 4])` in linkCanvasObject or a separate render pass in onRenderFramePre)
    - Render dead zone nodes with opacity 0.3 and "stale" text below label in nodeCanvasObject
    - Render coverage map as a DOM overlay panel (similar to health-panel): fixed position, lists each workspace folder with color-coded dot (green/yellow/red) and file count
    - Render redundancy pairs as dotted yellow edges (use `ctx.setLineDash([2, 3])` with yellow stroke)
    - Add toggles for suggested connections, dead zones, and redundancy detection
    - Show tooltip on hover for suggested connections (shared terms) and redundancy (shared targets)
    - _Requirements: 1.2, 1.4, 1.5, 2.2, 2.4, 3.2, 3.4, 3.5, 9.2, 9.3, 9.4_

  - [x] 10.4 Integrate visual-modes into webview.js nodeCanvasObject
    - If `activityHeatmapActive`: override node color with heatmap color based on mtime
    - If `depthOfFieldActive`: adjust opacity and shadowBlur based on distance from center
    - Render complexity warning (orange triangle) for nodes with lineCount >= 500
    - Render dependency depth badge on each node
    - Scale node radius proportionally to lineCount
    - Modify `showTooltip`: when node has lineCount >= 500, append "Consider splitting (N lines)" to tooltip text
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 7.2, 7.3, 7.4, 8.2, 8.3, 8.4, 13.2, 13.3_

  - [x] 10.5 Integrate visual-modes into webview.js linkCanvasObject
    - If `synapticStrengthActive`: vary edge opacity and width based on source mtime
    - Render annotation text at edge midpoint for annotated edges
    - _Requirements: 10.3, 15.1, 15.2, 15.3, 15.4_

  - [x] 10.6 Integrate constellation mode into webview.js onRenderFramePre
    - If `constellationModeActive`: render constellation MST edges as background layer
    - Use type color, opacity 0.06, width 0.3px
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 10.7 Integrate snapshot compare rendering into webview.js
    - If `snapshotCompareActive`: render new nodes with green glow, removed nodes as red ghost outlines
    - Render new edges in green, removed edges in red dashed style
    - _Requirements: 11.2, 11.4, 11.5_

  - [x] 10.8 Add UI toggles and toolbar buttons for all new modes
    - Add toggle buttons/controls for: suggested connections, dead zones, coverage map, redundancy, timeline view, hierarchy view, activity heatmap, depth of field, constellation mode, synaptic strength, annotation mode
    - Add action buttons for: export as image, save snapshot, compare snapshot
    - Wire toggle state to enable/disable functions in respective modules
    - _Requirements: 1.5, 4.5, 5.5, 6.5, 9.4, 13.5, 14.5, 15.5_

- [ ] 11. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all 15 requirements have corresponding implementations
  - Verify build completes successfully with `node esbuild.config.js`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- TypeScript for extension host services (annotationService, snapshotService, extension.ts, types.ts, webviewProvider.ts)
- Plain JavaScript for webview modules (gap-detector.js, alternative-views.js, visual-modes.js, export-panel.js)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
