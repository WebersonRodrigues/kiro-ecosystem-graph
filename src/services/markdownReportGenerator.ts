import type { CognitiveAnalysisResult, DailySnapshot } from '../types';
import { computeScoreTrend } from './healthScoreCalculator';

/**
 * Generates a structured Markdown report from cognitive analysis results.
 * The report is designed to be fed directly to Kiro AI for automated resolution.
 *
 * @param data - The cognitive analysis result from the webview panel
 * @param statsHistory - Optional daily snapshots for trend calculation
 * @returns Complete Markdown string ready to be saved as a .md file
 */
export function generateCognitiveReport(
  data: CognitiveAnalysisResult,
  statsHistory?: DailySnapshot[],
): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  lines.push('# Cognitive Analysis Report');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');

  appendSummaryTable(lines, data);
  appendHealthScore(lines, data, statsHistory);
  appendOrphanSteerings(lines, data);
  appendFragileLinks(lines, data);
  appendIsolatedFiles(lines, data);
  appendCoverageGaps(lines, data);
  appendWeakInstructions(lines, data);
  appendContextOverload(lines, data);
  appendInstructionAccessGap(lines, data);
  appendDeadLoops(lines, data);
  appendHopsToReach(lines, data);
  appendDuplicateIntent(lines, data);
  appendPassiveKnowledge(lines, data);
  appendSignalToNoise(lines, data);
  appendContradictions(lines, data);
  appendHookCoverage(lines, data);
  appendDecisionPath(lines, data);
  appendQualityGate(lines, data);
  appendDmlProtection(lines, data);
  appendStaleContent(lines, data);
  appendSuggestedConnections(lines, data);
  appendSemanticCoherence(lines, data);
  appendCircularHookDependencies(lines, data);
  appendGuardrailSuggestions(lines, data);
  appendInstructionSpecificity(lines, data);
  appendContextBudget(lines, data);
  appendJailbreakProtection(lines, data);
  appendConflictResolution(lines, data);
  appendFeedbackLoops(lines, data);
  appendRecommendations(lines, data);
  appendInstructionsForAI(lines, data);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Generators
// ─────────────────────────────────────────────────────────────────────────────

function appendSummaryTable(lines: string[], data: CognitiveAnalysisResult): void {
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Orphan Steerings | ${data.steeringsSoltos.length} |`);
  lines.push(`| Fragile Links | ${data.vinculosFrageis.length} |`);
  lines.push(`| Isolated Files | ${data.arquivosSemContexto.length} |`);
  lines.push(`| Coverage Gaps | ${data.coverageGaps.length} |`);
  lines.push(`| Weak Instructions | ${data.weakInstructions.length} |`);
  lines.push(`| Context Overload (350+ lines) | ${data.contextOverload.length} |`);
  lines.push(`| Total Always-Loaded Lines | ${data.totalAlwaysLines} |`);
  lines.push(`| Hooks Without Instruction | ${data.hooksWithoutInstruction.length} |`);
  lines.push(`| Steerings Without Access | ${data.steeringsWithoutAccess.length} |`);
  lines.push(`| Dead Loops | ${(data.deadLoops || []).length} |`);
  lines.push(`| Hops to Reach (4+) | ${(data.hopsToReach || []).length} |`);
  lines.push(`| Duplicate Intent Pairs | ${(data.duplicateIntent || []).length} |`);
  lines.push(`| Passive Knowledge | ${(data.passiveKnowledge || []).length} |`);
  lines.push(`| Low Signal-to-Noise | ${(data.signalToNoise || []).length} |`);
  lines.push(`| Contradictions | ${(data.contradictions || []).length} |`);
  lines.push(`| Hook Coverage | ${data.hookCoverageMap ? data.hookCoverageMap.covered.length : 0}/10 |`);
  lines.push(`| Quality Gate Level | ${data.qualityGate ? data.qualityGate.maturityLevel : 0}/2 |`);
  lines.push(`| DML Protection Level | ${data.dmlProtection ? data.dmlProtection.maturityLevel : 0}/2 |`);
  if (data.staleContent && data.staleContent.length > 0) {
    lines.push(`| Stale Content | ${data.staleContent.length} |`);
  }
  if (data.semanticCoherence && data.semanticCoherence.length > 0) {
    lines.push(`| Semantic Coherence | ${data.semanticCoherence.length} |`);
  }
  if (data.circularHookDependencies && data.circularHookDependencies.length > 0) {
    lines.push(`| Circular Hook Dependencies | ${data.circularHookDependencies.length} |`);
  }
  if (data.healthScore) {
    lines.push(`| **Health Score** | **${data.healthScore.score}/100** |`);
  }
  lines.push('');
}

function appendHealthScore(
  lines: string[],
  data: CognitiveAnalysisResult,
  statsHistory?: DailySnapshot[],
): void {
  if (!data.healthScore) { return; }
  const hs = data.healthScore;
  lines.push('## Health Score');
  lines.push('');
  let scoreLine = `**Score: ${hs.score}/100** (Connectivity: ${hs.connectivity} | Content Quality: ${hs.contentQuality} | Completeness: ${hs.completeness} | Maturity: ${hs.maturity})`;
  lines.push(scoreLine);
  lines.push('');

  if (statsHistory && statsHistory.length > 0) {
    const trend = computeScoreTrend(hs.score, statsHistory);
    if (trend) {
      const arrow = trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→';
      lines.push(`**Trend:** ${arrow} ${trend.delta} (previous: ${trend.previousScore}/100)`);
      lines.push('');
    }
  }
}

function appendOrphanSteerings(lines: string[], data: CognitiveAnalysisResult): void {
  if (data.steeringsSoltos.length === 0) { return; }
  lines.push('## Orphan Steerings');
  lines.push('');
  lines.push('Steering files with no incoming or outgoing connections — invisible to the AI agent.');
  lines.push('');
  lines.push('| File | Label | Tip |');
  lines.push('|------|-------|-----|');
  for (const item of data.steeringsSoltos) {
    lines.push(`| \`${item.id}\` | ${item.label} | Add a reference to this file from a related steering using backtick syntax (e.g., \\\`${getFilename(item.id)}\\\`) |`);
  }
  lines.push('');
}

function appendFragileLinks(lines: string[], data: CognitiveAnalysisResult): void {
  if (data.vinculosFrageis.length === 0) { return; }
  lines.push('## Fragile Links');
  lines.push('');
  lines.push('Connections relying on a single backtick reference — one deletion breaks the link.');
  lines.push('');
  lines.push('| Source | Target | Tip |');
  lines.push('|--------|--------|-----|');
  for (const item of data.vinculosFrageis) {
    lines.push(`| \`${item.source}\` | \`${item.target}\` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |`);
  }
  lines.push('');
}

function appendIsolatedFiles(lines: string[], data: CognitiveAnalysisResult): void {
  if (data.arquivosSemContexto.length === 0) { return; }
  lines.push('## Isolated Files');
  lines.push('');
  lines.push('Files with zero connections to the ecosystem — the AI has no context for these.');
  lines.push('');
  lines.push('| File | Label | Type | Tip |');
  lines.push('|------|-------|------|-----|');
  for (const item of data.arquivosSemContexto) {
    lines.push(`| \`${item.id}\` | ${item.label} | ${item.type} | Reference this file from the most relevant steering or skill file |`);
  }
  lines.push('');
}

function appendCoverageGaps(lines: string[], data: CognitiveAnalysisResult): void {
  if (data.coverageGaps.length === 0) { return; }
  lines.push('## Coverage Gaps');
  lines.push('');
  lines.push('Workspace folders with no steering files — the AI has no knowledge about these areas.');
  lines.push('');
  lines.push('| Folder | Tip |');
  lines.push('|--------|-----|');
  for (const item of data.coverageGaps) {
    lines.push(`| \`${item.folder}\` | Create a steering file in \`.kiro/steering/\` covering this folder\\'s domain |`);
  }
  lines.push('');
}

function appendWeakInstructions(lines: string[], data: CognitiveAnalysisResult): void {
  if (data.weakInstructions.length === 0) { return; }
  lines.push('## Weak Instructions');
  lines.push('');
  lines.push('Steering files with fewer than 10 lines — too short to be effective instructions.');
  lines.push('');
  lines.push('| File | Label | Lines | Tip |');
  lines.push('|------|-------|-------|-----|');
  for (const item of data.weakInstructions) {
    lines.push(`| \`${item.id}\` | ${item.label} | ${item.lineCount} | Expand with clear context, rules, examples, and expected behavior. Ideal range: 100-350 lines. |`);
  }
  lines.push('');
}

function appendContextOverload(lines: string[], data: CognitiveAnalysisResult): void {
  if (data.contextOverload.length === 0 && data.totalAlwaysLines <= 500) { return; }
  lines.push('## Context Window Overload');
  lines.push('');
  lines.push(`Total always-loaded steering content: **${data.totalAlwaysLines} lines**.`);
  lines.push('');
  if (data.contextOverload.length > 0) {
    lines.push('| File | Label | Lines | Tip |');
    lines.push('|------|-------|-------|-----|');
    for (const item of data.contextOverload) {
      lines.push(`| \`${item.id}\` | ${item.label} | ${item.lineCount} | Split into smaller focused files or change to \`inclusion: manual\` |`);
    }
    lines.push('');
  }
}

function appendInstructionAccessGap(lines: string[], data: CognitiveAnalysisResult): void {
  if (data.hooksWithoutInstruction.length === 0 && data.steeringsWithoutAccess.length === 0) { return; }
  lines.push('## Instruction \u2194 Access Gap');
  lines.push('');
  if (data.hooksWithoutInstruction.length > 0) {
    lines.push('### Hooks Without Instruction');
    lines.push('');
    lines.push('| Hook | Label | Tip |');
    lines.push('|------|-------|-----|');
    for (const item of data.hooksWithoutInstruction) {
      lines.push(`| \`${item.id}\` | ${item.label} | Add a steering reference in the hook prompt |`);
    }
    lines.push('');
  }
  if (data.steeringsWithoutAccess.length > 0) {
    lines.push('### Steerings Without Access');
    lines.push('');
    lines.push('| File | Label | Inclusion | Tip |');
    lines.push('|------|-------|-----------|-----|');
    for (const item of data.steeringsWithoutAccess) {
      lines.push(`| \`${item.id}\` | ${item.label} | ${item.inclusion} | Create a hook that references this steering, or change to \`inclusion: always\` |`);
    }
    lines.push('');
  }
}

function appendDeadLoops(lines: string[], data: CognitiveAnalysisResult): void {
  const deadLoops = data.deadLoops || [];
  if (deadLoops.length === 0) { return; }
  lines.push('## Dead Loops');
  lines.push('');
  lines.push('Isolated cycles with no external entry — the agent can enter but never reach useful information.');
  lines.push('');
  lines.push('| Cycle Size | Nodes | Tip |');
  lines.push('|-----------|-------|-----|');
  for (const loop of deadLoops) {
    const nodeLabels = loop.nodes.map((n) => n.label).join(', ');
    lines.push(`| ${loop.size} | ${nodeLabels} | Add an external entry point referencing at least one node in this cycle |`);
  }
  lines.push('');
}

function appendHopsToReach(lines: string[], data: CognitiveAnalysisResult): void {
  const hops = data.hopsToReach || [];
  if (hops.length === 0) { return; }
  lines.push('## Hops to Reach');
  lines.push('');
  lines.push('Steerings that are 4+ hops from any entry point — too deep for efficient agent navigation.');
  lines.push('');
  lines.push('| File | Label | Hops | Tip |');
  lines.push('|------|-------|------|-----|');
  for (const item of hops) {
    const hopsText = (item.hops >= 999 || item.hops === null || item.hops === undefined) ? '\u221E' : String(item.hops);
    lines.push(`| \`${item.id}\` | ${item.label} | ${hopsText} | Create a direct reference from an entry point to this steering |`);
  }
  lines.push('');
}

function appendDuplicateIntent(lines: string[], data: CognitiveAnalysisResult): void {
  const pairs = data.duplicateIntent || [];
  if (pairs.length === 0) { return; }
  lines.push('## Duplicate Intent');
  lines.push('');
  lines.push('Pairs of always-loaded steerings with >60% keyword overlap — redundant context consumption.');
  lines.push('');
  lines.push('| Steering A | Steering B | Overlap | Tip |');
  lines.push('|-----------|-----------|---------|-----|');
  for (const pair of pairs) {
    lines.push(`| ${pair.nodeA.label} | ${pair.nodeB.label} | ${pair.overlap}% | Consolidate into one file or differentiate their scopes |`);
  }
  lines.push('');
}

function appendPassiveKnowledge(lines: string[], data: CognitiveAnalysisResult): void {
  const passive = data.passiveKnowledge || [];
  if (passive.length === 0) { return; }
  lines.push('## Passive Knowledge');
  lines.push('');
  lines.push('Steerings with <10% actionable content — they describe but do not instruct.');
  lines.push('');
  lines.push('| File | Label | Actionable % | Tip |');
  lines.push('|------|-------|-------------|-----|');
  for (const item of passive) {
    lines.push(`| \`${item.id}\` | ${item.label} | ${item.actionablePercent}% | Add imperative instructions (use, always, never, must) |`);
  }
  lines.push('');
}

function appendSignalToNoise(lines: string[], data: CognitiveAnalysisResult): void {
  const items = data.signalToNoise || [];
  if (items.length === 0) { return; }
  lines.push('## Signal-to-Noise');
  lines.push('');
  lines.push('Steerings with 10-20% actionable content — mostly descriptive, low instruction density.');
  lines.push('');
  lines.push('| File | Label | Signal % | Tip |');
  lines.push('|------|-------|---------|-----|');
  for (const item of items) {
    lines.push(`| \`${item.id}\` | ${item.label} | ${item.signalRatio}% | Condense descriptive text and increase instruction density |`);
  }
  lines.push('');
}

function appendContradictions(lines: string[], data: CognitiveAnalysisResult): void {
  const items = data.contradictions || [];
  if (items.length === 0) { return; }
  lines.push('## Contradictions');
  lines.push('');
  lines.push('Conflicting rules between always-loaded steerings — the agent receives opposing instructions.');
  lines.push('');
  lines.push('| Steering A | Steering B | Conflict | Tip |');
  lines.push('|-----------|-----------|----------|-----|');
  for (const c of items) {
    lines.push(`| ${c.nodeA.label} | ${c.nodeB.label} | ${c.conflictType} | Unify the rule in one steering or define distinct scopes |`);
  }
  lines.push('');
}

function appendHookCoverage(lines: string[], data: CognitiveAnalysisResult): void {
  if (!data.hookCoverageMap) { return; }
  if (data.hookCoverageMap.uncovered.length === 0) { return; }
  lines.push('## Hook Coverage Map');
  lines.push('');
  lines.push('IDE events without any hook configured — potential automation opportunities.');
  lines.push('');
  lines.push('| Event | Status | Tip |');
  lines.push('|-------|--------|-----|');
  for (const item of data.hookCoverageMap.uncovered) {
    lines.push(`| ${item.event} | \u2717 Uncovered | Evaluate if automation is needed for this event |`);
  }
  for (const item of data.hookCoverageMap.covered) {
    lines.push(`| ${item.event} | \u2713 ${item.hookCount} hook(s) | — |`);
  }
  lines.push('');
}

function appendDecisionPath(lines: string[], data: CognitiveAnalysisResult): void {
  if (!data.decisionPathCompleteness) { return; }
  const dp = data.decisionPathCompleteness;
  if (dp.hooksWithoutDecisionSteering.length === 0 && dp.steeringsWithoutHook.length === 0) { return; }
  lines.push('## Decision Path Completeness');
  lines.push('');
  lines.push('Incomplete hook\u2192steering chains — the agent cannot fully detect, decide, and execute.');
  lines.push('');
  if (dp.hooksWithoutDecisionSteering.length > 0) {
    lines.push('### Hooks Without Decision Steering');
    lines.push('');
    lines.push('| Hook | Label | Tip |');
    lines.push('|------|-------|-----|');
    for (const item of dp.hooksWithoutDecisionSteering) {
      lines.push(`| \`${item.id}\` | ${item.label} | Link this hook to a steering with decision criteria |`);
    }
    lines.push('');
  }
  if (dp.steeringsWithoutHook.length > 0) {
    lines.push('### Decision Steerings Without Hook');
    lines.push('');
    lines.push('| File | Label | Tip |');
    lines.push('|------|-------|-----|');
    for (const item of dp.steeringsWithoutHook) {
      lines.push(`| \`${item.id}\` | ${item.label} | Create a hook that triggers this steering |`);
    }
    lines.push('');
  }
}

function appendQualityGate(lines: string[], data: CognitiveAnalysisResult): void {
  if (!data.qualityGate) { return; }
  const qg = data.qualityGate;
  lines.push('## Quality Gate');
  lines.push('');
  const levelLabel = qg.maturityLevel === 2 ? 'Complete' : qg.maturityLevel === 1 ? 'Partial' : 'No Gate';
  lines.push(`**Maturity Level: ${qg.maturityLevel}/2 (${levelLabel})**`);
  lines.push('');
  if (qg.maturityLevel < 2) {
    lines.push('| Component | Status | Tip |');
    lines.push('|-----------|--------|-----|');
    lines.push(`| Self-Review Hook | ${qg.missing.needsSelfReview ? '\u2717 Missing' : '\u2713 Present'} | Create a preToolUse/postToolUse hook with review keywords |`);
    lines.push(`| Quality Steering | ${qg.missing.needsQualitySteering ? '\u2717 Missing' : '\u2713 Present'} | Create a steering with quality/review/convention rules |`);
    lines.push(`| Post-Task Review | ${qg.missing.needsPostTaskReview ? '\u2717 Missing' : '\u2713 Present'} | Create a postTaskExecution hook referencing the quality steering |`);
    lines.push('');
  }
}

function appendDmlProtection(lines: string[], data: CognitiveAnalysisResult): void {
  if (!data.dmlProtection) { return; }
  const dml = data.dmlProtection;
  lines.push('## DML Protection');
  lines.push('');
  const levelLabel = dml.maturityLevel === 2 ? 'Smart Protection' : dml.maturityLevel === 1 ? 'Blind Block' : 'No Protection';
  lines.push(`**Maturity Level: ${dml.maturityLevel}/2 (${levelLabel})**`);
  lines.push('');
  if (dml.maturityLevel < 2) {
    lines.push('| Component | Status | Tip |');
    lines.push('|-----------|--------|-----|');
    lines.push(`| DML Hook | ${dml.missing.needsDmlHook ? '\u2717 Missing' : '\u2713 Present'} | Create a preToolUse hook with SQL/database keywords |`);
    lines.push(`| DML Steering | ${dml.missing.needsDmlSteering ? '\u2717 Missing' : '\u2713 Present'} | Create a steering with database protection rules |`);
    lines.push(`| Risk Integration | ${dml.missing.needsRiskIntegration ? '\u2717 Missing' : '\u2713 Present'} | Link the DML hook to a steering with risk assessment criteria |`);
    lines.push('');
  }
}

function appendStaleContent(lines: string[], data: CognitiveAnalysisResult): void {
  const items = data.staleContent || [];
  if (items.length === 0) { return; }
  lines.push('## Stale Content');
  lines.push('');
  lines.push('Steerings not modified in 90+ days with high connectivity — outdated hubs propagating stale information.');
  lines.push('');
  lines.push('| File | Label | Days Stale | Degree | Risk Score | Tip |');
  lines.push('|------|-------|-----------|--------|-----------|-----|');
  for (const item of items) {
    lines.push(`| \`${item.id}\` | ${item.label} | ${item.stalenessDays} | ${item.degree} | ${item.riskScore} | Review and update this high-connectivity steering to ensure accuracy |`);
  }
  lines.push('');
}

function appendSuggestedConnections(lines: string[], data: CognitiveAnalysisResult): void {
  const items = data.suggestedConnections || [];
  if (items.length === 0) { return; }
  lines.push('## Suggested Connections');
  lines.push('');
  lines.push('Steerings with 30-59% keyword overlap but no direct link — consider connecting them.');
  lines.push('');
  lines.push('| Steering A | Steering B | Similarity % | Tip |');
  lines.push('|-----------|-----------|-------------|-----|');
  for (const item of items) {
    lines.push(`| ${item.nodeA.label} | ${item.nodeB.label} | ${item.similarityScore}% | Add a cross-reference between these steerings to improve navigability |`);
  }
  lines.push('');
}

function appendSemanticCoherence(lines: string[], data: CognitiveAnalysisResult): void {
  const items = data.semanticCoherence || [];
  if (items.length === 0) { return; }
  lines.push('## Semantic Coherence');
  lines.push('');
  lines.push('Steerings whose section headers don\'t match the expected domain of their NodeType — indicating scope leakage.');
  lines.push('');
  lines.push('| File Path | Coherence % | Off-Topic Headers | Tip |');
  lines.push('|-----------|------------|-------------------|-----|');
  for (const item of items) {
    const pct = Math.round(item.coherencePercent * 100);
    const headers = item.offTopicHeaders.join(', ');
    lines.push(`| \`${item.filePath}\` | ${pct}% | ${headers} | Move off-topic content to a steering of the appropriate type |`);
  }
  lines.push('');
}

function appendCircularHookDependencies(lines: string[], data: CognitiveAnalysisResult): void {
  const items = data.circularHookDependencies || [];
  if (items.length === 0) { return; }
  lines.push('## Circular Hook Dependencies');
  lines.push('');
  lines.push('Cycles between hooks and steerings that could cause infinite agent execution loops.');
  lines.push('');
  lines.push('| Cycle Length | Nodes | Tip |');
  lines.push('|------------|-------|-----|');
  for (const cycle of items) {
    const nodeLabels = cycle.nodes.map((n) => `${n.label} [${n.type}]`).join(' → ');
    lines.push(`| ${cycle.cycleLength} | ${nodeLabels} | Break the circular reference by removing one edge in this cycle |`);
  }
  lines.push('');
}

function appendGuardrailSuggestions(lines: string[], data: CognitiveAnalysisResult): void {
  if (!data.guardrailCoverage) { return; }
  const suggestions = data.guardrailCoverage.categories.filter(
    (c) => c.isRelevant && c.maturityLevel < 2 && c.suggestion,
  );
  if (suggestions.length === 0) { return; }

  lines.push('## Guardrail Suggestions');
  lines.push('');
  lines.push('> These are improvement suggestions, not problems. They do not affect the Health Score.');
  lines.push('');
  lines.push('| Risk Category | Maturity | Present | Missing | Suggestion |');
  lines.push('|---------------|----------|---------|---------|------------|');
  for (const cat of suggestions) {
    const present = formatPresent(cat.hasHook, cat.hasSteering);
    lines.push(`| ${cat.category} | ${cat.maturityLevel}/2 | ${present} | ${cat.suggestion!.missing} | ${cat.suggestion!.text} |`);
  }
  lines.push('');
}

function formatPresent(hasHook: boolean, hasSteering: boolean): string {
  if (hasHook && hasSteering) { return 'hook + steering'; }
  if (hasHook) { return 'hook'; }
  if (hasSteering) { return 'steering'; }
  return 'none';
}

function appendInstructionSpecificity(lines: string[], data: CognitiveAnalysisResult): void {
  const specificity = data.instructionSpecificity;
  if (!specificity || specificity.alerts.length === 0) { return; }

  lines.push('## Instruction Specificity');
  lines.push('');
  lines.push('> These are improvement suggestions, not problems. They do not affect the Health Score.');
  lines.push('');
  lines.push('Steerings with vague instructions (specificity score < 50%) — consider making them more specific.');
  lines.push('');
  lines.push('| Steering | Score | Vague Lines | Example Vague Instructions |');
  lines.push('|----------|-------|-------------|---------------------------|');
  for (const alert of specificity.alerts) {
    const examples = alert.vagueExamples.join('; ');
    lines.push(`| ${alert.label} | ${alert.score}% | ${alert.vagueCount} | ${examples} |`);
  }
  lines.push('');
}

function appendContextBudget(lines: string[], data: CognitiveAnalysisResult): void {
  if (!data.contextBudget) { return; }
  const cb = data.contextBudget;

  lines.push('## Context Budget');
  lines.push('');
  lines.push('> This is informational only. It does not affect the Health Score.');
  lines.push('');

  if (cb.perSteering.length === 0) {
    lines.push('No always-loaded steerings detected.');
    lines.push('');
    return;
  }

  lines.push(`Estimated context consumption: ${cb.totalTokens} tokens (${cb.budgetPercent}% of ${cb.maxBudget} budget)`);
  lines.push('');
  lines.push('| Steering | Tokens | % of Budget |');
  lines.push('|----------|--------|-------------|');
  for (const entry of cb.perSteering) {
    lines.push(`| ${entry.label} | ${entry.tokens} | ${entry.percent}% |`);
  }
  lines.push('');

  if (cb.suggestion) {
    lines.push(`> ${cb.suggestion}`);
    lines.push('');
  }
}

function appendJailbreakProtection(lines: string[], data: CognitiveAnalysisResult): void {
  if (!data.jailbreakProtection) { return; }
  const jp = data.jailbreakProtection;

  lines.push('## Jailbreak Protection Level');
  lines.push('');
  lines.push('> This is an improvement suggestion, not a problem. It does not affect the Health Score.');
  lines.push('');

  const levelLabel = jp.maturityLevel === 2 ? 'Reinforced' :
    jp.maturityLevel === 1 ? 'Basic' : 'No protection';
  lines.push(`**Maturity Level: ${jp.maturityLevel}/2 (${levelLabel})**`);
  lines.push('');

  lines.push('| Component | Status |');
  lines.push('|-----------|--------|');
  lines.push(`| Identity Lock | ${jp.hasIdentityLock ? '\u2713 Present' : '\u2717 Missing'} |`);
  lines.push(`| Strong Rules | ${jp.strongRuleCount} |`);
  lines.push(`| Redundant Rules | ${jp.redundantRuleCount} |`);
  lines.push(`| Destructive Hooks | ${jp.destructiveHookCount} |`);
  lines.push('');

  if (jp.maturityLevel === 2) {
    lines.push('\uD83C\uDF89 Congratulations! Your ecosystem has reinforced jailbreak protection.');
    lines.push('');
  } else if (jp.suggestions.length > 0) {
    for (const suggestion of jp.suggestions) {
      lines.push(`- ${suggestion}`);
    }
    lines.push('');
  }
}

function appendConflictResolution(lines: string[], data: CognitiveAnalysisResult): void {
  const cr = data.conflictResolution;
  if (!cr) { return; }
  if (cr.priorityStatements.length === 0 && !cr.suggestion) { return; }

  lines.push('## Conflict Resolution Priority');
  lines.push('');
  lines.push('> This is an improvement suggestion, not a problem. It does not affect the Health Score.');
  lines.push('');

  if (cr.priorityStatements.length > 0) {
    lines.push('Priority hierarchy defined:');
    lines.push('');
    lines.push('| Steering | Statement |');
    lines.push('|----------|-----------|');
    for (const stmt of cr.priorityStatements) {
      lines.push(`| ${stmt.steeringId} | ${stmt.text} |`);
    }
    lines.push('');
  }

  if (cr.suggestion) {
    lines.push(`> ${cr.suggestion}`);
    lines.push('');
  }
}

function appendFeedbackLoops(lines: string[], data: CognitiveAnalysisResult): void {
  if (!data.feedbackLoops) { return; }
  const fl = data.feedbackLoops;
  if (fl.completeLoops === 0 && fl.incompleteLoops.length === 0) { return; }
  if (fl.incompleteLoops.length === 0) { return; }

  lines.push('## Feedback Loop Completeness');
  lines.push('');
  lines.push('> This is an improvement suggestion, not a problem. It does not affect the Health Score.');
  lines.push('');
  lines.push(`${fl.completeLoops} complete loop(s), ${fl.incompleteLoops.length} incomplete loop(s).`);
  lines.push('');
  lines.push('| Hook | Detection | Decision | Action | Verification | Missing |');
  lines.push('|------|-----------|----------|--------|--------------|---------|');
  for (const entry of fl.incompleteLoops) {
    const det = entry.hasDetection ? '✅' : '❌';
    const dec = entry.hasDecision ? '✅' : '❌';
    const act = entry.hasAction ? '✅' : '❌';
    const ver = entry.hasVerification ? '✅' : '❌';
    lines.push(`| ${entry.hookLabel} | ${det} | ${dec} | ${act} | ${ver} | ${entry.missing.join(', ')} |`);
  }
  lines.push('');
  if (fl.suggestion) {
    lines.push(`> ${fl.suggestion}`);
    lines.push('');
  }
}

function appendRecommendations(lines: string[], data: CognitiveAnalysisResult): void {
  if (data.sugestoes.length === 0) { return; }
  lines.push('## Recommendations');
  lines.push('');
  for (const suggestion of data.sugestoes) {
    lines.push(`- ${suggestion}`);
  }
  lines.push('');
}

function appendInstructionsForAI(lines: string[], data: CognitiveAnalysisResult): void {
  lines.push('## Instructions for Kiro AI');
  lines.push('');
  lines.push('```text');
  lines.push('Based on the cognitive analysis above, please resolve the identified issues:');
  lines.push('');

  let step = 1;
  if (data.steeringsSoltos.length > 0) {
    lines.push(`${step++}. For each Orphan Steering, add cross-references from related steerings.`);
  }
  if (data.vinculosFrageis.length > 0) {
    lines.push(`${step++}. For each Fragile Link, add at least one additional reference.`);
  }
  if (data.arquivosSemContexto.length > 0) {
    lines.push(`${step++}. For each Isolated File, reference it from the most relevant steering.`);
  }
  if (data.coverageGaps.length > 0) {
    lines.push(`${step++}. For each Coverage Gap, create a new steering file.`);
  }
  if (data.weakInstructions.length > 0) {
    lines.push(`${step++}. For each Weak Instruction, expand with context, rules, and examples.`);
  }
  if (data.contextOverload.length > 0 || data.totalAlwaysLines > 500) {
    lines.push(`${step++}. For Context Overload, split large steerings or change inclusion mode.`);
  }
  if (data.hooksWithoutInstruction.length > 0) {
    lines.push(`${step++}. For each Hook Without Instruction, add a steering reference.`);
  }
  if (data.steeringsWithoutAccess.length > 0) {
    lines.push(`${step++}. For each Steering Without Access, create a hook or change inclusion.`);
  }
  if ((data.deadLoops || []).length > 0) {
    lines.push(`${step++}. For each Dead Loop, add an external entry point to break the isolation.`);
  }
  if ((data.hopsToReach || []).length > 0) {
    lines.push(`${step++}. For distant steerings (4+ hops), create direct shortcuts from entry points.`);
  }
  if ((data.duplicateIntent || []).length > 0) {
    lines.push(`${step++}. For duplicate intent pairs, consolidate or differentiate scopes.`);
  }
  if ((data.passiveKnowledge || []).length > 0) {
    lines.push(`${step++}. For passive steerings, add imperative instructions.`);
  }
  if ((data.signalToNoise || []).length > 0) {
    lines.push(`${step++}. For low signal-to-noise steerings, condense descriptive text.`);
  }
  if ((data.contradictions || []).length > 0) {
    lines.push(`${step++}. For contradictions, unify conflicting rules or define distinct scopes.`);
  }
  if (data.hookCoverageMap && data.hookCoverageMap.uncovered.length > 0) {
    lines.push(`${step++}. For uncovered IDE events, evaluate if hooks are needed.`);
  }
  if (data.qualityGate && data.qualityGate.maturityLevel < 2) {
    lines.push(`${step++}. For Quality Gate, add missing components to reach level 2.`);
  }
  if (data.dmlProtection && data.dmlProtection.maturityLevel < 2) {
    lines.push(`${step++}. For DML Protection, add missing components to reach level 2.`);
  }
  if ((data.staleContent || []).length > 0) {
    lines.push(`${step++}. For each Stale Content steering, review and update the content to reflect current practices.`);
  }
  if ((data.suggestedConnections || []).length > 0) {
    lines.push(`${step++}. For each Suggested Connection, add a cross-reference between the two steerings.`);
  }
  if ((data.semanticCoherence || []).length > 0) {
    lines.push(`${step++}. For each Semantic Coherence alert, move off-topic content to a steering of the appropriate NodeType.`);
  }
  if ((data.circularHookDependencies || []).length > 0) {
    lines.push(`${step++}. For each Circular Hook Dependency, break the circular reference by removing or redirecting one edge in the cycle.`);
  }
  if (data.guardrailCoverage) {
    const hasSuggestions = data.guardrailCoverage.categories.some(
      (c) => c.isRelevant && c.maturityLevel < 2 && c.suggestion,
    );
    if (hasSuggestions) {
      lines.push(`${step++}. Consider implementing Guardrail Suggestions as optional improvements to strengthen ecosystem protection.`);
    }
  }
  if (data.instructionSpecificity && data.instructionSpecificity.alerts.length > 0) {
    lines.push(`${step++}. Consider making vague instructions more specific as optional improvements (Instruction Specificity suggestions).`);
  }
  if (data.jailbreakProtection && data.jailbreakProtection.maturityLevel < 2) {
    lines.push(`${step++}. Consider implementing Jailbreak Protection suggestions to strengthen ecosystem resilience against bypass attempts.`);
  }
  if (data.conflictResolution && data.conflictResolution.suggestion) {
    lines.push(`${step++}. Consider defining a priority hierarchy between steerings to resolve potential contradictions (Conflict Resolution suggestion).`);
  }
  if (data.feedbackLoops && data.feedbackLoops.incompleteLoops.length > 0) {
    lines.push(`${step++}. Consider completing feedback loops for hooks with incomplete Detection\u2192Decision\u2192Action\u2192Verification cycles.`);
  }

  lines.push('');
  lines.push('Prioritize changes that increase overall graph connectivity and reduce context window waste.');
  lines.push('```');
  lines.push('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function getFilename(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}
