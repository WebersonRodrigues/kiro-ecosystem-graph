/**
 * Cognitive Validations — Testable TypeScript module mirroring the webview logic.
 *
 * These functions implement the same algorithms used in cognitive-panel.js
 * but in a Node.js-testable form. They operate on graph data structures
 * (nodes, edges, metadata) and produce validation results.
 */

import type {
  GraphNode,
  GraphEdge,
  NodeType,
  DeadLoop,
  HopAlert,
  DuplicatePair,
  PassiveNode,
  SignalNoiseAlert,
  Contradiction,
  HookCoverageMap,
  QualityGateResult,
  DmlProtectionResult,
  StaleContentAlert,
  LinkSuggestion,
  SemanticCoherenceAlert,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Dead Loops
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects isolated cycles (dead loops) in the graph.
 * A dead loop is a strongly connected component with no incoming edges
 * from outside the component.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @returns Array of detected dead loops
 */
export function detectDeadLoops(nodes: GraphNode[], edges: GraphEdge[]): DeadLoop[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();
  const reverseAdj = new Map<string, string[]>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
    reverseAdj.set(id, []);
  }

  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      adjacency.get(edge.source)!.push(edge.target);
      reverseAdj.get(edge.target)!.push(edge.source);
    }
  }

  // Kosaraju's algorithm for SCCs
  const visited = new Set<string>();
  const order: string[] = [];

  function dfs1(node: string): void {
    visited.add(node);
    for (const neighbor of adjacency.get(node) || []) {
      if (!visited.has(neighbor)) {
        dfs1(neighbor);
      }
    }
    order.push(node);
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) {
      dfs1(id);
    }
  }

  const componentMap = new Map<string, number>();
  const components: string[][] = [];
  let componentIdx = 0;

  function dfs2(node: string, idx: number): void {
    componentMap.set(node, idx);
    components[idx].push(node);
    for (const neighbor of reverseAdj.get(node) || []) {
      if (!componentMap.has(neighbor)) {
        dfs2(neighbor, idx);
      }
    }
  }

  for (let i = order.length - 1; i >= 0; i--) {
    const node = order[i];
    if (!componentMap.has(node)) {
      components.push([]);
      dfs2(node, componentIdx);
      componentIdx++;
    }
  }

  // Filter: SCCs with size > 1 that have no external incoming edges
  const deadLoops: DeadLoop[] = [];

  for (const component of components) {
    if (component.length <= 1) { continue; }

    const componentSet = new Set(component);
    let hasExternalEntry = false;

    for (const nodeId of component) {
      for (const source of reverseAdj.get(nodeId) || []) {
        if (!componentSet.has(source)) {
          hasExternalEntry = true;
          break;
        }
      }
      if (hasExternalEntry) { break; }
    }

    if (!hasExternalEntry) {
      const loopNodes = component.map((id) => {
        const node = nodes.find((n) => n.id === id);
        return { id, label: node?.label || id };
      });
      deadLoops.push({ nodes: loopNodes, size: component.length });
    }
  }

  return deadLoops;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hops to Reach
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the minimum hops from any entry point to each node.
 * Entry points are nodes with metadata.inclusion === 'always' or type 'hook-*'.
 * Returns nodes that are >= threshold hops away.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @param threshold - Minimum hops to flag (default 4)
 * @returns Array of hop alerts for distant nodes
 */
export function computeHopsToReach(
  nodes: GraphNode[],
  edges: GraphEdge[],
  threshold: number = 4,
): HopAlert[] {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      adjacency.get(edge.source)!.push(edge.target);
    }
  }

  // Entry points: always-loaded steerings and hooks
  const entryPoints = nodes.filter((n) =>
    n.metadata?.inclusion === 'always' ||
    n.type === 'hook-manual' ||
    n.type === 'hook-auto',
  );

  // BFS from all entry points simultaneously
  const distances = new Map<string, number>();
  const queue: { id: string; dist: number }[] = [];

  for (const entry of entryPoints) {
    distances.set(entry.id, 0);
    queue.push({ id: entry.id, dist: 0 });
  }

  let head = 0;
  while (head < queue.length) {
    const { id, dist } = queue[head++];
    for (const neighbor of adjacency.get(id) || []) {
      if (!distances.has(neighbor)) {
        distances.set(neighbor, dist + 1);
        queue.push({ id: neighbor, dist: dist + 1 });
      }
    }
  }

  // Find nodes that are >= threshold or unreachable
  const alerts: HopAlert[] = [];
  for (const node of nodes) {
    // Skip entry points themselves
    if (entryPoints.some((e) => e.id === node.id)) { continue; }

    const dist = distances.get(node.id);
    if (dist === undefined) {
      alerts.push({ id: node.id, label: node.label, hops: 999 });
    } else if (dist >= threshold) {
      alerts.push({ id: node.id, label: node.label, hops: dist });
    }
  }

  return alerts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate Intent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes keyword overlap percentage between two keyword sets.
 * Uses Jaccard-like metric: intersection / min(setA, setB) * 100.
 *
 * @param keywordsA - Keywords from first steering
 * @param keywordsB - Keywords from second steering
 * @returns Overlap percentage (0-100)
 */
export function computeKeywordOverlap(keywordsA: string[], keywordsB: string[]): number {
  if (keywordsA.length === 0 || keywordsB.length === 0) { return 0; }

  const setA = new Set(keywordsA);
  const setB = new Set(keywordsB);

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) { intersection++; }
  }

  const minSize = Math.min(setA.size, setB.size);
  if (minSize === 0) { return 0; }

  return Math.round((intersection / minSize) * 100);
}

/**
 * Detects pairs of always-loaded steerings with >60% keyword overlap.
 *
 * @param nodes - All graph nodes (filters to always-loaded steerings)
 * @param overlapThreshold - Minimum overlap to flag (default 60)
 * @returns Array of duplicate intent pairs
 */
export function detectDuplicateIntent(
  nodes: GraphNode[],
  overlapThreshold: number = 60,
): DuplicatePair[] {
  const alwaysNodes = nodes.filter(
    (n) => n.metadata?.inclusion === 'always' && n.metadata?.keywords,
  );

  const pairs: DuplicatePair[] = [];

  for (let i = 0; i < alwaysNodes.length; i++) {
    for (let j = i + 1; j < alwaysNodes.length; j++) {
      const a = alwaysNodes[i];
      const b = alwaysNodes[j];
      const overlap = computeKeywordOverlap(
        a.metadata!.keywords!,
        b.metadata!.keywords!,
      );

      if (overlap >= overlapThreshold) {
        pairs.push({
          nodeA: { id: a.id, label: a.label },
          nodeB: { id: b.id, label: b.label },
          overlap,
        });
      }
    }
  }

  return pairs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Passive Knowledge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects steerings with actionable ratio below threshold.
 *
 * @param nodes - All graph nodes
 * @param threshold - Maximum ratio to flag as passive (default 0.10)
 * @returns Array of passive nodes
 */
export function detectPassiveKnowledge(
  nodes: GraphNode[],
  threshold: number = 0.10,
): PassiveNode[] {
  const results: PassiveNode[] = [];

  for (const node of nodes) {
    if (node.metadata?.actionableRatio === undefined) { continue; }
    if (node.metadata.actionableRatio < threshold) {
      results.push({
        id: node.id,
        label: node.label,
        actionablePercent: Math.round(node.metadata.actionableRatio * 100),
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal-to-Noise
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects steerings with actionable ratio in the 10-20% range (low signal).
 *
 * @param nodes - All graph nodes
 * @param lowerBound - Lower bound of signal range (default 0.10)
 * @param upperBound - Upper bound of signal range (default 0.20)
 * @returns Array of signal-to-noise alerts
 */
export function detectSignalToNoise(
  nodes: GraphNode[],
  lowerBound: number = 0.10,
  upperBound: number = 0.20,
): SignalNoiseAlert[] {
  const results: SignalNoiseAlert[] = [];

  for (const node of nodes) {
    if (node.metadata?.actionableRatio === undefined) { continue; }
    const ratio = node.metadata.actionableRatio;
    if (ratio >= lowerBound && ratio < upperBound) {
      results.push({
        id: node.id,
        label: node.label,
        signalRatio: Math.round(ratio * 100),
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contradictions
// ─────────────────────────────────────────────────────────────────────────────

/** Opposite pattern pairs for contradiction detection */
const OPPOSITE_PAIRS: [string, string][] = [
  ['always', 'never'],
  ['use', 'avoid'],
  ['must', 'do_not'],
  ['prefer', 'avoid'],
];

/**
 * Detects contradictions between always-loaded steerings.
 * Looks for opposite imperative patterns targeting the same subject.
 *
 * @param nodes - All graph nodes (filters to always-loaded steerings with imperativeLines)
 * @returns Array of detected contradictions
 */
export function detectContradictions(nodes: GraphNode[]): Contradiction[] {
  const alwaysNodes = nodes.filter(
    (n) => n.metadata?.inclusion === 'always' && n.metadata?.imperativeLines,
  );

  const contradictions: Contradiction[] = [];

  for (let i = 0; i < alwaysNodes.length; i++) {
    for (let j = i + 1; j < alwaysNodes.length; j++) {
      const a = alwaysNodes[i];
      const b = alwaysNodes[j];
      const linesA = a.metadata!.imperativeLines!;
      const linesB = b.metadata!.imperativeLines!;

      for (const lineA of linesA) {
        for (const lineB of linesB) {
          if (lineA.subject !== lineB.subject) { continue; }

          for (const [patA, patB] of OPPOSITE_PAIRS) {
            if (
              (lineA.pattern === patA && lineB.pattern === patB) ||
              (lineA.pattern === patB && lineB.pattern === patA)
            ) {
              contradictions.push({
                nodeA: { id: a.id, label: a.label },
                nodeB: { id: b.id, label: b.label },
                snippetA: lineA.text,
                snippetB: lineB.text,
                conflictType: `${lineA.pattern} vs ${lineB.pattern}`,
              });
            }
          }
        }
      }
    }
  }

  return contradictions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Coverage
// ─────────────────────────────────────────────────────────────────────────────

/** All IDE events that can be covered by hooks */
const ALL_HOOK_EVENTS = [
  'fileEdited',
  'fileCreated',
  'fileDeleted',
  'userTriggered',
  'promptSubmit',
  'agentStop',
  'preToolUse',
  'postToolUse',
  'preTaskExecution',
  'postTaskExecution',
];

/**
 * Computes hook coverage map — which IDE events have hooks and which don't.
 *
 * @param nodes - All graph nodes (filters to hook nodes)
 * @returns Hook coverage map with covered and uncovered events
 */
export function computeHookCoverage(nodes: GraphNode[]): HookCoverageMap {
  const hookNodes = nodes.filter(
    (n) => n.type === 'hook-manual' || n.type === 'hook-auto',
  );

  const eventCounts = new Map<string, number>();

  for (const hook of hookNodes) {
    const whenType = hook.metadata?.whenType;
    if (whenType) {
      eventCounts.set(whenType, (eventCounts.get(whenType) || 0) + 1);
    }
  }

  const covered: { event: string; hookCount: number }[] = [];
  const uncovered: { event: string }[] = [];

  for (const event of ALL_HOOK_EVENTS) {
    const count = eventCounts.get(event);
    if (count && count > 0) {
      covered.push({ event, hookCount: count });
    } else {
      uncovered.push({ event });
    }
  }

  return { covered, uncovered };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quality Gate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes quality gate maturity level.
 * Level 0: No gate (missing all components)
 * Level 1: Partial (has some but not all)
 * Level 2: Complete (has self-review hook + quality steering + post-task review)
 *
 * @param hasSelfReview - Whether a self-review hook exists
 * @param hasQualitySteering - Whether a quality steering exists
 * @param hasPostTaskReview - Whether a post-task review hook exists
 * @returns Maturity level 0, 1, or 2
 */
export function computeQualityGateLevel(
  hasSelfReview: boolean,
  hasQualitySteering: boolean,
  hasPostTaskReview: boolean,
): 0 | 1 | 2 {
  const components = [hasSelfReview, hasQualitySteering, hasPostTaskReview];
  const presentCount = components.filter(Boolean).length;

  if (presentCount === 3) { return 2; }
  if (presentCount > 0) { return 1; }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// DML Protection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes DML protection maturity level.
 * Level 0: No protection (no DML hook)
 * Level 1: Blind block (has hook + steering but no risk integration)
 * Level 2: Smart protection (has hook + steering + risk integration)
 *
 * @param hasDmlHook - Whether a DML preToolUse hook exists
 * @param hasDmlSteering - Whether a DML steering exists
 * @param hasRiskIntegration - Whether the hook references a risk-assessment steering
 * @returns Maturity level 0, 1, or 2
 */
export function computeDmlProtectionLevel(
  hasDmlHook: boolean,
  hasDmlSteering: boolean,
  hasRiskIntegration: boolean,
): 0 | 1 | 2 {
  if (hasDmlHook && hasDmlSteering && hasRiskIntegration) { return 2; }
  if (hasDmlHook && hasDmlSteering) { return 1; }
  if (hasDmlHook || hasDmlSteering) { return 1; }
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Overload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes context overload: steerings that are always-loaded with too many lines.
 * Excludes steerings with inclusion 'fileMatch' or 'manual' since they are not
 * always-loaded into the context window.
 *
 * @param nodes - All graph nodes
 * @param threshold - Line count threshold to flag (default 350)
 * @returns Object with overloaded steerings and total always-loaded lines
 */
export function computeContextOverload(
  nodes: GraphNode[],
  threshold: number = 350,
  domainThreshold: number = 1000,
): {
  overloaded: Array<{ id: string; label: string; lineCount: number }>;
  largeDomainSteerings: Array<{ id: string; label: string; lineCount: number }>;
  totalAlwaysLines: number;
} {
  const overloaded: Array<{ id: string; label: string; lineCount: number }> = [];
  const largeDomainSteerings: Array<{ id: string; label: string; lineCount: number }> = [];
  let totalAlwaysLines = 0;

  for (const n of nodes) {
    if (!n.type || !n.type.startsWith('steering-')) { continue; }
    const inclusion = (n.metadata && n.metadata.inclusion) || 'always';
    // SKIP fileMatch/manual — not always-loaded
    if (inclusion === 'fileMatch' || inclusion === 'manual') { continue; }
    const lineCount = (n.metadata && n.metadata.lineCount) || 0;
    if (inclusion === 'always') {
      totalAlwaysLines += lineCount;
      if (lineCount > threshold) {
        overloaded.push({ id: n.id, label: n.label, lineCount });
      }
    } else if (inclusion === 'auto' && lineCount > domainThreshold) {
      largeDomainSteerings.push({ id: n.id, label: n.label, lineCount });
    }
  }

  return { overloaded, largeDomainSteerings, totalAlwaysLines };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orphan Steerings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes orphan steerings: steerings with 0 incoming + 0 outgoing edges.
 * Excludes steerings with inclusion 'fileMatch' or 'manual' since they
 * function independently of cross-references.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @returns Array of orphan steerings
 */
export function computeOrphanSteerings(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Array<{ id: string; label: string }> {
  const incomingMap: Record<string, number> = {};
  const outgoingMap: Record<string, number> = {};
  for (const n of nodes) { incomingMap[n.id] = 0; outgoingMap[n.id] = 0; }
  for (const e of edges) {
    if (outgoingMap[e.source] !== undefined) { outgoingMap[e.source]++; }
    if (incomingMap[e.target] !== undefined) { incomingMap[e.target]++; }
  }

  const orphans: Array<{ id: string; label: string }> = [];
  for (const n of nodes) {
    if (!n.type || !n.type.startsWith('steering-')) { continue; }
    if (n.source && n.source !== 'local' && n.resolved !== false) { continue; }
    const inclusion = (n.metadata && n.metadata.inclusion) || 'always';
    // SKIP fileMatch/manual — don't need cross-references
    if (inclusion === 'fileMatch' || inclusion === 'manual') { continue; }
    if ((incomingMap[n.id] || 0) === 0 && (outgoingMap[n.id] || 0) === 0) {
      orphans.push({ id: n.id, label: n.label });
    }
  }

  return orphans;
}

// ─────────────────────────────────────────────────────────────────────────────
// Isolated Files
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes isolated files: nodes with 0 total edges.
 * Excludes hooks and skills since they are activated by independent mechanisms
 * (IDE events for hooks, keyword matching for skills).
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @returns Array of isolated files
 */
export function computeIsolatedFiles(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Array<{ id: string; label: string; type: string }> {
  const incomingMap: Record<string, number> = {};
  const outgoingMap: Record<string, number> = {};
  for (const n of nodes) { incomingMap[n.id] = 0; outgoingMap[n.id] = 0; }
  for (const e of edges) {
    if (outgoingMap[e.source] !== undefined) { outgoingMap[e.source]++; }
    if (incomingMap[e.target] !== undefined) { incomingMap[e.target]++; }
  }

  const isolated: Array<{ id: string; label: string; type: string }> = [];
  for (const n of nodes) {
    if (n.source && n.source !== 'local' && n.resolved !== false) { continue; }
    // SKIP hooks and skills — activated by independent mechanisms
    if (n.type === 'hook-auto' || n.type === 'hook-manual' || n.type === 'skill') { continue; }
    const totalEdges = (incomingMap[n.id] || 0) + (outgoingMap[n.id] || 0);
    if (totalEdges === 0) {
      isolated.push({ id: n.id, label: n.label, type: n.type || 'unknown' });
    }
  }

  return isolated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Self-Sufficiency
// ─────────────────────────────────────────────────────────────────────────────

/** Regex matching imperative verbs in PT-BR and EN */
const IMPERATIVE_VERBS = /\b(analise|verifique|garanta|implemente|crie|remova|adicione|corrija|valide|reporte|documente|teste|refatore|otimize|configure|monitore|ensure|verify|check|validate|create|remove|add|fix|report|document|test|refactor|optimize|configure|monitor|analyze|review|implement|always|never|must|shall|should)\b/i;

/**
 * Evaluates whether a hook prompt is self-sufficient (contains enough
 * instructional content to guide the AI agent without a steering reference).
 *
 * Criteria:
 * - Content is not null/empty
 * - Contains >= 20 words
 * - Contains at least one imperative verb (PT-BR or EN)
 *
 * @param content - The prompt content to evaluate
 * @returns true if the prompt is self-sufficient
 */
export function isPromptSelfSufficient(content: string | undefined | null): boolean {
  if (!content) { return false; }
  const words = content.trim().split(/\s+/);
  if (words.length < 20) { return false; }
  return IMPERATIVE_VERBS.test(content);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks Without Instruction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes hooks without instruction: hooks that have no steering reference
 * AND no self-sufficient prompt. Uses hookPrompt (from then.prompt) with
 * fallback to description.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @returns Array of hooks without instruction
 */
export function computeHooksWithoutInstruction(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Array<{ id: string; label: string }> {
  const steeringIds = new Set<string>();
  for (const n of nodes) {
    if (n.type && n.type.startsWith('steering-')) { steeringIds.add(n.id); }
  }

  const result: Array<{ id: string; label: string }> = [];
  for (const n of nodes) {
    if (n.type !== 'hook-auto' && n.type !== 'hook-manual') { continue; }

    const hasSteeringRef = edges.some(
      (e) => e.source === n.id && steeringIds.has(e.target),
    );
    if (hasSteeringRef) { continue; }

    // Evaluate prompt sufficiency — use hookPrompt with fallback to description
    const promptContent = (n.metadata && n.metadata.hookPrompt) || (n.metadata && n.metadata.description) || '';
    if (isPromptSelfSufficient(promptContent)) { continue; }

    result.push({ id: n.id, label: n.label });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fragile Links
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes fragile links: backtick-ref edges with weight=1 where the source
 * is an always/auto steering or a hook. Excludes fileMatch/manual sources.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @returns Array of fragile link descriptors
 */
export function computeFragileLinks(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Array<{ source: string; target: string; sourceLabel: string; targetLabel: string }> {
  const nodeMap = new Map<string, GraphNode>();
  for (const n of nodes) { nodeMap.set(n.id, n); }

  const result: Array<{ source: string; target: string; sourceLabel: string; targetLabel: string }> = [];

  for (const edge of edges) {
    if (edge.type !== 'backtick-ref') { continue; }

    const sourceNode = nodeMap.get(edge.source);
    if (sourceNode) {
      const sType = sourceNode.type || '';
      const isHook = sType === 'hook-auto' || sType === 'hook-manual';
      if (!isHook) {
        const inclusion = (sourceNode.metadata && sourceNode.metadata.inclusion) || 'always';
        if (inclusion === 'fileMatch' || inclusion === 'manual') { continue; }
      }
    }

    const targetNode = nodeMap.get(edge.target);
    result.push({
      source: edge.source,
      target: edge.target,
      sourceLabel: sourceNode ? sourceNode.label : edge.source,
      targetLabel: targetNode ? targetNode.label : edge.target,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage Gaps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes coverage gaps: workspace folders with no steering files.
 *
 * @param nodes - All graph nodes
 * @param workspaceFolders - All workspace folder names
 * @returns Array of folders with no steerings
 */
export function computeCoverageGaps(
  nodes: GraphNode[],
  workspaceFolders: string[],
): Array<{ folder: string }> {
  const folderSteeringCount: Record<string, number> = {};
  for (const f of workspaceFolders) { folderSteeringCount[f] = 0; }
  for (const n of nodes) {
    if (n.type && n.type.startsWith('steering-') && n.workspaceFolder) {
      if (folderSteeringCount[n.workspaceFolder] !== undefined) {
        folderSteeringCount[n.workspaceFolder]++;
      }
    }
  }
  const gaps: Array<{ folder: string }> = [];
  for (const f of workspaceFolders) {
    if (folderSteeringCount[f] === 0) { gaps.push({ folder: f }); }
  }
  return gaps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weak Instructions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes weak instructions: steering files with fewer lines than threshold.
 * Skips steerings with lineCount 0 or undefined (no data available).
 *
 * @param nodes - All graph nodes
 * @param threshold - Line count threshold (default 10)
 * @returns Array of weak steerings
 */
export function computeWeakInstructions(
  nodes: GraphNode[],
  threshold: number = 10,
): Array<{ id: string; label: string; lineCount: number }> {
  const weak: Array<{ id: string; label: string; lineCount: number }> = [];
  for (const n of nodes) {
    if (!n.type || !n.type.startsWith('steering-')) { continue; }
    const lineCount = (n.metadata && n.metadata.lineCount) || 0;
    if (lineCount > 0 && lineCount < threshold) {
      weak.push({ id: n.id, label: n.label, lineCount });
    }
  }
  return weak;
}

// ─────────────────────────────────────────────────────────────────────────────
// Steerings Without Access
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes steerings without access: non-always/auto steerings that are not
 * referenced by any hook. These steerings require a hook trigger to be loaded
 * but have no hook pointing to them.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @returns Array of steerings without access
 */
export function computeSteeringsWithoutAccess(
  nodes: GraphNode[],
  edges: GraphEdge[],
): Array<{ id: string; label: string; inclusion: string }> {
  const steeringIds = new Set<string>();
  for (const n of nodes) {
    if (n.type && n.type.startsWith('steering-')) { steeringIds.add(n.id); }
  }

  // Find steerings referenced by hooks
  const steeringsReferencedByHooks = new Set<string>();
  for (const e of edges) {
    const sourceNode = nodes.find((n) => n.id === e.source);
    if (sourceNode && (sourceNode.type === 'hook-auto' || sourceNode.type === 'hook-manual')) {
      if (steeringIds.has(e.target)) {
        steeringsReferencedByHooks.add(e.target);
      }
    }
  }

  const result: Array<{ id: string; label: string; inclusion: string }> = [];
  for (const n of nodes) {
    if (!n.type || !n.type.startsWith('steering-')) { continue; }
    const inclusion = (n.metadata && n.metadata.inclusion) || 'always';
    if (inclusion !== 'always' && inclusion !== 'auto' && !steeringsReferencedByHooks.has(n.id)) {
      result.push({ id: n.id, label: n.label, inclusion });
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision Path
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes decision path completeness: identifies hooks without steering
 * references and decision-keyword steerings without hook triggers.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @returns Object with hooksWithoutSteering and steeringsWithoutHook
 */
export function computeDecisionPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { hooksWithoutSteering: Array<{ id: string; label: string }>; steeringsWithoutHook: Array<{ id: string; label: string }> } {
  const steeringIds = new Set<string>();
  for (const n of nodes) {
    if (n.type && n.type.startsWith('steering-')) { steeringIds.add(n.id); }
  }

  const hookToSteerings: Record<string, string[]> = {};
  const steeringFromHooks = new Set<string>();
  for (const e of edges) {
    const sourceNode = nodes.find((n) => n.id === e.source);
    if (sourceNode && (sourceNode.type === 'hook-auto' || sourceNode.type === 'hook-manual')) {
      if (steeringIds.has(e.target)) {
        if (!hookToSteerings[e.source]) { hookToSteerings[e.source] = []; }
        hookToSteerings[e.source].push(e.target);
        steeringFromHooks.add(e.target);
      }
    }
  }

  const hooksWithoutSteering: Array<{ id: string; label: string }> = [];
  for (const n of nodes) {
    if (n.type !== 'hook-auto' && n.type !== 'hook-manual') { continue; }
    if (!hookToSteerings[n.id] || hookToSteerings[n.id].length === 0) {
      hooksWithoutSteering.push({ id: n.id, label: n.label });
    }
  }

  const DECISION_KEYWORDS = ['decide', 'choose', 'when', 'condition', 'criteria', 'decida', 'escolha', 'quando', 'condição', 'critério'];
  const steeringsWithoutHook: Array<{ id: string; label: string }> = [];
  for (const n of nodes) {
    if (!n.type || !n.type.startsWith('steering-')) { continue; }
    const inclusion = (n.metadata && n.metadata.inclusion) || 'always';
    if (inclusion === 'always' || inclusion === 'auto') { continue; }
    const keywords = (n.metadata && n.metadata.keywords) || [];
    const hasDecision = keywords.some((kw: string) => DECISION_KEYWORDS.includes(kw.toLowerCase()));
    if (hasDecision && !steeringFromHooks.has(n.id)) {
      steeringsWithoutHook.push({ id: n.id, label: n.label });
    }
  }

  return { hooksWithoutSteering, steeringsWithoutHook };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stale Content Detection (Rule 20)
// ─────────────────────────────────────────────────────────────────────────────

/** Options for stale content detection */
export interface StaleContentOptions {
  /** Minimum days without modification to consider stale (default: 90) */
  stalenessThresholdDays?: number;
  /** Minimum connections to consider a hub (default: 3) */
  degreeThreshold?: number;
  /** Current time in ms for deterministic testing (default: Date.now()) */
  currentTimeMs?: number;
}

/**
 * Detects steering nodes that are stale (not modified recently) AND have
 * high connectivity (hub nodes). These represent high-risk outdated content
 * that propagates through many paths.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @param options - Detection thresholds and testing overrides
 * @returns Array of stale content alerts sorted by riskScore descending
 */
export function detectStaleContent(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options?: StaleContentOptions,
): StaleContentAlert[] {
  const stalenessThreshold = options?.stalenessThresholdDays ?? 90;
  const degreeThreshold = options?.degreeThreshold ?? 3;
  const now = options?.currentTimeMs ?? Date.now();

  const degreeMap = buildDegreeMap(nodes, edges);
  const alerts: StaleContentAlert[] = [];

  for (const node of nodes) {
    if (!isSteeringNode(node)) { continue; }
    if (node.metadata?.mtime == null) { continue; }

    const stalenessDays = computeStalenessDays(node.metadata.mtime, now);
    const degree = degreeMap.get(node.id) || 0;

    if (!passesThreshold(stalenessDays, stalenessThreshold, degree, degreeThreshold)) {
      continue;
    }

    alerts.push({
      id: node.id,
      label: node.label,
      stalenessDays,
      degree,
      riskScore: stalenessDays * degree,
    });
  }

  return alerts.sort((a, b) => b.riskScore - a.riskScore);
}

function isSteeringNode(node: GraphNode): boolean {
  return !!node.type && node.type.startsWith('steering-');
}

function computeStalenessDays(mtime: number, now: number): number {
  return Math.floor((now - mtime) / (1000 * 60 * 60 * 24));
}

function buildDegreeMap(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const n of nodes) { map.set(n.id, 0); }
  for (const e of edges) {
    if (map.has(e.source)) { map.set(e.source, (map.get(e.source) || 0) + 1); }
    if (map.has(e.target)) { map.set(e.target, (map.get(e.target) || 0) + 1); }
  }
  return map;
}

function passesThreshold(
  stalenessDays: number,
  stalenessThreshold: number,
  degree: number,
  degreeThreshold: number,
): boolean {
  const passesStale = stalenessThreshold <= 0 || stalenessDays >= stalenessThreshold;
  const passesDegree = degreeThreshold <= 0 || degree >= degreeThreshold;
  return passesStale && passesDegree;
}

// ─────────────────────────────────────────────────────────────────────────────
// Link Recommender (Suggested Connections)
// ─────────────────────────────────────────────────────────────────────────────

/** Options for link suggestion computation */
export interface LinkRecommenderOptions {
  /** Minimum overlap percentage to suggest (default: 30) */
  overlapThreshold?: number;
  /** Maximum number of suggestions to return (default: 10) */
  maxRecommendations?: number;
}

/**
 * Computes link suggestions between steering nodes that share keywords
 * but have no direct edge. Excludes pairs already flagged by Duplicate Intent.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @param duplicateIntentPairs - Pairs already flagged by Duplicate Intent
 * @param options - Threshold and limit options
 * @returns Array of link suggestions sorted by similarityScore descending
 */
export function computeLinkSuggestions(
  nodes: GraphNode[],
  edges: GraphEdge[],
  duplicateIntentPairs?: DuplicatePair[],
  options?: LinkRecommenderOptions,
): LinkSuggestion[] {
  const threshold = options?.overlapThreshold ?? 30;
  const maxResults = options?.maxRecommendations ?? 10;

  const steeringNodes = filterSteeringWithKeywords(nodes);
  const connectedSet = buildConnectedPairSet(edges);
  const duplicateSet = buildDuplicateSet(duplicateIntentPairs);

  const candidates = collectCandidates(
    steeringNodes, connectedSet, duplicateSet, threshold,
  );

  return candidates
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, maxResults);
}

function filterSteeringWithKeywords(nodes: GraphNode[]): GraphNode[] {
  return nodes.filter(
    (n) => n.type && n.type.startsWith('steering-') &&
      n.metadata?.keywords && n.metadata.keywords.length > 0,
  );
}

function buildConnectedPairSet(edges: GraphEdge[]): Set<string> {
  const set = new Set<string>();
  for (const edge of edges) {
    set.add(`${edge.source}|||${edge.target}`);
    set.add(`${edge.target}|||${edge.source}`);
  }
  return set;
}

function buildDuplicateSet(pairs?: DuplicatePair[]): Set<string> {
  const set = new Set<string>();
  if (!pairs) { return set; }
  for (const pair of pairs) {
    set.add(`${pair.nodeA.id}|||${pair.nodeB.id}`);
    set.add(`${pair.nodeB.id}|||${pair.nodeA.id}`);
  }
  return set;
}

function collectCandidates(
  steeringNodes: GraphNode[],
  connectedSet: Set<string>,
  duplicateSet: Set<string>,
  threshold: number,
): LinkSuggestion[] {
  const candidates: LinkSuggestion[] = [];

  for (let i = 0; i < steeringNodes.length; i++) {
    for (let j = i + 1; j < steeringNodes.length; j++) {
      const a = steeringNodes[i];
      const b = steeringNodes[j];

      if (connectedSet.has(`${a.id}|||${b.id}`)) { continue; }
      if (duplicateSet.has(`${a.id}|||${b.id}`)) { continue; }

      const suggestion = evaluatePair(a, b, threshold);
      if (suggestion) { candidates.push(suggestion); }
    }
  }

  return candidates;
}

function evaluatePair(
  a: GraphNode,
  b: GraphNode,
  threshold: number,
): LinkSuggestion | null {
  const keywordsA = a.metadata!.keywords!;
  const keywordsB = b.metadata!.keywords!;
  const overlap = computeKeywordOverlap(keywordsA, keywordsB);

  if (overlap < threshold || overlap >= 60) { return null; }

  const shared = computeSharedKeywords(keywordsA, keywordsB);

  return {
    nodeA: { id: a.id, label: a.label },
    nodeB: { id: b.id, label: b.label },
    similarityScore: overlap,
    sharedKeywords: shared,
  };
}

function computeSharedKeywords(keywordsA: string[], keywordsB: string[]): string[] {
  const setB = new Set(keywordsB);
  return keywordsA.filter((kw) => setB.has(kw));
}

// ─────────────────────────────────────────────────────────────────────────────
// Semantic Coherence (Rule 21)
// ─────────────────────────────────────────────────────────────────────────────

/** Keyword sets mapping each steering NodeType to expected domain terms */
export const KEYWORD_SETS: Partial<Record<NodeType, string[]>> = {
  'steering-policy': ['security', 'auth', 'permission', 'access', 'compliance', 'governance', 'guard', 'policy', 'rule', 'restrict', 'allow', 'deny', 'segurança', 'permissão', 'acesso', 'política', 'regra'],
  'steering-tech': ['deploy', 'pipeline', 'infrastructure', 'architecture', 'stack', 'database', 'migration', 'ci', 'cd', 'docker', 'kubernetes', 'api', 'endpoint', 'server', 'tecnologia', 'arquitetura', 'infraestrutura'],
  'steering-flow': ['flow', 'step', 'sequence', 'process', 'workflow', 'trigger', 'action', 'state', 'transition', 'fluxo', 'etapa', 'processo', 'sequência'],
  'steering-domain': ['domain', 'entity', 'model', 'business', 'rule', 'logic', 'convention', 'pattern', 'domínio', 'entidade', 'modelo', 'negócio', 'regra', 'convenção', 'padrão'],
  'steering-product': ['product', 'feature', 'user', 'story', 'requirement', 'backlog', 'sprint', 'roadmap', 'produto', 'funcionalidade', 'usuário', 'requisito'],
  'steering-agent': ['agent', 'persona', 'prompt', 'llm', 'ai', 'behavior', 'instruction', 'context', 'agente', 'comportamento', 'instrução', 'contexto'],
  'steering-help': ['help', 'faq', 'question', 'answer', 'guide', 'tutorial', 'howto', 'ajuda', 'pergunta', 'resposta', 'guia'],
  'steering-playbook': ['playbook', 'runbook', 'incident', 'procedure', 'checklist', 'step', 'recovery', 'procedimento', 'incidente', 'recuperação'],
  'steering-observability': ['observability', 'monitoring', 'logging', 'tracing', 'alert', 'metric', 'dashboard', 'sla', 'observabilidade', 'monitoramento', 'alerta', 'métrica'],
};

/**
 * Computes semantic coherence alerts for steering nodes whose section headers
 * don't match the expected domain keywords for their NodeType.
 *
 * @param nodes - All graph nodes
 * @returns Array of alerts for steerings with coherence < 0.70
 */
export function computeSemanticCoherence(nodes: GraphNode[]): SemanticCoherenceAlert[] {
  const steeringNodes = filterSemanticCandidates(nodes);
  const alerts: SemanticCoherenceAlert[] = [];

  for (const node of steeringNodes) {
    const alert = evaluateNodeCoherence(node);
    if (alert) { alerts.push(alert); }
  }

  return alerts;
}

function filterSemanticCandidates(nodes: GraphNode[]): GraphNode[] {
  return nodes.filter((n) => {
    if (!n.type || !n.type.startsWith('steering-')) { return false; }
    if (n.type === 'unknown') { return false; }
    return KEYWORD_SETS[n.type] !== undefined;
  });
}

function evaluateNodeCoherence(node: GraphNode): SemanticCoherenceAlert | null {
  const headers = node.metadata?.sectionHeaders;
  if (!headers || headers.length === 0) { return null; }

  const keywordSet = KEYWORD_SETS[node.type]!;
  const offTopicHeaders: string[] = [];

  for (const header of headers) {
    if (!isHeaderOnTopic(header, keywordSet)) {
      offTopicHeaders.push(header);
    }
  }

  const onTopicCount = headers.length - offTopicHeaders.length;
  const coherence = onTopicCount / headers.length;

  if (coherence >= 0.70) { return null; }

  return {
    id: node.id,
    label: node.label,
    filePath: node.filePath,
    nodeType: node.type,
    coherencePercent: coherence,
    offTopicHeaders,
  };
}

/**
 * Tokenizes a header and checks if at least one token matches the keyword set.
 */
export function isHeaderOnTopic(header: string, keywordSet: string[]): boolean {
  const tokens = tokenizeHeader(header);
  return tokens.some((token) => keywordSet.includes(token));
}

/**
 * Tokenizes a header: lowercase, split by non-alphanumeric characters.
 */
export function tokenizeHeader(header: string): string[] {
  return header.toLowerCase().split(/[^a-záàâãéèêíïóôõöúçñü]+/).filter((t) => t.length > 0);
}
