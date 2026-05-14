# Implementation Plan: Ecosystem Graph Brain Insights

## Overview

Upgrade the Kiro Ecosystem Graph extension with four pillars: visual brain effects, insights panels, advanced interactions, and temporal evolution. Implementation uses TypeScript in the extension host and plain JavaScript in the webview, building on the existing force-graph Canvas 2D architecture.

## Tasks

- [x] 1. Foundation: Types, Stats History Service, and Birthtime Metadata
  - [x] 1.1 Extend types.ts with new interfaces and message types
    - Add `birthtime?: number` to `GraphNodeMetadata`
    - Add `DailySnapshot` interface (`date: string, nodeCount: number, edgeCount: number`)
    - Add `StatsHistory` interface (`snapshots: DailySnapshot[]`)
    - Extend `ExtensionMessage` union with optional `statsHistory?: DailySnapshot[]` on `updateGraph`
    - _Requirements: 12.1, 13.6_

  - [x] 1.2 Create src/services/statsHistoryService.ts
    - Implement `StatsHistoryService` class with constructor taking `workspaceRoot: vscode.Uri`
    - Implement `load()`: read `.kiro/ecosystem-graph-stats.json`, handle missing/corrupted file gracefully
    - Implement `recordSnapshot(nodeCount, edgeCount)`: upsert today's entry, prune entries older than 30 days
    - Implement `getRecentSnapshots()`: return last 7 days of data
    - Create `.kiro/` directory if it doesn't exist before writing
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 1.3 Write property tests for StatsHistoryService
    - **Property 21: Stats history serialization round-trip**
    - **Property 22: Same-day snapshot is idempotent**
    - **Property 23: Stats history never exceeds 30 entries**
    - **Property 24: Growth indicator calculation**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.5**

  - [x] 1.4 Update extension.ts to integrate StatsHistoryService and birthtimes
    - Instantiate `StatsHistoryService` with workspace root URI
    - After `initializeGraph`: call `recordSnapshot` with node/edge counts
    - After `handleFileChange`: call `recordSnapshot` with updated counts
    - During file parsing: use `vscode.workspace.fs.stat()` to get `birthtime` (ctime) and attach to `node.metadata.birthtime`
    - Pass `statsHistory` (recent snapshots) in the `updateGraph` message payload
    - _Requirements: 12.1, 12.2, 12.8, 13.2, 13.6_

- [ ] 2. Checkpoint - Ensure foundation compiles and stats persistence works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Visual Effects: Density Particles, Heartbeat, Gradient Edges, Neural Impulse Ray
  - [x] 3.1 Implement center-dense particle distribution in webview.js
    - Modify `initAmbientParticles` to use radial probability: particles within 30% of canvas radius from center get 3x spawn probability
    - Use rejection sampling or weighted random to achieve the distribution
    - Existing drift behavior and screen wrapping remain unchanged
    - On resize, `initAmbientParticles` already reinitializes (existing behavior preserved)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 3.2 Write property test for particle density distribution
    - **Property 1: Particle density follows radial distribution**
    - **Validates: Requirements 1.2**

  - [x] 3.3 Implement heartbeat pulse on nodes in webview.js
    - Add a time variable incremented in `onRenderFramePre` (use `Date.now()` or frame counter)
    - In `nodeCanvasObject`: compute heartbeat opacity using `0.9 + 0.05 * Math.sin(2 * PI * t / period + phaseOffset)` where period is ~2500ms and phaseOffset is based on node index
    - Apply heartbeat opacity only when node is highlighted (not dimmed); dimmed nodes stay at 0.2
    - Heartbeat affects only `globalAlpha`, NOT `shadowBlur`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.4 Write property tests for heartbeat
    - **Property 2: Heartbeat opacity stays within bounds [0.85, 0.95]**
    - **Property 3: Heartbeat is periodic**
    - **Property 4: Heartbeat phase offset produces distinct values**
    - **Property 5: Dimmed nodes ignore heartbeat**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x] 3.5 Implement gradient edge rendering in webview.js
    - Add `.linkCanvasObject` callback to the force-graph instance
    - For each edge: create `ctx.createLinearGradient(source.x, source.y, target.x, target.y)`
    - Set gradient stops using `COLOR_MAP[sourceType]` and `COLOR_MAP[targetType]` with appropriate opacity
    - Respect hover state: opacity 0.12 default, 0.7 when highlighted
    - If source and target have same type, render single color (optimization)
    - Preserve existing impulse particle color (source node color)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.6 Write property tests for gradient edges
    - **Property 6: Gradient edge colors match source and target types**
    - **Property 7: Edge opacity respects hover state**
    - **Validates: Requirements 3.1, 3.3**

  - [x] 3.7 Implement neural impulse ray propagation on hover in webview.js
    - On `onNodeHover`: highlight hovered node immediately (existing behavior)
    - After 150ms: highlight 1-hop neighbors (add to `highlightedNodes` with full opacity)
    - After 300ms: highlight 2-hop neighbors (add with reduced intensity flag)
    - Add a brief flash animation (opacity spike) on newly highlighted nodes
    - On hover away: clear all propagation highlights immediately (existing `updateHighlights(null)`)
    - Limit propagation to 2 hops maximum
    - Edges connecting propagated nodes also brighten with same delay timing
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 3.8 Write property test for impulse propagation bounds
    - **Property 8: Impulse propagation bounded to 2 hops**
    - **Validates: Requirements 4.6**

- [ ] 4. Checkpoint - Ensure visual effects render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Insights: Health Panel, Island Detection, Cognitive Weight, Enriched Tooltip
  - [x] 5.1 Create src/webview/media/health-panel.js
    - Create DOM overlay panel (top-right, below settings gear) with dark semi-transparent background
    - Implement `updateHealthPanel(graphData, degreeMap)`:
      - Compute orphan count (nodes with degree 0)
      - Find hub node (highest degree); show "No connections yet" if all have 0
      - Find least documented type (NodeType with fewest nodes)
      - Compute cognitive weight per NodeType: `(sum degrees of type) / (total degrees) * 100`
      - Sort cognitive weights descending, highlight dominant type with its COLOR_MAP color
    - Implement `computeIslands(graphData)`:
      - BFS/DFS to find all connected components
      - Return island count and sizes array
      - Display "Fully connected" if single component
    - Panel updates on every graph data change
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ]* 5.2 Write property tests for health metrics
    - **Property 9: Orphan count equals nodes with zero degree**
    - **Property 10: Hub node has maximum degree**
    - **Property 11: Least documented type has minimum node count**
    - **Property 12: Island detection produces valid partition**
    - **Property 13: Cognitive weights sum to 100%**
    - **Property 14: Cognitive weights sorted descending**
    - **Validates: Requirements 5.2, 5.3, 5.4, 6.1, 6.3, 7.1, 7.3**

  - [x] 5.3 Implement enriched tooltip in webview.js
    - Modify `showTooltip` to compute and display:
      - Incoming connections count (edges where node is target)
      - Outgoing connections count (edges where node is source)
      - Top 3 most-connected neighbors (by degree), sorted descending
    - If node has < 3 neighbors, show all available
    - If node has 0 connections, show "No connections"
    - Preserve existing tooltip positioning logic
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 5.4 Write property tests for tooltip metrics
    - **Property 15: Tooltip connection counts are correct**
    - **Property 16: Top-N neighbors are highest-degree neighbors**
    - **Validates: Requirements 8.2, 8.3, 8.4**

- [x] 6. Interactions: Focus Mode, Path Finder, Cluster Mode
  - [x] 6.1 Create src/webview/media/interactions-panel.js
    - Implement Focus Mode:
      - `enterFocusMode(node)`: store original graphData, filter to node + 1-hop neighbors and their edges, update graph, center and zoom to fit
      - `exitFocusMode()`: restore original graphData, reapply filters
      - Add "Return to full graph" button (top-center, fixed position) visible only in focus mode
      - Wire double-click on node (250ms delay to distinguish from single-click)
    - Implement Path Finder:
      - `enterPathFinderMode()` / `exitPathFinderMode()`: toggle button in controls area
      - Allow sequential click of two nodes (source, target)
      - `computeShortestPath(sourceId, targetId, graphData)`: BFS on undirected graph
      - Highlight path nodes and edges with distinct style (brighter, thicker, pulsing)
      - Display path length (hops) near controls
      - Show "No path found — nodes are in different islands" if disconnected
      - Clear on toggle off or background click
    - Implement Cluster Mode:
      - `enterClusterMode()` / `exitClusterMode()`: toggle button in controls area
      - Compute cluster center positions evenly on a circle (one per active NodeType)
      - Apply `forceX` and `forceY` with strength 0.3-0.5 pulling nodes toward their type's center
      - Display subtle labels at cluster centers
      - On deactivate: remove clustering forces, reheat simulation
      - Preserve all edge rendering and particle animations
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [ ]* 6.2 Write property tests for interactions
    - **Property 17: Focus mode produces correct 1-hop subgraph**
    - **Property 18: Focus mode round-trip restores graph**
    - **Property 19: BFS finds shortest path on undirected graph**
    - **Property 20: Cluster centers evenly distributed on circle**
    - **Validates: Requirements 9.1, 9.4, 10.3, 10.8, 11.2, 11.3**

- [ ] 7. Checkpoint - Ensure interactions work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Evolution: Sparkline in Stats, New Badge
  - [x] 8.1 Implement sparkline rendering in webview.js stats overlay
    - Receive `statsHistory` from `updateGraph` message and store in webview state
    - In stats overlay: render a mini Canvas 2D polyline (~60px wide, 16px tall) showing node count for last 7 days
    - Display growth indicator text (e.g., "+3 nodes this week") comparing current to 7 days ago
    - If fewer than 2 days of history: show only current counts, hide sparkline
    - Update sparkline when graph data changes
    - _Requirements: 12.4, 12.5, 12.6, 12.7, 12.8_

  - [x] 8.2 Implement new badge on recent nodes in webview.js
    - In `nodeCanvasObject`: check `node.metadata.birthtime`
    - If birthtime is within last 7 days (604800000 ms): render a 3px bright cyan dot at top-right of node circle
    - Add subtle pulse animation (opacity oscillation) to the badge
    - Skip badge if birthtime is undefined/null (unresolved nodes)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.7_

  - [ ]* 8.3 Write property test for new badge threshold
    - **Property 25: New badge threshold is 7 days**
    - **Validates: Requirements 13.1, 13.5**

- [x] 9. Integration: Wire New Scripts in HTML, Update esbuild Config
  - [x] 9.1 Update webviewProvider.ts HTML to include new panels and scripts
    - Add script tags for `health-panel.js` and `interactions-panel.js` (after webview.js, before settings-panel.js)
    - Add URI variables for the new scripts using `webview.asWebviewUri`
    - Add DOM elements: health panel container (top-right), focus mode button (top-center), path finder toggle, cluster toggle, path length display
    - Add CSS styles for new panels and controls (consistent with existing dark theme)
    - _Requirements: 5.1, 5.6, 9.3, 10.1, 11.1_

  - [x] 9.2 Update esbuild.config.js to copy new webview JS files
    - Add `'health-panel.js'` and `'interactions-panel.js'` to the `filesToCopy` array
    - _Requirements: (build infrastructure)_

  - [x] 9.3 Wire health panel and interactions into webview.js data flow
    - In `handleUpdateGraph`: call `updateHealthPanel(graphData, degreeMap)` after computing degrees
    - In `handleUpdateGraph`: store `message.statsHistory` for sparkline use
    - In `reapplyFilters`: call `updateHealthPanel` with filtered data
    - Ensure focus mode, path finder, and cluster mode have access to the graph instance and graphData
    - _Requirements: 5.5, 6.6, 12.8_

- [ ] 10. Final Checkpoint - Build and verify all features
  - Run `node esbuild.config.js` to confirm build succeeds
  - Verify no TypeScript compilation errors in extension host
  - Verify all webview JS files are copied to dist/
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests (can be skipped for faster MVP)
- Each task references specific requirements for traceability
- TypeScript is used in extension host (extension.ts, services, types); plain JavaScript in webview
- All new webview features are additive — base graph rendering is never broken by failures in new panels
- Property tests use fast-check (already in devDependencies) with Mocha runner
- The force-graph library's continuous simulation (`cooldownTime: Infinity`) drives all animations without extra timers
