import * as path from 'path';
import type { SteeringFile, EcosystemFile, ParseResult, Reference, GraphNode, NodeType } from '../types';
import { NodeClassifier } from './nodeClassifier';
import { PathResolver } from './pathResolver';

/**
 * Regex patterns for extracting references from steering file markdown content.
 * Each pattern targets a specific reference format used in the ecosystem.
 */
const PATTERNS = {
  /** Matches `#[[file:path/to/file.md]]` wiki-link references */
  wikiLink: /#\[\[file:([^\]]+)\]\]/g,

  /** Matches `[text](path)` markdown links, excluding http/https URLs */
  markdownLink: /\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,

  /** Matches backtick-wrapped .md filenames like `help-faq.md` */
  backtickRef: /`([a-z][\w-]*\.md)`/g,

  /** Matches file paths inside markdown table cells */
  tablePath: /\|\s*`?([a-zA-Z][\w/.-]+\.\w+)`?\s*\|/g,

  /** Matches YAML front-matter block at the start of the file */
  frontMatter: /^---\n([\s\S]*?)\n---/,
};

/**
 * Service responsible for parsing steering files and extracting references,
 * metadata, and graph node information from their markdown content.
 *
 * Uses regex-based extraction to identify wiki-links, markdown links,
 * backtick references, and table paths. Validates backtick references
 * against the list of known steering files to avoid noise from code examples.
 */
export class ParserService {
  private readonly nodeClassifier: NodeClassifier;
  private readonly pathResolver: PathResolver;

  /**
   * @param nodeClassifier - Service for classifying nodes by filename prefix
   * @param pathResolver - Service for resolving relative paths across workspace folders
   */
  constructor(nodeClassifier: NodeClassifier, pathResolver: PathResolver) {
    this.nodeClassifier = nodeClassifier;
    this.pathResolver = pathResolver;
  }

  /**
   * Parses a steering file's content and extracts all references and metadata.
   *
   * Extraction steps:
   * 1. Extracts the node label from the filename (without .md extension)
   * 2. Classifies the node using NodeClassifier based on filename prefix
   * 3. Extracts front-matter YAML for `inclusion` metadata
   * 4. Extracts all references using regex patterns (wiki-link, markdown-link, backtick-ref, table-path)
   * 5. Validates backtick refs against knownSteeringFiles — skips unmatched ones
   *
   * @param file - The steering file being parsed
   * @param content - The raw text content of the file
   * @param knownSteeringFiles - Map of filename → relativePath for cross-workspace resolution
   * @returns ParseResult containing the GraphNode and all extracted References
   */
  parse(file: SteeringFile, content: string, knownSteeringFiles: Map<string, string>): ParseResult {
    const fileName = path.posix.basename(file.relativePath);
    const label = fileName.replace(/\.md$/, '');
    const nodeType = this.nodeClassifier.classify(fileName, file.workspaceFolder);
    const metadata = this.extractFrontMatter(content);

    const node: GraphNode = {
      id: file.relativePath,
      label,
      type: nodeType,
      workspaceFolder: file.workspaceFolder,
      filePath: file.relativePath,
      resolved: true,
      metadata: metadata.inclusion ? { inclusion: metadata.inclusion } : undefined,
    };

    const references: Reference[] = [];
    const lines = content.split('\n');

    this.extractWikiLinks(lines, file, references);
    this.extractMarkdownLinks(lines, file, references);
    this.extractBacktickRefs(lines, file, knownSteeringFiles, references);
    this.extractTablePaths(lines, file, references);

    return { node, references };
  }

  /**
   * Parses a skill file's content and extracts all references.
   * Reuses the same markdown reference extraction logic as steering files
   * (wiki-links, markdown-links, backtick-refs, table-paths) but forces
   * the node type to 'skill' regardless of filename prefix.
   *
   * @param file - The skill file being parsed
   * @param content - The raw text content of the file
   * @param knownSteeringFiles - Map of filename → relativePath for cross-workspace resolution
   * @returns ParseResult containing the GraphNode (type='skill') and all extracted References
   */
  parseSkill(file: EcosystemFile, content: string, knownSteeringFiles: Map<string, string>): ParseResult {
    const fileName = path.posix.basename(file.relativePath);
    // If file is SKILL.md inside a named subdirectory, use the parent folder name as label
    // e.g. ".kiro/skills/compilacao-delphi-lib-bimer/SKILL.md" → "compilacao-delphi-lib-bimer"
    let label: string;
    if (fileName.toLowerCase() === 'skill.md') {
      const parentDir = path.posix.dirname(file.relativePath);
      label = path.posix.basename(parentDir);
    } else {
      label = fileName.replace(/\.md$/, '');
    }

    const node: GraphNode = {
      id: file.relativePath,
      label,
      type: 'skill',
      workspaceFolder: file.workspaceFolder,
      filePath: file.relativePath,
      resolved: true,
    };

    const references: Reference[] = [];
    const lines = content.split('\n');

    this.extractWikiLinks(lines, file, references);
    this.extractMarkdownLinks(lines, file, references);
    this.extractBacktickRefs(lines, file, knownSteeringFiles, references);
    this.extractTablePaths(lines, file, references);

    return { node, references };
  }

  /**
   * Parses a hook JSON file and extracts the node and references.
   * Determines the NodeType based on `when.type`:
   * - `'userTriggered'` → `hook-manual`
   * - anything else (or missing) → `hook-auto`
   *
   * Scans `then.prompt` for known steering filenames (backtick-wrapped or bare `.md` references)
   * to create Reference edges from the hook to the referenced steerings.
   *
   * @param file - The hook file being parsed
   * @param content - The raw JSON content of the file
   * @param knownSteeringFiles - Map of filename → relativePath for cross-workspace resolution
   * @returns ParseResult containing the GraphNode and extracted References, or null if JSON is invalid
   */
  parseHook(file: EcosystemFile, content: string, knownSteeringFiles: Map<string, string>): ParseResult | null {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(content) as Record<string, unknown>;
    } catch {
      console.warn(`[EcosystemGraph] Invalid JSON in hook file: ${file.relativePath}`);
      return null;
    }

    const fileName = path.posix.basename(file.relativePath);
    const name = typeof json.name === 'string' && json.name.trim() !== '' ? json.name.trim() : undefined;
    const label = name ?? fileName.replace(/\.(json|kiro\.hook)$/, '');

    // Determine NodeType from when.type
    const when = json.when as Record<string, unknown> | undefined;
    const whenType = when && typeof when.type === 'string' ? when.type : undefined;
    const nodeType: NodeType = whenType === 'userTriggered' ? 'hook-manual' : 'hook-auto';

    const node: GraphNode = {
      id: file.relativePath,
      label,
      type: nodeType,
      workspaceFolder: file.workspaceFolder,
      filePath: file.relativePath,
      resolved: true,
    };

    // Extract references from then.prompt (with shared dedup set)
    const references: Reference[] = [];
    const seen = new Set<string>();
    const then = json.then as Record<string, unknown> | undefined;
    const prompt = then && typeof then.prompt === 'string' ? then.prompt : undefined;

    if (prompt) {
      this.extractHookPromptRefs(prompt, file, knownSteeringFiles, references, seen);
    }

    // Extract implicit hook edges from toolTypes and when.patterns
    this.extractImplicitHookEdges(json, file, knownSteeringFiles, references, seen);

    // Populate hook metadata
    const description = typeof json.description === 'string' && json.description.trim() !== '' ? json.description.trim() : undefined;

    // Build referencedSteerings labels from all references targeting steering files
    const referencedSteerings: string[] = [];
    for (const ref of references) {
      const basename = ref.target.split('/').pop() || '';
      const steeringLabel = basename.replace(/\.md$/i, '');
      if (steeringLabel && !referencedSteerings.includes(steeringLabel)) {
        referencedSteerings.push(steeringLabel);
      }
    }

    node.metadata = {
      ...node.metadata,
      whenType,
      description,
      referencedSteerings: referencedSteerings.length > 0 ? referencedSteerings : undefined,
    };

    return { node, references };
  }

  /**
   * Scans a hook's `then.prompt` string for known steering filenames.
   * Matches backtick-wrapped references (e.g., `` `help-faq.md` ``) and
   * bare `.md` references (e.g., `help-faq.md` without backticks).
   *
   * Only creates edges for filenames that exist in the knownSteeringFiles map.
   */
  private extractHookPromptRefs(
    prompt: string,
    file: EcosystemFile,
    knownSteeringFiles: Map<string, string>,
    references: Reference[],
    seen: Set<string>
  ): void {
    // Match backtick-wrapped .md filenames: `something.md`
    const backtickRegex = /`([a-z][\w-]*\.md)`/g;
    let match: RegExpExecArray | null;

    while ((match = backtickRegex.exec(prompt)) !== null) {
      const refName = match[1];
      const targetPath = knownSteeringFiles.get(refName);
      if (targetPath && !seen.has(targetPath)) {
        seen.add(targetPath);
        references.push({
          source: file.relativePath,
          target: targetPath,
          type: 'backtick-ref',
          line: 0,
        });
      }
    }

    // Match bare .md filenames not already caught by backtick pattern
    // Looks for word-boundary filenames like help-faq.md in plain text
    const bareRegex = /(?<![`\w])([a-z][\w-]*\.md)(?![`\w])/g;

    while ((match = bareRegex.exec(prompt)) !== null) {
      const refName = match[1];
      const targetPath = knownSteeringFiles.get(refName);
      if (targetPath && !seen.has(targetPath)) {
        seen.add(targetPath);
        references.push({
          source: file.relativePath,
          target: targetPath,
          type: 'backtick-ref',
          line: 0,
        });
      }
    }
  }

  /**
   * Extracts implicit hook-to-steering edges by scanning toolTypes and when.patterns.
   *
   * - toolTypes: for each entry, checks if any known steering filename contains
   *   that string (case-insensitive substring match)
   * - when.patterns: array of glob strings; checks if any known steering file path
   *   matches the pattern (simple extension/substring matching)
   *
   * Uses the shared `seen` Set to deduplicate against prompt refs.
   */
  private extractImplicitHookEdges(
    json: Record<string, unknown>,
    file: EcosystemFile,
    knownSteeringFiles: Map<string, string>,
    references: Reference[],
    seen: Set<string>
  ): void {
    const when = json.when as Record<string, unknown> | undefined;

    // Scan toolTypes (can be at top-level or inside when)
    const toolTypes = when && Array.isArray(when.toolTypes) ? when.toolTypes as string[] :
      (Array.isArray(json.toolTypes) ? json.toolTypes as string[] : undefined);

    if (toolTypes) {
      for (const toolType of toolTypes) {
        if (typeof toolType !== 'string') { continue; }
        const toolTypeLower = toolType.toLowerCase();

        for (const [steeringFilename, steeringPath] of knownSteeringFiles) {
          if (seen.has(steeringPath)) { continue; }
          // Case-insensitive substring match: does the steering filename contain the toolType?
          if (steeringFilename.toLowerCase().includes(toolTypeLower)) {
            seen.add(steeringPath);
            references.push({
              source: file.relativePath,
              target: steeringPath,
              type: 'hook-implicit',
              line: 0,
            });
          }
        }
      }
    }

    // Scan when.patterns (array of glob strings like "*.ts", "*.py")
    const patterns = when && Array.isArray(when.patterns) ? when.patterns as string[] : undefined;

    if (patterns) {
      for (const pattern of patterns) {
        if (typeof pattern !== 'string') { continue; }

        for (const [, steeringPath] of knownSteeringFiles) {
          if (seen.has(steeringPath)) { continue; }
          // Simple glob matching: check if the steering path matches the pattern
          if (this.simpleGlobMatch(pattern, steeringPath)) {
            seen.add(steeringPath);
            references.push({
              source: file.relativePath,
              target: steeringPath,
              type: 'hook-implicit',
              line: 0,
            });
          }
        }
      }
    }
  }

  /**
   * Simple glob matching for file patterns against a path.
   * Supports: star-dot-ext, double-star patterns, and plain substring matching.
   */
  private simpleGlobMatch(pattern: string, filePath: string): boolean {
    // Handle *.ext patterns (match by extension)
    if (pattern.startsWith('*.')) {
      const ext = pattern.slice(1); // e.g. ".ts"
      return filePath.endsWith(ext);
    }

    // Handle **/*.ext patterns (match by extension recursively)
    if (pattern.startsWith('**/')) {
      const subPattern = pattern.slice(3);
      return this.simpleGlobMatch(subPattern, filePath);
    }

    // Plain substring match as fallback
    return filePath.includes(pattern);
  }

  /**
   * Extracts YAML front-matter from the beginning of the file content.
   * Looks for content between `---` markers and parses the `inclusion` field.
   *
   * @param content - Raw file content
   * @returns Object with extracted inclusion value, or empty object if no front-matter
   */
  private extractFrontMatter(content: string): { inclusion?: string } {
    const match = PATTERNS.frontMatter.exec(content);
    if (!match) {
      return {};
    }

    const yaml = match[1];
    const inclusionMatch = /^inclusion:\s*(.+)$/m.exec(yaml);
    if (!inclusionMatch) {
      return {};
    }

    return { inclusion: inclusionMatch[1].trim() };
  }

  /**
   * Extracts `#[[file:path]]` wiki-link references from the content.
   */
  private extractWikiLinks(
    lines: string[],
    file: SteeringFile,
    references: Reference[]
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const regex = new RegExp(PATTERNS.wikiLink.source, 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(lines[i])) !== null) {
        const targetPath = match[1];
        const resolved = this.pathResolver.resolve(
          targetPath,
          file.relativePath,
          file.workspaceFolder
        );

        references.push({
          source: file.relativePath,
          target: resolved,
          type: 'wiki-link',
          line: i + 1,
        });
      }
    }
  }

  /**
   * Extracts `[text](path)` markdown link references, excluding http/https URLs.
   */
  private extractMarkdownLinks(
    lines: string[],
    file: SteeringFile,
    references: Reference[]
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const regex = new RegExp(PATTERNS.markdownLink.source, 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(lines[i])) !== null) {
        const targetPath = match[2];
        const resolved = this.pathResolver.resolve(
          targetPath,
          file.relativePath,
          file.workspaceFolder
        );

        references.push({
          source: file.relativePath,
          target: resolved,
          type: 'markdown-link',
          line: i + 1,
        });
      }
    }
  }

  /**
   * Extracts backtick-wrapped .md filename references.
   * Only creates edges for references that match a filename in the knownSteeringFiles list.
   * This prevents noise from code examples that happen to mention .md filenames.
   */
  private extractBacktickRefs(
    lines: string[],
    file: SteeringFile,
    knownSteeringFiles: Map<string, string>,
    references: Reference[]
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const regex = new RegExp(PATTERNS.backtickRef.source, 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(lines[i])) !== null) {
        const refName = match[1];

        // Only create edge if the backtick ref matches a known steering file
        if (!knownSteeringFiles.has(refName)) {
          continue;
        }

        // Resolve to the actual path of the discovered file (cross-workspace)
        const resolvedPath = knownSteeringFiles.get(refName)!;

        references.push({
          source: file.relativePath,
          target: resolvedPath,
          type: 'backtick-ref',
          line: i + 1,
        });
      }
    }
  }

  /**
   * Extracts file paths from markdown table cells.
   * Matches paths like `| path/to/file.ext |` or `| \`path/to/file.ext\` |`.
   */
  private extractTablePaths(
    lines: string[],
    file: SteeringFile,
    references: Reference[]
  ): void {
    for (let i = 0; i < lines.length; i++) {
      const regex = new RegExp(PATTERNS.tablePath.source, 'g');
      let match: RegExpExecArray | null;

      while ((match = regex.exec(lines[i])) !== null) {
        const targetPath = match[1];
        const resolved = this.pathResolver.resolve(
          targetPath,
          file.relativePath,
          file.workspaceFolder
        );

        references.push({
          source: file.relativePath,
          target: resolved,
          type: 'table-path',
          line: i + 1,
        });
      }
    }
  }
}
