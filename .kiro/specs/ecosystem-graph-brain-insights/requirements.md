# Requirements Document

## Introduction

Upgrade da extensao "Kiro Ecosystem Graph" para adicionar efeitos visuais inspirados em cerebro biologico e funcionalidades de insights sobre o ecossistema. A extensao ja possui: renderizacao force-graph com glow nodes, impulse particles nos edges, edges coloridos por tipo de source, particulas ambiente, settings panel, filter panel, stats overlay e file watcher. Este spec adiciona quatro pilares: (1) efeitos visuais que simulam um cerebro vivo (densidade neural, heartbeat, gradientes, propagacao de impulso), (2) paineis de insights que revelam a saude e estrutura do ecossistema, (3) interacoes avancadas de exploracao (focus mode, path finder, clustering), e (4) visualizacao de evolucao temporal (historico de stats, badges de novidade).

## Glossary

- **Graph_Panel**: O webview panel dentro do VS Code que renderiza o grafo interativo usando force-graph (Canvas 2D)
- **Force_Simulation**: A simulacao de forcas fisicas (d3-force) que posiciona os nodes automaticamente
- **Ambient_Particles**: Particulas de fundo flutuantes que criam atmosfera neural
- **Heartbeat_Pulse**: Oscilacao ciclica de opacidade nos nodes simulando pulsacao biologica
- **Neural_Impulse_Ray**: Efeito visual de highlight que se propaga do node hovered para vizinhos com delay
- **Health_Score_Panel**: Painel de metricas que mostra saude estrutural do ecossistema (orphans, hub central, areas pouco documentadas)
- **Island_Detector**: Algoritmo que identifica clusters de nodes desconectados do componente principal do grafo
- **Cognitive_Weight**: Metrica que soma o degree de todos os nodes de um tipo para determinar dominancia relativa
- **Focus_Mode**: Modo de visualizacao que mostra apenas o node selecionado e seus vizinhos diretos
- **Path_Finder**: Funcionalidade que calcula e exibe o caminho mais curto entre dois nodes selecionados
- **Cluster_Mode**: Modo que agrupa nodes por tipo formando "lobos cerebrais" usando forceX/forceY
- **Stats_History**: Registro persistido de contagens de nodes/edges por dia para visualizacao de evolucao temporal
- **Sparkline**: Mini grafico de linha embutido no stats overlay mostrando evolucao recente
- **New_Badge**: Indicador visual em nodes criados nos ultimos 7 dias
- **BFS**: Breadth-First Search — algoritmo de busca em largura usado para encontrar caminhos mais curtos em grafos nao-ponderados
- **Workspace_Storage**: API do VS Code (ExtensionContext.workspaceState ou globalState) para persistir dados entre sessoes

## Requirements

### Requirement 1: Particulas Ambiente com Densidade Neural

**User Story:** As a developer, I want background particles to be denser in the center and sparser at the edges, so that the visualization simulates cortex neural density and creates a natural focal point.

#### Acceptance Criteria

1. THE Graph_Panel SHALL distribute ambient particles with higher density near the center of the canvas and lower density toward the edges
2. THE Graph_Panel SHALL use a radial probability distribution when initializing particle positions, where particles within 30% of the canvas radius from center have 3x higher spawn probability than particles at the edges
3. WHEN the canvas is resized, THE Graph_Panel SHALL reinitialize particles maintaining the center-dense distribution
4. THE ambient particles SHALL maintain their existing drift behavior (slow random movement, screen wrapping) while preserving the overall density gradient over time
5. THE density gradient SHALL be visually perceptible without being distracting — the center area should feel "alive" while edges feel sparse

### Requirement 2: Heartbeat Pulse nos Nodes

**User Story:** As a developer, I want nodes to have a subtle heartbeat-like opacity oscillation, so that the graph feels like a living system with active synapses.

#### Acceptance Criteria

1. THE Graph_Panel SHALL oscillate node opacity in a continuous loop between 0.85 and 0.95 (amplitude of 0.10)
2. THE Heartbeat_Pulse SHALL use a sinusoidal easing function with a period of approximately 2-3 seconds per full cycle
3. THE Heartbeat_Pulse SHALL apply to all visible nodes simultaneously but with a slight phase offset based on node index to avoid uniform pulsing
4. WHILE a node is dimmed (not highlighted during hover), THE Graph_Panel SHALL suppress the heartbeat effect and use the dimmed opacity (0.2) instead
5. THE Heartbeat_Pulse SHALL NOT affect node glow intensity (shadowBlur) — only the fillStyle globalAlpha

### Requirement 3: Edges com Gradiente de Cor

**User Story:** As a developer, I want edges to display a color gradient from source node color to target node color, so that I can visually perceive the direction of information flow.

#### Acceptance Criteria

1. THE Graph_Panel SHALL render each edge using a linear gradient that transitions from the source node's COLOR_MAP color to the target node's COLOR_MAP color
2. THE gradient SHALL be created using Canvas 2D createLinearGradient with the source node position as start point and target node position as end point
3. THE gradient colors SHALL respect the current edge opacity (0.12 default, 0.7 on hover) applied to both gradient stops
4. WHEN source and target nodes have the same type (same color), THE Graph_Panel SHALL still render the edge with a single color (no visible gradient needed)
5. THE Impulse_Particles on gradient edges SHALL use the source node color (existing behavior preserved)
6. THE gradient rendering SHALL use force-graph's linkCanvasObject callback to override default link rendering

### Requirement 4: Neural Impulse Ray on Hover

**User Story:** As a developer, I want hovering a node to trigger a visual "ray" of highlight that propagates to neighbors with a delay, so that I can see how neural impulses spread through the network.

#### Acceptance Criteria

1. WHEN the user hovers over a node, THE Graph_Panel SHALL highlight the hovered node immediately (0ms delay)
2. WHEN the user hovers over a node, THE Graph_Panel SHALL highlight direct neighbors (1-hop) after a 150ms delay
3. WHEN the user hovers over a node, THE Graph_Panel SHALL highlight 2-hop neighbors after a 300ms delay with reduced intensity (opacity 0.5 of the highlight)
4. THE propagation highlight SHALL use a brief "flash" animation (opacity spike then settle) on each newly highlighted node to simulate an impulse arriving
5. WHEN the user moves the hover away, THE Graph_Panel SHALL clear all propagation highlights immediately (no reverse animation)
6. THE propagation SHALL NOT extend beyond 2 hops to avoid visual noise on dense graphs
7. THE edges connecting propagated nodes SHALL also brighten progressively with the same delay timing

### Requirement 5: Health Score Panel

**User Story:** As a developer, I want a Health Score panel that shows orphan count, most central node, and least documented area, so that I can understand the structural health of my ecosystem at a glance.

#### Acceptance Criteria

1. THE Graph_Panel SHALL display a Health Score panel in a fixed position (top-right area, below settings gear) showing ecosystem health metrics
2. THE Health_Score_Panel SHALL calculate and display the number of orphan nodes (nodes with zero connections)
3. THE Health_Score_Panel SHALL identify and display the most central node (node with highest degree — the "hub")
4. THE Health_Score_Panel SHALL identify and display the least documented area (the NodeType with fewest nodes in the graph)
5. THE Health_Score_Panel SHALL update metrics in real-time when graph data changes (file added/removed/edited)
6. THE Health_Score_Panel SHALL use compact styling consistent with the existing stats overlay (dark semi-transparent background, small font)
7. IF all nodes have zero connections, THEN THE Health_Score_Panel SHALL display "No connections yet" instead of hub information

### Requirement 6: Island Detection

**User Story:** As a developer, I want the system to detect disconnected clusters (islands) in the graph, so that I can identify areas of my ecosystem that don't communicate with each other.

#### Acceptance Criteria

1. THE Island_Detector SHALL identify all connected components in the graph using BFS/DFS traversal
2. THE Health_Score_Panel SHALL display the number of islands (connected components) when more than 1 exists
3. WHEN islands are detected, THE Health_Score_Panel SHALL list the size (node count) of each island
4. THE Graph_Panel SHALL provide a visual indicator for island membership (subtle background highlight or border variation per island) when island detection is active
5. IF the graph is fully connected (single component), THEN THE Health_Score_Panel SHALL display "Fully connected" for the islands metric
6. THE island detection SHALL recompute when graph data changes

### Requirement 7: Cognitive Weight per Area

**User Story:** As a developer, I want to see the "cognitive weight" of each node type as a percentage, so that I can understand which type dominates my ecosystem brain.

#### Acceptance Criteria

1. THE Health_Score_Panel SHALL calculate cognitive weight per NodeType as: (sum of degrees of all nodes of that type) / (sum of all node degrees) * 100
2. THE Health_Score_Panel SHALL display cognitive weight as a percentage for each NodeType present in the graph (e.g., "steering-help: 45%")
3. THE Health_Score_Panel SHALL sort types by cognitive weight descending (dominant type first)
4. THE Health_Score_Panel SHALL highlight the dominant type (highest percentage) with its COLOR_MAP color
5. IF a NodeType has 0 total degree (all its nodes are orphans), THEN THE Health_Score_Panel SHALL display 0% for that type
6. THE cognitive weight calculation SHALL update when graph data changes

### Requirement 8: Richer Tooltip

**User Story:** As a developer, I want the hover tooltip to show incoming connections count, outgoing connections count, and top 3 connected nodes, so that I get immediate context about a node's role in the ecosystem.

#### Acceptance Criteria

1. WHEN the user hovers over a node, THE tooltip SHALL display the node label, type, and file path (existing behavior preserved)
2. THE tooltip SHALL display the count of incoming connections (edges where this node is the target)
3. THE tooltip SHALL display the count of outgoing connections (edges where this node is the source)
4. THE tooltip SHALL display the top 3 most-connected neighbor nodes (by degree) with their labels
5. IF a node has fewer than 3 neighbors, THEN THE tooltip SHALL display all available neighbors
6. IF a node has zero connections, THEN THE tooltip SHALL display "No connections" instead of neighbor list
7. THE tooltip SHALL maintain its existing positioning logic (near cursor, avoiding overflow)

### Requirement 9: Focus Mode (Double-Click)

**User Story:** As a developer, I want to double-click a node to enter focus mode showing only its direct neighbors, so that I can explore a specific area without visual noise from the rest of the graph.

#### Acceptance Criteria

1. WHEN the user double-clicks a node, THE Graph_Panel SHALL enter Focus_Mode showing only the clicked node and its direct neighbors (1-hop)
2. WHILE in Focus_Mode, THE Graph_Panel SHALL display only edges that connect visible nodes (edges between the focused node and its neighbors)
3. WHILE in Focus_Mode, THE Graph_Panel SHALL display a "Return to full graph" button in a visible fixed position (top-center)
4. WHEN the user clicks the "Return to full graph" button, THE Graph_Panel SHALL exit Focus_Mode and restore the complete graph with all filters applied
5. WHILE in Focus_Mode, THE Graph_Panel SHALL center the view on the focused node and zoom to fit the visible subgraph
6. THE Focus_Mode SHALL NOT interfere with existing click-to-open behavior (single click opens file, double-click enters focus)
7. THE Graph_Panel SHALL distinguish single-click from double-click using a 250ms delay threshold

### Requirement 10: Path Finder Mode

**User Story:** As a developer, I want to select two nodes and see the shortest path between them, so that I can understand how information flows from one area to another.

#### Acceptance Criteria

1. THE Graph_Panel SHALL provide a "Path Finder" toggle button in the controls area to enter/exit path finding mode
2. WHILE in Path_Finder mode, THE Graph_Panel SHALL allow the user to click two nodes sequentially (source and target)
3. WHEN two nodes are selected, THE Graph_Panel SHALL compute the shortest path using BFS on the undirected graph
4. WHEN a path is found, THE Graph_Panel SHALL highlight all nodes and edges along the path with a distinct visual style (brighter opacity, thicker edges, pulsing animation)
5. WHEN a path is found, THE Graph_Panel SHALL display the path length (number of hops) near the controls
6. IF no path exists between the two selected nodes, THEN THE Graph_Panel SHALL display "No path found — nodes are in different islands"
7. WHEN the user clicks the Path_Finder toggle again or clicks the background, THE Graph_Panel SHALL clear the path highlight and exit path finding mode
8. THE BFS implementation SHALL treat edges as undirected (path can traverse edges in either direction)

### Requirement 11: Cluster Mode (Brain Lobes)

**User Story:** As a developer, I want a "Cluster" button that groups nodes by type into brain-lobe-like clusters, so that I can see the structural organization of my ecosystem by category.

#### Acceptance Criteria

1. THE Graph_Panel SHALL provide a "Cluster" toggle button in the controls area
2. WHEN the user activates Cluster_Mode, THE Graph_Panel SHALL apply forceX and forceY forces that pull nodes of the same type toward computed cluster center positions
3. THE cluster center positions SHALL be distributed evenly in a circular layout around the graph center, one position per active NodeType
4. WHILE in Cluster_Mode, THE Graph_Panel SHALL display subtle labels at each cluster center indicating the NodeType name
5. WHEN the user deactivates Cluster_Mode, THE Graph_Panel SHALL remove the clustering forces and let the simulation return to normal layout
6. THE clustering force strength SHALL be moderate (0.3-0.5) to allow nodes to cluster without collapsing into a single point
7. THE Cluster_Mode SHALL preserve all existing edge rendering and particle animations

### Requirement 12: Stats History with Sparkline

**User Story:** As a developer, I want to see a mini sparkline in the stats overlay showing how my ecosystem grew over time, so that I can track evolution and momentum.

#### Acceptance Criteria

1. THE Extension SHALL persist daily snapshots of node count and edge count to a JSON file at `.kiro/ecosystem-graph-stats.json` in the workspace root
2. THE Extension SHALL record one snapshot per calendar day (overwriting if multiple sessions occur on the same day)
3. THE Stats_History SHALL retain the last 30 days of snapshots (older entries are pruned)
4. THE stats overlay SHALL display a mini sparkline (approximately 60px wide, 16px tall) showing node count trend for the last 7 days
5. THE stats overlay SHALL display a textual growth indicator (e.g., "+3 nodes this week") comparing current count to 7 days ago
6. IF fewer than 2 days of history exist, THEN THE stats overlay SHALL display only current counts without sparkline
7. THE sparkline SHALL be rendered using Canvas 2D (simple polyline) within the stats overlay element
8. WHEN the graph data changes, THE Extension SHALL update today's snapshot entry

### Requirement 13: New Badge on Recent Nodes

**User Story:** As a developer, I want nodes created in the last 7 days to have a small "new" visual indicator, so that I can immediately spot recent additions to the ecosystem.

#### Acceptance Criteria

1. THE Graph_Panel SHALL display a small visual badge (pulsing dot or ring) on nodes whose backing file was created within the last 7 days
2. THE Extension SHALL determine file creation date using the file system stat (birthtime/ctime) via VS Code workspace API
3. THE New_Badge SHALL be rendered as a small colored indicator (e.g., 3px bright cyan dot) positioned at the top-right of the node circle
4. THE New_Badge SHALL have a subtle pulse animation (opacity oscillation) to draw attention without being distracting
5. WHEN a node's file age exceeds 7 days, THE Graph_Panel SHALL stop rendering the New_Badge for that node
6. THE file creation date information SHALL be passed from the extension host to the webview as part of the node metadata
7. IF file creation date cannot be determined (unresolved nodes), THEN THE Graph_Panel SHALL NOT display a New_Badge for that node

