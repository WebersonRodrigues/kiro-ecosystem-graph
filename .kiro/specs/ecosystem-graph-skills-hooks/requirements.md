# Requirements Document

## Introduction

Extension of the Kiro Ecosystem Graph VS Code extension to support two new Kiro concepts: Skills (`.kiro/skills/*.md`) and Hooks (`.kiro/hooks/*.json`). Skills are markdown files defining agent capabilities, rendered as diamond-shaped nodes. Hooks are JSON files defining automated triggers, rendered as triangle-shaped nodes with color differentiation between manual and automatic types. The feature adds discovery, parsing, classification, rendering, and filtering for these new node categories while preserving all existing steering functionality.

## Glossary

- **Ecosystem_Graph**: The VS Code extension that renders a force-directed graph of Kiro ecosystem files
- **FileDiscoveryService**: Service that scans workspace folders for ecosystem files using glob patterns
- **ParserService**: Service that reads file content and extracts graph nodes and references (edges)
- **NodeClassifier**: Service that assigns a NodeType and color to each discovered file based on its filename and location
- **Skill_File**: A markdown file located in `.kiro/skills/` defining an agent capability
- **Hook_File**: A JSON file located in `.kiro/hooks/` defining an automated trigger action
- **Manual_Hook**: A hook where `when.type` equals `userTriggered`, requiring explicit user invocation
- **Automatic_Hook**: A hook where `when.type` is any value other than `userTriggered` (e.g., `fileEdited`, `promptSubmit`)
- **Webview**: The HTML/JS panel that renders the force-directed graph using the force-graph library
- **Filter_Panel**: The UI component with toggle buttons that controls visibility of node types and workspace folders
- **COLOR_MAP**: A JavaScript object mapping NodeType strings to hex color values for rendering
- **GraphNode**: The data structure representing a single node in the graph (id, label, type, workspaceFolder, filePath, resolved, metadata)
- **Reference**: An edge in the graph connecting a source node to a target node, extracted from file content

## Requirements

### Requirement 1: Discover Skill Files

**User Story:** As a developer, I want the Ecosystem Graph to discover `.kiro/skills/*.md` files across all workspace folders, so that skills appear as nodes in the graph.

#### Acceptance Criteria

1. WHEN the graph is initialized, THE FileDiscoveryService SHALL scan all workspace folders for files matching the glob pattern `**/.kiro/skills/*.md`
2. WHEN a skill file is discovered, THE FileDiscoveryService SHALL produce a file descriptor containing the URI, workspace folder name, and relative path
3. WHEN a skill file is created, changed, or deleted on disk, THE FileDiscoveryService SHALL emit a file change event within 500ms
4. THE FileDiscoveryService SHALL continue to discover steering files (`**/.kiro/steering/*.md`) without modification to existing behavior

### Requirement 2: Discover Hook Files

**User Story:** As a developer, I want the Ecosystem Graph to discover `.kiro/hooks/*.json` files across all workspace folders, so that hooks appear as nodes in the graph.

#### Acceptance Criteria

1. WHEN the graph is initialized, THE FileDiscoveryService SHALL scan all workspace folders for files matching the glob pattern `**/.kiro/hooks/*.json`
2. WHEN a hook file is discovered, THE FileDiscoveryService SHALL produce a file descriptor containing the URI, workspace folder name, and relative path
3. WHEN a hook file is created, changed, or deleted on disk, THE FileDiscoveryService SHALL emit a file change event within 500ms
4. THE FileDiscoveryService SHALL continue to discover steering files (`**/.kiro/steering/*.md`) without modification to existing behavior

### Requirement 3: Parse Skill Files

**User Story:** As a developer, I want skill markdown files to be parsed for references, so that edges connect skills to the steerings they reference.

#### Acceptance Criteria

1. WHEN a skill file is parsed, THE ParserService SHALL extract references using the same markdown patterns used for steering files (wiki-links, markdown-links, backtick-refs, table-paths)
2. WHEN a skill file is parsed, THE ParserService SHALL produce a GraphNode with the `skill` NodeType
3. WHEN a skill file references a known steering file via backtick (e.g., `` `help-faq.md` ``), THE ParserService SHALL create an edge from the skill node to the steering node
4. THE ParserService SHALL assign the filename without extension as the node label for skill files

### Requirement 4: Parse Hook Files

**User Story:** As a developer, I want hook JSON files to be parsed and their references extracted, so that edges connect hooks to the steerings they reference.

#### Acceptance Criteria

1. WHEN a hook file is parsed, THE ParserService SHALL read the JSON content and extract the `name`, `description`, `when.type`, and `then.prompt` fields
2. WHEN a hook file has `when.type` equal to `userTriggered`, THE ParserService SHALL produce a GraphNode with the `hook-manual` NodeType
3. WHEN a hook file has `when.type` not equal to `userTriggered`, THE ParserService SHALL produce a GraphNode with the `hook-auto` NodeType
4. WHEN the `then.prompt` field of a hook mentions a known steering filename (with or without `.md` extension), THE ParserService SHALL create an edge from the hook node to the referenced steering node
5. IF a hook file contains invalid JSON, THEN THE ParserService SHALL skip the file and log a warning without crashing
6. THE ParserService SHALL use the `name` field from the JSON as the node label, falling back to the filename without extension if `name` is absent
7. FOR ALL valid Hook_File objects, parsing then serializing the extracted fields then parsing again SHALL produce an equivalent GraphNode (round-trip property)

### Requirement 5: Classify Skill and Hook Nodes

**User Story:** As a developer, I want skills and hooks to have distinct NodeType classifications, so that they can be visually differentiated and filtered independently.

#### Acceptance Criteria

1. THE NodeClassifier SHALL assign the `skill` NodeType to all files discovered from `.kiro/skills/*.md`
2. THE NodeClassifier SHALL assign the `hook-manual` NodeType to hook files where `when.type` equals `userTriggered`
3. THE NodeClassifier SHALL assign the `hook-auto` NodeType to hook files where `when.type` does not equal `userTriggered`
4. THE NodeClassifier SHALL map `skill` to color `#B388FF`
5. THE NodeClassifier SHALL map `hook-manual` to color `#64B5F6`
6. THE NodeClassifier SHALL map `hook-auto` to color `#7C4DFF`
7. THE NodeClassifier SHALL preserve all existing steering NodeType classifications and their colors without modification

### Requirement 6: Render Skill Nodes as Diamonds

**User Story:** As a developer, I want skill nodes to appear as diamond shapes in the graph, so that I can visually distinguish them from steering circles.

#### Acceptance Criteria

1. WHEN a node with type `skill` is rendered, THE Webview SHALL draw a diamond (rotated square at 45 degrees) shape
2. WHEN a node with type `skill` is rendered, THE Webview SHALL fill the diamond with color `#B388FF`
3. THE Webview SHALL size skill diamond nodes using the same degree-based sizing formula applied to steering circle nodes
4. THE Webview SHALL apply the same glow, opacity, and heartbeat animation effects to skill diamonds as applied to steering circles

### Requirement 7: Render Hook Nodes as Triangles

**User Story:** As a developer, I want hook nodes to appear as triangle shapes in the graph, so that I can visually distinguish them from steerings and skills.

#### Acceptance Criteria

1. WHEN a node with type `hook-manual` is rendered, THE Webview SHALL draw an equilateral triangle shape
2. WHEN a node with type `hook-manual` is rendered, THE Webview SHALL fill the triangle with color `#64B5F6`
3. WHEN a node with type `hook-auto` is rendered, THE Webview SHALL draw an equilateral triangle shape
4. WHEN a node with type `hook-auto` is rendered, THE Webview SHALL fill the triangle with color `#7C4DFF`
5. THE Webview SHALL size hook triangle nodes using the same degree-based sizing formula applied to steering circle nodes
6. THE Webview SHALL apply the same glow, opacity, and heartbeat animation effects to hook triangles as applied to steering circles

### Requirement 8: Filter Toggle Visibility for New Types

**User Story:** As a developer, I want toggle buttons in the filter panel for skills and hooks, so that I can show or hide them independently.

#### Acceptance Criteria

1. WHEN skill nodes exist in the graph data, THE Filter_Panel SHALL display a toggle button labeled `skill` with a dot colored `#B388FF`
2. WHEN hook-manual nodes exist in the graph data, THE Filter_Panel SHALL display a toggle button labeled `hook-manual` with a dot colored `#64B5F6`
3. WHEN hook-auto nodes exist in the graph data, THE Filter_Panel SHALL display a toggle button labeled `hook-auto` with a dot colored `#7C4DFF`
4. WHEN a user clicks a toggle button to deactivate a type, THE Filter_Panel SHALL hide all nodes of that type from the graph
5. WHEN a user clicks a toggle button to reactivate a type, THE Filter_Panel SHALL show all nodes of that type in the graph
6. THE Filter_Panel SHALL include the new types in the `visibleTypes` set by default (visible on load)

### Requirement 9: Extend Type System

**User Story:** As a developer, I want the TypeScript type definitions to include the new node types, so that the codebase remains type-safe.

#### Acceptance Criteria

1. THE NodeType union type SHALL include `skill`, `hook-manual`, and `hook-auto` as valid values
2. THE COLOR_MAP in the webview SHALL include entries for `skill`, `hook-manual`, and `hook-auto`
3. THE NODE_COLOR_MAP in NodeClassifier SHALL include entries for `skill`, `hook-manual`, and `hook-auto`
4. THE existing NodeType values and their associated colors SHALL remain unchanged

### Requirement 10: Backward Compatibility

**User Story:** As a developer, I want all existing steering graph functionality to continue working unchanged after adding skills and hooks support.

#### Acceptance Criteria

1. THE FileDiscoveryService SHALL continue to discover and emit events for `.kiro/steering/*.md` files with identical behavior to the current implementation
2. THE ParserService SHALL continue to parse steering markdown files with identical reference extraction behavior
3. THE NodeClassifier SHALL continue to classify steering files using the same prefix-based rules and color assignments
4. THE Webview SHALL continue to render steering nodes as circles with the same colors, sizing, glow, and animation
5. THE Filter_Panel SHALL continue to display toggle buttons for all existing steering NodeTypes
6. THE graph physics (forces, decay, warmup) SHALL remain unchanged regardless of the presence of skill or hook nodes
