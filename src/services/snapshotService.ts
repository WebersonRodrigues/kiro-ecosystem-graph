import * as vscode from 'vscode';
import type { SerializedGraph, GraphSnapshot } from '../types';

/**
 * Manages graph state snapshots persisted in `.kiro/ecosystem-graph-snapshots/`.
 * Each snapshot is a timestamped JSON file containing the full graph state
 * (nodes and edges) at the time of save.
 */
export class SnapshotService {
  private static readonly SNAPSHOTS_DIR = '.kiro/ecosystem-graph-snapshots';

  constructor(private readonly workspaceRoot: vscode.Uri) {}

  /**
   * Saves the current graph state as a timestamped snapshot file.
   * Creates the snapshots directory if it doesn't exist.
   * @returns The filename of the saved snapshot.
   */
  async save(graph: SerializedGraph): Promise<string> {
    const dirUri = vscode.Uri.joinPath(this.workspaceRoot, SnapshotService.SNAPSHOTS_DIR);
    try { await vscode.workspace.fs.createDirectory(dirUri); } catch { /* exists */ }

    const now = new Date();
    const filename = 'snapshot-' + now.toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
    const fileUri = vscode.Uri.joinPath(dirUri, filename);

    const snapshot: GraphSnapshot = {
      timestamp: now.getTime(),
      filename,
      nodes: graph.nodes,
      edges: graph.edges,
    };

    const content = JSON.stringify(snapshot, null, 2);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf-8'));
    return filename;
  }

  /**
   * Lists all available snapshots sorted by timestamp descending (newest first).
   * Returns an empty array if the directory doesn't exist.
   */
  async list(): Promise<{ filename: string; timestamp: number }[]> {
    const dirUri = vscode.Uri.joinPath(this.workspaceRoot, SnapshotService.SNAPSHOTS_DIR);
    try {
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      const snapshots: { filename: string; timestamp: number }[] = [];
      for (const [name, type] of entries) {
        if (type === vscode.FileType.File && name.endsWith('.json')) {
          // Extract timestamp from filename: snapshot-YYYY-MM-DDTHH-MM-SS.json
          const match = name.match(/snapshot-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
          let ts = 0;
          if (match) {
            const [, year, month, day, hour, min, sec] = match;
            ts = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).getTime();
          }
          snapshots.push({ filename: name, timestamp: ts || Date.now() });
        }
      }
      return snapshots.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  /**
   * Loads a specific snapshot by filename.
   * Returns null if the file doesn't exist or is malformed.
   */
  async load(filename: string): Promise<GraphSnapshot | null> {
    const fileUri = vscode.Uri.joinPath(this.workspaceRoot, SnapshotService.SNAPSHOTS_DIR, filename);
    try {
      const raw = await vscode.workspace.fs.readFile(fileUri);
      return JSON.parse(Buffer.from(raw).toString('utf-8'));
    } catch {
      return null;
    }
  }
}
