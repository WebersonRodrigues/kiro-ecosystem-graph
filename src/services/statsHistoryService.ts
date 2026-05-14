import * as vscode from 'vscode';
import type { DailySnapshot, StatsHistory } from '../types';

/**
 * Service responsible for persisting daily node/edge count snapshots
 * to `.kiro/ecosystem-graph-stats.json` within the workspace root.
 * Supports loading, recording (upsert + prune), and retrieving recent data.
 */
export class StatsHistoryService {
  private static readonly STATS_DIR = '.kiro';
  private static readonly STATS_FILE = '.kiro/ecosystem-graph-stats.json';
  private static readonly MAX_ENTRIES = 30;
  private static readonly RECENT_DAYS = 7;

  private history: StatsHistory = { snapshots: [] };

  constructor(private readonly workspaceRoot: vscode.Uri) {}

  /**
   * Reads the stats history from `.kiro/ecosystem-graph-stats.json`.
   * Returns empty history if the file doesn't exist or contains invalid JSON.
   */
  async load(): Promise<StatsHistory> {
    const fileUri = vscode.Uri.joinPath(this.workspaceRoot, StatsHistoryService.STATS_FILE);

    try {
      const raw = await vscode.workspace.fs.readFile(fileUri);
      const text = Buffer.from(raw).toString('utf-8');
      const parsed = JSON.parse(text);

      if (parsed && Array.isArray(parsed.snapshots)) {
        this.history = { snapshots: parsed.snapshots };
      } else {
        this.history = { snapshots: [] };
      }
    } catch (error: unknown) {
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        // File doesn't exist yet — start with empty history
        this.history = { snapshots: [] };
      } else if (error instanceof SyntaxError) {
        // Corrupted/invalid JSON
        console.warn('[EcosystemGraph] Stats file contains invalid JSON, resetting to empty history.');
        this.history = { snapshots: [] };
      } else {
        // Other read errors (permissions, etc.)
        console.warn('[EcosystemGraph] Failed to read stats file, using empty history.', error);
        this.history = { snapshots: [] };
      }
    }

    return this.history;
  }

  /**
   * Records a snapshot for today's date (ISO YYYY-MM-DD).
   * If an entry for today already exists, it is updated (upsert).
   * Entries older than 30 days from today are pruned.
   * Creates the `.kiro/` directory if it doesn't exist.
   */
  async recordSnapshot(nodeCount: number, edgeCount: number): Promise<void> {
    const today = this.getTodayISO();

    // Upsert today's entry
    const existingIndex = this.history.snapshots.findIndex(s => s.date === today);
    const snapshot: DailySnapshot = { date: today, nodeCount, edgeCount };

    if (existingIndex >= 0) {
      this.history.snapshots[existingIndex] = snapshot;
    } else {
      this.history.snapshots.push(snapshot);
    }

    // Sort by date ascending
    this.history.snapshots.sort((a, b) => a.date.localeCompare(b.date));

    // Prune entries older than 30 days
    const cutoffDate = this.getCutoffDate(StatsHistoryService.MAX_ENTRIES);
    this.history.snapshots = this.history.snapshots.filter(s => s.date >= cutoffDate);

    // Write to file
    await this.save();
  }

  /**
   * Returns the last 7 days of snapshot data from the loaded history.
   * Data is sorted by date ascending.
   */
  getRecentSnapshots(): DailySnapshot[] {
    const cutoffDate = this.getCutoffDate(StatsHistoryService.RECENT_DAYS);
    return this.history.snapshots.filter(s => s.date >= cutoffDate);
  }

  /**
   * Persists the current history to disk.
   * Creates the `.kiro/` directory if it doesn't exist.
   * Logs errors but does not throw (graceful degradation).
   */
  private async save(): Promise<void> {
    const dirUri = vscode.Uri.joinPath(this.workspaceRoot, StatsHistoryService.STATS_DIR);
    const fileUri = vscode.Uri.joinPath(this.workspaceRoot, StatsHistoryService.STATS_FILE);

    try {
      // Ensure .kiro/ directory exists
      try {
        await vscode.workspace.fs.createDirectory(dirUri);
      } catch {
        // Directory may already exist — ignore
      }

      const content = JSON.stringify(this.history, null, 2);
      const encoded = Buffer.from(content, 'utf-8');
      await vscode.workspace.fs.writeFile(fileUri, encoded);
    } catch (error: unknown) {
      console.error('[EcosystemGraph] Failed to write stats file.', error);
    }
  }

  /**
   * Returns today's date as an ISO string (YYYY-MM-DD).
   */
  private getTodayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Returns the cutoff date string (YYYY-MM-DD) for pruning.
   * Entries with dates before this value should be removed.
   */
  private getCutoffDate(days: number): string {
    const now = new Date();
    now.setDate(now.getDate() - days);
    return now.toISOString().slice(0, 10);
  }
}
