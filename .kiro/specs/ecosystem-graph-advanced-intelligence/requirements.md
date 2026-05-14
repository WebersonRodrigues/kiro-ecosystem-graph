# Requirements Document

## Introduction

Major upgrade to the Kiro Ecosystem Graph VS Code extension adding advanced intelligence capabilities: gap detection to find missing connections and stale areas, alternative visualization modes (timeline, hierarchy, heatmap), content intelligence metrics (complexity, dependency depth, redundancy), advanced interaction features (annotations, snapshots, export), and high-fidelity visual enhancements (depth of field, constellation mode, synaptic strength). All rendering uses Canvas 2D only (no WebGL), leveraging the existing force-graph library and extension architecture.

## Glossary

- **Extension_Host**: The TypeScript process running in VS Code that manages file discovery, parsing, and data services
- **Webview**: The HTML/Canvas panel running plain JavaScript that renders the graph using the ForceGraph library
- **Steering_File**: A markdown file in `.kiro/steering/` that represents a node in the ecosystem graph
- **Graph_Node**: A visual element in the graph representing a steering file, with properties like id, label, type, workspaceFolder
- **Graph_Edge**: A visual connection between two Graph_Nodes representing a reference from one file to another
- **Force_Graph**: The ForceGraph library instance that manages simulation physics and Canvas 2D rendering
- **Gap_Detector**: The service responsible for identifying suggested connections, dead zones, and coverage gaps
- **Timeline_View**: An alternative rendering mode displaying nodes on a horizontal axis ordered by creation date
- **Hierarchy_View**: An alternative rendering mode displaying nodes in a tree layout based on degree centrality
- **Activity_Heatmap**: A visualization overlay where node color temperature reflects recency of file modification
- **Annotation_Store**: A JSON file (`.kiro/ecosystem-graph-annotations.json`) persisting user-added edge labels
- **Snapshot_Store**: A directory (`.kiro/ecosystem-graph-snapshots/`) persisting saved graph states for comparison
- **Coverage_Map**: An overlay showing which workspace folders have adequate steering file coverage
- **Mtime**: The last modification timestamp of a file, obtained via `vscode.workspace.fs.stat()`
- **Dependency_Depth**: The minimum number of hops (edges) required to reach any other node from a given node
- **Synaptic_Strength**: A visual property of edges where brightness correlates with recency of source file edits

## Requirements

### Requirement 1: Suggested Connections

**User Story:** As a developer, I want the graph to suggest connections between nodes that should be linked but aren't, so that I can identify missing references in my steering ecosystem.

#### Acceptance Criteria

1. WHEN the graph data is loaded, THE Gap_Detector SHALL perform semantic analysis on node labels to identify pairs of nodes that share common terms but have no direct edge
2. WHEN a suggested connection is identified, THE Webview SHALL render it as a dashed line with a "?" indicator at the midpoint
3. THE Gap_Detector SHALL compare tokenized labels (splitting on hyphens and common separators) to compute a similarity score between unconnected node pairs
4. WHEN a suggested connection is hovered, THE Webview SHALL display a tooltip explaining why the connection is suggested (shared terms)
5. WHERE the user enables suggested connections via a toggle, THE Webview SHALL overlay suggested edges on the existing graph without affecting force simulation physics

### Requirement 2: Dead Zones Detection

**User Story:** As a developer, I want to see which steering files haven't been updated in over 30 days, so that I can identify stale knowledge that may need revision.

#### Acceptance Criteria

1. WHEN graph data is loaded, THE Extension_Host SHALL retrieve the mtime for each steering file via `vscode.workspace.fs.stat()`
2. WHEN a Graph_Node's file has not been modified in 30 or more days, THE Webview SHALL render that node with reduced opacity (0.3) and a "stale" text indicator below the label
3. THE Extension_Host SHALL include the mtime timestamp in the node metadata sent to the Webview
4. WHILE dead zone visualization is enabled, THE Webview SHALL calculate staleness relative to the current date at render time
5. IF a file's mtime cannot be retrieved, THEN THE Extension_Host SHALL omit the mtime metadata and THE Webview SHALL render the node normally without a stale indicator

### Requirement 3: Coverage Map

**User Story:** As a developer, I want a heatmap overlay showing which workspace modules have good steering coverage and which don't, so that I can prioritize documentation efforts.

#### Acceptance Criteria

1. WHEN coverage map mode is activated, THE Extension_Host SHALL count the number of steering files associated with each workspace folder
2. THE Webview SHALL display a color-coded overlay where green indicates high steering coverage (5+ files) and red indicates no coverage (0 files), with a gradient for intermediate values
3. THE Coverage_Map SHALL determine folder association by matching the `workspaceFolder` property of each Graph_Node against the workspace folder names
4. WHEN a workspace folder has zero steering files, THE Coverage_Map SHALL display it as a red zone with a "No coverage" label
5. THE Webview SHALL render the coverage map as a background layer that does not interfere with node interaction or force simulation

### Requirement 4: Timeline View

**User Story:** As a developer, I want to see my steering files arranged on a horizontal timeline by creation date, so that I can understand how the knowledge base evolved over time.

#### Acceptance Criteria

1. WHEN timeline view is activated, THE Webview SHALL replace the force-graph layout with a horizontal timeline where the X-axis represents creation date (birthtime)
2. THE Webview SHALL position each Graph_Node at the X coordinate corresponding to its creation date, distributed proportionally across the canvas width
3. THE Webview SHALL render a horizontal axis with date labels at regular intervals (monthly or weekly depending on date range)
4. WHILE timeline view is active, THE Webview SHALL disable force simulation physics and render edges as curved arcs connecting nodes at their timeline positions
5. WHEN timeline view is deactivated, THE Webview SHALL restore the force-graph layout and resume simulation
6. IF a node has no birthtime metadata, THEN THE Webview SHALL position it at the leftmost position with a "unknown date" indicator

### Requirement 5: Hierarchy View

**User Story:** As a developer, I want a tree layout where high-degree nodes appear at the top and referenced nodes appear below, so that I can understand the authority structure of my steering ecosystem.

#### Acceptance Criteria

1. WHEN hierarchy view is activated, THE Webview SHALL replace the force-graph layout with a top-down tree where nodes are positioned by degree centrality (highest degree at top)
2. THE Webview SHALL assign vertical levels based on degree: nodes with the highest degree occupy level 0 (root), their direct references occupy level 1, and so on
3. THE Webview SHALL distribute nodes horizontally within each level to minimize edge crossings
4. WHILE hierarchy view is active, THE Webview SHALL disable force simulation physics and render edges as straight vertical or diagonal lines connecting parent to child
5. WHEN hierarchy view is deactivated, THE Webview SHALL restore the force-graph layout and resume simulation

### Requirement 6: Activity Heatmap

**User Story:** As a developer, I want nodes to visually indicate how recently they were edited using color temperature, so that I can identify actively evolving areas versus stagnant ones.

#### Acceptance Criteria

1. WHILE activity heatmap mode is enabled, THE Webview SHALL color each Graph_Node using a temperature scale from blue (cold, not edited in 30+ days) to red (hot, edited within the last 24 hours)
2. THE Webview SHALL interpolate node color between blue and red based on the ratio of days since last edit to 30 days
3. WHILE activity heatmap mode is enabled, THE Webview SHALL increase the pulse animation intensity for nodes edited within the last 7 days
4. THE Extension_Host SHALL provide mtime data for each node to enable the heatmap calculation
5. WHEN activity heatmap mode is disabled, THE Webview SHALL restore the original type-based color scheme from COLOR_MAP

### Requirement 7: Complexity Score

**User Story:** As a developer, I want to see a complexity indicator on nodes based on file size, so that I can identify overly dense steerings that should be split.

#### Acceptance Criteria

1. WHEN graph data is loaded, THE Extension_Host SHALL count the number of lines in each steering file and include the line count in node metadata
2. THE Webview SHALL scale node radius proportionally to line count (larger nodes for files with more lines)
3. WHEN a steering file has 500 or more lines, THE Webview SHALL display a warning indicator (orange triangle icon) adjacent to the node
4. WHEN a node with a complexity warning is hovered, THE Webview SHALL show a tooltip suggesting the file should be split, including the current line count
5. IF a file cannot be read for line counting, THEN THE Extension_Host SHALL set line count to 0 and THE Webview SHALL render the node at default size without a warning

### Requirement 8: Dependency Depth

**User Story:** As a developer, I want to see how many hops each node needs to reach any other node, so that I can identify overly isolated steerings.

#### Acceptance Criteria

1. WHEN graph data is loaded, THE Extension_Host SHALL compute the maximum shortest path (eccentricity) from each node to all reachable nodes using BFS
2. THE Webview SHALL display the dependency depth as a numeric badge on each Graph_Node
3. WHEN a node has a dependency depth of 4 or more hops, THE Webview SHALL highlight the badge in orange to indicate potential isolation
4. WHEN a node is unreachable from the main component (island), THE Webview SHALL display an infinity symbol on the badge
5. THE Extension_Host SHALL recompute dependency depth whenever the graph data changes (file created, changed, or deleted)

### Requirement 9: Redundancy Detector

**User Story:** As a developer, I want to identify steering files that reference the same targets, so that I can find and eliminate knowledge duplication.

#### Acceptance Criteria

1. WHEN graph data is loaded, THE Gap_Detector SHALL identify pairs of nodes that share 3 or more common outgoing targets
2. WHEN a redundant pair is identified, THE Webview SHALL render a special dotted edge between the two redundant nodes colored in yellow
3. WHEN a redundancy edge is hovered, THE Webview SHALL display a tooltip listing the shared targets between the two nodes
4. WHERE redundancy detection is enabled via a toggle, THE Webview SHALL overlay redundancy edges without affecting force simulation physics
5. THE Gap_Detector SHALL recompute redundancy pairs whenever graph data changes

### Requirement 10: Annotation Mode

**User Story:** As a developer, I want to add notes and labels to edges explaining the relationship between connected steerings, so that I can document the purpose of each connection.

#### Acceptance Criteria

1. WHEN annotation mode is active and the user clicks an edge, THE Webview SHALL display an input field allowing the user to type a relationship label
2. WHEN the user submits an annotation, THE Extension_Host SHALL persist it in the Annotation_Store (`.kiro/ecosystem-graph-annotations.json`) keyed by source-target pair
3. WHILE an edge has a persisted annotation, THE Webview SHALL render the annotation text at the midpoint of the edge
4. WHEN annotation mode is active and the user clicks an already-annotated edge, THE Webview SHALL pre-fill the input with the existing annotation for editing
5. THE Extension_Host SHALL load annotations from the Annotation_Store on startup and send them to the Webview with the graph data
6. IF the Annotation_Store file does not exist, THEN THE Extension_Host SHALL create it with an empty JSON object on first annotation save

### Requirement 11: Snapshot Compare

**User Story:** As a developer, I want to save the current graph state and later compare it with the current state, so that I can visualize how the ecosystem evolved over time.

#### Acceptance Criteria

1. WHEN the user triggers a snapshot save, THE Extension_Host SHALL serialize the current graph state (nodes, edges, metadata) to a timestamped JSON file in the Snapshot_Store directory
2. WHEN the user triggers a snapshot compare, THE Webview SHALL display a visual diff showing: new nodes (green glow), removed nodes (red ghost outline), and unchanged nodes (normal rendering)
3. THE Extension_Host SHALL list available snapshots by reading the Snapshot_Store directory and present them to the user for selection
4. WHEN comparing, THE Webview SHALL highlight new edges in green and removed edges in red dashed style
5. WHEN snapshot compare mode is exited, THE Webview SHALL restore normal rendering
6. IF the Snapshot_Store directory does not exist, THEN THE Extension_Host SHALL create it on first snapshot save

### Requirement 12: Export as Image

**User Story:** As a developer, I want to export the current graph view as a PNG image, so that I can include it in presentations and documentation.

#### Acceptance Criteria

1. WHEN the user triggers the export action, THE Webview SHALL capture the current canvas state using `canvas.toDataURL('image/png')`
2. THE Webview SHALL send the PNG data to the Extension_Host via postMessage
3. THE Extension_Host SHALL save the PNG file to the workspace root with a timestamped filename (e.g., `ecosystem-graph-2024-01-15.png`)
4. WHEN the export is complete, THE Extension_Host SHALL show an information notification with the saved file path
5. IF the canvas capture fails, THEN THE Webview SHALL send an error message and THE Extension_Host SHALL show a warning notification

### Requirement 13: Depth of Field

**User Story:** As a developer, I want nodes farther from the graph center to appear slightly blurred, so that the visualization creates a 3D depth sensation without requiring WebGL.

#### Acceptance Criteria

1. WHILE depth of field mode is enabled, THE Webview SHALL calculate each node's distance from the graph center (0,0 in graph coordinates)
2. THE Webview SHALL reduce shadowBlur and opacity for nodes beyond 50% of the maximum node distance from center
3. THE Webview SHALL apply a linear falloff: nodes at center have full sharpness (shadowBlur as normal, opacity 1.0), nodes at maximum distance have reduced sharpness (shadowBlur halved, opacity 0.5)
4. THE Webview SHALL apply depth of field only to the Canvas 2D rendering without modifying node data or simulation physics
5. WHEN depth of field mode is disabled, THE Webview SHALL restore normal rendering with uniform sharpness for all nodes

### Requirement 14: Constellation Mode

**User Story:** As a developer, I want nodes of the same type to be connected by subtle lines forming constellation patterns, so that I can visually identify type groupings like a star map.

#### Acceptance Criteria

1. WHILE constellation mode is enabled, THE Webview SHALL render very subtle lines (opacity 0.06, width 0.3px) connecting all nodes of the same NodeType
2. THE Webview SHALL use the type's color from COLOR_MAP for constellation lines
3. THE Webview SHALL connect nodes of the same type using a minimum spanning tree algorithm to avoid visual clutter (not fully connected)
4. THE Webview SHALL render constellation lines as a background layer behind normal edges and nodes
5. WHEN constellation mode is disabled, THE Webview SHALL remove all constellation lines from rendering

### Requirement 15: Synaptic Strength

**User Story:** As a developer, I want edges to glow brighter when their source file was recently edited, so that I can see which connections are actively used versus dormant.

#### Acceptance Criteria

1. WHILE synaptic strength mode is enabled, THE Webview SHALL vary edge brightness based on the source node's mtime
2. THE Webview SHALL render edges from recently edited sources (within 7 days) at full brightness (opacity 0.7) with increased line width (1.5px)
3. THE Webview SHALL render edges from stale sources (30+ days since edit) at minimum brightness (opacity 0.05) with reduced line width (0.3px)
4. THE Webview SHALL interpolate edge brightness linearly between the 7-day and 30-day thresholds
5. WHEN synaptic strength mode is disabled, THE Webview SHALL restore the default edge rendering (EDGE_DEFAULT_OPACITY and EDGE_DEFAULT_WIDTH)
