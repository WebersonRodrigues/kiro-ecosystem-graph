import type * as vscode from 'vscode';

// ─────────────────────────────────────────────────────────────────────────────
// File Discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents a discovered steering file within a workspace folder.
 * Contains the file URI, the workspace folder it belongs to, and its relative path.
 */
export interface SteeringFile {
  /** Absolute URI of the steering file */
  uri: vscode.Uri;
  /** Name of the workspace folder (e.g. "Workspace", "API", "Mobile") */
  workspaceFolder: string;
  /** Path relative to the workspace folder root (e.g. ".kiro/steering/flow-pedido.md") */
  relativePath: string;
}

/**
 * Discriminator for the three file categories handled by the ecosystem graph.
 */
export type FileCategory = 'steering' | 'skill' | 'hook';

/**
 * Represents a discovered ecosystem file (steering, skill, or hook) within a workspace folder.
 * Unlike SteeringFile, carries a `category` discriminator for multi-pattern discovery routing.
 */
export interface EcosystemFile {
  /** Absolute URI of the file */
  uri: vscode.Uri;
  /** Name of the workspace folder (e.g. "Workspace", "API", "Mobile") */
  workspaceFolder: string;
  /** Path relative to the workspace folder root (e.g. ".kiro/skills/my-skill.md") */
  relativePath: string;
  /** File category determining which parsing strategy to apply */
  category: FileCategory;
}

/**
 * Event emitted when an ecosystem file is created, changed, or deleted.
 * Used by the file watcher to trigger incremental graph updates.
 */
export interface FileChangeEvent {
  /** Type of file system change */
  type: 'created' | 'changed' | 'deleted';
  /** The affected ecosystem file (steering, skill, or hook) */
  file: EcosystemFile;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of parsing a single steering file.
 * Contains the graph node representing the file and all references extracted from its content.
 */
export interface ParseResult {
  /** Graph node representing the parsed file */
  node: GraphNode;
  /** All references (edges) extracted from the file content */
  references: Reference[];
}

/**
 * A reference extracted from a steering file pointing to another file or entity.
 * Each reference becomes an edge in the graph.
 */
export interface Reference {
  /** Relative path of the source file containing the reference */
  source: string;
  /** Relative path of the target file being referenced */
  target: string;
  /** Format in which the reference was found */
  type: ReferenceType;
  /** Line number where the reference appears in the source file */
  line: number;
}

/**
 * The format/syntax used to express a reference in markdown content.
 * - wiki-link: `#[[file:path/to/file.md]]`
 * - markdown-link: `[text](path/to/file.md)` (excluding http/https URLs)
 * - backtick-ref: `` `filename.md` `` (only if filename matches a known steering file)
 * - table-path: `| path/to/file.ext |` (file paths in markdown table cells)
 */
export type ReferenceType = 'wiki-link' | 'markdown-link' | 'backtick-ref' | 'table-path' | 'hook-implicit';

// ─────────────────────────────────────────────────────────────────────────────
// Graph Model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A node in the ecosystem graph representing a file, module, or entity.
 * Nodes are uniquely identified by their relative path (id).
 */
export interface GraphNode {
  /** Unique identifier — relative path within the workspace */
  id: string;
  /** Display label — typically the filename without extension */
  label: string;
  /** Classification type determining visual appearance */
  type: NodeType;
  /** Workspace folder this node belongs to */
  workspaceFolder: string;
  /** Full relative file path */
  filePath: string;
  /** Whether the file exists on disk (false for unresolved reference targets) */
  resolved: boolean;
  /** Optional metadata extracted from front-matter or other sources */
  metadata?: {
    /** Steering file inclusion mode: always, auto, fileMatch, or manual */
    inclusion?: string;
    /** Unix timestamp (ms) of file creation — used for "new" badge in webview */
    birthtime?: number;
    /** Unix timestamp (ms) of last modification — used for heatmap and dead zones */
    mtime?: number;
    /** Number of lines in the file — used for complexity score */
    lineCount?: number;
    /** Max shortest path to any reachable node — used for dependency depth badge */
    eccentricity?: number;
    /** Hook trigger type (e.g. 'fileEdited', 'userTriggered', 'promptSubmit') */
    whenType?: string;
    /** Hook description from JSON */
    description?: string;
    /** Labels of all steering files referenced by this hook */
    referencedSteerings?: string[];
  };
}

/**
 * An edge in the ecosystem graph connecting two nodes.
 * Represents a reference from one file to another.
 */
export interface GraphEdge {
  /** Node id of the source (file containing the reference) */
  source: string;
  /** Node id of the target (file being referenced) */
  target: string;
  /** Format of the reference that created this edge */
  type: ReferenceType;
}

/**
 * Classification of a graph node based on its filename prefix or role.
 * Determines the node's color and visual grouping in the graph.
 */
export type NodeType =
  | 'steering-flow'
  | 'steering-help'
  | 'steering-playbook'
  | 'steering-observability'
  | 'steering-domain'
  | 'steering-policy'
  | 'steering-tech'
  | 'steering-product'
  | 'steering-agent'
  | 'code-file'
  | 'module'
  | 'entity'
  | 'skill'
  | 'hook-manual'
  | 'hook-auto'
  | 'unknown';

/**
 * Serialized representation of the full graph, sent to the webview for rendering.
 * Contains all nodes and edges without circular references.
 */
export interface SerializedGraph {
  /** All nodes in the graph */
  nodes: GraphNode[];
  /** All edges in the graph */
  edges: GraphEdge[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Webview State
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete state of the webview panel, persisted across hide/restore cycles.
 * Includes viewport position, active filters, and graph physics settings.
 */
export interface PanelState {
  /** Current zoom level (1.0 = default) */
  zoom: number;
  /** Horizontal pan offset in pixels */
  panX: number;
  /** Vertical pan offset in pixels */
  panY: number;
  /** Active filter configuration */
  filters: FilterState;
  /** Graph physics and visual settings */
  settings: GraphSettings;
}

/**
 * Filter state controlling which nodes and edges are visible in the graph.
 */
export interface FilterState {
  /** Text filter applied to node labels (case-insensitive contains) */
  searchText: string;
  /** Node types currently visible in the graph */
  visibleTypes: NodeType[];
  /** Workspace folders currently visible in the graph */
  visibleFolders: string[];
}

/**
 * Configurable graph physics and visual parameters.
 * Adjustable in real-time via the settings panel sliders.
 */
export interface GraphSettings {
  /** Center force strength pulling nodes toward the center (0 - 0.2, default 0.05) */
  centerForce: number;
  /** Repulsion force between nodes (-300 - 0, default -150) */
  repulsionForce: number;
  /** Link force pulling connected nodes together (0 - 1, default 0.3) */
  linkForce: number;
  /** Ideal distance between connected nodes in pixels (20 - 200, default 60) */
  linkDistance: number;
  /** Multiplier for base node size (0.5 - 3, default 1) */
  nodeSizeMultiplier: number;
  /** Width of edge lines in pixels (0.1 - 3, default 0.5) */
  linkWidth: number;
  /** Whether to render directional arrows on edges (default false) */
  showArrows: boolean;
  /** Label visibility mode: always on, always off, or auto (visible at zoom > threshold) */
  labelMode: 'on' | 'off' | 'auto';
  /** When true, hide nodes whose files do not exist on disk (default false) */
  showOnlyExisting: boolean;
  /** When true, show nodes with no connections (default true) */
  showOrphans: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension <-> Webview Communication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Messages sent from the extension host to the webview panel.
 * Discriminated union on the `type` field.
 */
export type ExtensionMessage =
  | { type: 'updateGraph'; data: SerializedGraph; statsHistory?: DailySnapshot[]; annotations?: AnnotationEntry[]; snapshotList?: { filename: string; timestamp: number }[] }
  | { type: 'highlightNode'; nodeId: string }
  | { type: 'snapshotData'; snapshot: GraphSnapshot };

/**
 * Messages sent from the webview panel to the extension host.
 * Discriminated union on the `type` field.
 */
export type WebviewMessage =
  | { type: 'openFile'; filePath: string }
  | { type: 'ready' }
  | { type: 'stateChanged'; state: PanelState }
  | { type: 'saveAnnotation'; source: string; target: string; text: string }
  | { type: 'deleteAnnotation'; source: string; target: string }
  | { type: 'saveSnapshot' }
  | { type: 'loadSnapshot'; filename: string }
  | { type: 'exportImage'; dataUrl: string }
  | { type: 'exportImageError'; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Stats History (Temporal Evolution)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single daily snapshot of graph metrics.
 * Recorded once per calendar day and persisted in .kiro/ecosystem-graph-stats.json.
 */
export interface DailySnapshot {
  /** ISO date string "YYYY-MM-DD" */
  date: string;
  /** Total number of nodes in the graph on this date */
  nodeCount: number;
  /** Total number of edges in the graph on this date */
  edgeCount: number;
}

/**
 * Collection of daily snapshots for tracking graph evolution over time.
 * Maximum 30 entries, sorted by date ascending.
 */
export interface StatsHistory {
  /** Array of daily snapshots (max 30, oldest pruned on write) */
  snapshots: DailySnapshot[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Annotations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single annotation entry representing a user-provided label on an edge.
 * Persisted in the Annotation_Store keyed by "source->target".
 */
export interface AnnotationEntry {
  /** Node id of the source (file containing the reference) */
  source: string;
  /** Node id of the target (file being referenced) */
  target: string;
  /** User-provided relationship label */
  text: string;
  /** Unix timestamp (ms) when the annotation was created */
  createdAt: number;
}

/**
 * The full annotation store persisted to `.kiro/ecosystem-graph-annotations.json`.
 * Keys are formatted as "source->target".
 */
export interface AnnotationStore {
  annotations: Record<string, AnnotationEntry>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshots
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A saved graph state snapshot for later comparison.
 * Persisted as a timestamped JSON file in `.kiro/ecosystem-graph-snapshots/`.
 */
export interface GraphSnapshot {
  /** Unix timestamp (ms) when the snapshot was taken */
  timestamp: number;
  /** Filename of the snapshot (e.g. "snapshot-2024-01-15T10-30-00.json") */
  filename: string;
  /** All nodes at the time of snapshot */
  nodes: GraphNode[];
  /** All edges at the time of snapshot */
  edges: GraphEdge[];
}
