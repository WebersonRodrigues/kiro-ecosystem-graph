import * as vscode from 'vscode';
import { SerializedGraph, ExtensionMessage, WebviewMessage, DailySnapshot, AnnotationEntry, CognitiveAnalysisResult, IssueCategory, FixIssueData } from '../types';
import { GraphDataStore } from '../services/graphDataStore';
import { PathResolver } from '../services/pathResolver';
import { AnnotationService } from '../services/annotationService';
import { SnapshotService } from '../services/snapshotService';
import { generateCognitiveReport } from '../services/markdownReportGenerator';
import { generateTargetedPrompt, generateConsolidatedPrompt } from '../services/fixPromptGenerator';
import { getTemplate } from '../services/onboardingTemplates';

/**
 * Webview provider for the Ecosystem Graph panel.
 * Manages the webview lifecycle, bidirectional communication via postMessage,
 * and file opening on node click.
 */
export class EcosystemGraphProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private latestStatsHistory: DailySnapshot[] | undefined;
  private latestAnnotations: AnnotationEntry[] | undefined;
  private latestSnapshotList: { filename: string; timestamp: number }[] | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly graphDataStore: GraphDataStore,
    private readonly pathResolver: PathResolver,
    private readonly annotationService?: AnnotationService,
    private readonly snapshotService?: SnapshotService
  ) {}

  /**
   * VS Code lifecycle method called when the webview view is resolved (created/restored).
   * Sets up the webview options, HTML content, and message handling.
   */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
      ],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      this.handleMessage(message);
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
  }

  /**
   * Focuses the webview panel by executing the view focus command.
   */
  show(): void {
    vscode.commands.executeCommand('ecosystemGraphView.focus');
  }

  /**
   * Sends an updateGraph message to the webview with the latest graph data.
   * Only sends if the webview is currently visible.
   */
  updateGraph(
    graph: SerializedGraph,
    statsHistory?: DailySnapshot[],
    annotations?: AnnotationEntry[],
    snapshotList?: { filename: string; timestamp: number }[]
  ): void {
    if (this.view && this.view.visible) {
      const message: ExtensionMessage = { type: 'updateGraph', data: graph, statsHistory, annotations, snapshotList };
      this.view.webview.postMessage(message);
    }
    // Store latest data for sendCurrentGraph
    this.latestStatsHistory = statsHistory;
    this.latestAnnotations = annotations;
    this.latestSnapshotList = snapshotList;
  }

  /**
   * Handles incoming messages from the webview.
   */
  private handleMessage(message: WebviewMessage): void {
    switch (message.type) {
      case 'openFile':
        this.handleOpenFile(message.filePath);
        break;
      case 'ready':
        this.sendCurrentGraph();
        break;
      case 'stateChanged':
        // State is persisted in the webview via getState/setState — no-op on extension side
        break;
      case 'saveAnnotation':
        this.handleSaveAnnotation(message.source, message.target, message.text);
        break;
      case 'deleteAnnotation':
        this.handleDeleteAnnotation(message.source, message.target);
        break;
      case 'saveSnapshot':
        this.handleSaveSnapshot();
        break;
      case 'loadSnapshot':
        this.handleLoadSnapshot(message.filename);
        break;
      case 'exportImage':
        this.handleExportImage(message.dataUrl);
        break;
      case 'exportImageError':
        vscode.window.showWarningMessage('Failed to capture graph: ' + message.error);
        break;
      case 'exportCognitiveAnalysis':
        this.handleExportCognitiveAnalysis(message.data);
        break;
      case 'fixIssue':
        this.handleFixIssue(message.category, message.issue);
        break;
      case 'fixAllCategory':
        this.handleFixAllCategory(message.category, message.issues);
        break;
      case 'createFromTemplate':
        this.handleCreateFromTemplate(message.templateKey, message.fileName, message.targetDir);
        break;
    }
  }

  /**
   * Handles saving an annotation for an edge.
   */
  private async handleSaveAnnotation(source: string, target: string, text: string): Promise<void> {
    if (this.annotationService) {
      await this.annotationService.save(source, target, text);
    }
  }

  /**
   * Handles deleting an annotation for an edge.
   */
  private async handleDeleteAnnotation(source: string, target: string): Promise<void> {
    if (this.annotationService) {
      await this.annotationService.delete(source, target);
    }
  }

  /**
   * Handles saving a graph snapshot and sending the updated list back to the webview.
   */
  private async handleSaveSnapshot(): Promise<void> {
    if (this.snapshotService) {
      await this.snapshotService.save(this.graphDataStore.getSerializableGraph());
      // Send updated snapshot list
      const list = await this.snapshotService.list();
      this.latestSnapshotList = list;
      if (this.view) {
        const message: ExtensionMessage = {
          type: 'updateGraph',
          data: this.graphDataStore.getSerializableGraph(),
          statsHistory: this.latestStatsHistory,
          snapshotList: list,
          annotations: this.annotationService?.getAll()
        };
        this.view.webview.postMessage(message);
      }
    }
  }

  /**
   * Handles loading a specific snapshot and sending it to the webview.
   */
  private async handleLoadSnapshot(filename: string): Promise<void> {
    if (this.snapshotService) {
      const snapshot = await this.snapshotService.load(filename);
      if (snapshot && this.view) {
        const message: ExtensionMessage = { type: 'snapshotData', snapshot };
        this.view.webview.postMessage(message);
      }
    }
  }

  /**
   * Handles exporting the graph as a PNG image to the workspace root.
   */
  private async handleExportImage(dataUrl: string): Promise<void> {
    try {
      const imageData = dataUrl.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(imageData, 'base64');
      const filename = 'ecosystem-graph-' + new Date().toISOString().slice(0, 10) + '.png';
      const fileUri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, filename);
      await vscode.workspace.fs.writeFile(fileUri, buffer);
      vscode.window.showInformationMessage(`Graph exported to ${filename}`);
    } catch {
      vscode.window.showWarningMessage('Failed to export graph image');
    }
  }

  /**
   * Handles exporting the cognitive analysis as a structured Markdown report.
   * Shows a save dialog and writes the report to the selected location.
   */
  private async handleExportCognitiveAnalysis(data: CognitiveAnalysisResult | null): Promise<void> {
    if (!data) {
      return;
    }

    // Validate at least one non-empty array
    const hasContent = data.steeringsSoltos.length > 0
      || data.vinculosFrageis.length > 0
      || data.arquivosSemContexto.length > 0
      || data.coverageGaps.length > 0
      || data.weakInstructions.length > 0
      || data.contextOverload.length > 0
      || data.hooksWithoutInstruction.length > 0
      || data.steeringsWithoutAccess.length > 0;

    if (!hasContent) {
      return;
    }

    const markdownContent = generateCognitiveReport(data);
    const defaultFilename = `cognitive-analysis-${new Date().toISOString().slice(0, 10)}.md`;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const defaultUri = workspaceFolder
      ? vscode.Uri.joinPath(workspaceFolder.uri, defaultFilename)
      : undefined;

    const saveUri = await vscode.window.showSaveDialog({
      defaultUri,
      filters: { 'Markdown': ['md'] },
    });

    if (!saveUri) {
      return;
    }

    try {
      await vscode.workspace.fs.writeFile(saveUri, Buffer.from(markdownContent, 'utf-8'));
      const savedFilename = saveUri.path.split('/').pop() || defaultFilename;
      vscode.window.showInformationMessage(`Cognitive analysis exported to ${savedFilename}`);
    } catch {
      vscode.window.showWarningMessage('Failed to export cognitive analysis');
    }
  }

  /**
   * Handles a single fix issue request: generates a targeted prompt and copies to clipboard.
   */
  private async handleFixIssue(category: IssueCategory, issue: FixIssueData): Promise<void> {
    const prompt = generateTargetedPrompt(category, issue);
    await this.copyAndSendToChat(prompt);
  }

  /**
   * Handles a fix-all request for a category: generates a consolidated prompt and copies to clipboard.
   */
  private async handleFixAllCategory(category: IssueCategory, issues: FixIssueData[]): Promise<void> {
    const prompt = generateConsolidatedPrompt(category, issues);
    if (!prompt) { return; }
    await this.copyAndSendToChat(prompt);
  }

  /**
   * Copies the prompt to clipboard, shows a notification, and attempts to open the chat panel.
   */
  private async copyAndSendToChat(prompt: string): Promise<void> {
    await vscode.env.clipboard.writeText(prompt);
    vscode.window.showInformationMessage('Prompt copiado para o clipboard. Cole no chat do Kiro.');
    try {
      await vscode.commands.executeCommand('workbench.action.chat.open');
    } catch {
      // Chat command unavailable — user pastes manually
    }
  }

  /**
   * Handles creating a file from an onboarding template.
   * Does not overwrite existing files — shows an informational message instead.
   */
  private async handleCreateFromTemplate(
    templateKey: string,
    fileName: string,
    targetDir: string,
  ): Promise<void> {
    const template = getTemplate(templateKey);
    if (!template) {
      vscode.window.showWarningMessage(`Template not found: ${templateKey}`);
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder open.');
      return;
    }

    const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, targetDir, fileName);

    try {
      await vscode.workspace.fs.stat(fileUri);
      vscode.window.showInformationMessage(`File already exists: ${targetDir}/${fileName}`);
    } catch {
      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(template, 'utf-8'));
      const document = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(document);
    }
  }

  /**
   * Sends the current graph data to the webview.
   * Called when the webview signals it is ready.
   */
  private sendCurrentGraph(): void {
    const graph = this.graphDataStore.getSerializableGraph();
    if (this.view) {
      const message: ExtensionMessage = {
        type: 'updateGraph',
        data: graph,
        statsHistory: this.latestStatsHistory,
        annotations: this.latestAnnotations,
        snapshotList: this.latestSnapshotList
      };
      this.view.webview.postMessage(message);
    }
  }

  /**
   * Handles the openFile message from the webview.
   * Searches for the file across workspace folders and opens it in the editor.
   * Shows an informational message if the file is not found.
   */
  private async handleOpenFile(filePath: string): Promise<void> {
    try {
      const files = await vscode.workspace.findFiles(`**/${filePath}`, null, 1);

      if (files.length > 0) {
        const document = await vscode.workspace.openTextDocument(files[0]);
        await vscode.window.showTextDocument(document);
      } else {
        vscode.window.showInformationMessage(`File not found: ${filePath}`);
      }
    } catch {
      vscode.window.showInformationMessage(`File not found: ${filePath}`);
    }
  }

  /**
   * Returns the HTML content for the webview panel.
   * Includes CSP meta tag, graph container, tooltip, legend, controls,
   * settings panel placeholder, and script references for force-graph rendering.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    const distUri = vscode.Uri.joinPath(this.extensionUri, 'dist');

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'webview.js'));
    const settingsPanelUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'settings-panel.js'));
    const filterPanelUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'filter-panel.js'));
    const healthPanelUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'health-panel.js'));
    const interactionsPanelUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'interactions-panel.js'));
    const gapDetectorUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'gap-detector.js'));
    const alternativeViewsUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'alternative-views.js'));
    const visualModesUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'visual-modes.js'));
    const exportPanelUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'export-panel.js'));
    const cognitivePanelUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'cognitive-panel.js'));
    const shapeLegendUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'shape-legend.js'));
    const forceGraphUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'force-graph.min.js'));
    const rendererManagerUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'renderer-manager.js'));
    const forceGraph3DUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, '3d-force-graph.min.js'));
    const minimapUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'minimap.js'));

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src 'unsafe-inline' ${webview.cspSource}; img-src ${webview.cspSource} blob: data:;">
  <title>Ecosystem Graph</title>
  <style>
    /* ── Reset & Base ─────────────────────────────────────────────── */
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #0d0d0d;
      color: #ffffff;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif);
      font-size: 12px;
    }

    /* ── Graph Container ──────────────────────────────────────────── */
    #graph {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }

    /* ── Radial Glow Overlay (fixed center, not affected by zoom/pan) ── */
    #radial-glow {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
      background: radial-gradient(ellipse at center, rgba(26, 58, 92, 0.18) 0%, rgba(13, 13, 13, 0) 65%);
    }

    /* ── Central Pulse Orb ────────────────────────────────────────── */
    #pulse-core-2d {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 3;
      background: radial-gradient(circle, rgba(74,158,255,0.6) 0%, rgba(74,158,255,0.1) 60%, transparent 100%);
      animation: corePulse2D 3s ease-in-out infinite;
    }

    @keyframes corePulse2D {
      0% { box-shadow: 0 0 15px 5px rgba(74,158,255,0.3), 0 0 30px 10px rgba(74,158,255,0.15), inset 0 0 10px rgba(74,158,255,0.4); transform: translate(-50%,-50%) scale(1); }
      50% { box-shadow: 0 0 25px 10px rgba(74,158,255,0.5), 0 0 50px 20px rgba(74,158,255,0.25), inset 0 0 15px rgba(74,158,255,0.6); transform: translate(-50%,-50%) scale(1.4); }
      100% { box-shadow: 0 0 15px 5px rgba(74,158,255,0.3), 0 0 30px 10px rgba(74,158,255,0.15), inset 0 0 10px rgba(74,158,255,0.4); transform: translate(-50%,-50%) scale(1); }
    }

    /* ── Central Heartbeat Pulse ──────────────────────────────────── */
    @keyframes corePulse {
      0% {
        box-shadow: 0 0 15px 5px rgba(74,158,255,0.3), 0 0 30px 10px rgba(74,158,255,0.15), inset 0 0 10px rgba(74,158,255,0.4);
        transform: translate(-50%,-50%) scale(1);
      }
      50% {
        box-shadow: 0 0 25px 10px rgba(74,158,255,0.5), 0 0 50px 20px rgba(74,158,255,0.25), inset 0 0 15px rgba(74,158,255,0.6);
        transform: translate(-50%,-50%) scale(1.4);
      }
      100% {
        box-shadow: 0 0 15px 5px rgba(74,158,255,0.3), 0 0 30px 10px rgba(74,158,255,0.15), inset 0 0 10px rgba(74,158,255,0.4);
        transform: translate(-50%,-50%) scale(1);
      }
    }

    #pulse-core {
      background: radial-gradient(circle, rgba(74,158,255,0.6) 0%, rgba(74,158,255,0.1) 60%, transparent 100%);
      animation: corePulse 3s ease-in-out infinite;
    }

    /* ── Empty State Message ──────────────────────────────────────── */
    #empty-message {
      display: none;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      opacity: 0.5;
      font-size: 14px;
      pointer-events: none;
      z-index: 10;
    }

    /* ── Controls (search/filter) — placeholder for task 10.1 ─────── */
    #controls {
      position: fixed;
      top: 8px;
      left: 8px;
      right: 50px;
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    #controls input[type="text"] {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 4px;
      color: #fff;
      padding: 5px 8px;
      font-size: 11px;
      width: 180px;
      outline: none;
    }

    #controls input[type="text"]:focus {
      border-color: #4A9EFF;
    }

    #controls .filter-toggles {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    /* ── Tooltip ───────────────────────────────────────────────────── */
    #tooltip {
      display: none;
      position: fixed;
      z-index: 200;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11px;
      line-height: 1.5;
      pointer-events: none;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    }

    #tooltip strong {
      color: #ffffff;
      font-size: 12px;
    }

    #tooltip .tooltip-type {
      color: #aaa;
      font-style: italic;
    }

    #tooltip .tooltip-path {
      color: #888;
      font-size: 10px;
      word-break: break-all;
    }

    /* ── Legend (fixed bottom-right) ───────────────────────────────── */
    #legend {
      position: fixed;
      bottom: 12px;
      right: 12px;
      z-index: 100;
      background: rgba(26, 26, 26, 0.9);
      border: 1px solid #333;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 10px;
    }

    #legend .legend-title {
      color: #aaa;
      font-weight: 600;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 9px;
    }

    #legend .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
    }

    #legend .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    #legend .legend-label {
      color: #ccc;
    }

    /* ── Stats Overlay (fixed bottom-left) ───────────────────────── */
    #stats {
      position: fixed;
      bottom: 12px;
      left: 12px;
      z-index: 100;
      background: rgba(26, 26, 26, 0.9);
      border: 1px solid #333;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 10px;
      color: #aaa;
      pointer-events: none;
    }

    /* ── Zoom/Position Debug Indicator ─────────────────────────────── */
    #zoom-debug {
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      background: rgba(26, 26, 26, 0.9);
      border: 1px solid #333;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 10px;
      color: #4A9EFF;
      font-family: monospace;
    }

    /* ── Settings Panel — placeholder for task 9.3 ────────────────── */
    #settings-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 220px;
      height: 100%;
      background: rgba(26, 26, 26, 0.95);
      border-left: 1px solid #333;
      z-index: 150;
      display: none;
      overflow-y: auto;
      padding: 12px;
      box-sizing: border-box;
    }

    #settings-panel.visible {
      display: block;
    }

    #settings-panel .panel-title {
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #fff;
    }

    /* ── Settings Panel Controls ──────────────────────────────────── */
    #settings-panel .settings-section {
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #2a2a2a;
    }

    #settings-panel .settings-section:last-child {
      border-bottom: none;
    }

    #settings-panel .section-header {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      margin-bottom: 8px;
    }

    #settings-panel .setting-row {
      margin-bottom: 8px;
    }

    #settings-panel .setting-label {
      display: block;
      font-size: 10px;
      color: #bbb;
      margin-bottom: 3px;
    }

    #settings-panel .setting-control {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    #settings-panel .settings-slider {
      flex: 1;
      height: 3px;
      -webkit-appearance: none;
      appearance: none;
      background: #333;
      border-radius: 2px;
      outline: none;
      cursor: pointer;
    }

    #settings-panel .settings-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #4A9EFF;
      cursor: pointer;
    }

    #settings-panel .setting-value {
      font-size: 9px;
      color: #888;
      min-width: 28px;
      text-align: right;
    }

    #settings-panel .setting-row-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    #settings-panel .setting-row-toggle .setting-label {
      display: inline;
      margin-bottom: 0;
    }

    #settings-panel .settings-checkbox {
      width: 14px;
      height: 14px;
      cursor: pointer;
      accent-color: #4A9EFF;
    }

    #settings-panel .setting-row-radio .setting-label {
      margin-bottom: 4px;
    }

    #settings-panel .radio-group {
      display: flex;
      gap: 8px;
    }

    #settings-panel .radio-option {
      font-size: 10px;
      color: #bbb;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    #settings-panel .radio-option input[type="radio"] {
      width: 11px;
      height: 11px;
      accent-color: #4A9EFF;
      cursor: pointer;
    }

    #settings-panel .settings-btn {
      width: 100%;
      padding: 6px 0;
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 4px;
      color: #ccc;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.15s;
    }

    #settings-panel .settings-btn:hover {
      background: #3a3a3a;
      color: #fff;
    }
  </style>
</head>
<body data-3d-graph-uri="${forceGraph3DUri}" data-nonce="${nonce}">
  <!-- Controls: search input and filter toggles (wired in task 10.1) -->
  <div id="controls">
    <input type="text" id="search-input" placeholder="Search nodes..." />
    <div class="filter-toggles" id="filter-toggles">
      <!-- Toggle buttons populated by task 10.1 -->
    </div>
  </div>

  <!-- Graph canvas container -->
  <div id="graph"></div>

  <!-- Central heartbeat pulse (shared between 2D and 3D) -->
  <div id="pulse-core" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:20px;height:20px;border-radius:50%;pointer-events:none;z-index:1;"></div>

  <!-- Radial glow overlay (stays centered regardless of zoom/pan) -->
  <div id="radial-glow"></div>

  <!-- Central pulse orb (heartbeat of the ecosystem) -->
  <div id="pulse-core-2d"></div>

  <!-- Empty state message -->
  <div id="empty-message">No ecosystem data found.<br>Add steering files to .kiro/steering/ to get started.</div>

  <!-- Tooltip (positioned on hover) -->
  <div id="tooltip"></div>

  <!-- Legend (fixed bottom-right, always visible) -->
  <div id="legend"></div>

  <!-- Stats overlay (fixed bottom-left) -->
  <div id="stats"></div>

  <!-- Zoom slider + debug -->
  <div id="zoom-control" style="position:fixed;bottom:38px;left:50%;transform:translateX(-50%);z-index:100;display:flex;align-items:center;gap:8px;">
    <input type="range" id="zoom-slider" min="0.3" max="4" step="0.05" value="1.28" style="width:120px;height:3px;accent-color:#4A9EFF;cursor:pointer;" />
    <span id="zoom-slider-value" style="font-size:9px;color:#888;font-family:monospace;min-width:30px;">1.28</span>
  </div>

  <!-- Zoom/Position debug (temporary - shows current zoom and center) -->
  <div id="zoom-debug">zoom: 2.0 | center: 0, 0</div>

  <!-- Settings panel (fixed right, toggled by gear icon) -->
  <div id="settings-panel"></div>

  <!-- Scripts -->
  <script nonce="${nonce}" src="${forceGraphUri}"></script>
  <script nonce="${nonce}" src="${rendererManagerUri}"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
  <script nonce="${nonce}" src="${filterPanelUri}"></script>
  <script nonce="${nonce}" src="${healthPanelUri}"></script>
  <script nonce="${nonce}" src="${interactionsPanelUri}"></script>
  <script nonce="${nonce}" src="${gapDetectorUri}"></script>
  <script nonce="${nonce}" src="${alternativeViewsUri}"></script>
  <script nonce="${nonce}" src="${visualModesUri}"></script>
  <script nonce="${nonce}" src="${exportPanelUri}"></script>
  <script nonce="${nonce}" src="${settingsPanelUri}"></script>
  <script nonce="${nonce}" src="${cognitivePanelUri}"></script>
  <script nonce="${nonce}" src="${shapeLegendUri}"></script>
  <script nonce="${nonce}" src="${minimapUri}"></script>
</body>
</html>`;
  }
}

/**
 * Generates a random nonce string for CSP script-src.
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
