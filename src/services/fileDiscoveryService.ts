import * as vscode from 'vscode';
import type { EcosystemFile, FileCategory, FileChangeEvent } from '../types';

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
 * Service responsible for discovering ecosystem files (steering, skills, hooks)
 * across all workspace folders and watching for file system changes to trigger
 * incremental graph updates.
 */
export class FileDiscoveryService {
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
        });
      }
    }

    return ecosystemFiles;
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
