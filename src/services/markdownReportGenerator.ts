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

  // Title
  lines.push('# Cognitive Analysis Report');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');

  // Summary
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
  lines.push('');

  // Orphan Steerings
  if (data.steeringsSoltos.length > 0) {
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

  // Fragile Links
  if (data.vinculosFrageis.length > 0) {
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

  // Isolated Files
  if (data.arquivosSemContexto.length > 0) {
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

  // Coverage Gaps
  if (data.coverageGaps.length > 0) {
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

  // Weak Instructions
  if (data.weakInstructions.length > 0) {
    lines.push('## Weak Instructions');
    lines.push('');
    lines.push('Steering files with fewer than 10 lines — too short to be effective instructions for the AI. Files are the new software; each .md becomes a prompt that shapes agent behavior.');
    lines.push('');
    lines.push('| File | Label | Lines | Tip |');
    lines.push('|------|-------|-------|-----|');
    for (const item of data.weakInstructions) {
      lines.push(`| \`${item.id}\` | ${item.label} | ${item.lineCount} | Expand with clear context, rules, examples, and expected behavior. Ideal range: 100-350 lines. |`);
    }
    lines.push('');
  }

  // Context Overload
  if (data.contextOverload.length > 0 || data.totalAlwaysLines > 500) {
    lines.push('## Context Window Overload');
    lines.push('');
    lines.push(`Total always-loaded steering content: **${data.totalAlwaysLines} lines**. After 60% context window usage, AI quality degrades significantly. Organize memory before it compacts.`);
    lines.push('');
    if (data.contextOverload.length > 0) {
      lines.push('Large always-loaded steerings (350+ lines — ideal range is 100-350):');
      lines.push('');
      lines.push('| File | Label | Lines | Tip |');
      lines.push('|------|-------|-------|-----|');
      for (const item of data.contextOverload) {
        lines.push(`| \`${item.id}\` | ${item.label} | ${item.lineCount} | Split into smaller focused files (100-350 lines each), or change to \`inclusion: manual\` / \`inclusion: fileMatch\` |`);
      }
      lines.push('');
    }
  }

  // Instruction-Access Gap
  if (data.hooksWithoutInstruction.length > 0 || data.steeringsWithoutAccess.length > 0) {
    lines.push('## Instruction ↔ Access Gap');
    lines.push('');
    lines.push('Every agent needs two things: precise instructions AND correct access to tools. Missing either one degrades performance.');
    lines.push('');
    if (data.hooksWithoutInstruction.length > 0) {
      lines.push('### Hooks Without Instruction');
      lines.push('');
      lines.push('These hooks have access/trigger but no steering reference — the agent fires them without context.');
      lines.push('');
      lines.push('| Hook | Label | Tip |');
      lines.push('|------|-------|-----|');
      for (const item of data.hooksWithoutInstruction) {
        lines.push(`| \`${item.id}\` | ${item.label} | Add a steering reference in the hook prompt to give the agent instruction context |`);
      }
      lines.push('');
    }
    if (data.steeringsWithoutAccess.length > 0) {
      lines.push('### Steerings Without Access');
      lines.push('');
      lines.push('These steerings have instructions but no hook or automated trigger references them — the knowledge exists but is never activated.');
      lines.push('');
      lines.push('| File | Label | Inclusion | Tip |');
      lines.push('|------|-------|-----------|-----|');
      for (const item of data.steeringsWithoutAccess) {
        lines.push(`| \`${item.id}\` | ${item.label} | ${item.inclusion} | Create a hook that references this steering, or change to \`inclusion: always\` |`);
      }
      lines.push('');
    }
  }

  // Recommendations
  if (data.sugestoes.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (const suggestion of data.sugestoes) {
      lines.push(`- ${suggestion}`);
    }
    lines.push('');
  }

  // Instructions for Kiro AI
  lines.push('## Instructions for Kiro AI');
  lines.push('');
  lines.push('```text');
  lines.push('Based on the cognitive analysis above, please resolve the identified issues:');
  lines.push('');
  if (data.steeringsSoltos.length > 0) {
    lines.push('1. For each Orphan Steering, add cross-references from related steerings to integrate them into the knowledge network.');
  }
  if (data.vinculosFrageis.length > 0) {
    lines.push('2. For each Fragile Link, add at least one additional reference (wiki-link or markdown-link) to strengthen the connection.');
  }
  if (data.arquivosSemContexto.length > 0) {
    lines.push('3. For each Isolated File, reference it from the most relevant steering file.');
  }
  if (data.coverageGaps.length > 0) {
    lines.push('4. For each Coverage Gap, create a new steering file in .kiro/steering/ covering that folder\'s domain.');
  }
  if (data.weakInstructions.length > 0) {
    lines.push('5. For each Weak Instruction, expand the steering file with clear context, rules, examples, and expected behavior (target 20-80 lines).');
  }
  if (data.contextOverload.length > 0 || data.totalAlwaysLines > 500) {
    lines.push('6. For Context Overload, split large steerings into smaller focused files or change their inclusion mode to "manual" or "fileMatch".');
  }
  if (data.hooksWithoutInstruction.length > 0) {
    lines.push('7. For each Hook Without Instruction, add a steering reference in the hook prompt to provide context.');
  }
  if (data.steeringsWithoutAccess.length > 0) {
    lines.push('8. For each Steering Without Access, create a hook that references it or change its inclusion to "always".');
  }
  lines.push('');
  lines.push('Prioritize changes that increase overall graph connectivity and reduce context window waste.');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

/**
 * Extracts the filename from a relative path.
 */
function getFilename(path: string): string {
  return path.split('/').pop() || path;
}
