# Requirements Document

## Introduction

Extensao gratuita e open-source para VS Code/Kiro que renderiza um grafo interativo do ecossistema Fourkeep. Inspirada na graph view do Obsidian, a extensao parseia os arquivos de steering (`.kiro/steering/*.md`) de todos os workspace folders, extrai referencias cruzadas entre arquivos, modulos, entidades e endpoints, e apresenta uma visualizacao navegavel em webview panel. O objetivo e dar visibilidade imediata das conexoes entre os componentes do ecossistema (API, Integrador, Mobile, Manifests) sem depender de ferramentas externas pagas.

## Glossary

- **Extension**: A extensao VS Code/Kiro "Ecosystem Graph" sendo desenvolvida
- **Graph_Panel**: O webview panel dentro do VS Code/Kiro que renderiza o grafo interativo
- **Steering_File**: Arquivo markdown localizado em `.kiro/steering/` que documenta fluxos, regras, FAQs e convencoes do ecossistema
- **Node**: Elemento visual no grafo representando um componente do ecossistema (steering, modulo, entidade, endpoint, arquivo de codigo)
- **Edge**: Conexao visual entre dois Nodes representando uma referencia ou dependencia
- **Reference**: Qualquer link entre arquivos — pode ser `#[[file:path]]`, link markdown `[texto](path)`, ou referencia textual a outro steering (ex: "ver help-haproxy.md")
- **Workspace_Folder**: Uma das pastas raiz do workspace multi-root (Workspace, API, Integrador, Mobile, Manifests)
- **Parser**: Componente da Extension responsavel por extrair References dos Steering_Files
- **Force_Graph**: Algoritmo de layout baseado em simulacao de forcas fisicas que posiciona os Nodes automaticamente

## Requirements

### Requirement 1: Descoberta de Steering Files

**User Story:** As a developer, I want the extension to automatically discover all steering files across workspace folders, so that the graph reflects the complete ecosystem without manual configuration.

#### Acceptance Criteria

1. WHEN a workspace is opened, THE Extension SHALL scan all workspace folders for files matching the pattern `.kiro/steering/*.md`
2. WHEN a new steering file is created or deleted, THE Extension SHALL update the discovered file list within 5 seconds
3. THE Extension SHALL support multi-root workspaces with steering files in different workspace folders (Workspace, API, Mobile, Integrador, Manifests)
4. IF a workspace folder does not contain a `.kiro/steering/` directory, THEN THE Extension SHALL skip that folder without error

### Requirement 2: Parsing de Referencias

**User Story:** As a developer, I want the extension to parse all reference formats used in steering files, so that the graph accurately represents all connections.

#### Acceptance Criteria

1. THE Parser SHALL extract references in the format `#[[file:relative_path]]`
2. THE Parser SHALL extract references from markdown links in the format `[text](relative_path)`
3. THE Parser SHALL extract textual references to other steering files (pattern: backtick-wrapped filenames like `` `help-haproxy.md` `` or `` `flow-pedido.md` ``)
4. THE Parser SHALL only create Edges for backtick references that match a file in the discovered steering file list; backtick references not matching any known steering file SHALL be ignored
5. THE Parser SHALL extract file paths from markdown tables (cells containing paths like `api/django/faturamento/views.py`)
6. WHEN a reference target (from wiki-link, markdown-link, or table-path) does not exist on disk, THE Parser SHALL still create the Edge but mark the target Node as unresolved
7. THE Parser SHALL parse front-matter YAML to extract the `inclusion` mode (always, auto, fileMatch, manual) as Node metadata
8. FOR ALL valid Steering_Files, parsing then serializing the extracted references back to a normalized format then parsing again SHALL produce an equivalent reference set (round-trip property)

### Requirement 3: Classificacao de Nodes

**User Story:** As a developer, I want nodes to be visually categorized by type, so that I can quickly identify what kind of component each node represents.

#### Acceptance Criteria

1. THE Graph_Panel SHALL classify Nodes into the following types: steering-flow, steering-help, steering-playbook, steering-observability, steering-domain, code-file, module, entity
2. THE Graph_Panel SHALL assign a distinct color to each Node type
3. THE Graph_Panel SHALL determine Node type from the steering filename prefix (flow-*, help-*, playbook*, observability-*)
4. THE Graph_Panel SHALL determine Node type for code files based on the Workspace_Folder they belong to (API, Integrador, Mobile, Manifests)
5. WHEN a Node type cannot be determined, THE Graph_Panel SHALL assign a default "unknown" type with a neutral color

### Requirement 4: Renderizacao do Grafo Interativo

**User Story:** As a developer, I want an interactive force-directed graph visualization with a neural network aesthetic, so that I can explore the ecosystem connections as a living cognitive system.

#### Acceptance Criteria

1. THE Graph_Panel SHALL render Nodes and Edges using a force-directed layout algorithm (Force_Graph)
2. THE Graph_Panel SHALL use a dark background (#0d0d0d) to create a "neural cosmos" visual
3. THE Graph_Panel SHALL render Nodes with a glow/bloom effect using the node's color
4. THE Graph_Panel SHALL render Edges as thin semi-transparent lines (opacity ~0.15) that become more visible on hover (opacity ~0.7)
5. THE Graph_Panel SHALL keep the force simulation running continuously with low alpha decay, creating subtle organic movement
6. THE Graph_Panel SHALL show Node labels only when zoom level exceeds a threshold (default 1.5x); at lower zoom levels only colored dots are visible
7. THE Graph_Panel SHALL allow the user to zoom in and out using mouse wheel or trackpad gestures
8. THE Graph_Panel SHALL allow the user to pan the view by dragging the background
9. THE Graph_Panel SHALL allow the user to drag individual Nodes to reposition them
10. WHEN the user hovers over a Node, THE Graph_Panel SHALL display a tooltip with the file path and Node type
11. WHEN the user hovers over a Node, THE Graph_Panel SHALL highlight all connected Edges and adjacent Nodes
12. THE Graph_Panel SHALL render the graph within 3 seconds for up to 200 Nodes and 500 Edges
13. THE Graph_Panel SHALL scale Node size proportionally to its degree (number of connections) using the formula: baseSize + (degree * scaleFactor)
14. THE Graph_Panel SHALL display a fixed legend in the bottom-right corner showing each NodeType with its corresponding color

### Requirement 4b: Painel de Controles

**User Story:** As a developer, I want to adjust the graph physics and visual parameters in real-time, so that I can fine-tune the visualization to my preference.

#### Acceptance Criteria

1. THE Graph_Panel SHALL provide a collapsible settings panel on the right side
2. THE settings panel SHALL include sliders for: center force, repulsion force, link force, link distance, node size multiplier, link width
3. THE settings panel SHALL include toggles for: show arrows (edge direction), label visibility (on/off/auto), show only existing files, show orphan nodes
4. THE settings panel SHALL include an "Animate" button that restarts the force simulation
5. WHEN the user adjusts a slider, THE Graph_Panel SHALL update the visualization in real-time without re-parsing
6. THE settings panel SHALL persist user preferences across panel hide/restore cycles

### Requirement 5: Navegacao para Arquivos

**User Story:** As a developer, I want to click a node and open the corresponding file in the editor, so that I can quickly navigate to any part of the ecosystem.

#### Acceptance Criteria

1. WHEN the user clicks a Node, THE Extension SHALL open the corresponding file in the VS Code editor
2. WHEN the user clicks a Node representing a file that does not exist, THE Extension SHALL display an informational message indicating the file was not found
3. THE Extension SHALL resolve relative paths correctly across different Workspace_Folders

### Requirement 6: Filtragem e Busca

**User Story:** As a developer, I want to filter and search the graph, so that I can focus on specific parts of the ecosystem.

#### Acceptance Criteria

1. THE Graph_Panel SHALL provide a text input for filtering Nodes by name
2. WHEN the user types in the filter input, THE Graph_Panel SHALL highlight matching Nodes and dim non-matching Nodes
3. THE Graph_Panel SHALL provide toggle buttons to show/hide Nodes by type (steering-flow, steering-help, code-file, etc.)
4. THE Graph_Panel SHALL provide toggle buttons to show/hide Nodes by Workspace_Folder (API, Integrador, Mobile, Manifests, Workspace)
5. WHILE a filter is active, THE Graph_Panel SHALL display only Edges connected to visible Nodes

### Requirement 7: Webview Panel Integration

**User Story:** As a developer, I want the graph to be integrated as a VS Code panel, so that I can use it alongside my code without switching applications.

#### Acceptance Criteria

1. THE Extension SHALL register a command `ecosystemGraph.show` to open the Graph_Panel
2. THE Extension SHALL display the Graph_Panel in the editor area as a webview panel
3. THE Extension SHALL persist the Graph_Panel state (zoom level, pan position) when the panel is hidden and restored
4. THE Extension SHALL provide a sidebar icon in the activity bar to quickly open the Graph_Panel
5. WHEN the workspace has no steering files, THE Graph_Panel SHALL display a message indicating no ecosystem data was found

### Requirement 8: Performance e Atualizacao em Tempo Real

**User Story:** As a developer, I want the graph to update automatically when I edit steering files, so that the visualization stays current without manual refresh.

#### Acceptance Criteria

1. WHEN a steering file is saved, THE Extension SHALL re-parse that file and update the graph within 2 seconds
2. THE Extension SHALL use incremental updates (re-parse only changed files) instead of full re-scan on file save
3. THE Extension SHALL debounce rapid file changes to avoid excessive re-parsing (minimum 500ms between updates)
4. IF parsing a file fails due to malformed content, THEN THE Extension SHALL retain the previous valid state for that file and log a warning

### Requirement 9: Extensao Gratuita e Open Source

**User Story:** As a developer, I want the extension to be free and open source, so that the team can use it without licensing costs and contribute improvements.

#### Acceptance Criteria

1. THE Extension SHALL be distributed under the MIT license
2. THE Extension SHALL not depend on any paid services or proprietary libraries
3. THE Extension SHALL function entirely offline without requiring network access
4. THE Extension SHALL be publishable to the VS Code Marketplace and Open VSX Registry

### Requirement 10: Genericidade e Portabilidade

**User Story:** As a developer, I want the extension to work with any project that uses Kiro steering files, so that I can reuse it across different teams and codebases without modification.

#### Acceptance Criteria

1. THE Extension SHALL not contain any hardcoded references to specific project names, domains, or team structures
2. THE Extension SHALL work with any workspace that contains `.kiro/steering/*.md` files, regardless of the project's language, framework, or architecture
3. THE Extension SHALL derive all graph data exclusively from the steering file content and structure, without requiring external configuration files
4. THE Extension SHALL use a generic name suitable for public distribution (e.g., "Kiro Ecosystem Graph" or "Steering Graph View")
5. THE Extension SHALL not assume any specific steering file naming convention beyond the prefix-based classification rules defined in Requirement 3

