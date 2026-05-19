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
  StaleContentAlert,
  LinkSuggestion,
  SemanticCoherenceAlert,
  CircularHookDependency,
  GuardrailRiskCategory,
  GuardrailCategoryResult,
  GuardrailSuggestion,
  GuardrailCoverageResult,
  InstructionSpecificityAlert,
  InstructionSpecificityResult,
  ContextBudgetResult,
  ContextBudgetSteeringEntry,
  JailbreakProtectionResult,
  PriorityStatement,
  ConflictResolutionResult,
  IncompleteLoopEntry,
  FeedbackLoopResult,
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

/** Bilingual risk keywords for inline risk criteria detection */
export const INLINE_RISK_KEYWORDS: readonly string[] = [
  'risco', 'risk', 'critico', 'critical', 'alto', 'high',
  'medio', 'medium', 'baixo', 'low', 'recusar', 'refuse',
  'sem where', 'without where', 'count', 'tabela critica',
  'critical table',
];

/**
 * Checks whether a hook node contains inline risk criteria in its prompt
 * or description. Returns true when 3+ keywords from INLINE_RISK_KEYWORDS
 * are found in the concatenated lowercased hookPrompt + description.
 *
 * @param hookNode - The graph node to evaluate
 * @returns true if the node has 3+ inline risk keywords
 */
export function hasInlineRiskCriteria(hookNode: GraphNode): boolean {
  const prompt = (hookNode.metadata?.hookPrompt || '').toLowerCase();
  const desc = (hookNode.metadata?.description || '').toLowerCase();
  const text = prompt + ' ' + desc;
  let matchCount = 0;
  for (const kw of INLINE_RISK_KEYWORDS) {
    if (text.includes(kw)) {
      matchCount++;
      if (matchCount >= 3) { return true; }
    }
  }
  return false;
}

/**
 * Computes DML protection maturity level.
 * Level 0: No protection (no DML hook)
 * Level 1: Blind block (has hook + steering but no risk integration)
 * Level 2: Smart protection (has hook + steering + risk integration OR inline risk)
 *
 * @param hasDmlHook - Whether a DML preToolUse hook exists
 * @param hasDmlSteering - Whether a DML steering exists
 * @param hasRiskIntegration - Whether the hook references a risk-assessment steering
 * @param hasInlineRisk - Whether the hook contains inline risk criteria (3+ keywords)
 * @returns Maturity level 0, 1, or 2
 */
export function computeDmlProtectionLevel(
  hasDmlHook: boolean,
  hasDmlSteering: boolean,
  hasRiskIntegration: boolean,
  hasInlineRisk?: boolean,
): 0 | 1 | 2 {
  if (hasDmlHook && (hasRiskIntegration || hasInlineRisk)) { return 2; }
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

/** Universal cross-cutting keywords valid for ANY steering type */
export const UNIVERSAL_KEYWORDS: string[] = [
  // EN
  'troubleshooting', 'setup', 'configuration', 'examples', 'references',
  'overview', 'summary', 'getting', 'started', 'prerequisites', 'faq', 'tips',
  // PT-BR
  'armadilhas', 'configuração', 'exemplos', 'referências', 'visão', 'geral',
  'pré', 'requisitos', 'dicas', 'atalhos', 'erros', 'comuns', 'diagnóstico',
];

/** Keyword sets mapping each steering NodeType to expected domain terms */
export const KEYWORD_SETS: Partial<Record<NodeType, string[]>> = {
  'steering-policy': ['security', 'auth', 'permission', 'access', 'compliance', 'governance', 'guard', 'policy', 'rule', 'restrict', 'allow', 'deny', 'segurança', 'permissão', 'acesso', 'política', 'regra', 'autorização', 'proteção', 'controle'],
  'steering-tech': ['deploy', 'pipeline', 'infrastructure', 'architecture', 'stack', 'database', 'migration', 'ci', 'cd', 'docker', 'kubernetes', 'api', 'endpoint', 'server', 'tecnologia', 'arquitetura', 'infraestrutura', 'ambientes', 'acesso', 'tunnel', 'cluster', 'environment', 'ssh', 'network', 'servidor', 'banco', 'rota', 'camada'],
  'steering-flow': ['flow', 'step', 'sequence', 'process', 'workflow', 'trigger', 'action', 'state', 'transition', 'fluxo', 'etapa', 'processo', 'sequência', 'automação', 'gatilho', 'ação', 'estado'],
  'steering-domain': ['domain', 'entity', 'model', 'business', 'rule', 'logic', 'convention', 'pattern', 'domínio', 'entidade', 'modelo', 'negócio', 'regra', 'convenção', 'padrão', 'stack', 'estrutura', 'endpoints', 'troubleshooting', 'armadilhas', 'configuração', 'banco', 'webhooks', 'camadas', 'fluxo'],
  'steering-product': ['product', 'feature', 'user', 'story', 'requirement', 'backlog', 'sprint', 'roadmap', 'produto', 'funcionalidade', 'usuário', 'requisito', 'entrega', 'prioridade', 'escopo'],
  'steering-agent': ['agent', 'persona', 'prompt', 'llm', 'ai', 'behavior', 'instruction', 'context', 'agente', 'comportamento', 'instrução', 'contexto', 'modelo', 'resposta', 'diretriz'],
  'steering-help': ['help', 'faq', 'question', 'answer', 'guide', 'tutorial', 'howto', 'ajuda', 'pergunta', 'resposta', 'guia', 'documentação', 'suporte'],
  'steering-playbook': ['playbook', 'runbook', 'incident', 'procedure', 'checklist', 'step', 'recovery', 'procedimento', 'incidente', 'recuperação', 'emergência', 'escalonamento', 'mitigação'],
  'steering-observability': ['observability', 'monitoring', 'logging', 'tracing', 'alert', 'metric', 'dashboard', 'sla', 'observabilidade', 'monitoramento', 'alerta', 'métrica', 'rastreamento', 'log', 'painel'],
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
 * Tokenizes a header and checks if at least one token matches a universal
 * keyword or the domain-specific keyword set.
 */
export function isHeaderOnTopic(header: string, keywordSet: string[]): boolean {
  const tokens = tokenizeHeader(header);
  return tokens.some((token) => UNIVERSAL_KEYWORDS.includes(token) || keywordSet.includes(token));
}

/**
 * Tokenizes a header: lowercase, split by non-alphanumeric characters.
 */
export function tokenizeHeader(header: string): string[] {
  return header.toLowerCase().split(/[^a-záàâãéèêíïóôõöúçñü]+/).filter((t) => t.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Circular Hook Dependencies (Rule 22)
// ─────────────────────────────────────────────────────────────────────────────

/** DFS node coloring for cycle detection */
const enum Color {
  WHITE = 0,
  GRAY = 1,
  BLACK = 2,
}

/**
 * Filters nodes to only hooks and steerings with resolved !== false.
 */
function filterRelevantNodes(nodes: GraphNode[]): GraphNode[] {
  return nodes.filter((n) => {
    if (n.resolved === false) { return false; }
    return isHookNode(n) || isSteeringType(n.type);
  });
}

function isHookNode(node: GraphNode): boolean {
  return node.type === 'hook-auto' || node.type === 'hook-manual';
}

function isSteeringType(type: NodeType | string): boolean {
  return typeof type === 'string' && type.startsWith('steering-');
}

/**
 * Builds a directed adjacency list from edges, restricted to the given node set.
 */
function buildFilteredAdjacency(
  nodeIds: Set<string>,
  edges: GraphEdge[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) { adj.set(id, []); }
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      adj.get(edge.source)!.push(edge.target);
    }
  }
  return adj;
}

/**
 * Checks whether a cycle contains at least one hook node.
 */
function cycleContainsHook(
  cycle: string[],
  nodeMap: Map<string, GraphNode>,
): boolean {
  return cycle.some((id) => {
    const node = nodeMap.get(id);
    return node !== undefined && isHookNode(node);
  });
}

/**
 * Computes the canonical form of a cycle for deduplication.
 * Rotates so the smallest ID is first, then joins with '|||'.
 */
function canonicalizeCycle(cycle: string[]): string {
  if (cycle.length === 0) { return ''; }
  let minIdx = 0;
  for (let i = 1; i < cycle.length; i++) {
    if (cycle[i] < cycle[minIdx]) { minIdx = i; }
  }
  const rotated = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
  return rotated.join('|||');
}

/**
 * DFS with coloring to detect back-edges and extract cycles.
 */
function dfsDetectCycles(
  startNode: string,
  adjacency: Map<string, string[]>,
  color: Map<string, Color>,
  path: string[],
  cycles: string[][],
  maxDepth: number,
): void {
  if (path.length > maxDepth) { return; }
  color.set(startNode, Color.GRAY);
  path.push(startNode);

  for (const neighbor of adjacency.get(startNode) || []) {
    const neighborColor = color.get(neighbor) ?? Color.WHITE;
    if (neighborColor === Color.GRAY) {
      const cycleStart = path.indexOf(neighbor);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
    } else if (neighborColor === Color.WHITE) {
      dfsDetectCycles(neighbor, adjacency, color, path, cycles, maxDepth);
    }
  }

  path.pop();
  color.set(startNode, Color.BLACK);
}

/**
 * Detects circular dependencies between hooks and steerings.
 * Uses DFS with coloring (WHITE/GRAY/BLACK) to find back-edges indicating cycles.
 * Only reports cycles containing at least one hook node.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges
 * @param maxDepth - Maximum DFS depth to prevent combinatorial explosion (default 10)
 * @returns Array of detected circular hook dependencies
 */
export function detectCircularHookDependencies(
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxDepth: number = 10,
): CircularHookDependency[] {
  const relevant = filterRelevantNodes(nodes);
  const nodeIds = new Set(relevant.map((n) => n.id));
  const nodeMap = new Map(relevant.map((n) => [n.id, n]));
  const adjacency = buildFilteredAdjacency(nodeIds, edges);

  const color = new Map<string, Color>();
  for (const id of nodeIds) { color.set(id, Color.WHITE); }

  const rawCycles: string[][] = [];
  for (const id of nodeIds) {
    if (color.get(id) === Color.WHITE) {
      dfsDetectCycles(id, adjacency, color, [], rawCycles, maxDepth);
    }
  }

  return deduplicateAndFilter(rawCycles, nodeMap);
}

/**
 * Filters cycles to those containing a hook and deduplicates via canonical rotation.
 */
function deduplicateAndFilter(
  rawCycles: string[][],
  nodeMap: Map<string, GraphNode>,
): CircularHookDependency[] {
  const seen = new Set<string>();
  const results: CircularHookDependency[] = [];

  for (const cycle of rawCycles) {
    if (!cycleContainsHook(cycle, nodeMap)) { continue; }

    const key = canonicalizeCycle(cycle);
    if (seen.has(key)) { continue; }
    seen.add(key);

    const cycleNodes = cycle.map((id) => {
      const node = nodeMap.get(id);
      return { id, label: node?.label || id, type: node?.type || 'unknown' };
    });

    results.push({ nodes: cycleNodes, cycleLength: cycle.length });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail Coverage Analysis (Rule 23)
// ─────────────────────────────────────────────────────────────────────────────

/** Pre-compiled keyword patterns for each risk category */
export const GUARDRAIL_RISK_PATTERNS: Record<GuardrailRiskCategory, {
  hookPatterns: string[];
  steeringPatterns: string[];
}> = {
  database: {
    hookPatterns: ['sql', 'database', 'query', 'dml', 'migration'],
    steeringPatterns: ['database', 'sql', 'banco', 'dados', 'migration', 'query'],
  },
  deploy: {
    hookPatterns: ['deploy', 'publish', 'push', 'release', 'ship'],
    steeringPatterns: ['deploy', 'release', 'publish', 'publicação', 'ship', 'rollback'],
  },
  secrets: {
    hookPatterns: ['write', 'file', 'create'],
    steeringPatterns: ['secret', 'credential', 'env', 'token', 'password', 'chave', 'segredo', 'api-key'],
  },
  tests: {
    hookPatterns: ['test', 'coverage', 'teste', 'cobertura'],
    steeringPatterns: ['test', 'testing', 'tdd', 'coverage', 'teste', 'cobertura'],
  },
  infrastructure: {
    hookPatterns: ['terraform', 'docker', 'k8s', 'kubernetes', 'cloudformation', 'ansible', 'helm'],
    steeringPatterns: ['infra', 'infrastructure', 'terraform', 'docker', 'kubernetes', 'cloud', 'devops'],
  },
};

/** All risk categories in fixed order */
const ALL_RISK_CATEGORIES: GuardrailRiskCategory[] = [
  'database', 'deploy', 'secrets', 'tests', 'infrastructure',
];

/**
 * Checks if a hook exists for the given risk category.
 * Matches against whenType, hookPrompt, description, and label.
 */
export function checkHookForCategory(
  nodes: GraphNode[],
  category: GuardrailRiskCategory,
): boolean {
  const patterns = GUARDRAIL_RISK_PATTERNS[category].hookPatterns;
  return nodes.some((n) => {
    if (n.type !== 'hook-auto' && n.type !== 'hook-manual') { return false; }
    return matchesHookPatterns(n, patterns);
  });
}

function matchesHookPatterns(node: GraphNode, patterns: string[]): boolean {
  const desc = (node.metadata?.description || '').toLowerCase();
  const prompt = (node.metadata?.hookPrompt || '').toLowerCase();
  const label = node.label.toLowerCase();
  return patterns.some((p) =>
    desc.includes(p) || prompt.includes(p) || label.includes(p),
  );
}

/**
 * Checks if a steering exists for the given risk category.
 * Matches against keywords and label.
 */
export function checkSteeringForCategory(
  nodes: GraphNode[],
  category: GuardrailRiskCategory,
): boolean {
  const patterns = GUARDRAIL_RISK_PATTERNS[category].steeringPatterns;
  return nodes.some((n) => {
    if (!n.type || !n.type.startsWith('steering-')) { return false; }
    return matchesSteeringPatterns(n, patterns);
  });
}

function matchesSteeringPatterns(node: GraphNode, patterns: string[]): boolean {
  const keywords = (node.metadata?.keywords || []).map((k) => k.toLowerCase());
  const label = node.label.toLowerCase();
  return patterns.some((p) => keywords.includes(p) || label.includes(p));
}

/**
 * Determines if a risk category is relevant to the current ecosystem.
 * Database is skipped when DML Protection already covers it.
 */
export function isCategoryRelevant(
  nodes: GraphNode[],
  category: GuardrailRiskCategory,
  dmlProtectionLevel?: number,
): boolean {
  if (category === 'database' && (dmlProtectionLevel ?? 0) >= 1) {
    return false;
  }
  if (category === 'tests') {
    return nodes.some((n) => n.type === 'hook-auto' || n.type === 'hook-manual');
  }
  const hasHook = checkHookForCategory(nodes, category);
  const hasSteering = checkSteeringForCategory(nodes, category);
  return hasHook || hasSteering;
}

/**
 * Generates a positively-framed suggestion for a risk category.
 */
export function generateGuardrailSuggestion(
  category: GuardrailRiskCategory,
  missing: 'hook' | 'steering' | 'both',
): GuardrailSuggestion {
  const texts = buildSuggestionTexts(category, missing);
  return { text: texts.text, missing, example: texts.example };
}

function buildSuggestionTexts(
  category: GuardrailRiskCategory,
  missing: 'hook' | 'steering' | 'both',
): { text: string; example: string } {
  if (missing === 'hook') {
    return {
      text: `Consider adding a preToolUse/postToolUse hook for ${category} operations`,
      example: `Create a hook with toolTypes matching ${category} patterns`,
    };
  }
  if (missing === 'steering') {
    return {
      text: `Consider adding a steering with ${category} conventions and guardrails`,
      example: `Create a steering file with ${category} protection rules`,
    };
  }
  return {
    text: `Consider adding both a hook and a steering for ${category} protection`,
    example: `Create a preToolUse hook + steering with ${category} rules`,
  };
}

function computeMaturityLevel(hasHook: boolean, hasSteering: boolean): 0 | 1 | 2 {
  if (hasHook && hasSteering) { return 2; }
  if (hasHook || hasSteering) { return 1; }
  return 0;
}

/**
 * Analyzes guardrail coverage across all 5 risk categories.
 * Returns per-category results and overall maturity average.
 *
 * @param nodes - All graph nodes
 * @param edges - All graph edges (unused but kept for API consistency)
 * @param dmlProtectionLevel - Current DML Protection maturity level (to avoid overlap)
 * @returns Complete guardrail coverage analysis result
 */
export function analyzeGuardrailCoverage(
  nodes: GraphNode[],
  _edges: GraphEdge[],
  dmlProtectionLevel?: number,
): GuardrailCoverageResult {
  const categories = ALL_RISK_CATEGORIES.map((category) =>
    analyzeCategory(nodes, category, dmlProtectionLevel),
  );
  const overallMaturity = computeOverallMaturity(categories);
  return { categories, overallMaturity };
}

function analyzeCategory(
  nodes: GraphNode[],
  category: GuardrailRiskCategory,
  dmlProtectionLevel?: number,
): GuardrailCategoryResult {
  const hasHook = checkHookForCategory(nodes, category);
  const hasSteering = checkSteeringForCategory(nodes, category);
  const isRelevant = isCategoryRelevant(nodes, category, dmlProtectionLevel);
  const maturityLevel = computeMaturityLevel(hasHook, hasSteering);
  const suggestion = buildCategorySuggestion(isRelevant, maturityLevel, hasHook, hasSteering, category);
  return { category, maturityLevel, hasHook, hasSteering, isRelevant, suggestion };
}

function buildCategorySuggestion(
  isRelevant: boolean,
  maturityLevel: 0 | 1 | 2,
  hasHook: boolean,
  hasSteering: boolean,
  category: GuardrailRiskCategory,
): GuardrailSuggestion | undefined {
  if (!isRelevant || maturityLevel >= 2) { return undefined; }
  const missing = determineMissing(hasHook, hasSteering);
  return generateGuardrailSuggestion(category, missing);
}

function determineMissing(hasHook: boolean, hasSteering: boolean): 'hook' | 'steering' | 'both' {
  if (!hasHook && !hasSteering) { return 'both'; }
  if (!hasHook) { return 'hook'; }
  return 'steering';
}

function computeOverallMaturity(categories: GuardrailCategoryResult[]): number {
  const relevant = categories.filter((c) => c.isRelevant);
  if (relevant.length === 0) { return 0; }
  const sum = relevant.reduce((acc, c) => acc + c.maturityLevel, 0);
  return sum / relevant.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Instruction Specificity Score (Rule 24)
// ─────────────────────────────────────────────────────────────────────────────

/** Technology names that indicate specific instructions */
const TECHNOLOGY_MARKERS: string[] = [
  'typescript', 'javascript', 'react', 'angular', 'vue', 'svelte',
  'node', 'express', 'fastify', 'nest', 'next', 'nuxt',
  'sql', 'postgres', 'mysql', 'mongodb', 'redis', 'dynamodb',
  'docker', 'kubernetes', 'terraform', 'aws', 'azure', 'gcp',
  'python', 'java', 'rust', 'go', 'ruby', 'php', 'csharp',
  'webpack', 'esbuild', 'vite', 'rollup', 'parcel',
  'eslint', 'prettier', 'jest', 'mocha', 'vitest', 'cypress',
  'git', 'github', 'gitlab', 'npm', 'yarn', 'pnpm',
  'rest', 'graphql', 'grpc', 'websocket', 'http', 'https',
  'json', 'yaml', 'toml', 'xml', 'csv', 'markdown',
];

/** File extension patterns that indicate specific instructions */
const FILE_EXTENSION_MARKERS: string[] = [
  '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.rs', '.go',
  '.md', '.json', '.yaml', '.yml', '.toml', '.xml', '.html', '.css',
  '.env', '.config', '.lock', '.sql', '.sh', '.dockerfile',
];

/** Path prefix patterns that indicate specific instructions */
const PATH_PREFIX_MARKERS: string[] = [
  'src/', 'dist/', 'test/', 'tests/', 'lib/', 'bin/',
  'config/', 'scripts/', '.kiro/', '.github/', '.vscode/',
  'node_modules/', 'packages/', 'apps/',
];

/** Vague instruction patterns (case-insensitive substring matching) */
const VAGUE_PATTERNS: string[] = [
  'best practices',
  'proper handling',
  'appropriate measures',
  'good code',
  'clean code',
  'proper way',
  'appropriate way',
  'correct way',
  'handle errors properly',
  'ensure quality',
  'ensure security',
  'ensure performance',
  'maintain quality',
  'follow standards',
  'follow conventions',
  'use proper',
  'use appropriate',
  'use good',
  'use correct',
];

/** Generic imperative subjects (vague when alone without specificity marker) */
const GENERIC_SUBJECTS: string[] = [
  'validate', 'check', 'verify', 'ensure', 'handle',
  'process', 'manage', 'maintain', 'review', 'monitor',
];

/** Pre-compiled regex for camelCase identifiers (2+ words) */
const CAMEL_CASE_RE = /[a-z][a-zA-Z]*[A-Z][a-zA-Z]*/;

/** Pre-compiled regex for PascalCase identifiers (2+ words) */
const PASCAL_CASE_RE = /[A-Z][a-z]+[A-Z][a-zA-Z]*/;

/** Pre-compiled regex for measurable criteria with units */
const MEASURABLE_UNIT_RE = /\b\d+\s*(ms|s|lines?|words?|chars?|bytes?|kb|mb|%)\b/i;

/** Pre-compiled regex for measurable criteria with operators */
const MEASURABLE_OP_RE = /[<>=!]+\s*\d+/;

/**
 * Checks if a line contains at least one specificity marker.
 * Markers: technology names, file extensions, path prefixes,
 * backtick code, camelCase/PascalCase, measurable criteria.
 */
export function hasSpecificityMarker(lineText: string): boolean {
  if (hasTechnologyMarker(lineText)) { return true; }
  if (hasFileOrPathMarker(lineText)) { return true; }
  if (hasCodePatternMarker(lineText)) { return true; }
  if (hasMeasurableMarker(lineText)) { return true; }
  return false;
}

function hasTechnologyMarker(lineText: string): boolean {
  const lower = lineText.toLowerCase();
  const words = lower.split(/[^a-z0-9]+/).filter((w) => w.length > 0);
  return TECHNOLOGY_MARKERS.some((tech) => words.includes(tech));
}

function hasFileOrPathMarker(lineText: string): boolean {
  const lower = lineText.toLowerCase();
  const hasExtension = FILE_EXTENSION_MARKERS.some((ext) => lower.includes(ext));
  if (hasExtension) { return true; }
  return PATH_PREFIX_MARKERS.some((prefix) => lower.includes(prefix));
}

function hasCodePatternMarker(lineText: string): boolean {
  if (lineText.includes('`')) { return true; }
  if (CAMEL_CASE_RE.test(lineText)) { return true; }
  if (PASCAL_CASE_RE.test(lineText)) { return true; }
  return false;
}

function hasMeasurableMarker(lineText: string): boolean {
  if (MEASURABLE_UNIT_RE.test(lineText)) { return true; }
  return MEASURABLE_OP_RE.test(lineText);
}

/**
 * Checks if a line is a vague instruction: matches a vague pattern
 * AND does not contain any specificity marker.
 */
export function isVagueInstruction(lineText: string): boolean {
  if (hasSpecificityMarker(lineText)) { return false; }
  if (matchesVaguePattern(lineText)) { return true; }
  return matchesGenericSubject(lineText);
}

function matchesVaguePattern(lineText: string): boolean {
  const lower = lineText.toLowerCase();
  return VAGUE_PATTERNS.some((pattern) => lower.includes(pattern));
}

function matchesGenericSubject(lineText: string): boolean {
  const words = lineText.toLowerCase().split(/\s+/);
  if (words.length > 4) { return false; }
  return GENERIC_SUBJECTS.some((subject) => words.includes(subject));
}

/**
 * Computes specificity score for a set of imperative lines.
 * Score = Math.round(specificCount / total * 100).
 * Returns 100 for empty arrays.
 */
export function computeSpecificityScore(
  imperativeLines: { text: string }[],
): number {
  if (imperativeLines.length === 0) { return 100; }
  let specificCount = 0;
  for (const line of imperativeLines) {
    if (hasSpecificityMarker(line.text)) { specificCount++; }
  }
  return Math.round((specificCount / imperativeLines.length) * 100);
}

/**
 * Analyzes instruction specificity across all steering nodes.
 * Returns alerts for steerings with score < 50 and the average score.
 */
export function analyzeInstructionSpecificity(
  nodes: GraphNode[],
): InstructionSpecificityResult {
  const alerts: InstructionSpecificityAlert[] = [];
  let totalScore = 0;
  let analyzedCount = 0;

  for (const node of nodes) {
    if (!node.type || !node.type.startsWith('steering-')) { continue; }
    const lines = node.metadata?.imperativeLines;
    if (!lines || lines.length === 0) { continue; }

    analyzedCount++;
    const score = computeSpecificityScore(lines);
    totalScore += score;

    if (score < 50) {
      const alert = buildSpecificityAlert(node, lines, score);
      alerts.push(alert);
    }
  }

  const averageScore = analyzedCount > 0
    ? Math.round(totalScore / analyzedCount)
    : 100;

  return { alerts, averageScore };
}

function buildSpecificityAlert(
  node: GraphNode,
  lines: { text: string }[],
  score: number,
): InstructionSpecificityAlert {
  const vagueLines = lines.filter((l) => !hasSpecificityMarker(l.text));
  return {
    id: node.id,
    label: node.label,
    score,
    vagueCount: vagueLines.length,
    specificCount: lines.length - vagueLines.length,
    vagueExamples: vagueLines.slice(0, 3).map((l) => l.text),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Budget Estimator (Rule 25)
// ─────────────────────────────────────────────────────────────────────────────

/** Default maximum context budget in tokens */
export const DEFAULT_MAX_BUDGET = 200000;

/** Threshold above which a suggestion is generated (15%) */
export const BUDGET_ALERT_THRESHOLD = 0.15;

/**
 * Estimates the token count for a given content string.
 * Uses heuristic: Math.ceil(wordCount * 1.3).
 * Returns 0 for empty or whitespace-only strings.
 */
export function estimateTokenCount(content: string): number {
  if (!content) { return 0; }
  const words = content.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) { return 0; }
  return Math.ceil(words.length * 1.3);
}

/**
 * Checks if a node is an always-loaded steering.
 * A steering is always-loaded when its type starts with 'steering-'
 * AND metadata.alwaysApply === true OR metadata.autoInclusion === true.
 */
function isAlwaysLoadedSteering(node: GraphNode): boolean {
  if (!node.type || !node.type.startsWith('steering-')) { return false; }
  const meta = node.metadata;
  if (!meta) { return false; }
  return meta.alwaysApply === true || meta.autoInclusion === true;
}

/**
 * Extracts content from a steering node for token estimation.
 * Priority: metadata.content → imperativeLines joined → label.
 */
function getSteeringContent(node: GraphNode): string {
  const meta = node.metadata;
  if (meta?.content) { return meta.content as string; }
  if (meta?.imperativeLines && meta.imperativeLines.length > 0) {
    return meta.imperativeLines.map((l) => l.text).join(' ');
  }
  return node.label || '';
}

/**
 * Estimates the context budget consumption by always-loaded steerings.
 * Returns a complete breakdown with per-steering tokens and a suggestion
 * when consumption exceeds 15% of the budget.
 */
export function estimateContextBudget(
  nodes: GraphNode[],
  maxBudget: number = DEFAULT_MAX_BUDGET,
): ContextBudgetResult {
  const alwaysSteerings = nodes.filter(isAlwaysLoadedSteering);

  const perSteering: ContextBudgetSteeringEntry[] = alwaysSteerings.map((node) => {
    const content = getSteeringContent(node);
    const tokens = estimateTokenCount(content);
    const percent = Math.round((tokens / maxBudget) * 100);
    return { id: node.id, label: node.label, tokens, percent };
  });

  const totalTokens = perSteering.reduce((sum, s) => sum + s.tokens, 0);
  const budgetPercent = Math.round((totalTokens / maxBudget) * 100);

  const suggestion = budgetPercent > 15
    ? `Consider reviewing always-loaded steerings — they consume ${budgetPercent}% of the estimated context budget.`
    : undefined;

  return { totalTokens, budgetPercent, maxBudget, perSteering, suggestion };
}


// ─────────────────────────────────────────────────────────────────────────────
// Jailbreak/Bypass Protection (Rule 26)
// ─────────────────────────────────────────────────────────────────────────────

/** Patterns indicating identity lock in steerings (lowercase for case-insensitive match) */
const IDENTITY_LOCK_PATTERNS: string[] = [
  'i am kiro', 'my identity', 'never change persona',
  'do not impersonate', 'you are kiro',
];

/** Strong language patterns requiring exact case (all-caps) */
const STRONG_LANGUAGE_PATTERNS: string[] = [
  'NEVER', 'FORBIDDEN', 'MUST NOT', 'DO NOT', 'ABSOLUTELY',
];

/** Destructive tool patterns (lowercase for case-insensitive match) */
const DESTRUCTIVE_TOOL_PATTERNS: string[] = [
  'delete', 'remove', 'drop', 'destroy', 'truncate', 'force',
];

/** Stop words to ignore when extracting subjects */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'to', 'for', 'of', 'in',
  'on', 'with', 'and', 'or', 'that', 'this', 'it', 'be',
]);

/**
 * Detects whether any always-loaded steering contains identity lock patterns.
 * Checks imperativeLines and first 10 lines of content (case-insensitive).
 */
function detectIdentityLock(nodes: GraphNode[]): boolean {
  const steerings = nodes.filter(isAlwaysLoadedSteering);
  for (const steering of steerings) {
    if (checkIdentityInLines(steering)) { return true; }
  }
  return false;
}

function checkIdentityInLines(node: GraphNode): boolean {
  const lines = getCheckableLines(node);
  for (const line of lines) {
    const lower = line.toLowerCase();
    for (const pattern of IDENTITY_LOCK_PATTERNS) {
      if (lower.includes(pattern)) { return true; }
    }
  }
  return false;
}

/**
 * Gets checkable lines: imperativeLines texts + first 10 lines of content.
 */
function getCheckableLines(node: GraphNode): string[] {
  const lines: string[] = [];
  const meta = node.metadata;
  if (meta?.imperativeLines) {
    for (const imp of meta.imperativeLines) { lines.push(imp.text); }
  }
  if (meta?.content) {
    const contentLines = (meta.content as string).split('\n').slice(0, 10);
    for (const cl of contentLines) { lines.push(cl); }
  }
  return lines;
}

/**
 * Counts lines with strong language patterns (exact case: all-caps).
 * Each line counts once even if multiple patterns match.
 */
function countStrongLanguage(nodes: GraphNode[]): number {
  let count = 0;
  const steerings = nodes.filter(isAlwaysLoadedSteering);
  for (const steering of steerings) {
    count += countStrongLinesInNode(steering);
  }
  return count;
}

function countStrongLinesInNode(node: GraphNode): number {
  let count = 0;
  const lines = getAllNodeLines(node);
  for (const line of lines) {
    if (STRONG_LANGUAGE_PATTERNS.some((p) => line.includes(p))) {
      count++;
    }
  }
  return count;
}

/**
 * Gets all text lines from a node (imperativeLines + content lines).
 */
function getAllNodeLines(node: GraphNode): string[] {
  const lines: string[] = [];
  const meta = node.metadata;
  if (meta?.imperativeLines) {
    for (const imp of meta.imperativeLines) { lines.push(imp.text); }
  }
  if (meta?.content) {
    const contentLines = (meta.content as string).split('\n');
    for (const cl of contentLines) { lines.push(cl); }
  }
  return lines;
}

/**
 * Extracts first 3-4 significant words from a line (removes stop words, lowercase).
 */
function extractSubject(lineText: string): string {
  const words = lineText.toLowerCase().split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return words.slice(0, 4).join(' ');
}

/**
 * Counts subjects that appear in imperativeLines of 2+ different always-loaded steerings.
 */
function countRedundantRules(nodes: GraphNode[]): number {
  const steerings = nodes.filter(isAlwaysLoadedSteering);
  const subjectMap = new Map<string, Set<string>>();

  for (const steering of steerings) {
    const lines = steering.metadata?.imperativeLines || [];
    for (const line of lines) {
      const subject = extractSubject(line.text);
      if (!subject) { continue; }
      if (!subjectMap.has(subject)) { subjectMap.set(subject, new Set()); }
      subjectMap.get(subject)!.add(steering.id);
    }
  }

  let redundantCount = 0;
  for (const [, steeringIds] of subjectMap) {
    if (steeringIds.size >= 2) { redundantCount++; }
  }
  return redundantCount;
}

/**
 * Counts hooks with type 'hook-auto' AND whenType === 'preToolUse'
 * AND description/hookPrompt/label matching destructive patterns.
 */
function countDestructiveHooks(nodes: GraphNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type !== 'hook-auto') { continue; }
    if (node.metadata?.whenType !== 'preToolUse') { continue; }
    if (matchesDestructivePattern(node)) { count++; }
  }
  return count;
}

function matchesDestructivePattern(node: GraphNode): boolean {
  const meta = node.metadata;
  const text = [
    meta?.description || '',
    meta?.hookPrompt || '',
    node.label || '',
  ].join(' ').toLowerCase();
  return DESTRUCTIVE_TOOL_PATTERNS.some((p) => text.includes(p));
}

/**
 * Computes jailbreak maturity level based on detected components.
 * Level 0: no components
 * Level 1: (identityLock OR strongRules >= 3) OR destructiveHooks >= 1
 * Level 2: (identityLock OR strongRules >= 3) AND destructiveHooks >= 1 AND redundancy >= 1
 */
function computeJailbreakMaturity(
  hasIdentityLock: boolean,
  strongRuleCount: number,
  redundantRuleCount: number,
  destructiveHookCount: number,
): 0 | 1 | 2 {
  const hasAbsoluteRules = hasIdentityLock || strongRuleCount >= 3;
  const hasBlockingHooks = destructiveHookCount >= 1;
  const hasRedundancy = redundantRuleCount >= 1;

  if (hasAbsoluteRules && hasBlockingHooks && hasRedundancy) { return 2; }
  if (hasAbsoluteRules || hasBlockingHooks) { return 1; }
  return 0;
}

/**
 * Generates improvement suggestions with positive framing.
 * Returns empty array when maturityLevel === 2.
 */
function generateJailbreakSuggestions(
  maturityLevel: 0 | 1 | 2,
  hasIdentityLock: boolean,
  strongRuleCount: number,
  destructiveHookCount: number,
  redundantRuleCount: number,
): string[] {
  if (maturityLevel === 2) { return []; }
  const suggestions: string[] = [];
  if (!hasIdentityLock && strongRuleCount < 3) {
    suggestions.push(
      'Consider adding identity lock statements (e.g., "I am Kiro, NEVER change persona") to always-loaded steerings.',
    );
  }
  if (destructiveHookCount === 0) {
    suggestions.push(
      'Consider adding preToolUse hooks for destructive operations (delete, drop, truncate, force).',
    );
  }
  if (redundantRuleCount === 0 && maturityLevel >= 1) {
    suggestions.push(
      'Consider reinforcing critical rules by repeating them in 2+ steerings (redundancy makes bypass harder).',
    );
  }
  return suggestions;
}

/**
 * Analyzes jailbreak/bypass protection level of the ecosystem.
 * Returns maturity level, component counts, and improvement suggestions.
 */
export function analyzeJailbreakProtection(
  nodes: GraphNode[],
): JailbreakProtectionResult {
  const hasIdentityLock = detectIdentityLock(nodes);
  const strongRuleCount = countStrongLanguage(nodes);
  const redundantRuleCount = countRedundantRules(nodes);
  const destructiveHookCount = countDestructiveHooks(nodes);
  const maturityLevel = computeJailbreakMaturity(
    hasIdentityLock, strongRuleCount, redundantRuleCount, destructiveHookCount,
  );
  const suggestions = generateJailbreakSuggestions(
    maturityLevel, hasIdentityLock, strongRuleCount,
    destructiveHookCount, redundantRuleCount,
  );

  return {
    maturityLevel,
    hasIdentityLock,
    strongRuleCount,
    redundantRuleCount,
    destructiveHookCount,
    suggestions,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conflict Resolution Priority (Rule 27)
// ─────────────────────────────────────────────────────────────────────────────

/** Priority language patterns for EN and PT-BR */
export const PRIORITY_LANGUAGE_PATTERNS: string[] = [
  'priority',
  'precedence',
  'overrides',
  'takes priority',
  'in case of conflict',
  'higher priority',
  'lower priority',
  'has priority over',
  'prioridade',
  'prevalece',
  'em caso de conflito',
  'tem prioridade sobre',
  'sobrepõe',
  'precedência',
];

/**
 * Extracts all content lines from a graph node.
 * Priority: metadata.content → imperativeLines → empty array.
 */
function getAllContentLines(node: GraphNode): string[] {
  if (node.metadata?.content) {
    return node.metadata.content.split('\n');
  }
  if (node.metadata?.imperativeLines && node.metadata.imperativeLines.length > 0) {
    return node.metadata.imperativeLines.map((l) => l.text);
  }
  return [];
}

/**
 * Scans always-loaded steerings for priority language patterns.
 * Returns array of priority statements with source steering id and text.
 */
function detectPriorityStatements(nodes: GraphNode[]): PriorityStatement[] {
  const statements: PriorityStatement[] = [];
  const alwaysSteerings = nodes.filter(isAlwaysLoadedSteering);

  for (const steering of alwaysSteerings) {
    const lines = getAllContentLines(steering);
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const hasPattern = PRIORITY_LANGUAGE_PATTERNS.some(
        (pattern) => lowerLine.includes(pattern),
      );
      if (hasPattern) {
        statements.push({ steeringId: steering.id, text: line.trim() });
      }
    }
  }

  return statements;
}

/**
 * Determines if conflict resolution analysis is relevant.
 * Relevant when contradictions exist OR 3+ always-loaded steerings.
 */
function isConflictResolutionRelevant(
  contradictionCount: number,
  alwaysLoadedCount: number,
): boolean {
  return contradictionCount > 0 || alwaysLoadedCount >= 3;
}

/**
 * Analyzes conflict resolution priority across the ecosystem.
 * Returns whether priority hierarchy is defined, statements found,
 * and an optional suggestion when relevant but undefined.
 */
export function analyzeConflictResolution(
  nodes: GraphNode[],
  contradictionCount?: number,
): ConflictResolutionResult {
  const effectiveContradictions = contradictionCount ?? 0;
  const alwaysSteerings = nodes.filter(isAlwaysLoadedSteering);
  const alwaysLoadedCount = alwaysSteerings.length;

  const priorityStatements = detectPriorityStatements(nodes);
  const hasPriorityDefined = priorityStatements.length > 0;

  const isRelevant = isConflictResolutionRelevant(
    effectiveContradictions, alwaysLoadedCount,
  );

  const suggestion = (!hasPriorityDefined && isRelevant)
    ? 'Consider defining a priority hierarchy between steerings to resolve potential contradictions. Example: "In case of conflict, security-policies takes priority over code-conventions."'
    : undefined;

  return { hasPriorityDefined, priorityStatements, suggestion };
}

// ─────────────────────────────────────────────────────────────────────────────
// Feedback Loop Completeness (Rule 28)
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum word count for a hook prompt to qualify as an Action */
const MIN_ACTION_WORD_COUNT = 20;

/** Minimum components to NOT be flagged (hooks with >= 3 are acceptable) */
const MIN_COMPONENTS_TO_FLAG = 3;

/** Event types that qualify as verification hooks */
const POST_EVENT_TYPES = ['postTaskExecution', 'postToolUse'];

/**
 * Returns ids of steering nodes connected to the given node via edges.
 */
function getConnectedSteeringIds(
  nodeId: string,
  edges: GraphEdge[],
  nodes: GraphNode[],
): string[] {
  const steeringIds: string[] = [];
  for (const edge of edges) {
    const otherId = edge.source === nodeId ? edge.target : edge.source;
    if (otherId === nodeId) { continue; }
    const otherNode = nodes.find((n) => n.id === otherId);
    if (otherNode && otherNode.type && otherNode.type.startsWith('steering-')) {
      steeringIds.push(otherId);
    }
  }
  return steeringIds;
}

/**
 * Checks if a hook has a Decision component (edge to a steering node).
 */
function hasHookDecision(
  hookId: string,
  edges: GraphEdge[],
  nodes: GraphNode[],
): boolean {
  return getConnectedSteeringIds(hookId, edges, nodes).length > 0;
}

/**
 * Checks if a hook has an Action component (prompt >= 20 words).
 */
function hasHookAction(hookNode: GraphNode): boolean {
  const prompt = hookNode.metadata?.hookPrompt
    || hookNode.metadata?.description
    || '';
  const words = prompt.split(/\s+/).filter((w) => w.length > 0);
  return words.length >= MIN_ACTION_WORD_COUNT;
}

/**
 * Checks if a hook has a Verification component.
 * True when another hook with a post-event type references the same steering.
 */
function hasHookVerification(
  hookId: string,
  edges: GraphEdge[],
  nodes: GraphNode[],
): boolean {
  const connectedSteerings = getConnectedSteeringIds(hookId, edges, nodes);
  if (connectedSteerings.length === 0) { return false; }

  const postHooks = nodes.filter((n) =>
    (n.type === 'hook-auto' || n.type === 'hook-manual') &&
    n.id !== hookId &&
    POST_EVENT_TYPES.includes(n.metadata?.whenType || ''),
  );

  for (const postHook of postHooks) {
    const postSteerings = getConnectedSteeringIds(postHook.id, edges, nodes);
    const hasShared = connectedSteerings.some((s) => postSteerings.includes(s));
    if (hasShared) { return true; }
  }
  return false;
}

/**
 * Generates a suggestion string for incomplete loops.
 */
function generateLoopSuggestion(incompleteLoops: IncompleteLoopEntry[]): string {
  const counts: Record<string, number> = {
    Decision: 0, Action: 0, Verification: 0,
  };
  for (const loop of incompleteLoops) {
    for (const component of loop.missing) {
      if (counts[component] !== undefined) { counts[component]++; }
    }
  }
  const sorted = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const mostCommon = sorted.slice(0, 2).join(', ');
  return `Consider completing feedback loops for ${incompleteLoops.length} hook(s) — most commonly missing: ${mostCommon}.`;
}

/**
 * Analyzes feedback loop completeness for all hooks in the ecosystem.
 * Returns complete/incomplete loop counts and improvement suggestions.
 */
export function analyzeFeedbackLoops(
  nodes: GraphNode[],
  edges: GraphEdge[],
): FeedbackLoopResult {
  const hooks = nodes.filter(
    (n) => n.type === 'hook-auto' || n.type === 'hook-manual',
  );

  let completeLoops = 0;
  const incompleteLoops: IncompleteLoopEntry[] = [];

  for (const hook of hooks) {
    const detection = true;
    const decision = hasHookDecision(hook.id, edges, nodes);
    const action = hasHookAction(hook);
    const verification = hasHookVerification(hook.id, edges, nodes);

    const componentCount = [detection, decision, action, verification]
      .filter(Boolean).length;

    if (componentCount === 4) {
      completeLoops++;
    } else if (componentCount < MIN_COMPONENTS_TO_FLAG) {
      const missing: string[] = [];
      if (!decision) { missing.push('Decision'); }
      if (!action) { missing.push('Action'); }
      if (!verification) { missing.push('Verification'); }
      incompleteLoops.push({
        hookId: hook.id,
        hookLabel: hook.label,
        hasDetection: detection,
        hasDecision: decision,
        hasAction: action,
        hasVerification: verification,
        missing,
      });
    }
  }

  const suggestion = incompleteLoops.length > 0
    ? generateLoopSuggestion(incompleteLoops)
    : undefined;

  return { completeLoops, incompleteLoops, suggestion };
}
