/**
 * ContentAnalyzer — Extracts textual metrics from steering file content.
 *
 * Runs in the extension host (Node.js) during parsing.
 * Results are stored in node.metadata and passed to the webview for analysis.
 */

/** Pattern type for imperative line detection */
export type ImperativePattern =
  | 'always'
  | 'never'
  | 'use'
  | 'do_not'
  | 'prefer'
  | 'avoid'
  | 'must'
  | 'shall';

/** A single imperative line extracted from content */
export interface ImperativeLine {
  /** Normalized text of the line */
  text: string;
  /** Detected imperative pattern */
  pattern: ImperativePattern;
  /** Target subject (the X in "always X", "never X") */
  subject: string;
}

/** Complete content metrics extracted from a steering file */
export interface ContentMetrics {
  /** Keywords extracted (no stop-words, >= 4 chars) */
  keywords: string[];
  /** Section headers (lines starting with #) */
  sectionHeaders: string[];
  /** Proportion of actionable lines (0.0 - 1.0) */
  actionableRatio: number;
  /** Imperative lines for contradiction detection */
  imperativeLines: ImperativeLine[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop Words (EN + PT-BR)
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  // English
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'need',
  'for', 'and', 'but', 'or', 'not', 'with', 'this', 'that',
  'from', 'they', 'its', 'into', 'also', 'than', 'then',
  'each', 'all', 'any', 'some', 'such', 'only', 'other',
  'more', 'most', 'very', 'just', 'about', 'over', 'after',
  'before',
  // Portuguese
  'para', 'que', 'com', 'uma', 'por', 'como', 'mais', 'este',
  'esta', 'esse', 'essa', 'são', 'não', 'dos', 'das', 'nos',
  'nas', 'pelo', 'pela', 'seus', 'suas', 'entre', 'sobre',
  'após', 'cada', 'todo', 'toda', 'todos', 'todas',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Decision Table Detection
// ─────────────────────────────────────────────────────────────────────────────

/** Recognized decision column pairs (PT-BR + EN) */
const DECISION_TABLE_PAIRS: [string, string][] = [
  ['quando', 'ação'], ['quando', 'acao'],
  ['se', 'então'], ['se', 'entao'],
  ['situação', 'ação'], ['situacao', 'acao'],
  ['cenário', 'resposta'], ['cenario', 'resposta'],
  ['condition', 'action'],
  ['if', 'then'],
  ['trigger', 'response'],
];

/**
 * Checks if a table header line contains a recognized decision column pair.
 * The line must start with '|' and contain at least one recognized pair.
 */
export function isDecisionTableHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) { return false; }
  const columns = trimmed
    .split('|')
    .map((col) => col.trim().toLowerCase())
    .filter((col) => col.length > 0);
  return DECISION_TABLE_PAIRS.some(
    ([a, b]) => columns.includes(a) && columns.includes(b),
  );
}

/**
 * Checks if a line is a markdown table separator (e.g. |---|---|).
 */
export function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Imperative Patterns
// ─────────────────────────────────────────────────────────────────────────────

const IMPERATIVE_REGEX = /\b(use|create|always|never|must|should|shall|ensure|implement|avoid|prefer)\b/i;
const DO_NOT_REGEX = /\b(do not|don't|cannot|can't)\b/i;
const PT_BR_REGEX = /\b(crie|sempre|nunca|deve|faça|evite|garanta|implemente|verificar|usar|configurar|documentar|testar|validar|manter|utilizar|aplicar|seguir|respeitar|incluir|remover|adicionar|corrigir|atualizar)\b/i;
const PTBR_OBLIGATION_REGEX = /\b(obrigatório|proibido|permitido)\b/i;
const PTBR_NEGATION_REGEX = /\bnão\s+\w+/i;
const PTBR_CAPS_REGEX = /\b(OBRIGATÓRIO|PROIBIDO|PERMITIDO|REGRA|CRÍTICO|IMPORTANTE)\b/;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts keywords from content (words >= 4 chars, no stop-words).
 */
export function extractKeywords(content: string): string[] {
  const words = new Set<string>();
  const lines = content.split('\n');

  for (const line of lines) {
    if (isExcludedLine(line)) { continue; }
    const tokens = line.toLowerCase().split(/\W+/);
    for (const token of tokens) {
      if (token.length >= 4 && !STOP_WORDS.has(token)) {
        words.add(token);
      }
    }
  }

  return Array.from(words);
}

/**
 * Computes the proportion of actionable lines in content.
 * Excludes empty lines, front-matter, and separators.
 * Counts both imperative verb lines and decision table data rows.
 */
export function computeActionableRatio(content: string): number {
  const lines = content.split('\n');
  const nonEmpty = lines.filter((l) => !isExcludedLine(l));
  if (nonEmpty.length === 0) { return 0; }

  let actionableCount = 0;
  let inDecisionTable = false;

  for (const line of lines) {
    if (isExcludedLine(line)) { continue; }

    if (isDecisionTableHeader(line)) {
      inDecisionTable = true;
      continue;
    }

    if (inDecisionTable) {
      if (!line.trim().startsWith('|')) {
        inDecisionTable = false;
      } else if (isTableSeparator(line)) {
        continue;
      } else {
        actionableCount++;
        continue;
      }
    }

    if (isActionableLine(line)) {
      actionableCount++;
    }
  }

  return actionableCount / nonEmpty.length;
}

/**
 * Extracts imperative lines with pattern and subject for contradiction detection.
 */
export function extractImperativeLines(content: string): ImperativeLine[] {
  const results: ImperativeLine[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    if (isExcludedLine(line)) { continue; }
    const extracted = extractImperativeFromLine(line);
    if (extracted) {
      results.push(extracted);
    }
  }

  return results;
}

/**
 * Extracts section headers (lines starting with #).
 */
export function extractSectionHeaders(content: string): string[] {
  const headers: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      const headerText = trimmed.replace(/^#+\s*/, '').toLowerCase().trim();
      if (headerText.length > 0) {
        headers.push(headerText);
      }
    }
  }

  return headers;
}

/**
 * Computes all content metrics in a single pass-friendly call.
 */
export function analyzeContent(content: string): ContentMetrics {
  return {
    keywords: extractKeywords(content),
    sectionHeaders: extractSectionHeaders(content),
    actionableRatio: computeActionableRatio(content),
    imperativeLines: extractImperativeLines(content),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks if a line should be excluded from analysis.
 * Excluded: empty lines, front-matter (between ---), separators (only --- or ===).
 */
function isExcludedLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === '') { return true; }
  if (trimmed === '---' || trimmed === '===') { return true; }
  return false;
}

/**
 * Checks if a line contains at least one imperative pattern.
 */
function isActionableLine(line: string): boolean {
  return IMPERATIVE_REGEX.test(line) ||
    DO_NOT_REGEX.test(line) ||
    PT_BR_REGEX.test(line) ||
    PTBR_OBLIGATION_REGEX.test(line) ||
    PTBR_NEGATION_REGEX.test(line) ||
    PTBR_CAPS_REGEX.test(line);
}

/** Pattern mapping for imperative extraction */
const PATTERN_MAP: { regex: RegExp; pattern: ImperativePattern }[] = [
  { regex: /\b(do not|don't|cannot|can't)\s+(\w+)/i, pattern: 'do_not' },
  { regex: /\balways\s+(\w+)/i, pattern: 'always' },
  { regex: /\bnever\s+(\w+)/i, pattern: 'never' },
  { regex: /\bmust\s+(\w+)/i, pattern: 'must' },
  { regex: /\bshall\s+(\w+)/i, pattern: 'shall' },
  { regex: /\bprefer\s+(\w+)/i, pattern: 'prefer' },
  { regex: /\bavoid\s+(\w+)/i, pattern: 'avoid' },
  { regex: /\buse\s+(\w+)/i, pattern: 'use' },
];

/**
 * Extracts the first imperative pattern + subject from a line.
 */
function extractImperativeFromLine(line: string): ImperativeLine | null {
  for (const { regex, pattern } of PATTERN_MAP) {
    const match = regex.exec(line);
    if (match) {
      // For do_not pattern, subject is in group 2; for others, group 1
      const subject = pattern === 'do_not'
        ? (match[2] || '').toLowerCase()
        : (match[1] || '').toLowerCase();
      if (subject.length === 0) { continue; }
      return {
        text: line.trim(),
        pattern,
        subject,
      };
    }
  }
  return null;
}
