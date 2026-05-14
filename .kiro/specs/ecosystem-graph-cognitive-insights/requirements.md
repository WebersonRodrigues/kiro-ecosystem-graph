# Requirements Document

## Introduction

Este documento formaliza os requisitos para a evolucao do Ecosystem Graph, a extensao VS Code que visualiza o ecossistema cognitivo Kiro/Keepinho como um grafo force-directed. As melhorias abrangem: enriquecimento de edges entre hooks e steerings, descoberta recursiva de skills, peso visual de edges, tooltips aprimorados, integracao do gap detector com skills/hooks, legenda de formas, um novo painel de analise cognitiva, e documentacao filosofica do grafo.

O objetivo central e transformar o grafo de uma simples visualizacao de arquivos em um mapa cerebral completo do agente — onde cada no e um pedaco de conhecimento e cada aresta e uma via neural. Conexoes fortes significam assertividade e velocidade; conexoes fracas ou ausentes significam lacunas cognitivas.

## Glossary

- **Ecosystem_Graph**: Extensao VS Code que renderiza o grafo force-directed representando steerings, skills, hooks e suas interconexoes.
- **Parser_Service**: Servico TypeScript (`parserService.ts`) responsavel por extrair referencias (edges) do conteudo de arquivos markdown e JSON.
- **File_Discovery_Service**: Servico TypeScript (`fileDiscoveryService.ts`) responsavel por descobrir arquivos do ecossistema via glob patterns.
- **Gap_Detector**: Modulo JavaScript (`gap-detector.js`) que computa metricas de lacunas no grafo (sugestoes de conexao, zonas mortas, cobertura, redundancia).
- **Health_Panel**: Painel JavaScript (`health-panel.js`) que exibe metricas de saude do ecossistema (orfaos, hub, ilhas, peso cognitivo).
- **Webview**: Painel de renderizacao do grafo (`webview.js`) usando ForceGraph com Canvas 2D.
- **Hook**: Arquivo JSON (`.kiro/hooks/*.json` ou `*.kiro.hook`) que define automacoes do agente com campos `when`, `then`, `toolTypes`, `patterns`.
- **Steering**: Arquivo markdown (`.kiro/steering/*.md`) que guia o comportamento do agente em contextos especificos.
- **Skill**: Arquivo markdown (`.kiro/skills/`) que define capacidades especificas do agente.
- **Edge_Weight**: Numero de referencias distintas entre dois nos — determina a espessura visual da aresta.
- **Cognitive_Analysis_Panel**: Novo painel que exibe analise profunda da rede cognitiva (orfaos, vinculos frageis, arquivos sem contexto, gaps de cobertura).
- **Fragile_Edge**: Aresta que existe apenas via uma unica referencia backtick — conexao fragil que pode se perder facilmente.
- **Orphan_Node**: No com zero arestas de entrada e saida — conhecimento isolado e inacessivel.

## Requirements

### Requirement 1: Richer Hook-to-Steering Edges

**User Story:** As a developer maintaining the cognitive ecosystem, I want hooks to create edges to steerings via all implicit relationships (toolTypes, patterns.fileMatch, when.type), so that the graph accurately represents the full cognitive wiring between hooks and steerings.

#### Acceptance Criteria

1. WHEN a hook JSON file contains a `toolTypes` array referencing steering-related tool names, THE Parser_Service SHALL create edges from the hook node to each steering node whose filename matches the tool type reference.
2. WHEN a hook JSON file contains a `patterns` array with `fileMatch` globs that match known steering file paths, THE Parser_Service SHALL create edges from the hook node to each matched steering node.
3. WHEN a hook JSON file contains a `when.type` value that semantically maps to a steering category (e.g., `fileCreated` matching steerings with `fileMatch` inclusion), THE Parser_Service SHALL create an edge from the hook node to the relevant steering node.
4. THE Parser_Service SHALL preserve existing `then.prompt` reference extraction alongside the new implicit edge extraction.
5. WHEN a hook has multiple implicit relationships to the same steering, THE Parser_Service SHALL create only one edge between the pair (deduplication).
6. THE Parser_Service SHALL assign a new ReferenceType value to distinguish implicit hook edges from explicit prompt references.

### Requirement 2: Recursive Skill Discovery

**User Story:** As a developer organizing skills in subfolders, I want the file discovery to find `SKILL.md` files at any depth within `.kiro/skills/`, so that nested skill structures are fully represented in the graph.

#### Acceptance Criteria

1. THE File_Discovery_Service SHALL discover skill files matching the glob pattern `**/.kiro/skills/**/SKILL.md` in addition to `**/.kiro/skills/*.md`.
2. WHEN a `SKILL.md` file exists inside a named subfolder (e.g., `.kiro/skills/compilacao-delphi-lib-bimer/SKILL.md`), THE Parser_Service SHALL use the parent folder name as the node label.
3. THE File_Discovery_Service SHALL not produce duplicate entries when a file matches both the flat pattern (`*.md`) and the recursive pattern (`**/SKILL.md`).
4. WHEN a new `SKILL.md` file is created in a nested subfolder, THE File_Discovery_Service file watcher SHALL detect the creation and trigger a graph update.

### Requirement 3: Visual Edge Weight

**User Story:** As a developer analyzing the cognitive graph, I want edges between nodes with multiple references to appear visually thicker, so that I can immediately identify strong vs weak connections.

#### Acceptance Criteria

1. THE Webview SHALL render edges with line width proportional to the number of references between the connected nodes.
2. WHEN two nodes have exactly one reference between them, THE Webview SHALL render the edge at the configured base link width.
3. WHEN two nodes have N references between them (N > 1), THE Webview SHALL render the edge at base width multiplied by a scaling factor of `1 + log2(N)`.
4. THE Webview SHALL cap the maximum edge width at 5 pixels to prevent visual clutter.
5. WHEN the user hovers over a weighted edge, THE Webview SHALL display a tooltip showing the reference count and types.

### Requirement 4: Enhanced Tooltips for Hooks

**User Story:** As a developer inspecting hook nodes, I want the tooltip to show `when.type`, `description`, and referenced steerings, so that I can understand the hook's purpose and connections without opening the file.

#### Acceptance Criteria

1. WHEN the user hovers over a hook node, THE Webview SHALL display a tooltip containing the hook's `when.type` value.
2. WHEN the user hovers over a hook node that has a `description` field, THE Webview SHALL include the description text in the tooltip.
3. WHEN the user hovers over a hook node that references steerings, THE Webview SHALL list the referenced steering names in the tooltip.
4. IF a hook JSON file has no `description` field, THEN THE Webview SHALL omit the description line from the tooltip without showing empty placeholders.
5. THE Parser_Service SHALL extract and store `when.type` and `description` in the hook node's metadata for consumption by the Webview.

### Requirement 5: Gap Detector Integration with Skills and Hooks

**User Story:** As a developer monitoring ecosystem health, I want the gap detector to analyze skills and hooks alongside steerings, so that orphan skills, disconnected hooks, and missing connections across all node types are surfaced.

#### Acceptance Criteria

1. THE Gap_Detector SHALL include skill nodes in its orphan detection (nodes with zero connections).
2. THE Gap_Detector SHALL include hook nodes in its orphan detection (nodes with zero connections).
3. THE Gap_Detector SHALL include skill and hook nodes in its suggested connections computation (semantic similarity between unconnected nodes of any type).
4. THE Gap_Detector SHALL include skill and hook nodes in its dead zones detection (files not modified in 30+ days).
5. WHEN computing coverage map, THE Gap_Detector SHALL count skills and hooks per workspace folder alongside steerings.
6. THE Gap_Detector SHALL include skill and hook nodes in its redundancy pair detection.

### Requirement 6: Shape Legend

**User Story:** As a developer viewing the graph, I want the legend to show shape icons (circle, diamond, triangle) next to the color dots, so that I can quickly identify what each shape represents.

#### Acceptance Criteria

1. THE Webview SHALL render a legend panel showing a circle icon next to steering node type entries.
2. THE Webview SHALL render a legend panel showing a diamond icon next to the skill node type entry.
3. THE Webview SHALL render a legend panel showing a triangle icon next to hook node type entries (hook-manual, hook-auto).
4. THE Webview SHALL render each shape icon in the corresponding node type color from the COLOR_MAP.
5. THE Webview SHALL position the shape legend in a non-obstructive location visible without scrolling.

### Requirement 7: Cognitive Analysis Panel

**User Story:** As a developer strengthening the cognitive ecosystem, I want a dedicated analysis panel showing orphan steerings, fragile connections, context-less files, coverage gaps, and improvement suggestions, so that I can systematically identify and fix weaknesses in the agent's knowledge network.

#### Acceptance Criteria

1. THE Cognitive_Analysis_Panel SHALL display a section "Steerings Soltos" listing all steering nodes with zero incoming and zero outgoing edges.
2. THE Cognitive_Analysis_Panel SHALL display a section "Vinculos Frageis" listing all edges that exist only via a single backtick reference (ReferenceType = 'backtick-ref' with edge weight = 1).
3. THE Cognitive_Analysis_Panel SHALL display a section "Arquivos sem Contexto" listing all nodes that have zero references to or from any other node in the graph.
4. THE Cognitive_Analysis_Panel SHALL display a section "Coverage Gaps" listing workspace folders that contain zero steering files.
5. THE Cognitive_Analysis_Panel SHALL display a section "Sugestoes" with actionable recommendations for strengthening the cognitive network based on the detected issues.
6. WHEN the graph data changes, THE Cognitive_Analysis_Panel SHALL recompute all metrics and update the display.
7. THE Cognitive_Analysis_Panel SHALL be toggleable via a button in the advanced toolbar, hidden by default.
8. WHEN the user clicks on a node name in the Cognitive_Analysis_Panel, THE Webview SHALL highlight and center the corresponding node in the graph.

### Requirement 8: Philosophy Documentation

**User Story:** As a developer or contributor understanding the ecosystem graph, I want a documentation file explaining the philosophy and purpose of the graph, so that the team understands why strong interconnections matter and how the graph represents the agent's cognitive system.

#### Acceptance Criteria

1. THE Documentation SHALL be created at the path `tools/ecosystem-graph/docs/PHILOSOPHY.md`.
2. THE Documentation SHALL explain that the Ecosystem Graph is NOT a folder visualizer but the visual representation of the AI agent's cognitive system.
3. THE Documentation SHALL explain that strong interconnections correlate with assertiveness, speed, and precision in agent responses.
4. THE Documentation SHALL explain that weak or missing connections represent gaps in knowledge, slower responses, and potential errors.
5. THE Documentation SHALL describe the graph as the agent's brain map where each node is a piece of knowledge and each edge is a neural pathway.
6. THE Documentation SHALL state the goal: a strong cognitive system where every piece of knowledge is reachable and well-connected.
7. THE Documentation SHALL be written in Portuguese (Brasil) following the project's documentation conventions.
