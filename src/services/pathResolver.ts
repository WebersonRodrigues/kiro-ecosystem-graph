import * as path from 'path';

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
}
