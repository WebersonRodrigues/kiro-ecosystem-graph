# Requirements Document

## Introduction

Upgrade visual e funcional da extensao "Kiro Ecosystem Graph" para atingir uma estetica de rede neural dentro de um cerebro — um sistema cognitivo vivo que evolui. A extensao ja funciona (parsing, grafo, force-graph), mas a qualidade visual esta abaixo do esperado. Este upgrade transforma a visualizacao em algo fora do comum: nodes como sinapses brilhantes, edges como impulsos eletricos viajando entre neuronios, particulas de comunicacao, e um background neural que transmite a sensacao de estar olhando para dentro de um cerebro digital. O objetivo e ver o ecossistema de conhecimento como um organismo vivo — onde voce identifica instantaneamente quais areas sao fortes, quais sao fracas, e como tudo se interliga.

## Glossary

- **Graph_Panel**: O webview panel dentro do VS Code/Kiro que renderiza o grafo interativo
- **Force_Simulation**: A simulacao de forcas fisicas (d3-force) que posiciona os nodes automaticamente e cria movimento organico
- **Glow_Effect**: Efeito visual de brilho/bloom ao redor dos nodes usando shadowBlur e shadowColor do Canvas 2D — simula sinapses iluminadas
- **Settings_Panel**: Painel lateral direito colapsavel com sliders e toggles para ajuste em tempo real dos parametros do grafo
- **Node_Degree**: Numero de conexoes (edges) de um node — determina seu tamanho visual e "forca" no ecossistema
- **Edge_Weight**: Numero de referencias entre dois nodes especificos — edges com mais referencias sao visualmente mais fortes
- **Impulse_Particles**: Pequenos pontos de luz animados que viajam ao longo dos edges, simulando impulsos eletricos/comunicacao neural
- **Alpha_Decay**: Taxa de decaimento da energia da simulacao — valores baixos mantem movimento continuo
- **Neural_Cosmos**: Estetica visual inspirada em redes neurais e cosmos — fundo preto profundo, nos com glow colorido, links semi-transparentes, movimento organico continuo
- **Brain_Background**: Camada visual decorativa com silhueta de cerebro, radial glow central, e particulas ambiente flutuantes
- **Ecosystem_Stats**: Indicadores numericos do estado atual do ecossistema (total de nodes, edges, distribuicao por tipo)

## Requirements

### Requirement 1: Carregamento do Settings Panel

**User Story:** As a developer, I want the settings panel to actually appear when I click the gear icon, so that I can adjust graph parameters in real-time.

#### Acceptance Criteria

1. THE Graph_Panel SHALL include the settings-panel.js script tag in the webview HTML with the correct nonce and URI
2. WHEN the webview loads, THE Graph_Panel SHALL render a gear icon button in the top-right corner
3. WHEN the user clicks the gear icon, THE Settings_Panel SHALL toggle visibility (show/hide)
4. THE Settings_Panel SHALL display all sliders and toggles defined in settings-panel.js (center force, repulsion, link force, link distance, node size, link width, arrows, labels, filters)
5. WHEN the user adjusts any slider, THE Graph_Panel SHALL update the visualization in real-time without re-parsing

### Requirement 2: Background Neural — Cerebro Digital

**User Story:** As a developer, I want the graph to feel like I'm looking inside a digital brain, with a deep dark background, radial glow, and ambient particles that create depth and atmosphere.

#### Acceptance Criteria

1. THE Graph_Panel SHALL use background color #0d0d0d (deep black) for the HTML body and force-graph backgroundColor
2. THE Graph_Panel SHALL render a subtle radial gradient glow in the center of the canvas (color #1a3a5c at 0.15 opacity, fading to transparent) to create a focal point and depth
3. THE Graph_Panel SHALL render ambient floating particles in the background (small dots, 0.5-1.5px, opacity 0.1-0.3, slowly drifting) to simulate neural activity in the environment
4. THE ambient particles SHALL number between 30-60 and move independently of the graph nodes with very slow random drift
5. THE Graph_Panel SHALL optionally render a semi-transparent brain silhouette outline (SVG path, opacity 0.03-0.05) behind the graph as a subtle contextual frame
6. THE Graph_Panel SHALL NOT use the VS Code default gray (#1e1e1e) as background anywhere in the graph rendering area

### Requirement 3: Node Glow/Bloom — Sinapses Iluminadas

**User Story:** As a developer, I want nodes to glow intensely with their type color like illuminated synapses, so that the graph looks like a living neural network.

#### Acceptance Criteria

1. THE Graph_Panel SHALL render each node with a glow/bloom effect using Canvas 2D shadowBlur and shadowColor properties
2. THE Graph_Panel SHALL set shadowBlur to a value proportional to the node size (minimum 8px, maximum 20px, scaling with degree)
3. THE Graph_Panel SHALL set shadowColor to the same color as the node's type color from the COLOR_MAP
4. THE Graph_Panel SHALL render the node circle on top of the glow, creating a bright center with soft radial falloff
5. WHEN a node is dimmed (not highlighted during hover), THE Graph_Panel SHALL reduce the glow intensity proportionally to the opacity reduction
6. THE glow effect SHALL create the visual impression of bioluminescent synapses in a dark neural space

### Requirement 4: Node Sizing — Conexoes Fortes e Fracas

**User Story:** As a developer, I want nodes sized proportionally to their connections so that I can immediately identify which steerings are central (most connected/strongest) and which are peripheral (weakest).

#### Acceptance Criteria

1. THE Graph_Panel SHALL use NODE_BASE_SIZE of 4 pixels as the minimum node radius
2. THE Graph_Panel SHALL use NODE_SCALE_FACTOR of 1.5 pixels per connection for degree-based scaling
3. THE Graph_Panel SHALL calculate node size using the formula: (NODE_BASE_SIZE + degree * NODE_SCALE_FACTOR) * nodeSizeMultiplier
4. THE Graph_Panel SHALL render nodes with high degree (5+ connections) visibly larger than nodes with 0-1 connections
5. THE Graph_Panel SHALL make the size difference dramatic enough that a user can instantly distinguish "strong" nodes (many connections) from "weak" nodes (few connections) without reading labels

### Requirement 5: Simulacao Organica Continua

**User Story:** As a developer, I want the graph to feel alive with subtle continuous movement, so that it conveys the sense of a living, breathing cognitive system rather than a frozen static diagram.

#### Acceptance Criteria

1. THE Force_Simulation SHALL use cooldownTime of Infinity so that the simulation never stops automatically
2. THE Force_Simulation SHALL use alphaDecay of 0.005 to maintain subtle organic movement indefinitely
3. THE Force_Simulation SHALL use warmupTicks of 100 for initial layout stabilization
4. THE Force_Simulation SHALL use d3VelocityDecay of 0.4 to prevent excessive oscillation while allowing gentle drift
5. WHILE the graph is visible, THE Force_Simulation SHALL keep nodes in subtle continuous motion, creating a "breathing" visual effect

### Requirement 6: Parametros de Forca Corretos

**User Story:** As a developer, I want the force parameters to match the design spec defaults, so that the graph layout is readable with proper spacing and clustering.

#### Acceptance Criteria

1. THE Force_Simulation SHALL use centerForce default of 0.05 (gentle centripetal pull, not aggressive centering)
2. THE Force_Simulation SHALL use repulsionForce default of -150 (strong enough to separate clusters)
3. THE Force_Simulation SHALL use linkDistance default of 60 pixels between connected nodes
4. THE Force_Simulation SHALL use linkForce default of 0.3 for link attraction strength
5. THE Settings_Panel SHALL initialize all sliders to these corrected default values
6. WHEN the user has no saved state, THE Graph_Panel SHALL apply these defaults to the force simulation

### Requirement 7: Label Zoom Threshold Correto

**User Story:** As a developer, I want labels to appear at zoom level 1.5x as designed, so that I can read node names without zooming excessively.

#### Acceptance Criteria

1. THE Graph_Panel SHALL show node labels when the zoom level exceeds 1.5x (LABEL_ZOOM_THRESHOLD = 1.5)
2. WHILE zoom level is below 1.5x and label mode is "auto", THE Graph_Panel SHALL hide all node labels, showing only colored glowing dots
3. WHEN label mode is "on", THE Graph_Panel SHALL show labels at all zoom levels regardless of threshold
4. WHEN label mode is "off", THE Graph_Panel SHALL hide labels at all zoom levels regardless of threshold

### Requirement 8: Edges — Impulsos Eletricos com Particulas

**User Story:** As a developer, I want edges to look like neural pathways with electric impulses traveling along them, so that I can see the communication happening between nodes in real-time.

#### Acceptance Criteria

1. THE Graph_Panel SHALL render edges with default opacity of approximately 0.12 (very subtle, barely visible at rest)
2. WHEN the user hovers over a node, THE Graph_Panel SHALL increase opacity of connected edges to approximately 0.7
3. THE Graph_Panel SHALL render edges with default width of 0.5 pixels, increasing to 1.5 pixels on hover
4. THE Graph_Panel SHALL render animated directional particles (Impulse_Particles) traveling along edges using force-graph's linkDirectionalParticles feature
5. THE Impulse_Particles SHALL be small (1-2px), use the color of the source node, and travel at moderate speed (0.005-0.01 per frame)
6. THE Graph_Panel SHALL render 1-3 particles per edge (more particles for edges with higher weight)
7. WHEN multiple references exist between the same two nodes, THE Graph_Panel SHALL render a single edge with increased width proportional to the reference count (weight), making "strong" connections visually thicker
8. THE particle animation SHALL create the visual impression of information/impulses flowing through neural pathways

### Requirement 9: Edges Coloridos — Cor do Node Source

**User Story:** As a developer, I want edges to inherit color from their source node, so that I can visually trace which type of steering is connecting to what, creating a colorful circuit-board aesthetic.

#### Acceptance Criteria

1. THE Graph_Panel SHALL color each edge using the COLOR_MAP color of the source node (the node where the reference originates)
2. THE edge color SHALL be applied at low opacity (0.12 default) so that colors are subtle at rest but visible on hover (0.7 opacity)
3. THE Impulse_Particles on each edge SHALL use the same color as the edge (source node color)
4. WHEN the user hovers over a node, THE connected edges SHALL brighten to show their source colors clearly
5. THE colored edges SHALL create a visual effect similar to colored circuits/pathways in a neural network

### Requirement 10: Click-to-Open Verificacao

**User Story:** As a developer, I want to click any node and have the corresponding file open in the editor, so that I can navigate the ecosystem directly from the graph.

#### Acceptance Criteria

1. WHEN the user clicks a node, THE Extension SHALL open the corresponding file in the VS Code editor
2. WHEN the user clicks a node representing a file that does not exist on disk, THE Extension SHALL display an informational message indicating the file was not found
3. THE Extension SHALL resolve relative paths correctly across different workspace folders in the multi-root workspace
4. THE click-to-open behavior SHALL work for all node types (steering files, code files, unresolved references)

### Requirement 11: Visao de Evolucao do Ecossistema

**User Story:** As a developer, I want to see ecosystem statistics that give me a sense of how the cognitive system is growing, so that I can track its evolution over time.

#### Acceptance Criteria

1. THE Graph_Panel SHALL display a stats indicator in the bottom-left corner showing: total number of nodes, total number of edges, and number of node types present
2. THE stats indicator SHALL update in real-time when the graph data changes (file added/removed/edited)
3. THE stats indicator SHALL use a compact format (e.g., "42 nodes · 127 edges · 5 types") that does not obstruct the graph
4. THE stats indicator SHALL use the same dark theme styling as the legend (semi-transparent dark background)
5. WHEN the graph grows (new steering file added), THE stats indicator SHALL reflect the new totals within 2 seconds

### Requirement 12: NodeTypes Corretos e Consistentes

**User Story:** As a developer, I want node classification to accurately reflect the role of each steering file, so that the visual grouping makes sense and I can filter meaningfully.

#### Acceptance Criteria

1. THE NodeClassifier SHALL classify files with prefix `flow-` as type `steering-flow`
2. THE NodeClassifier SHALL classify files with prefix `help-` as type `steering-help`
3. THE NodeClassifier SHALL classify files with prefix `playbook` as type `steering-playbook`
4. THE NodeClassifier SHALL classify files with prefix `observability-` as type `steering-observability`
5. THE NodeClassifier SHALL classify files containing `-dominio` or `-domain` in the name as type `steering-domain`
6. THE NodeClassifier SHALL classify configuration/rules files (agent-persona, regras-criticas, code-conventions, security-policies, auto-aprendizado, cognitive-evolution) as type `steering-domain`
7. THE NodeClassifier SHALL classify files referenced from code workspace folders (API, Integrador, Mobile, Manifests) that are not steering files as type `code-file`
8. THE NodeClassifier SHALL assign type `unknown` to files that match no classification rule
9. EACH NodeType SHALL have a unique, visually distinct color that is consistent across sessions
