# Implementation Plan: Ecosystem Graph Extension

## Overview

Implementacao incremental da extensao VS Code "Ecosystem Graph" em TypeScript. Cada task constroi sobre a anterior, comecando pelo scaffolding do projeto, passando pelos servicos core (discovery, parser, classifier, graph store), webview com force-graph, interacoes do usuario, file watching incremental, e finalizando com testes e packaging.

## Tasks

- [ ] 1. Project scaffolding and extension boilerplate
  - [x] 1.1 Initialize VS Code extension project structure
    - Create `package.json` with extension manifest (commands, activation events, viewsContainers, contributes)
    - Create `tsconfig.json` with strict mode and ES2020 target
    - Create `.vscodeignore`, `.eslintrc.json`
    - Register command `ecosystemGraph.show` and activity bar icon in package.json contributes
    - Install dependencies: `force-graph`, `vscode` types
    - Install dev dependencies: `mocha`, `@types/mocha`, `fast-check`, `@vscode/test-electron`, `esbuild`
    - _Requirements: 7.1, 7.4, 9.2, 9.3_

  - [x] 1.2 Create extension entry point and activation
    - Create `src/extension.ts` with `activate()` and `deactivate()` functions
    - Register the `ecosystemGraph.show` command
    - Wire up FileDiscoveryService, ParserService, GraphDataStore, WebviewProvider on activation
    - _Requirements: 7.1, 7.2_

- [ ] 2. Implement core interfaces and types
  - [x] 2.1 Define all TypeScript interfaces and types
    - Create `src/types.ts` with: SteeringFile, FileChangeEvent, ParseResult, Reference, ReferenceType, GraphNode, GraphEdge, NodeType, SerializedGraph, PanelState, FilterState, ExtensionMessage, WebviewMessage
    - _Requirements: 2.1-2.7, 3.1, 4.1_

- [ ] 3. Implement NodeClassifier
  - [x] 3.1 Create NodeClassifier service
    - Create `src/services/nodeClassifier.ts`
    - Implement prefix-based classification rules: flow-* → steering-flow, help-* → steering-help, playbook* → steering-playbook, observability-* → steering-observability, *-dominio*/*-domain* → steering-domain
    - Implement workspace folder classification for code-file type
    - Implement fallback to "unknown" type
    - Implement color mapping (injective function over NodeType → hex color)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 Write property test for node classification (Property 6)
    - **Property 6: Node classification from filename prefix**
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.5**

  - [ ]* 3.3 Write property test for color mapping uniqueness (Property 7)
    - **Property 7: Color mapping uniqueness**
    - **Validates: Requirements 3.2**

- [ ] 4. Implement FileDiscoveryService
  - [x] 4.1 Create FileDiscoveryService
    - Create `src/services/fileDiscoveryService.ts`
    - Implement `discoverAll()`: scan all workspace folders for `.kiro/steering/*.md` using `vscode.workspace.findFiles`
    - Skip folders without `.kiro/steering/` directory without error
    - Map discovered URIs to SteeringFile objects with workspaceFolder name and relativePath
    - _Requirements: 1.1, 1.3, 1.4_

  - [ ]* 4.2 Write property test for file discovery (Property 1)
    - **Property 1: File discovery finds all steering files across workspace folders**
    - **Validates: Requirements 1.1, 1.3**

- [ ] 5. Implement ParserService
  - [x] 5.1 Create ParserService with regex-based reference extraction
    - Create `src/services/parserService.ts`
    - Implement regex patterns: wikiLink (`#[[file:path]]`), markdownLink (`[text](path)` excluding http/https), backtickRef (`` `filename.md` ``), tablePath (`| path/to/file.ext |`)
    - Implement front-matter YAML extraction for `inclusion` metadata
    - Accept `knownSteeringFiles` parameter; only create edges for backtick refs that match a known steering file name
    - Return ParseResult with GraphNode and array of References
    - Mark target nodes as unresolved when target file does not exist on disk (for wiki-link, markdown-link, table-path only)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 5.2 Write property test for reference extraction completeness (Property 2)
    - **Property 2: Reference extraction completeness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [ ]* 5.3 Write property test for unresolved targets (Property 3)
    - **Property 3: Unresolved targets are marked correctly**
    - **Validates: Requirements 2.5**

  - [ ]* 5.4 Write property test for front-matter metadata extraction (Property 4)
    - **Property 4: Front-matter metadata extraction**
    - **Validates: Requirements 2.6**

  - [ ]* 5.5 Write property test for reference parsing round-trip (Property 5)
    - **Property 5: Reference parsing round-trip**
    - **Validates: Requirements 2.7**

- [ ] 6. Checkpoint - Core services validation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement GraphDataStore
  - [x] 7.1 Create GraphDataStore with incremental update support
    - Create `src/services/graphDataStore.ts`
    - Implement in-memory storage of GraphNode[] and GraphEdge[]
    - Implement `upsertFile(result: ParseResult)`: add/update nodes and edges for a single file
    - Implement `removeFile(filePath: string)`: remove node and all associated edges
    - Implement `getSerializableGraph()`: return SerializedGraph for webview consumption
    - Ensure upsertFile only modifies nodes/edges associated with the changed file (isolation)
    - _Requirements: 8.2, 8.4_

  - [ ]* 7.2 Write property test for incremental update isolation (Property 12)
    - **Property 12: Incremental update isolation**
    - **Validates: Requirements 8.2**

  - [ ]* 7.3 Write property test for error resilience (Property 13)
    - **Property 13: Error resilience preserves valid state**
    - **Validates: Requirements 8.4**

- [ ] 8. Implement path resolution utility
  - [x] 8.1 Create path resolver for cross-workspace-folder references
    - Create `src/services/pathResolver.ts`
    - Implement resolution of relative paths accounting for workspace folder roots
    - Ensure deterministic resolution (same relative path from same folder always resolves to same absolute path)
    - _Requirements: 5.3_

  - [ ]* 8.2 Write property test for path resolution (Property 8)
    - **Property 8: Path resolution across workspace folders**
    - **Validates: Requirements 5.3**

- [ ] 9. Implement WebviewProvider and graph panel
  - [x] 9.1 Create WebviewProvider class
    - Create `src/webview/webviewProvider.ts`
    - Implement `vscode.WebviewViewProvider` interface
    - Handle panel lifecycle (create, dispose, visibility change)
    - Implement `postMessage` communication: send `updateGraph` messages to webview
    - Handle incoming messages: `openFile`, `ready`, `stateChanged`
    - Persist and restore PanelState via `vscode.getState()`/`vscode.setState()`
    - Open files in editor on `openFile` message, show info message if file not found
    - _Requirements: 7.1, 7.2, 7.3, 5.1, 5.2_

  - [x] 9.2 Create webview HTML/CSS/JS with force-graph integration and neural network visual
    - Create `src/webview/media/` directory with webview assets
    - Create HTML template with: controls div (search input, toggle buttons), graph container div, tooltip div, legend div (fixed bottom-right), settings panel div (collapsible right side)
    - Bundle `force-graph` library for canvas 2D rendering
    - Implement dark background (#0d0d0d) with neural cosmos aesthetic
    - Implement node glow/bloom effect using canvas shadowBlur and shadowColor matching node color
    - Implement links as thin semi-transparent lines (opacity 0.15, width 0.5px) that brighten on hover (opacity 0.7, width 1.5px)
    - Implement continuous force simulation (alphaDecay 0.005, cooldownTime Infinity) for subtle organic movement
    - Implement label visibility threshold: labels appear only at zoom > 1.5x
    - Implement force-directed layout rendering with node colors by type
    - Implement node sizing proportional to degree: baseSize (4px) + degree * scaleFactor (1.5px)
    - Implement fixed legend showing all NodeType colors (always visible, not affected by zoom/pan)
    - Implement zoom (mouse wheel/trackpad), pan (drag background), drag nodes
    - Implement hover: show tooltip with file path and node type, highlight connected edges and adjacent nodes
    - _Requirements: 4.1-4.14_

  - [x] 9.3 Create settings panel with real-time controls
    - Create collapsible panel on right side of webview
    - Implement sliders: center force (0-0.2), repulsion force (-300 to 0), link force (0-1), link distance (20-200), node size multiplier (0.5-3), link width (0.1-3)
    - Implement toggles: show arrows, label visibility (on/off/auto), show only existing files, show orphan nodes
    - Implement "Animate" button to restart force simulation
    - Wire sliders to force-graph parameters for real-time updates (no re-parse needed)
    - Persist settings in PanelState via setState/getState
    - _Requirements: 4b.1-4b.6_

  - [ ]* 9.4 Write property test for panel state persistence round-trip (Property 11)
    - **Property 11: Panel state persistence round-trip**
    - **Validates: Requirements 7.3**

- [ ] 10. Implement filter and search functionality
  - [x] 10.1 Create filter/search logic in webview
    - Implement text search input that filters nodes by label (case-insensitive contains)
    - Implement toggle buttons to show/hide nodes by NodeType
    - Implement toggle buttons to show/hide nodes by workspace folder
    - Highlight matching nodes, dim non-matching nodes
    - Filter edges: only show edges where both source and target are visible
    - Display "no ecosystem data found" message when graph has zero nodes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.5_

  - [ ]* 10.2 Write property test for filter matching (Property 9)
    - **Property 9: Filter matching partitions nodes correctly**
    - **Validates: Requirements 6.2**

  - [ ]* 10.3 Write property test for edge visibility (Property 10)
    - **Property 10: Edge visibility follows node visibility**
    - **Validates: Requirements 6.5**

- [ ] 11. Checkpoint - Webview and interaction validation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement file watching and incremental updates
  - [x] 12.1 Create file watcher with debounce
    - Implement `watchForChanges()` in FileDiscoveryService using `vscode.workspace.createFileSystemWatcher`
    - Watch pattern: `**/.kiro/steering/*.md` across all workspace folders
    - Emit FileChangeEvent (created, changed, deleted) on file system changes
    - Implement 500ms debounce to avoid excessive re-parsing on rapid changes
    - On file change: re-parse only the changed file, call `graphDataStore.upsertFile()`
    - On file delete: call `graphDataStore.removeFile()`
    - On file create: parse new file and add to graph
    - On parse failure: retain previous valid state, log warning
    - Update webview within 2 seconds of file save
    - Update discovered file list within 5 seconds of create/delete
    - _Requirements: 1.2, 8.1, 8.2, 8.3, 8.4_

  - [ ]* 12.2 Write unit tests for file watcher debounce and incremental update
    - Test debounce behavior (multiple rapid changes result in single parse)
    - Test that parse failure retains previous state
    - _Requirements: 8.3, 8.4_

- [ ] 13. Implement click-to-open file navigation
  - [x] 13.1 Wire node click to file opening
    - Handle `openFile` postMessage from webview in WebviewProvider
    - Resolve file path using pathResolver across workspace folders
    - Open file in VS Code editor via `vscode.workspace.openTextDocument` + `vscode.window.showTextDocument`
    - Show informational message when file does not exist
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 14. Checkpoint - Full feature integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Packaging and publishing setup
  - [x] 15.1 Configure extension bundling and packaging
    - Create `esbuild.config.js` for extension bundling (extension host + webview)
    - Add build scripts to package.json: `compile`, `watch`, `package`, `publish`
    - Create `CHANGELOG.md` and `LICENSE` (MIT)
    - Configure `.vscodeignore` to exclude test files, source maps, node_modules
    - Ensure extension works offline without network access
    - Add `vsce` as dev dependency for packaging
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 16. Final checkpoint - All tests pass and extension packages correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Extension source lives in `Workspace/tools/ecosystem-graph/` (will be extracted to its own repo later)
- The extension is fully generic — no references to any specific project in the source code. Works with any Kiro workspace that has steering files.
- Extension name for marketplace: "Kiro Ecosystem Graph" (or similar generic name)
- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use `fast-check` with minimum 100 iterations per property
- Unit tests use Mocha + assert
- The extension is entirely offline, no network dependencies
- force-graph handles canvas 2D rendering with native zoom/pan/drag support
