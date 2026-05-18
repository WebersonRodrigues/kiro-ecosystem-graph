import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import type { EcosystemFile, FileCategory, FileChangeEvent, NodeSource, ExternalDiscoveryResult } from '../types';

/**
 * Expands a raw path string by replacing ~ with home directory
 * and $VAR / ${VAR} with environment variable values.
 * If a variable is undefined, keeps the literal and logs a warning.
 *
 * @param rawPath - The raw path string to expand
 * @returns Expanded path string
 */
export function expandPath(rawPath: string): string {
  let result = rawPath;

  // Replace ~ at the beginning with home directory
  if (result.startsWith('~')) {
    result = os.homedir() + result.slice(1);
  }

  // Replace ${VAR} syntax first (more specific)
  result = result.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
    const value = process.env[varName];
    if (value === undefined) {
      console.warn(`[EcosystemGraph] Environment variable \${${varName}} is undefined, keeping literal`);
      return `\${${varName}}`;
    }
    return value;
  });

  // Replace $VAR syntax (word characters after $)
  result = result.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, varName: string) => {
    const value = process.env[varName];
    if (value === undefined) {
      console.warn(`[EcosystemGraph] Environment variable $${varName} is undefined, keeping literal`);
      return `$${varName}`;
    }
    return value;
  });

  return result;
}

/**
 * Glob patterns for each file category in the ecosystem graph.
 * Used by both discovery and file watching.
 */
const ECOSYSTEM_PATTERNS: { glob: string; category: FileCategory }[] = [
  { glob: '**/.kiro/steering/*.md', category: 'steering' },
  { glob: '**/.kiro/skills/*.md', category: 'skill' },
  { glob: '**/.kiro/skills/**/SKILL.md', category: 'skill' },
  { glob: '**/.kiro/hooks/*.json', category: 'hook' },
  { glob: '**/.kiro/hooks/*.kiro.hook', category: 'hook' },
];

/**
 * Derives a workspace name from an external path.
 * Uses the last segment before `.kiro/` if present, otherwise the last directory segment.
 */
export function deriveWorkspaceFromPath(dirPath: string): string {
  const normalized = dirPath.replace(/\\/g, '/').replace(/\/$/, '');
  const kiroIdx = normalized.indexOf('/.kiro');
  if (kiroIdx !== -1) {
    const beforeKiro = normalized.slice(0, kiroIdx);
    const segments = beforeKiro.split('/');
    return segments[segments.length - 1] || normalized;
  }
  const segments = normalized.split('/');
  return segments[segments.length - 1] || normalized;
}

/**
 * Categorizes a file by its name/extension into an ecosystem category.
 * Returns null if the file is not an ecosystem file.
 */
function categorizeFile(fileName: string, fullPath: string): FileCategory | null {
  const normalizedPath = fullPath.replace(/\\/g, '/');

  if (fileName.endsWith('.kiro.hook')) {
    if (normalizedPath.includes('/.kiro/hooks/')) { return 'hook'; }
    return null;
  }
  if (fileName.endsWith('.json') && normalizedPath.includes('/.kiro/hooks/')) {
    return 'hook';
  }
  if (fileName.endsWith('.md')) {
    if (normalizedPath.includes('/.kiro/steering/')) { return 'steering'; }
    if (normalizedPath.includes('/.kiro/skills/')) { return 'skill'; }
  }
  return null;
}

/** Custom error for timeout during directory scanning */
class TimeoutError extends Error {
  constructor() {
    super('Timeout exceeded');
    this.name = 'TimeoutError';
  }
}

/**
 * Service responsible for discovering ecosystem files (steering, skills, hooks)
 * across all workspace folders and watching for file system changes to trigger
 * incremental graph updates.
 */
export class FileDiscoveryService {
  /** In-memory cache for external discovery results */
  private cache: { entries: Map<string, EcosystemFile[]>; lastUpdated: number; configHash: string } | null = null;
  /**
   * Scans all workspace folders for ecosystem files matching three glob patterns
   * (steering .md, skills .md, hooks .json) in parallel.
   * Maps discovered URIs to EcosystemFile objects with workspaceFolder name,
   * relativePath, and category discriminator.
   *
   * @returns Array of discovered EcosystemFile objects
   */
  async discoverAll(): Promise<EcosystemFile[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];

    // Sort folders by path length descending — most specific first
    // This ensures mobile/.kiro/steering/ matches "Mobile" folder before "Workspace" (root)
    const sortedFolders = [...workspaceFolders].sort(
      (a, b) => b.uri.fsPath.length - a.uri.fsPath.length
    );

    // Run all three findFiles calls in parallel
    const results = await Promise.all(
      ECOSYSTEM_PATTERNS.map(async (pattern) => {
        const uris = await vscode.workspace.findFiles(pattern.glob);
        return { uris, category: pattern.category };
      })
    );

    const ecosystemFiles: EcosystemFile[] = [];
    const seenPaths = new Set<string>();

    for (const { uris, category } of results) {
      for (const uri of uris) {
        // Deduplicate: skip if we've already seen this file path
        if (seenPaths.has(uri.fsPath)) {
          continue;
        }
        seenPaths.add(uri.fsPath);

        const folder = sortedFolders.find(wf =>
          uri.fsPath.startsWith(wf.uri.fsPath)
        );

        if (!folder) {
          continue;
        }

        const folderRelativePath = uri.fsPath
          .slice(folder.uri.fsPath.length)
          .replace(/\\/g, '/')
          .replace(/^\//, '');

        ecosystemFiles.push({
          uri,
          workspaceFolder: folder.name,
          relativePath: folderRelativePath,
          category,
          source: 'local',
        });
      }
    }

    return ecosystemFiles;
  }

  /**
   * Discovers ecosystem files from external paths configured in settings.
   * Uses fs.readdir recursively with timeout and file limit per path.
   *
   * @returns ExternalDiscoveryResult with discovered files and skipped paths
   */
  async discoverExternal(): Promise<ExternalDiscoveryResult> {
    const config = vscode.workspace.getConfiguration('ecosystemGraph');
    const externalPaths: string[] = config.get<string[]>('externalPaths', []);

    if (externalPaths.length === 0) {
      return { files: [], skippedPaths: [] };
    }

    // Check cache
    const configHash = JSON.stringify(externalPaths);
    if (this.cache && this.cache.configHash === configHash) {
      const cachedFiles: EcosystemFile[] = [];
      for (const files of this.cache.entries.values()) {
        cachedFiles.push(...files);
      }
      return { files: cachedFiles, skippedPaths: [] };
    }

    const allFiles: EcosystemFile[] = [];
    const skippedPaths: { path: string; reason: string }[] = [];
    const newEntries = new Map<string, EcosystemFile[]>();

    for (const rawPath of externalPaths) {
      const expanded = expandPath(rawPath);
      const result = await this.scanExternalPath(expanded);
      if (result.skipped) {
        skippedPaths.push({ path: expanded, reason: result.skipped });
      } else {
        newEntries.set(expanded, result.files);
        allFiles.push(...result.files);
      }
    }

    // Update cache
    this.cache = {
      entries: newEntries,
      lastUpdated: Date.now(),
      configHash,
    };

    return { files: allFiles, skippedPaths };
  }

  /**
   * Discovers global steerings from ~/.kiro/steering/.
   * Respects the ecosystemGraph.includeGlobalSteerings setting.
   *
   * @returns Array of discovered global EcosystemFile objects
   */
  async discoverGlobal(): Promise<EcosystemFile[]> {
    const config = vscode.workspace.getConfiguration('ecosystemGraph');
    const includeGlobal = config.get<boolean>('includeGlobalSteerings', true);

    if (!includeGlobal) {
      return [];
    }

    const globalDir = path.join(os.homedir(), '.kiro', 'steering');

    if (!fs.existsSync(globalDir)) {
      return [];
    }

    const files: EcosystemFile[] = [];

    try {
      const entries = fs.readdirSync(globalDir);
      for (const entry of entries) {
        if (!entry.endsWith('.md')) { continue; }
        const fullPath = path.join(globalDir, entry);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) { continue; }

        files.push({
          uri: vscode.Uri.file(fullPath),
          workspaceFolder: '~global',
          relativePath: `.kiro/steering/${entry}`,
          category: 'steering',
          source: 'global',
        });
      }
    } catch (err) {
      console.warn(`[EcosystemGraph] Failed to scan global steerings: ${err}`);
    }

    return files;
  }

  /**
   * Invalidates the external discovery cache.
   * Called when configuration changes.
   */
  invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Scans a single external path for ecosystem files.
   * Implements timeout (5s) and file limit (1000).
   */
  private async scanExternalPath(
    dirPath: string,
  ): Promise<{ files: EcosystemFile[]; skipped?: string }> {
    if (!fs.existsSync(dirPath)) {
      return { files: [], skipped: 'path does not exist' };
    }

    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return { files: [], skipped: 'not a directory' };
    }

    const files: EcosystemFile[] = [];
    const maxFiles = 1000;
    const timeoutMs = 5000;
    const startTime = Date.now();
    const derivedWorkspace = deriveWorkspaceFromPath(dirPath);

    try {
      await this.walkDirectory(
        dirPath,
        dirPath,
        derivedWorkspace,
        files,
        maxFiles,
        startTime,
        timeoutMs,
      );
    } catch (err) {
      if (err instanceof TimeoutError) {
        console.warn(`[EcosystemGraph] Timeout scanning external path: ${dirPath}`);
        return { files, skipped: 'timeout exceeded 5s' };
      }
      console.warn(`[EcosystemGraph] Error scanning external path: ${dirPath}: ${err}`);
      return { files, skipped: `error: ${err}` };
    }

    if (files.length >= maxFiles) {
      console.info(`[EcosystemGraph] File limit reached for ${dirPath}: ${files.length} files`);
    }

    return { files };
  }

  /**
   * Recursively walks a directory collecting ecosystem files.
   */
  private async walkDirectory(
    rootDir: string,
    currentDir: string,
    workspace: string,
    files: EcosystemFile[],
    maxFiles: number,
    startTime: number,
    timeoutMs: number,
  ): Promise<void> {
    if (files.length >= maxFiles) { return; }
    if (Date.now() - startTime > timeoutMs) {
      throw new TimeoutError();
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (files.length >= maxFiles) { return; }
      if (Date.now() - startTime > timeoutMs) {
        throw new TimeoutError();
      }

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and .git
        if (entry.name === 'node_modules' || entry.name === '.git') { continue; }
        await this.walkDirectory(rootDir, fullPath, workspace, files, maxFiles, startTime, timeoutMs);
      } else if (entry.isFile()) {
        const category = categorizeFile(entry.name, fullPath);
        if (!category) { continue; }

        const relativePath = fullPath
          .slice(rootDir.length)
          .replace(/\\/g, '/')
          .replace(/^\//, '');

        files.push({
          uri: vscode.Uri.file(fullPath),
          workspaceFolder: workspace,
          relativePath,
          category,
          source: 'external-configured',
        });
      }
    }
  }

  /**
   * Registers a listener for configuration changes relevant to external discovery.
   * Invalidates cache and triggers re-scan when externalPaths or includeGlobalSteerings changes.
   *
   * @param onRescan - Callback invoked when configuration changes require a re-scan
   * @returns A Disposable that cleans up the listener
   */
  onConfigurationChanged(onRescan: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('ecosystemGraph.externalPaths') ||
        event.affectsConfiguration('ecosystemGraph.includeGlobalSteerings')
      ) {
        this.invalidateCache();
        onRescan();
      }
    });
  }

  /**
   * Creates FileSystemWatchers for all three ecosystem file glob patterns
   * (steering .md, skills .md, hooks .json).
   *
   * Emits unified FileChangeEvent objects on create/change/delete with 500ms debounce
   * to avoid excessive re-parsing on rapid changes.
   *
   * @param callback - Function called with FileChangeEvent when an ecosystem file changes
   * @returns A Disposable that cleans up all watchers when disposed
   */
  watchForChanges(callback: (event: FileChangeEvent) => void): vscode.Disposable {
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingEvent: FileChangeEvent | undefined;

    const emitDebounced = (event: FileChangeEvent): void => {
      pendingEvent = event;

      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        if (pendingEvent) {
          callback(pendingEvent);
          pendingEvent = undefined;
        }
        debounceTimer = undefined;
      }, 500);
    };

    const buildEcosystemFile = (uri: vscode.Uri, category: FileCategory): EcosystemFile | undefined => {
      const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
      const sortedFolders = [...workspaceFolders].sort(
        (a, b) => b.uri.fsPath.length - a.uri.fsPath.length
      );
      const folder = sortedFolders.find(wf =>
        uri.fsPath.startsWith(wf.uri.fsPath)
      );

      if (!folder) {
        return undefined;
      }

      const folderRelativePath = uri.fsPath
        .slice(folder.uri.fsPath.length)
        .replace(/\\/g, '/')
        .replace(/^\//, '');

      return {
        uri,
        workspaceFolder: folder.name,
        relativePath: folderRelativePath,
        category,
      };
    };

    const disposables: vscode.Disposable[] = [];

    // Create one watcher per pattern, all sharing the same debounce mechanism
    for (const pattern of ECOSYSTEM_PATTERNS) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern.glob);

      const onCreated = watcher.onDidCreate((uri) => {
        const file = buildEcosystemFile(uri, pattern.category);
        if (file) {
          emitDebounced({ type: 'created', file });
        }
      });

      const onChanged = watcher.onDidChange((uri) => {
        const file = buildEcosystemFile(uri, pattern.category);
        if (file) {
          emitDebounced({ type: 'changed', file });
        }
      });

      const onDeleted = watcher.onDidDelete((uri) => {
        const file = buildEcosystemFile(uri, pattern.category);
        if (file) {
          emitDebounced({ type: 'deleted', file });
        }
      });

      disposables.push(onCreated, onChanged, onDeleted, watcher);
    }

    return new vscode.Disposable(() => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      for (const disposable of disposables) {
        disposable.dispose();
      }
    });
  }
}
