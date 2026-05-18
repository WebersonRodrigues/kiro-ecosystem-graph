import * as path from 'path';
import * as fs from 'fs';
import type { ExternalResolutionResult, NodeSource } from '../types';

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
 * Service responsible for resolving relative paths across workspace folders.
 * Ensures deterministic resolution: same relative path from same folder
 * always resolves to the same absolute path.
 */
export class PathResolver {
  /**
   * Resolves a reference target path relative to the source file's location.
   * Handles both absolute-style paths (from workspace root) and relative paths.
   *
   * @param targetPath - The raw path extracted from a reference
   * @param sourceRelativePath - The relative path of the source file containing the reference
   * @param sourceWorkspaceFolder - The workspace folder the source file belongs to
   * @returns Normalized relative path suitable for use as a node ID
   */
  resolve(targetPath: string, sourceRelativePath: string, sourceWorkspaceFolder: string): string {
    const normalized = targetPath.replace(/\\/g, '/');

    // If the target already looks like a full relative path (contains directory separators),
    // treat it as relative to the workspace folder root
    if (normalized.startsWith('.kiro/') || normalized.includes('/')) {
      return normalized;
    }

    // For bare filenames (e.g. "help-faq.md"), assume they are in the same directory
    // as the source file (.kiro/steering/)
    const sourceDir = path.posix.dirname(sourceRelativePath);
    return path.posix.join(sourceDir, normalized);
  }

  /**
   * Resolves an external path reference (containing ../ that escapes the workspace).
   * Resolves to an absolute path, checks existence, and derives workspace name.
   *
   * @param targetPath - The raw relative path containing ../
   * @param sourceAbsoluteDir - The absolute directory of the source file
   * @returns ExternalResolutionResult with resolution details
   */
  resolveExternal(targetPath: string, sourceAbsoluteDir: string): ExternalResolutionResult {
    const normalized = targetPath.replace(/\\/g, '/');

    // Resolve to absolute path
    const absolutePath = path.resolve(sourceAbsoluteDir, normalized);

    // Normalize to POSIX
    const posixPath = normalizeToPosix(absolutePath);

    // Check existence
    const exists = fs.existsSync(absolutePath);

    // Derive workspace name
    const derivedWorkspace = deriveWorkspaceFromPath(posixPath);

    const source: NodeSource = 'external-resolved';

    return {
      absolutePath: posixPath,
      exists,
      derivedWorkspace,
      source,
    };
  }

  /**
   * Checks if a target path escapes the workspace folder (contains ../ going above root).
   *
   * @param targetPath - The raw relative path to check
   * @param sourceRelativePath - The relative path of the source file
   * @returns true if the path escapes the workspace
   */
  escapesWorkspace(targetPath: string, sourceRelativePath: string): boolean {
    const normalized = targetPath.replace(/\\/g, '/');
    if (!normalized.includes('../')) { return false; }

    // Resolve relative to source directory
    const sourceDir = path.posix.dirname(sourceRelativePath);
    const resolved = path.posix.normalize(path.posix.join(sourceDir, normalized));

    // If the resolved path starts with .. it escapes the workspace
    return resolved.startsWith('..');
  }
}

/**
 * Normalizes a path to POSIX format (forward slashes, no redundant ./ segments).
 */
export function normalizeToPosix(inputPath: string): string {
  let result = inputPath.replace(/\\/g, '/');
  // Remove redundant ./ segments
  result = result.replace(/\/\.\//g, '/');
  // Remove trailing ./
  if (result.endsWith('/.')) {
    result = result.slice(0, -2);
  }
  // Remove leading ./
  if (result.startsWith('./')) {
    result = result.slice(2);
  }
  return result;
}
