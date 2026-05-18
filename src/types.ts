import type * as vscode from 'vscode';

// ─────────────────────────────────────────────────────────────────────────────
// Node Source (Multi-Workspace Orchestration)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provenance of a graph node — indicates where the file was discovered.
 * - 'local': discovered within the open workspace folders
 * - 'external-configured': discovered via ecosystemGraph.externalPaths setting
 * - 'external-resolved': created by resolving a ../ reference to an external file
 * - 'global': discovered in ~/.kiro/steering/ (global steerings)
 */
export type NodeSource = 'local' | 'external-configured' | 'external-resolved' | 'global';

// ─────────────────────────────────────────────────────────────────────────────
// External Discovery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Options for external filesystem discovery.
 */
export interface ExternalDiscoveryOptions {
  /** Paths configured by the user in ecosystemGraph.externalPaths */
  externalPaths: string[];
  /** Whether to include ~/.kiro/ global steerings */
  includeGlobal: boolean;
  /** Timeout per path in ms (default: 5000) */
  timeoutMs?: number;
  /** Max files per path (default: 1000) */
  maxFilesPerPath?: number;
}

/**
 * Result of external filesystem discovery.
 */
export interface ExternalDiscoveryResult {
  /** Discovered ecosystem files */
  files: EcosystemFile[];
  /** Paths that were skipped (timeout or non-existent) */
  skippedPaths: { path: string; reason: string }[];
}

/**
 * In-memory cache for external discovery results.
 */
export interface ExternalPathCache {
  /** Map of configured path → discovered files */
  entries: Map<string, EcosystemFile[]>;
  /** Timestamp of last update */
  lastUpdated: number;
  /** Hash of the configuration that generated this cache */
  configHash: string;
}

/**
 * Result of resolving an external path reference.
 */
export interface ExternalResolutionResult {
  /** Normalized absolute path (POSIX) */
  absolutePath: string;
  /** Whether the file exists on the filesystem */
  exists: boolean;
  /** Derived workspace name from the path */
  derivedWorkspace: string;
  /** Source type */
  source: NodeSource;
}

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
  /** Provenance of this file (local, external-configured, external-resolved, global) */
  source?: NodeSource;
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
  /** Provenance of this node */
  source: NodeSource;
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
    /** Hook prompt content from then.prompt — used for self-sufficiency analysis */
    hookPrompt?: string;
    /** Labels of all steering files referenced by this hook */
    referencedSteerings?: string[];

    // ─── Content analysis fields (populated by ContentAnalyzer) ───

    /** Keywords extracted from content (no stop-words, >= 4 chars) */
    keywords?: string[];
    /** Section headers (lines starting with #) */
    sectionHeaders?: string[];
    /** Proportion of actionable lines (0.0 - 1.0) */
    actionableRatio?: number;
    /** Imperative lines for contradiction detection */
    imperativeLines?: { text: string; pattern: string; subject: string }[];
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
  /** When true, show the minimap overlay (default true) */
  showMinimap?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cognitive Analysis Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of the cognitive analysis computation from the webview panel.
 * Sent to the extension host for Markdown report generation.
 */
export interface CognitiveAnalysisResult {
  /** Steering nodes with 0 incoming + 0 outgoing edges */
  steeringsSoltos: { id: string; label: string }[];
  /** Edges with weight=1 AND type='backtick-ref' */
  vinculosFrageis: { source: string; target: string; sourceLabel: string; targetLabel: string }[];
  /** Nodes with 0 total edges */
  arquivosSemContexto: { id: string; label: string; type: string }[];
  /** Workspace folders with 0 steering files */
  coverageGaps: { folder: string }[];
  /** Steering files with fewer than 10 lines (weak instructions) */
  weakInstructions: { id: string; label: string; lineCount: number }[];
  /** Always-loaded steerings with 100+ lines (context window risk) */
  contextOverload: { id: string; label: string; lineCount: number }[];
  /** Total lines of all always-loaded steerings */
  totalAlwaysLines: number;
  /** Hooks with no reference to any steering (access without instruction) */
  hooksWithoutInstruction: { id: string; label: string }[];
  /** Non-always steerings not referenced by any hook (instruction without access) */
  steeringsWithoutAccess: { id: string; label: string; inclusion: string }[];
  /** Actionable recommendations */
  sugestoes: string[];

  // ─── New cognitive assertiveness validations ───

  /** Isolated cycles with no external entry */
  deadLoops: DeadLoop[];
  /** Steerings far from entry points (>= 4 hops) */
  hopsToReach: HopAlert[];
  /** Pairs of steerings with redundant keywords */
  duplicateIntent: DuplicatePair[];
  /** Steerings without imperative verbs (< 10% actionable) */
  passiveKnowledge: PassiveNode[];
  /** Steerings with low actionable proportion (10-20%) */
  signalToNoise: SignalNoiseAlert[];
  /** Contradictions between always-loaded steerings */
  contradictions: Contradiction[];
  /** IDE event coverage map */
  hookCoverageMap: HookCoverageMap;
  /** Incomplete decision chains */
  decisionPathCompleteness: DecisionPathResult;
  /** Quality gate maturity assessment */
  qualityGate: QualityGateResult;
  /** DML protection maturity assessment */
  dmlProtection: DmlProtectionResult;

  /** Broken external links (external nodes with resolved: false) */
  brokenExternalLinks?: { id: string; label: string; targetPath: string }[];

  /** Cross-workspace topology status */
  crossWorkspaceTopology?: {
    workspace: string;
    source: NodeSource;
    totalNodes: number;
    resolvedNodes: number;
    unresolvedNodes: number;
    status: 'connected' | 'partially-connected';
  }[];

  /** Unified health score computed from all cognitive rules */
  healthScore?: UnifiedHealthScore;

  /** Steerings flagged as stale content with high connectivity (Rule 20) */
  staleContent?: StaleContentAlert[];

  /** Suggested connections between steerings with keyword overlap (Link Recommender) */
  suggestedConnections?: LinkSuggestion[];

  /** Steerings with section headers mismatched to their NodeType domain (Rule 21) */
  semanticCoherence?: SemanticCoherenceAlert[];

  /** Circular dependencies between hooks and steerings (Rule 22) */
  circularHookDependencies?: CircularHookDependency[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Link Recommender Types
// ─────────────────────────────────────────────────────────────────────────────

/** A suggested connection between two steerings with keyword overlap */
export interface LinkSuggestion {
  /** First steering of the pair */
  nodeA: { id: string; label: string };
  /** Second steering of the pair */
  nodeB: { id: string; label: string };
  /** Similarity score percentage (0-100) */
  similarityScore: number;
  /** Keywords shared between both steerings */
  sharedKeywords: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Stale Content Detection Types
// ─────────────────────────────────────────────────────────────────────────────

/** A steering flagged as stale content with high connectivity */
export interface StaleContentAlert {
  /** Node ID (relative path) */
  id: string;
  /** Display label */
  label: string;
  /** Days since last modification */
  stalenessDays: number;
  /** Total connections (incoming + outgoing) */
  degree: number;
  /** Risk score: stalenessDays × degree */
  riskScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Coherence Types
// ─────────────────────────────────────────────────────────────────────────────

/** A steering flagged for semantic incoherence (section headers don't match NodeType domain) */
export interface SemanticCoherenceAlert {
  /** Node ID (relative path) */
  id: string;
  /** Display label */
  label: string;
  /** File path of the steering */
  filePath: string;
  /** NodeType classification of the steering */
  nodeType: NodeType;
  /** Proportion of on-topic headers (0.0 - 1.0) */
  coherencePercent: number;
  /** Headers that did not match the expected keyword set */
  offTopicHeaders: string[];
}

/** A detected circular dependency involving hooks and steerings */
export interface CircularHookDependency {
  /** Ordered list of nodes in the cycle */
  nodes: { id: string; label: string; type: string }[];
  /** Number of nodes in the cycle */
  cycleLength: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cognitive Assertiveness Validation Types
// ─────────────────────────────────────────────────────────────────────────────

/** A detected isolated cycle (dead loop) in the graph */
export interface DeadLoop {
  /** Nodes participating in the cycle */
  nodes: { id: string; label: string }[];
  /** Number of nodes in the cycle */
  size: number;
}

/** A steering node that is too far from entry points */
export interface HopAlert {
  /** ID of the distant steering */
  id: string;
  /** Label of the steering */
  label: string;
  /** Number of hops to the nearest entry point */
  hops: number;
}

/** A pair of steerings with redundant keyword overlap */
export interface DuplicatePair {
  /** First steering of the pair */
  nodeA: { id: string; label: string };
  /** Second steering of the pair */
  nodeB: { id: string; label: string };
  /** Overlap percentage (0-100) */
  overlap: number;
}

/** A steering with insufficient imperative content */
export interface PassiveNode {
  /** ID of the passive steering */
  id: string;
  /** Label of the steering */
  label: string;
  /** Percentage of actionable lines found */
  actionablePercent: number;
}

/** A steering with low signal-to-noise ratio */
export interface SignalNoiseAlert {
  /** ID of the steering */
  id: string;
  /** Label of the steering */
  label: string;
  /** Signal ratio percentage (0-100) */
  signalRatio: number;
}

/** A detected contradiction between two steerings */
export interface Contradiction {
  /** First steering */
  nodeA: { id: string; label: string };
  /** Second steering */
  nodeB: { id: string; label: string };
  /** Conflicting snippet from first steering */
  snippetA: string;
  /** Conflicting snippet from second steering */
  snippetB: string;
  /** Conflict type (e.g. "always vs never") */
  conflictType: string;
}

/** Map of IDE event coverage by hooks */
export interface HookCoverageMap {
  /** Events with at least one hook */
  covered: { event: string; hookCount: number }[];
  /** Events with no hooks */
  uncovered: { event: string }[];
}

/** Result of decision path completeness check */
export interface DecisionPathResult {
  /** Hooks with no steering reference */
  hooksWithoutDecisionSteering: { id: string; label: string; gap: string }[];
  /** Decision steerings without hook trigger */
  steeringsWithoutHook: { id: string; label: string; gap: string }[];
}

/** Quality gate maturity assessment result */
export interface QualityGateResult {
  /** Maturity level: 0=No Gate, 1=Partial, 2=Complete */
  maturityLevel: 0 | 1 | 2;
  /** Self-review hooks found */
  selfReviewHooks: { id: string; label: string }[];
  /** Quality gate steerings found */
  qualitySteerings: { id: string; label: string }[];
  /** Post-task hooks referencing quality steerings */
  postTaskReviewHooks: { id: string; label: string }[];
  /** What is missing to reach level 2 */
  missing: {
    needsSelfReview: boolean;
    needsQualitySteering: boolean;
    needsPostTaskReview: boolean;
  };
}

/** DML protection maturity assessment result */
export interface DmlProtectionResult {
  /** Maturity level: 0=No Protection, 1=Blind Block, 2=Smart Protection */
  maturityLevel: 0 | 1 | 2;
  /** preToolUse hooks with DML keywords */
  dmlHooks: { id: string; label: string }[];
  /** Steerings with database rules */
  dmlSteerings: { id: string; label: string }[];
  /** Steerings with risk assessment criteria */
  riskSteerings: { id: string; label: string }[];
  /** Hooks referencing risk-assessment steerings */
  hooksWithRiskSteering: { id: string; label: string }[];
  /** What is missing to reach level 2 */
  missing: {
    needsDmlHook: boolean;
    needsDmlSteering: boolean;
    needsRiskIntegration: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Fix Types
// ─────────────────────────────────────────────────────────────────────────────

/** Categorias de issues cognitivas — correspondem às 19 regras */
export type IssueCategory =
  | 'orphan-steerings'
  | 'fragile-links'
  | 'isolated-files'
  | 'coverage-gaps'
  | 'weak-instructions'
  | 'context-overload'
  | 'large-domain-steerings'
  | 'hooks-without-instruction'
  | 'steerings-without-access'
  | 'dead-loops'
  | 'hops-to-reach'
  | 'duplicate-intent'
  | 'passive-knowledge'
  | 'signal-to-noise'
  | 'contradictions'
  | 'hook-coverage'
  | 'decision-path'
  | 'quality-gate'
  | 'dml-protection';

/** Dados genéricos de uma issue para geração de prompt */
export interface FixIssueData {
  /** IDs/paths dos nós afetados */
  ids: string[];
  /** Labels dos nós afetados */
  labels: string[];
  /** Dados extras dependendo da categoria */
  extra?: Record<string, string | number | string[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Score
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unified health score computed from all cognitive analysis rules.
 * Each sub-score represents a category (0-100), and the total score
 * is a weighted combination: connectivity×0.3 + contentQuality×0.25 + completeness×0.25 + maturity×0.2.
 */
export interface UnifiedHealthScore {
  /** Overall health score (0-100, integer) */
  score: number;
  /** Connectivity sub-score: proportion of nodes without structural issues (0-100) */
  connectivity: number;
  /** Content quality sub-score: proportion of nodes without content issues (0-100) */
  contentQuality: number;
  /** Completeness sub-score: proportion of nodes without completeness issues (0-100) */
  completeness: number;
  /** Maturity sub-score: based on quality gate, DML protection, hook coverage, decision path (0-100) */
  maturity: number;
}

/**
 * Trend indicator comparing the current health score with the previous snapshot.
 */
export interface ScoreTrend {
  /** Direction of change relative to previous snapshot */
  direction: 'up' | 'down' | 'neutral';
  /** Absolute difference between current and previous score */
  delta: number;
  /** Score from the previous snapshot used for comparison */
  previousScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ecosystem Maturity (Onboarding Wizard)
// ─────────────────────────────────────────────────────────────────────────────

/** Ecosystem maturity phase (1-5) */
export type EcosystemPhaseNumber = 1 | 2 | 3 | 4 | 5;

/** Phase detection result */
export interface EcosystemPhaseResult {
  /** Current phase number */
  phase: EcosystemPhaseNumber;
  /** Phase display name */
  phaseName: string;
  /** Progress within current phase (0-100) */
  progressPercent: number;
  /** Criteria met for current phase */
  criteriaMet: string[];
  /** Criteria remaining for next phase */
  criteriaRemaining: string[];
}

/** Next step suggestion */
export interface NextStepSuggestion {
  /** Suggested file name */
  fileName: string;
  /** File type */
  fileType: 'steering' | 'hook';
  /** Brief description */
  description: string;
  /** Template key for creation */
  templateKey: string;
  /** Target directory */
  targetDir: string;
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
  | { type: 'exportImageError'; error: string }
  | { type: 'exportCognitiveAnalysis'; data: CognitiveAnalysisResult | null }
  // ─── Auto-Fix messages ───
  | { type: 'fixIssue'; category: IssueCategory; issue: FixIssueData }
  | { type: 'fixAllCategory'; category: IssueCategory; issues: FixIssueData[] }
  // ─── Onboarding Wizard messages ───
  | { type: 'createFromTemplate'; templateKey: string; fileName: string; targetDir: string };

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
  /** Unified health score at the time of snapshot (0-100) */
  healthScore?: number;
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
