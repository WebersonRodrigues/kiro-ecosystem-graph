import * as vscode from 'vscode';
import type { AnnotationEntry, AnnotationStore } from '../types';

/**
 * Manages edge annotations persisted to `.kiro/ecosystem-graph-annotations.json`.
 * Annotations are user-provided labels on edges explaining the relationship
 * between connected steering files.
 */
export class AnnotationService {
  private static readonly ANNOTATIONS_FILE = '.kiro/ecosystem-graph-annotations.json';
  private store: AnnotationStore = { annotations: {} };

  constructor(private readonly workspaceRoot: vscode.Uri) {}

  /**
   * Loads annotations from the JSON file on disk.
   * Returns an empty store if the file doesn't exist or is malformed.
   */
  async load(): Promise<AnnotationStore> {
    const fileUri = vscode.Uri.joinPath(this.workspaceRoot, AnnotationService.ANNOTATIONS_FILE);
    try {
      const raw = await vscode.workspace.fs.readFile(fileUri);
      const parsed = JSON.parse(Buffer.from(raw).toString('utf-8'));
      if (parsed && parsed.annotations) {
        this.store = parsed;
      }
    } catch {
      this.store = { annotations: {} };
    }
    return this.store;
  }

  /**
   * Saves an annotation for the given source->target edge.
   * Creates the file and directory if they don't exist.
   */
  async save(source: string, target: string, text: string): Promise<void> {
    const key = source + '->' + target;
    this.store.annotations[key] = { source, target, text, createdAt: Date.now() };
    await this.persist();
  }

  /**
   * Deletes the annotation for the given source->target edge.
   */
  async delete(source: string, target: string): Promise<void> {
    const key = source + '->' + target;
    delete this.store.annotations[key];
    await this.persist();
  }

  /**
   * Returns all annotations as a flat array.
   */
  getAll(): AnnotationEntry[] {
    return Object.values(this.store.annotations);
  }

  /**
   * Persists the current store to disk, creating the directory if needed.
   */
  private async persist(): Promise<void> {
    const fileUri = vscode.Uri.joinPath(this.workspaceRoot, AnnotationService.ANNOTATIONS_FILE);
    const dirUri = vscode.Uri.joinPath(this.workspaceRoot, '.kiro');
    try {
      try { await vscode.workspace.fs.createDirectory(dirUri); } catch { /* exists */ }
      const content = JSON.stringify(this.store, null, 2);
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
    } catch (error) {
      console.error('[EcosystemGraph] Failed to write annotations file.', error);
    }
  }
}
