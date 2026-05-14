# Implementation Plan: Ecosystem Graph Cognitive Insights

## Overview

Evolucao do Ecosystem Graph de visualizacao de arquivos para mapa cerebral completo do agente. Implementacao aditiva: novos campos em tipos existentes, novos metodos em servicos existentes, e novos modulos webview independentes. Linguagem: TypeScript (extension host) + vanilla JavaScript (webview).

## Tasks

- [x] 1. Type system updates
  - [x] 1.1 Add `'hook-implicit'` to `ReferenceType` union in `src/types.ts`
    - Add the new literal type to the existing union
    - _Requirements: 1.6_

  - [x] 1.2 Expand `GraphNode.metadata` interface with hook fields
    - Add optional fields: `whenType?: string`, `description?: string`, `referencedSteerings?: string[]`
    - _Requirements: 4.5_

- [x] 2. Parser changes — implicit hook edges and metadata
  - [x] 2.1 Implement `extractImplicitHookEdges()` private method in `parserService.ts`
    - Scan `json.toolTypes[]` for matches against known steering filenames (case-insensitive)
    - Scan `json.patterns[].fileMatch` globs against known steering file paths
    - Map `when.type` values (`fileCreated`/`fileChanged`) to steerings with `inclusion: fileMatch`
    - Create edges with type `'hook-implicit'`
    - Deduplicate using a `Set<string>` of target paths (shared with prompt refs)
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [x] 2.2 Integrate implicit edge extraction into `parseHook()` method
    - Call `extractImplicitHookEdges()` after existing `extractHookPromptRefs()`
    - Pass the same `seen` Set to both methods for deduplication across prompt + implicit
    - Preserve existing prompt reference extraction (do not remove or replace)
    - _Requirements: 1.4, 1.5_

  - [x] 2.3 Extract and store hook metadata (`whenType`, `description`, `referencedSteerings`)
    - In `parseHook()`, populate `node.metadata.whenType` from `json.when.type`
    - Populate `node.metadata.description` from `json.description`
    - Populate `node.metadata.referencedSteerings` with labels of all referenced steering nodes
    - _Requirements: 4.5_

  - [ ]* 2.4 Write property tests for implicit hook edge extraction (Properties 1-4)
    - **Property 1: Implicit hook edges from toolTypes**
    - **Property 2: Implicit hook edges from fileMatch patterns**
    - **Property 3: Prompt edge preservation**
    - **Property 4: Edge deduplication per hook-steering pair**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6**

- [x] 3. Checkpoint — Compile verification
  - Ensure `npm run compile` passes with no errors, ask the user if questions arise.

- [x] 4. Discovery changes — recursive skill glob and deduplication
  - [x] 4.1 Add recursive skill glob and deduplication logic to `fileDiscoveryService.ts`
    - Add new pattern `{ glob: '**/.kiro/skills/**/SKILL.md', category: 'skill' }` to ECOSYSTEM_PATTERNS
    - Add deduplication logic using a `Set<string>` of `uri.fsPath` to skip duplicates in `discoverAll()`
    - _Requirements: 2.1, 2.3_

  - [x] 4.2 Implement parent folder label logic in `parseSkill()` for nested SKILL.md files
    - When filename (case-insensitive) equals `SKILL.md`, use the parent directory name as the node label
    - When filename is anything else (e.g., `my-skill.md`), keep existing behavior (filename without extension)
    - _Requirements: 2.2_

  - [ ]* 4.3 Write property tests for discovery deduplication and skill label (Properties 5-6)
    - **Property 5: SKILL.md label from parent folder**
    - **Property 6: File discovery deduplication**
    - **Validates: Requirements 2.2, 2.3**

- [x] 5. Webview changes — edge weight rendering
  - [x] 5.1 Extend `computeEdgeWeights()` to track reference types array
    - Currently returns `{ source, target, weight, type }` — extend to include `types: ReferenceType[]` (all distinct types in the merged edges)
    - This enables the edge tooltip to show which reference types connect two nodes
    - _Requirements: 3.5_

  - [x] 5.2 Implement edge weight formula in `webview.js` link rendering
    - In the `linkCanvasObject` callback, compute `scaledWidth = settings.linkWidth * (1 + Math.log2(weight))`
    - Cap at `Math.min(scaledWidth, 5)` pixels
    - Fallback: if `link.weight` is undefined/NaN, treat as 1
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.3 Implement edge hover tooltip in `webview.js`
    - Add hit detection for edges (via ForceGraph `onLinkHover` callback)
    - Show tooltip with reference count and reference types on hover
    - Hide tooltip on mouse leave
    - _Requirements: 3.5_

  - [x]* 5.4 Write property test for edge width formula (Property 7)
    - **Property 7: Edge width formula correctness**
    - **Validates: Requirements 3.1, 3.3, 3.4**

- [x] 6. Webview changes — enhanced hook tooltips
  - [x] 6.1 Enhance hook node tooltip in `webview.js`
    - When hovering a hook node (`type === 'hook-manual' || type === 'hook-auto'`):
    - Show `whenType` (trigger type) if present in metadata
    - Show `description` if present in metadata
    - Show list of `referencedSteerings` if present and non-empty
    - Omit fields that are undefined/null/empty (no empty placeholders)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.2 Write property test for hook tooltip metadata (Property 8)
    - **Property 8: Hook tooltip contains all present metadata**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 7. Checkpoint — Compile and visual verification
  - Ensure `npm run compile` passes with no errors, ask the user if questions arise.

- [x] 8. New webview module — cognitive-panel.js
  - [x] 8.1 Create `src/webview/media/cognitive-panel.js`
    - Follow the same IIFE toggle-panel pattern as `health-panel.js`
    - Add toggle button to `advanced-toolbar` with brain icon (🧠 or unicode equivalent)
    - Panel hidden by default, positioned fixed right side BELOW the health panel (top: 280px or dynamic)
    - If health panel is hidden, cognitive panel should still position correctly (use fixed offset from toolbar)
    - Panel must NOT overlap with health panel — use mutual exclusion or stacked positioning
    - _Requirements: 7.7_

  - [x] 8.2 Implement cognitive analysis computation in `cognitive-panel.js`
    - Section "Steerings Soltos": steering nodes with 0 incoming + 0 outgoing edges
    - Section "Vinculos Frageis": edges with weight=1 AND type='backtick-ref'
    - Section "Arquivos sem Contexto": nodes with 0 total edges (any type)
    - Section "Coverage Gaps": workspace folders with 0 steering files
    - Section "Sugestoes": actionable recommendations based on detected issues
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 8.3 Implement panel update on graph data change
    - Expose `updateCognitivePanel(graphData, degreeMap, workspaceFolders)` function
    - Call from `webview.js` whenever graph data is refreshed (same pattern as `updateHealthPanel`)
    - _Requirements: 7.6_

  - [x] 8.4 Implement node click-to-highlight from cognitive panel
    - When user clicks a node name in the panel, emit highlight/center action to the graph
    - Reuse existing `highlightNode` mechanism from webview.js
    - _Requirements: 7.8_

  - [ ]* 8.5 Write property tests for cognitive panel computations (Properties 11-15)
    - **Property 11: Steerings soltos computation**
    - **Property 12: Fragile edges computation**
    - **Property 13: Context-less files computation**
    - **Property 14: Coverage gaps computation**
    - **Property 15: Suggestions non-empty when issues exist**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [x] 9. New webview module — shape-legend.js
  - [x] 9.1 Create `src/webview/media/shape-legend.js`
    - Render inline SVG shapes: circle (steerings), diamond (skills), triangle (hooks)
    - Each shape colored using the corresponding COLOR_MAP value
    - Position: bottom-left, ABOVE the stats overlay and Export/Snapshot buttons (use bottom: 60px; left: 8px)
    - Only show shapes for types that actually exist in the current graph data
    - Small and compact (max 120px wide) to not obstruct the graph
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 9.2 Write property test for shape legend colors (Property 10)
    - **Property 10: Shape legend color matches COLOR_MAP**
    - **Validates: Requirements 6.4**

- [x] 10. Gap detector verification
  - [x] 10.1 Verify gap-detector.js includes all node types without filtering
    - Confirm `computeSuggestedConnections`, `computeDeadZones`, `computeCoverageMap`, `computeRedundancyPairs` operate on all nodes regardless of type
    - No code changes expected — this is a verification task
    - If any function filters by type, add skill/hook inclusion
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 10.2 Write property test for gap detector all-types inclusion (Property 9)
    - **Property 9: Gap detector includes all node types**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 11. Checkpoint — Full compile verification
  - Ensure `npm run compile` passes with no errors, ask the user if questions arise.

- [x] 12. Wire new webview modules into HTML and webview.js
  - [x] 12.1 Add script tags for `cognitive-panel.js` and `shape-legend.js` in webview HTML template
    - Add to `webviewProvider.ts` HTML generation (same pattern as health-panel.js, gap-detector.js)
    - _Requirements: 7.7, 6.5_

  - [x] 12.2 Call `updateCognitivePanel()` from webview.js graph update flow
    - Invoke after `updateHealthPanel()` in the message handler for `updateGraph`
    - Pass `graphData`, `degreeMap`, and `workspaceFolders` array
    - _Requirements: 7.6_

- [x] 13. Philosophy documentation
  - [x] 13.1 Create `tools/ecosystem-graph/docs/PHILOSOPHY.md`
    - Written in Portuguese (Brasil)
    - Explain the graph is NOT a folder visualizer but the AI agent's cognitive system
    - Explain strong interconnections = assertiveness, speed, precision
    - Explain weak/missing connections = knowledge gaps, slower responses, errors
    - Describe graph as brain map: nodes = knowledge pieces, edges = neural pathways
    - State the goal: strong cognitive system where every piece of knowledge is reachable
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 14. Final checkpoint — Full compile and integration verification
  - Ensure `npm run compile` passes with no errors, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests (can be skipped for faster MVP)
- The project has no test framework set up yet — PBT tasks assume Vitest + fast-check setup
- Gap detector (Req 5) already includes all node types — task 10.1 is verification only
- The recursive skill glob does NOT exist yet — task 4.1 adds both the new pattern AND deduplication
- Each task references specific requirements for traceability
- Checkpoints ensure incremental compilation validation
