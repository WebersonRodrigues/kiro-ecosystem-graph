# Design Document: Ecosystem Graph Brain Insights

## Overview

This design upgrades the Kiro Ecosystem Graph VS Code extension with four pillars of functionality:

1. **Visual Enhancements** — Neural density particles, heartbeat pulse, gradient edges, neural impulse ray propagation
2. **Insights Panels** — Health score, island detection, cognitive weight metrics, enriched tooltips
3. **Advanced Interactions** — Focus mode (double-click), path finder (BFS), cluster mode (brain lobes)
4. **Temporal Evolution** — Stats history with sparkline, new-node badge

The extension uses Canvas 2D rendering via the `force-graph` library, plain JavaScript in the webview, and TypeScript in the extension host. All new features must work within these constraints — no WebGL, no framework in webview, no external dependencies beyond what's already in `package.json` (force-graph, fast-check, mocha).

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stats persistence | JSON file at `.kiro/ecosystem-graph-stats.json` | Portable, version-controllable, no VS Code API coupling |
| BFS/Path Finder | Implemented in webview.js | Graph data lives in webview; avoids round-trip messaging |
| Island detection | Implemented in webview.js | Same reason — operates on in-memory graph data |
| Cluster mode | d3-force `forceX`/`forceY` | Native to force-graph's simulation engine |
| Gradient edges | `linkCanvasObject` callback | force-graph API for custom edge rendering |
| Heartbeat | Driven by force-graph's continuous simulation tick (`onRenderFramePre`) | Already runs at ~60fps; no extra timer needed |
| Focus mode | Maintain separate filtered view (don't mutate `graphData`) | Allows clean restore without re-fetching |
| Health score panel | DOM overlay (like existing stats/legend) | Consistent with existing UI pattern |
| New badge | Extension host passes `birthtime` via node metadata | Webview can't access filesystem |

## Architecture

```mermaid
graph TB
    subgraph Extension Host (TypeScript)
        EXT[extension.ts] --> GDS[GraphDataStore]
        EXT --> SHS[StatsHistoryService]
        EXT --> FDS[FileDiscoveryService]
        GDS --> WP[WebviewProvider]
        SHS --> WP
    end

    subgraph Webview (Plain JS, Canvas 2D)
        WV[webview.js] --> FG[force-graph instance]
        WV --> HP[health-panel.js]
        WV --> IP[interactions-panel.js]
        WV --> SP[settings-panel.js]
        WV --> FP[filter-panel.js]
        FG --> C2D[Canvas 2D Context]
    end

    WP -->|postMessage: updateGraph + stats| WV
    WV -->|postMessage: openFile, ready| WP
```

### Data Flow

1. **Extension host** discovers files, parses references, builds graph, computes file birthtimes
2. **Extension host** reads/writes `.kiro/ecosystem-graph-stats.json` for daily snapshots
3. **Extension host** sends `updateGraph` message with enriched node metadata (including `birthtime`) and stats history
4. **Webview** receives data, computes derived metrics (health score, islands, cognitive weight, BFS paths) locally
5. **Webview** renders everything via Canvas 2D and DOM overlays

## Components and Interfaces

### New Extension Host Services

#### StatsHistoryService

Responsible for persisting daily node/edge count snapshots.

```typescript
interface DailySnapshot {
  date: string;        // ISO date "YYYY-MM-DD"
  nodeCount: number;
  edgeCount: number;
}

interface StatsHistory {
  snapshots: DailySnapshot[];  // max 30 entries, sorted by date ascending
}

class StatsHistoryService {
  constructor(private workspaceRoot: vscode.Uri) {}

  /** Read history from .kiro/ecosystem-graph-stats.json */
  async load(): Promise<StatsHistory>;

  /** Update today's entry (upsert) and prune entries older than 30 days */
  async recordSnapshot(nodeCount: number, edgeCount: number): Promise<void>;

  /** Get last 7 days for sparkline rendering */
  getRecentSnapshots(): DailySnapshot[];
}
```

#### GraphNode Metadata Extension

The existing `GraphNode.metadata` field will be extended:

```typescript
interface GraphNodeMetadata {
  inclusion?: string;
  birthtime?: number;  // Unix timestamp (ms) of file creation
}
```

### New Webview Modules

#### health-panel.js

DOM overlay panel computing and displaying:
- Orphan count
- Hub node (highest degree)
- Least documented area (NodeType with fewest nodes)
- Island count and sizes (via BFS connected components)
- Cognitive weight per NodeType

Exposes global functions:
- `updateHealthPanel(graphData, degreeMap)` — called after graph data updates
- `computeIslands(graphData)` — returns array of connected components

#### interactions-panel.js

Manages Focus Mode, Path Finder, and Cluster Mode:
- `enterFocusMode(node)` — filters graph to node + 1-hop neighbors
- `exitFocusMode()` — restores full graph
- `enterPathFinderMode()` / `exitPathFinderMode()`
- `computeShortestPath(sourceId, targetId, graphData)` — BFS on undirected graph
- `enterClusterMode()` / `exitClusterMode()` — applies/removes forceX/forceY

### Modified Existing Files

#### webview.js Changes

- **Heartbeat pulse**: Add time-based opacity oscillation in `nodeCanvasObject`
- **Gradient edges**: Add `linkCanvasObject` callback for gradient rendering
- **Neural impulse ray**: Add delayed highlight propagation on hover with `setTimeout`
- **Density particles**: Modify `initAmbientParticles` to use radial probability distribution
- **New badge**: Render small cyan dot on nodes with recent `birthtime`
- **Sparkline**: Render mini polyline in stats overlay using Canvas 2D
- **Enriched tooltip**: Add incoming/outgoing counts and top-3 neighbors to `showTooltip`

#### webviewProvider.ts Changes

- Include new script files (`health-panel.js`, `interactions-panel.js`) in HTML
- Pass stats history data alongside graph data in `updateGraph` message
- Add new DOM elements for health panel, focus mode button, path finder controls, cluster button

#### extension.ts Changes

- Instantiate `StatsHistoryService`
- Call `recordSnapshot` after graph initialization and on file changes
- Compute file birthtimes during parsing and attach to node metadata
- Send stats history in the `updateGraph` message payload

#### types.ts Changes

- Extend `GraphNodeMetadata` with `birthtime`
- Extend `ExtensionMessage` with stats history payload
- Add new `WebviewMessage` types for interaction modes

### Communication Protocol Extensions

```typescript
// Extension -> Webview (extended)
export type ExtensionMessage =
  | { type: 'updateGraph'; data: SerializedGraph; statsHistory?: DailySnapshot[] }
  | { type: 'highlightNode'; nodeId: string };

// Webview -> Extension (extended)
export type WebviewMessage =
  | { type: 'openFile'; filePath: string }
  | { type: 'ready' }
  | { type: 'stateChanged'; state: PanelState };
```

## Data Models

### Stats History File (`.kiro/ecosystem-graph-stats.json`)

```json
{
  "snapshots": [
    { "date": "2025-01-15", "nodeCount": 42, "edgeCount": 67 },
    { "date": "2025-01-16", "nodeCount": 44, "edgeCount": 71 },
    { "date": "2025-01-17", "nodeCount": 44, "edgeCount": 73 }
  ]
}
```

- Maximum 30 entries (older pruned on write)
- One entry per calendar day (upserted if multiple sessions)
- File created on first graph initialization if it doesn't exist

### Extended GraphNode (in-memory, sent to webview)

```typescript
{
  id: "api/.kiro/steering/flow-pedido.md",
  label: "flow-pedido",
  type: "steering-flow",
  workspaceFolder: "API",
  filePath: "api/.kiro/steering/flow-pedido.md",
  resolved: true,
  metadata: {
    inclusion: "auto",
    birthtime: 1705334400000  // Jan 15, 2025 — used for "new" badge
  }
}
```

### Health Metrics (computed in webview, not persisted)

```typescript
interface HealthMetrics {
  orphanCount: number;
  hubNode: { id: string; label: string; degree: number } | null;
  leastDocumentedType: { type: string; count: number } | null;
  islands: { count: number; sizes: number[] };
  cognitiveWeights: Array<{ type: string; percentage: number }>;
}
```

### Island Detection Data Structure

```typescript
// BFS connected components — computed in webview
interface ConnectedComponent {
  nodeIds: Set<string>;
  size: number;
}
```

### Path Finder State

```typescript
interface PathFinderState {
  active: boolean;
  sourceNode: string | null;
  targetNode: string | null;
  path: string[] | null;       // ordered node IDs from source to target
  pathEdges: Set<string>;      // edge keys "source->target" on the path
}
```

### Focus Mode State

```typescript
interface FocusModeState {
  active: boolean;
  focusedNodeId: string | null;
  originalGraphData: { nodes: any[]; links: any[] } | null;  // for restore
}
```

### Cluster Mode State

```typescript
interface ClusterModeState {
  active: boolean;
  clusterCenters: Map<string, { x: number; y: number }>;  // NodeType -> position
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Particle density follows radial distribution

*For any* canvas dimensions (width, height), after initializing ambient particles, the ratio of particles within 30% of the canvas radius from center to particles in the outer region should approximate 3x the uniform expectation (within statistical tolerance over 100+ particles).

**Validates: Requirements 1.2**

### Property 2: Heartbeat opacity stays within bounds

*For any* time value t (positive real number) and any node index, the computed heartbeat opacity should always be within the range [0.85, 0.95].

**Validates: Requirements 2.1**

### Property 3: Heartbeat is periodic

*For any* time value t and a fixed period P (between 2000ms and 3000ms), the heartbeat function should satisfy `f(t) ≈ f(t + P)` for all nodes (within floating-point tolerance).

**Validates: Requirements 2.2**

### Property 4: Heartbeat phase offset produces distinct values

*For any* two different node indices i and j at the same time t, the computed heartbeat opacity for node i should differ from node j (unless they happen to be at symmetric points in the cycle).

**Validates: Requirements 2.3**

### Property 5: Dimmed nodes ignore heartbeat

*For any* node that is in dimmed state (not highlighted during hover), the computed opacity should be exactly 0.2 regardless of the current time value.

**Validates: Requirements 2.4**

### Property 6: Gradient edge colors match source and target types

*For any* edge in the graph where source has type A and target has type B, the gradient start color should equal `COLOR_MAP[A]` and the gradient end color should equal `COLOR_MAP[B]`.

**Validates: Requirements 3.1**

### Property 7: Edge opacity respects hover state

*For any* edge, the applied opacity should be 0.12 when not highlighted and 0.7 when highlighted, regardless of the gradient colors.

**Validates: Requirements 3.3**

### Property 8: Impulse propagation bounded to 2 hops

*For any* graph and any hovered node, the set of nodes reached by the neural impulse propagation should contain only nodes within 2 hops of the hovered node (BFS distance <= 2).

**Validates: Requirements 4.6**

### Property 9: Orphan count equals nodes with zero degree

*For any* graph (nodes and edges), the computed orphan count should equal the number of nodes whose degree (incoming + outgoing) is zero.

**Validates: Requirements 5.2**

### Property 10: Hub node has maximum degree

*For any* non-empty graph with at least one edge, the identified hub node should have a degree greater than or equal to all other nodes in the graph.

**Validates: Requirements 5.3**

### Property 11: Least documented type has minimum node count

*For any* graph with at least two distinct NodeTypes, the identified least documented type should have a node count less than or equal to all other types present.

**Validates: Requirements 5.4**

### Property 12: Island detection produces valid partition

*For any* graph, the computed connected components should satisfy: (a) every node belongs to exactly one component, (b) for any two nodes in the same component there exists a path between them, and (c) the sum of all component sizes equals the total node count.

**Validates: Requirements 6.1, 6.3**

### Property 13: Cognitive weights sum to 100%

*For any* graph with at least one edge, the sum of cognitive weight percentages across all NodeTypes should equal 100% (within floating-point tolerance). For graphs with zero edges, all weights should be 0%.

**Validates: Requirements 7.1**

### Property 14: Cognitive weights sorted descending

*For any* graph, the cognitive weight array should be sorted in descending order by percentage value.

**Validates: Requirements 7.3**

### Property 15: Tooltip connection counts are correct

*For any* node in any graph, the computed incoming connection count should equal the number of edges where `target == node.id`, and the outgoing connection count should equal the number of edges where `source == node.id`.

**Validates: Requirements 8.2, 8.3**

### Property 16: Top-N neighbors are highest-degree neighbors

*For any* node with at least one neighbor, the returned top-3 (or fewer) neighbors should be the neighbors with the highest degree values, sorted descending. No neighbor outside the returned set should have a higher degree than any neighbor inside the set.

**Validates: Requirements 8.4**

### Property 17: Focus mode produces correct 1-hop subgraph

*For any* node in any graph, entering focus mode should produce a subgraph containing exactly the focused node and all nodes directly connected to it (1-hop), with edges only between nodes in this subgraph.

**Validates: Requirements 9.1**

### Property 18: Focus mode round-trip restores graph

*For any* graph state, entering focus mode on any node and then exiting should restore the graph to its original state (same nodes and edges as before focus).

**Validates: Requirements 9.4**

### Property 19: BFS finds shortest path on undirected graph

*For any* graph and any two nodes in the same connected component, the path returned by BFS should be: (a) a valid path (consecutive nodes are connected by an edge in either direction), (b) the shortest such path (no shorter valid path exists), and (c) traversable in both directions (edges treated as undirected).

**Validates: Requirements 10.3, 10.8**

### Property 20: Cluster centers evenly distributed on circle

*For any* set of N active NodeTypes (N >= 2), the computed cluster center positions should be evenly spaced on a circle around the graph center, with angular distance of 2*PI/N between consecutive centers (within floating-point tolerance).

**Validates: Requirements 11.2, 11.3**

### Property 21: Stats history serialization round-trip

*For any* valid StatsHistory object, serializing to JSON and deserializing should produce an equivalent object.

**Validates: Requirements 12.1**

### Property 22: Same-day snapshot is idempotent

*For any* stats history and any date, recording multiple snapshots on the same date should result in exactly one entry for that date (the last recorded values).

**Validates: Requirements 12.2**

### Property 23: Stats history never exceeds 30 entries

*For any* sequence of snapshot recordings, the resulting history should never contain more than 30 entries, and all entries should have dates within the last 30 days from the most recent entry.

**Validates: Requirements 12.3**

### Property 24: Growth indicator calculation

*For any* stats history with entries spanning at least 7 days, the growth indicator should equal the current day's node count minus the node count from 7 days ago (or the oldest available if less than 7 days exist).

**Validates: Requirements 12.5**

### Property 25: New badge threshold is 7 days

*For any* node with a defined birthtime, the "isNew" function should return true if and only if the birthtime is within the last 7 days (604800000 ms) from the current time. Nodes without a birthtime (undefined/null) should always return false.

**Validates: Requirements 13.1, 13.5**

## Error Handling

### Extension Host

| Scenario | Handling |
|----------|----------|
| Stats JSON file doesn't exist | Create with empty `{ "snapshots": [] }` on first write |
| Stats JSON file is corrupted/invalid JSON | Log warning, reset to empty history, continue |
| File birthtime unavailable (e.g., network filesystem) | Set `metadata.birthtime` to `undefined`; webview skips badge |
| Workspace folder has no `.kiro/` directory | Create `.kiro/` directory before writing stats file |
| File write fails (permissions) | Log error, continue without persistence; in-memory stats still work |
| Graph data is empty (no steering files found) | Send empty graph; webview shows empty state message |

### Webview

| Scenario | Handling |
|----------|----------|
| BFS on disconnected nodes (no path) | Return `null`; display "No path found — nodes are in different islands" |
| Focus mode on orphan node (no neighbors) | Show only the focused node with "No connections" indicator |
| Graph data arrives with 0 nodes | Health panel shows "No data"; sparkline hidden |
| Stats history has < 2 entries | Hide sparkline, show only current counts |
| Division by zero in cognitive weight (0 total degree) | All types get 0%; display "No connections yet" |
| Canvas resize to 0x0 (panel minimized) | Skip all rendering in `onRenderFramePre` (existing guard) |
| Double-click timing conflict with single-click | 250ms delay on single-click; if double-click fires within window, cancel single-click action |

### Graceful Degradation

All new features are additive — if any computation fails, the base graph rendering continues unaffected. Each panel/feature operates independently:
- Health panel failure: panel hidden, graph still renders
- Path finder failure: clear path state, show error message
- Cluster mode failure: remove forces, revert to normal layout
- Stats persistence failure: in-memory operation continues, sparkline shows available data

## Testing Strategy

### Testing Framework

- **Unit/Property tests**: Mocha + fast-check (already in devDependencies)
- **Test location**: `src/test/` directory
- **Run command**: `npm test` (mocha with ts-node)

### Dual Testing Approach

#### Property-Based Tests (fast-check)

Each correctness property maps to a single property-based test with minimum 100 iterations. Tests are tagged with the design property reference.

```typescript
// Tag format example:
// Feature: ecosystem-graph-brain-insights, Property 12: Island detection produces valid partition
```

Property tests focus on:
- Graph algorithm correctness (BFS, island detection, cognitive weight)
- Data invariants (stats history bounds, partition validity)
- Mathematical properties (heartbeat bounds, periodicity, density distribution)
- Round-trip properties (stats serialization, focus mode restore)

#### Unit Tests (Mocha)

Unit tests cover:
- Specific examples demonstrating correct behavior
- Edge cases identified in prework (5.7, 6.5, 7.5, 8.5, 8.6, 10.6, 12.6, 13.7)
- Integration points (message passing between extension host and webview)
- Error conditions (corrupted JSON, missing files, empty graphs)

### Test File Organization

```
src/test/
  algorithms/
    islandDetection.property.ts    — Properties 12
    bfs.property.ts                — Property 19
    cognitiveWeight.property.ts    — Properties 13, 14
    healthMetrics.property.ts      — Properties 9, 10, 11
    focusMode.property.ts          — Properties 17, 18
    clusterCenters.property.ts     — Property 20
    tooltipMetrics.property.ts     — Properties 15, 16
  visual/
    heartbeat.property.ts          — Properties 2, 3, 4, 5
    particleDensity.property.ts    — Property 1
    gradientEdge.property.ts       — Properties 6, 7
    impulseRay.property.ts         — Property 8
    newBadge.property.ts           — Property 25
  persistence/
    statsHistory.property.ts       — Properties 21, 22, 23, 24
  edge-cases/
    healthPanel.test.ts            — Edge cases 5.7, 6.5, 7.5
    tooltip.test.ts                — Edge cases 8.5, 8.6
    pathFinder.test.ts             — Edge case 10.6
    statsHistory.test.ts           — Edge case 12.6
    newBadge.test.ts               — Edge case 13.7
```

### Property Test Configuration

- Minimum 100 iterations per property (fast-check default `numRuns: 100`)
- Custom arbitraries for graph generation (random nodes with types, random edges)
- Seed-based reproducibility for debugging failures
- Each test file imports only the pure computation functions (no DOM, no Canvas, no VS Code API)

### What Is NOT Tested

- Canvas rendering output (visual correctness verified manually)
- DOM element positioning and styling
- force-graph library internals (d3-force simulation)
- VS Code API interactions (mocked at integration boundary)
- Animation timing (setTimeout delays)
