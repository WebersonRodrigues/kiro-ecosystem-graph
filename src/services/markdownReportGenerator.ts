import type { CognitiveAnalysisResult } from '../types';

/**
 * Generates a structured Markdown report from cognitive analysis results.
 * The report is designed to be fed directly to Kiro AI for automated resolution.
 *
 * @param data - The cognitive analysis result from the webview panel
 * @returns Complete Markdown string ready to be saved as a .md file
 */
export function generateCognitiveReport(data: CognitiveAnalysisResult): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  lines.push('# Cognitive Analysis Report');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');

  appendSummaryTable(lines, data);
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
  lines.push('');
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
