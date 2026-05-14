import * as vscode from 'vscode';
import { FileDiscoveryService } from './services/fileDiscoveryService';
import { ParserService } from './services/parserService';
import { NodeClassifier } from './services/nodeClassifier';
import { GraphDataStore } from './services/graphDataStore';
import { PathResolver } from './services/pathResolver';
import { StatsHistoryService } from './services/statsHistoryService';
import { AnnotationService } from './services/annotationService';
import { SnapshotService } from './services/snapshotService';
import { EcosystemGraphProvider } from './webview/webviewProvider';
import { FileChangeEvent } from './types';

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const pathResolver = new PathResolver();
  const nodeClassifier = new NodeClassifier();
  const parserService = new ParserService(nodeClassifier, pathResolver);
  const graphDataStore = new GraphDataStore(nodeClassifier);
  const fileDiscoveryService = new FileDiscoveryService();
  const statsHistoryService = new StatsHistoryService(workspaceFolders[0].uri);
  const annotationService = new AnnotationService(workspaceFolders[0].uri);
  const snapshotService = new SnapshotService(workspaceFolders[0].uri);

  const webviewProvider = new EcosystemGraphProvider(
    context.extensionUri,
    graphDataStore,
    pathResolver,
    annotationService,
    snapshotService
  );

  const viewRegistration = vscode.window.registerWebviewViewProvider(
    'ecosystemGraphView',
    webviewProvider
  );

  const showCommand = vscode.commands.registerCommand('ecosystemGraph.show', () => {
    webviewProvider.show();
  });

  // Initial discovery and graph population
  initializeGraph(fileDiscoveryService, parserService, graphDataStore, webviewProvider, statsHistoryService, annotationService, snapshotService);

  // File watcher for incremental updates
  const fileWatcher = fileDiscoveryService.watchForChanges((event: FileChangeEvent) => {
    handleFileChange(event, fileDiscoveryService, parserService, graphDataStore, webviewProvider, statsHistoryService, annotationService, snapshotService);
  });

  context.subscriptions.push(viewRegistration, showCommand, fileWatcher);
}

export function deactivate(): void {
  // Cleanup handled by disposables in context.subscriptions
}

/**
 * Computes eccentricity (max shortest path via BFS) for each node in the graph.
 * Sets `eccentricity` in node metadata. Nodes in disconnected components get Infinity.
 */
function computeEccentricities(graphDataStore: GraphDataStore): void {
  const nodes = graphDataStore.getNodes();
  const edges = graphDataStore.getEdges();

  // Build adjacency list (undirected)
  const adj: Map<string, string[]> = new Map();
  for (const node of nodes) { adj.set(node.id, []); }
  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target);
    adj.get(edge.target)?.push(edge.source);
  }

  // BFS from each node to find max shortest path
  for (const node of nodes) {
    let maxDist = 0;
    const visited = new Set<string>([node.id]);
    const queue: { id: string; dist: number }[] = [{ id: node.id, dist: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adj.get(current.id) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          const dist = current.dist + 1;
          if (dist > maxDist) { maxDist = dist; }
          queue.push({ id: neighbor, dist });
        }
      }
    }

    // If node couldn't reach all nodes, it's in an island — set eccentricity to Infinity
    const eccentricity = visited.size < nodes.length ? Infinity : maxDist;
    node.metadata = { ...node.metadata, eccentricity };
  }
}

async function initializeGraph(
  discoveryService: FileDiscoveryService,
  parserService: ParserService,
  graphDataStore: GraphDataStore,
  webviewProvider: EcosystemGraphProvider,
  statsHistoryService: StatsHistoryService,
  annotationService: AnnotationService,
  snapshotService: SnapshotService
): Promise<void> {
  try {
    const files = await discoveryService.discoverAll();

    // Build knownSteeringFiles map from steering files only (used by hook prompt scanning)
    const knownSteeringFiles = new Map<string, string>();
    for (const f of files) {
      if (f.category === 'steering') {
        const basename = f.relativePath.split('/').pop() || '';
        knownSteeringFiles.set(basename, f.relativePath);
      }
    }

    for (const file of files) {
      try {
        const document = await vscode.workspace.openTextDocument(file.uri);
        const content = document.getText();

        // Route by category: steering → parse(), skill → parseSkill(), hook → parseHook()
        let result;
        switch (file.category) {
          case 'steering':
            result = parserService.parse(file, content, knownSteeringFiles);
            break;
          case 'skill':
            result = parserService.parseSkill(file, content, knownSteeringFiles);
            break;
          case 'hook':
            result = parserService.parseHook(file, content, knownSteeringFiles);
            break;
        }

        // Skip null results from parseHook() (invalid JSON)
        if (!result) {
          continue;
        }

        // Attach birthtime and mtime from file stat
        try {
          const stat = await vscode.workspace.fs.stat(file.uri);
          result.node.metadata = { ...result.node.metadata, birthtime: stat.ctime, mtime: stat.mtime };
        } catch {
          // Stat unavailable (e.g., network filesystem) — skip
        }

        // Attach lineCount from file content
        const lineCount = content.split('\n').length;
        result.node.metadata = { ...result.node.metadata, lineCount };

        graphDataStore.upsertFile(result);
      } catch {
        // Skip files that fail to parse — retain graph without them
      }
    }

    // Compute eccentricity for all nodes after graph is fully built
    computeEccentricities(graphDataStore);

    // Record stats snapshot
    await statsHistoryService.load();
    await statsHistoryService.recordSnapshot(
      graphDataStore.getNodes().length,
      graphDataStore.getEdges().length
    );

    // Load annotations and snapshot list
    await annotationService.load();
    const annotations = annotationService.getAll();
    const snapshotList = await snapshotService.list();

    const statsHistory = statsHistoryService.getRecentSnapshots();
    webviewProvider.updateGraph(graphDataStore.getSerializableGraph(), statsHistory, annotations, snapshotList);
  } catch {
    // Discovery failure — graph starts empty
  }
}

async function handleFileChange(
  event: FileChangeEvent,
  discoveryService: FileDiscoveryService,
  parserService: ParserService,
  graphDataStore: GraphDataStore,
  webviewProvider: EcosystemGraphProvider,
  statsHistoryService: StatsHistoryService,
  annotationService: AnnotationService,
  snapshotService: SnapshotService
): Promise<void> {
  if (event.type === 'deleted') {
    graphDataStore.removeFile(event.file.relativePath);
  } else {
    try {
      const files = await discoveryService.discoverAll();

      // Build knownSteeringFiles map from steering files only
      const knownSteeringFiles = new Map<string, string>();
      for (const f of files) {
        if (f.category === 'steering') {
          const basename = f.relativePath.split('/').pop() || '';
          knownSteeringFiles.set(basename, f.relativePath);
        }
      }

      const document = await vscode.workspace.openTextDocument(event.file.uri);
      const content = document.getText();

      // Route by category: steering → parse(), skill → parseSkill(), hook → parseHook()
      let result;
      switch (event.file.category) {
        case 'steering':
          result = parserService.parse(event.file, content, knownSteeringFiles);
          break;
        case 'skill':
          result = parserService.parseSkill(event.file, content, knownSteeringFiles);
          break;
        case 'hook':
          result = parserService.parseHook(event.file, content, knownSteeringFiles);
          break;
      }

      // Skip null results from parseHook() (invalid JSON)
      if (!result) {
        return;
      }

      // Attach birthtime and mtime from file stat
      try {
        const stat = await vscode.workspace.fs.stat(event.file.uri);
        result.node.metadata = { ...result.node.metadata, birthtime: stat.ctime, mtime: stat.mtime };
      } catch {
        // Stat unavailable — skip
      }

      // Attach lineCount from file content
      const lineCount = content.split('\n').length;
      result.node.metadata = { ...result.node.metadata, lineCount };

      graphDataStore.upsertFile(result);
    } catch {
      // Parse failure — retain previous valid state
    }
  }

  // Recompute eccentricity after graph change
  computeEccentricities(graphDataStore);

  // Record stats snapshot after graph change
  await statsHistoryService.recordSnapshot(
    graphDataStore.getNodes().length,
    graphDataStore.getEdges().length
  );

  // Load annotations and snapshot list
  await annotationService.load();
  const annotations = annotationService.getAll();
  const snapshotList = await snapshotService.list();

  const statsHistory = statsHistoryService.getRecentSnapshots();
  webviewProvider.updateGraph(graphDataStore.getSerializableGraph(), statsHistory, annotations, snapshotList);
}
