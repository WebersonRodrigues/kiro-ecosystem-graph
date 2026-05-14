# Design Document: Ecosystem Graph Advanced Intelligence

## Overview

This design extends the Kiro Ecosystem Graph VS Code extension with 15 features across 5 pillars:

1. **Gap Detection** — Suggested connections, dead zones, coverage map, redundancy detector
2. **Alternative Views** — Timeline view, hierarchy view (replace force-graph temporarily)
3. **Content Intelligence** — Activity heatmap, complexity score, dependency depth
4. **Advanced Interactions** — Annotation mode, snapshot compare, export as image
5. **Visual Enhancements** — Depth of field, constellation mode, synaptic strength

All rendering uses Canvas 2D only (no WebGL). New webview modules are plain JavaScript. New extension host services are TypeScript. The existing architecture (force-graph library, postMessage communication, DOM overlays) is preserved.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Gap detection location | Webview (gap-detector.js) | Operates on in-memory graph data; avoids round-trip messaging |
| Semantic similarity | Tokenized label comparison (split on hyphens/separators) | Simple, fast, no ML dependencies needed |
| Dead zones threshold | 30 days since mtime | Matches common "stale documentation" heuristic |
| Mtime source | `vscode.workspace.fs.stat()` in extension host | Webview cannot access filesystem |
| Timeline/Hierarchy views | Hide canvas, render alternative DOM-based layout | Avoids fighting force-graph physics; clean separation |
| Annotation persistence | JSON file `.kiro/ecosystem-graph-annotations.json` | Same pattern as statsHistoryService |
| Snapshot persistence | Directory `.kiro/ecosystem-graph-snapshots/` with timestamped JSON | Allows multiple snapshots, easy listing |
| Export mechanism | `canvas.toDataURL()` → postMessage → extension host saves | Webview cannot write files directly |
| Constellation algorithm | Minimum spanning tree (Kruskal's) per type group | Avoids O(n^2) fully-connected visual clutter |
| Dependency depth | BFS eccentricity in extension host | Computed once on graph change, sent as metadata |
| Depth of field | Distance from (0,0) in graph coordinates | Simple, no camera model needed |
| Synaptic strength | Edge brightness based on source node mtime | Reuses existing mtime metadata |

## Architecture

```mermaid
graph TB
    subgraph Extension Host (TypeScript)
        EXT[extension.ts] --> GDS[GraphDataStore]
        EXT --> SHS[StatsHistoryService]
        EXT --> ANS[AnnotationService]
        EXT --> SNS[SnapshotService]
        EXT --> FDS[FileDiscoveryService]
        GDS --> WP[WebviewProvider]
        SHS --> WP
        ANS --> WP
        SNS --> WP
    end

    subgraph Webview (Plain JS, Canvas 2D)
        WV[webview.js] --> FG[force-graph instance]
        WV --> GD[gap-detector.js]
        WV --> AV[alternative-views.js]
        WV --> VM[visual-modes.js]
        WV --> EP[export-panel.js]
        WV --> HP[health-panel.js]
        WV --> IP[interactions-panel.js]
        WV --> SP[settings-panel.js]
        WV --> FP[filter-panel.js]
        FG --> C2D[Canvas 2D Context]
    end

    WP -->|postMessage: updateGraph + annotations + snapshots| WV
    WV -->|postMessage: saveAnnotation, saveSnapshot, exportImage| WP
```

### Data Flow

1. **Extension host** discovers files, parses references, builds graph
2. **Extension host** enriches node metadata: `birthtime`, `mtime`, `lineCount`
3. **Extension host** computes `eccentricity` (dependency depth) via BFS on the full graph
4. **Extension host** loads annotations from `.kiro/ecosystem-graph-annotations.json`
5. **Extension host** sends `updateGraph` message with all enriched data
6. **Webview** receives data, computes derived metrics locally (gap detection, coverage, redundancy)
7. **Webview** renders via Canvas 2D (force-graph callbacks) and DOM overlays (alternative views, panels)

### New Message Types

```
Extension → Webview:
  updateGraph: { data, statsHistory, annotations, snapshotList }
  snapshotData: { snapshot }  (when user requests compare)

Webview → Extension:
  saveAnnotation: { source, target, text }
  deleteAnnotation: { source, target }
  saveSnapshot: {}
  loadSnapshot: { filename }
  exportImage: { dataUrl }
  exportImageError: { error }
```

## Components and Interfaces

### New Extension Host Services

#### AnnotationService

Persists edge annotations to `.kiro/ecosystem-graph-annotations.json`.

```typescript
interface AnnotationEntry {
  source: string;   // source node id
  target: string;   // target node id
  text: string;     // user-provided label
  createdAt: number; // timestamp ms
}

interface AnnotationStore {
  annotations: Record<string, AnnotationEntry>; // key: "source->target"
}

class AnnotationService {
  constructor(workspaceRoot: vscode.Uri);
  async load(): Promise<AnnotationStore>;
  async save(source: string, target: string, text: string): Promise<void>;
  async delete(source: string, target: string): Promise<void>;
  getAll(): AnnotationEntry[];
}
```

#### SnapshotService

Manages graph state snapshots in `.kiro/ecosystem-graph-snapshots/`.

```typescript
interface GraphSnapshot {
  timestamp: number;
  filename: string;  // e.g. "snapshot-2024-01-15T10-30-00.json"
  nodes: GraphNode[];
  edges: GraphEdge[];
}

class SnapshotService {
  constructor(workspaceRoot: vscode.Uri);
  async save(graph: SerializedGraph): Promise<string>; // returns filename
  async list(): Promise<{ filename: string; timestamp: number }[]>;
  async load(filename: string): Promise<GraphSnapshot>;
}
```

### Extended Node Metadata

```typescript
interface GraphNode {
  // ... existing fields ...
  metadata?: {
    inclusion?: string;
    birthtime?: number;   // existing: file creation time (ms)
    mtime?: number;       // NEW: last modification time (ms)
    lineCount?: number;   // NEW: number of lines in file
    eccentricity?: number; // NEW: max shortest path to any reachable node
  };
}
```

### New Webview Modules

#### gap-detector.js

Computes suggested connections, dead zones overlay, coverage map, and redundancy pairs.

```javascript
// Public API (called from webview.js on data update)
function computeSuggestedConnections(graphData) → SuggestedEdge[]
function computeDeadZones(graphData, currentTime) → DeadZoneNode[]
function computeCoverageMap(graphData, workspaceFolders) → CoverageEntry[]
function computeRedundancyPairs(graphData) → RedundancyPair[]

// Types
SuggestedEdge: { source, target, sharedTerms: string[], score: number }
DeadZoneNode: { nodeId, daysSinceEdit: number }
CoverageEntry: { folder, fileCount, level: 'high'|'medium'|'low'|'none' }
RedundancyPair: { nodeA, nodeB, sharedTargets: string[] }
```

**Semantic similarity algorithm:**
1. Tokenize each node label by splitting on `-`, `_`, `.`, camelCase boundaries
2. For each pair of unconnected nodes, compute Jaccard similarity of token sets
3. Pairs with similarity >= 0.5 and at least 2 shared tokens are suggested

**Redundancy algorithm:**
1. For each node, collect set of outgoing target IDs
2. For each pair of nodes, compute intersection of outgoing targets
3. Pairs with 3+ shared targets are flagged as redundant

#### alternative-views.js

Manages timeline and hierarchy views that temporarily replace the force-graph.

```javascript
// Public API
function enterTimelineView(graphData, container) → void
function exitTimelineView() → void
function enterHierarchyView(graphData, degreeMap, container) → void
function exitHierarchyView() → void

// Internal: creates a DOM-based SVG or Canvas overlay that hides the force-graph canvas
```

**Timeline layout:**
- X-axis: birthtime mapped proportionally to canvas width
- Y-axis: grouped by type (swim lanes)
- Edges rendered as curved arcs (quadratic bezier)
- Date axis with monthly/weekly labels depending on range

**Hierarchy layout:**
- Level 0: nodes with highest degree (top 10% or max degree)
- Level N+1: nodes referenced by level N that aren't already placed
- Horizontal distribution within each level using simple spacing algorithm
- Edges as straight diagonal lines

#### visual-modes.js

Manages activity heatmap, depth of field, constellation mode, and synaptic strength.

```javascript
// Public API (mode toggles)
function enableActivityHeatmap() → void
function disableActivityHeatmap() → void
function enableDepthOfField() → void
function disableDepthOfField() → void
function enableConstellationMode(graphData) → void
function disableConstellationMode() → void
function enableSynapticStrength() → void
function disableSynapticStrength() → void

// State flags (read by webview.js nodeCanvasObject/linkCanvasObject)
var activityHeatmapActive: boolean
var depthOfFieldActive: boolean
var constellationModeActive: boolean
var synapticStrengthActive: boolean
var constellationEdges: { source, target, type, color }[]
```

**Activity heatmap color interpolation:**
- 0 days since edit → `#FF4444` (hot red)
- 30+ days since edit → `#4444FF` (cold blue)
- Linear interpolation in HSL space between these endpoints

**Constellation MST (Kruskal's):**
1. Group nodes by type
2. For each type group, compute all pairwise Euclidean distances
3. Sort edges by distance ascending
4. Use union-find to build MST (accept edge if it doesn't create cycle)
5. Store MST edges for rendering as background layer

#### export-panel.js

Handles export as PNG and snapshot save/compare UI.

```javascript
// Public API
function triggerExport(canvas, vscode) → void  // captures and sends to extension
function triggerSnapshotSave(vscode) → void
function enterSnapshotCompare(currentData, snapshotData) → void
function exitSnapshotCompare() → void

// Snapshot compare state
var snapshotCompareActive: boolean
var snapshotDiff: { newNodes, removedNodes, newEdges, removedEdges }
```

### Modified Files

#### extension.ts
- Add `AnnotationService` and `SnapshotService` instantiation
- Enrich node metadata with `mtime` and `lineCount` during discovery
- Compute `eccentricity` for each node after graph is built
- Handle new message types: `saveAnnotation`, `deleteAnnotation`, `saveSnapshot`, `loadSnapshot`, `exportImage`

#### types.ts
- Extend `GraphNode.metadata` with `mtime`, `lineCount`, `eccentricity`
- Add `AnnotationEntry`, `AnnotationStore`, `GraphSnapshot` interfaces
- Extend `ExtensionMessage` and `WebviewMessage` discriminated unions

#### webviewProvider.ts
- Add script tags for new JS modules (gap-detector, alternative-views, visual-modes, export-panel)
- Handle new message types in `handleMessage()`
- Pass annotations and snapshot list in `updateGraph` message

#### webview.js
- Add mode toggle state variables for all new visual modes
- Integrate gap-detector results into rendering (dashed suggested edges, dead zone opacity)
- Integrate visual-modes flags into `nodeCanvasObject` and `linkCanvasObject` callbacks
- Add annotation rendering in `linkCanvasObject`
- Add constellation edges rendering in `onRenderFramePre`

## Data Models

### Annotation Store (`.kiro/ecosystem-graph-annotations.json`)

```json
{
  "annotations": {
    "path/to/source.md->path/to/target.md": {
      "source": "path/to/source.md",
      "target": "path/to/target.md",
      "text": "implements the flow described in",
      "createdAt": 1705334400000
    }
  }
}
```

### Snapshot File (`.kiro/ecosystem-graph-snapshots/snapshot-2024-01-15T10-30-00.json`)

```json
{
  "timestamp": 1705334400000,
  "filename": "snapshot-2024-01-15T10-30-00.json",
  "nodes": [ /* GraphNode[] */ ],
  "edges": [ /* GraphEdge[] */ ]
}
```

### Extended Node Metadata (sent via postMessage)

```json
{
  "id": ".kiro/steering/flow-pedido.md",
  "label": "flow-pedido",
  "type": "steering-flow",
  "metadata": {
    "birthtime": 1700000000000,
    "mtime": 1705200000000,
    "lineCount": 245,
    "eccentricity": 3
  }
}
```

