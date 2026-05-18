# Changelog

## 0.2.2 (2026-05-18)

### Bug Fixes

- **False Positive Elimination** — 4 bugs corrigidos na análise cognitiva:
  - Context Overload agora exclui steerings `fileMatch`/`manual` da contagem (antes inflava ~10x)
  - Orphan Steerings agora exclui steerings `fileMatch`/`manual` (não precisam de cross-references)
  - Isolated Files agora exclui hooks e skills (ativados por evento/keyword, não por grafo)
  - Hooks Without Instruction agora avalia qualidade do prompt (>= 20 palavras + verbos imperativos) ao invés de métrica binária
- **Parser Quote Stripping** — `inclusion: "fileMatch"` (com aspas) agora é extraído corretamente como `fileMatch`
- **Hook Prompt Metadata** — `then.prompt` do hook agora é armazenado em `metadata.hookPrompt` para avaliação de suficiência

### Improvements

- **Decision Table Detection** — Tabelas de decisão (Quando/Ação, Condition/Action, If/Then, etc.) agora contam como conteúdo acionável no `actionableRatio`
- **Fragile Links Precision** — Só flagra referências de steerings always/auto ou hooks. Referências de steerings fileMatch/manual (documentação) são ignoradas
- **205 testes automatizados** — suite completa cobrindo todos os serviços e validações
- **Hooks padronizados** — todos os hooks agora usam extensão `.kiro.hook` (padrão Kiro IDE)

## 0.2.1 (2026-05-15)

### Bug Fixes

- **Phantom File Detection** — Fixed parser creating ghost nodes for non-ecosystem files (`.cs`, `.ts`, `.py`) referenced in markdown tables and links. Only `.md`, `.json`, and `.kiro.hook` files now produce graph nodes from table-path and markdown-link references. Wiki-links remain unfiltered (intentional cross-references). Defense-in-depth guard added to GraphDataStore.

### Features

- **10 Advanced Cognitive Assertiveness Validations** — New analysis rules in the Cognitive Panel:
  1. **Dead Loops** — Detects isolated cycles with no external entry (Tarjan SCC)
  2. **Hops to Reach** — Alerts steerings 4+ hops from any entry point (BFS)
  3. **Duplicate Intent** — Detects >60% keyword overlap between always-loaded steerings (Jaccard)
  4. **Passive Knowledge** — Flags steerings with <10% actionable content
  5. **Signal-to-Noise** — Flags steerings with 10-20% actionable content
  6. **Contradictions** — Detects opposing rules between always-loaded steerings
  7. **Hook Coverage Map** — Shows which IDE events have hooks and which don't
  8. **Decision Path** — Verifies hook→steering chain completeness
  9. **Quality Gate** — Maturity score (0/1/2) for self-review and subagent review mechanisms
  10. **DML Protection** — Maturity score (0/1/2) for database operation safeguards

- **Content Analyzer** — New extension host service that extracts keywords, actionable ratio, imperative lines, and section headers from steerings during parsing. Results power the content-based validations.

- **Enhanced Markdown Export** — All 10 new validations included in the exported cognitive analysis report with dedicated sections, tables, and AI instructions.

## 0.2.0 (2026-05-14)

### Features

- **3D Mode** — Toggle between 2D and 3D visualization with the "3D" button in the toolbar
  - Orbit controls (rotate, zoom, pan)
  - Node drag with position locking (nodes stay where you put them)
  - Double-click focus mode (isolate connected nodes) with "Return to full graph" button
  - Directional particles on links
  - Lazy-loaded (3D library only loads on first use)
  - WebGL fallback to 2D if GPU unavailable
  - Cluster and Expand buttons work in both modes
  - Type filters work in both modes
  - 2D-only features (Heatmap, Constellation, Synaptic) hidden in 3D mode
  - Shape legend hidden in 3D mode (all nodes are spheres)
- **Export Cognitive Analysis** — "Export" button in the Cognitive Analysis panel generates a structured Markdown report
  - All findings with per-item tips
  - "Instructions for Kiro AI" section ready to paste into chat
- **3 new cognitive analysis categories:**
  - Weak Instructions — steerings with fewer than 10 lines
  - Context Window Overload — always-loaded steerings exceeding 350 lines
  - Instruction ↔ Access Gap — hooks without steering references and vice versa
- **Heartbeat pulse** — Each node has a subtle inner pulse (tum-tum rhythm) giving the ecosystem a living feel
- **Central pulse orb** — Glowing orb at the center of the graph (both 2D and 3D)
- **Cognitive Ecosystem Guide** — Complete English guide linked from README

### Fixes

- Fixed extension not loading on other machines (all assets served from dist/)
- Removed StatsHistoryService (no more ecosystem-graph-stats.json generation)
- Cleaned .vscodeignore (excludes .kiro/ and *.vsix)

### Documentation

- README updated: "Built for Kiro IDE, also compatible with VS Code"
- Link to cognitive ecosystem guide in README
- package.json description mentions Kiro IDE

## 0.1.3 (2026-05-14)

### Improvements

- Internal build improvements

## 0.1.2 (2026-05-14)

### Improvements

- Redesigned README for marketplace — hero image first, badges, emoji headers, better structure
- Removed local file references from documentation
- Improved visual hierarchy for marketplace browsing

## 0.1.1 (2026-05-14)

### Fixes

- Fixed screenshots not loading on marketplace (moved to resources/ folder)
- Fixed classification: files with `standards` or `conventions` in the name now classified as `steering-tech` (cyan) instead of generic `steering-domain`

## 0.1.0 (2026-05-13)

### Features

- Force-directed graph visualization of `.kiro/steering/`, `.kiro/skills/`, and `.kiro/hooks/` files
- Neural network visual theme (dark background, glow nodes, ambient particles, brain silhouette)
- Shape differentiation: circles (steerings), diamonds (skills), triangles (hooks)
- Reference extraction from markdown (wiki-links, markdown-links, backtick-refs, table-paths)
- Hook JSON parsing with implicit edge extraction (toolTypes, patterns, prompt refs)
- Edge weight visualization (logarithmic scaling, capped at 5px)
- Cognitive Analysis Panel (orphan steerings, fragile links, isolated files, coverage gaps, suggestions)
- Brain Health Panel (orphan count, hub node, cognitive weight, island detection)
- Visual modes: Activity Heatmap, Constellation Mode, Synaptic Strength
- Shape Legend (bottom-left indicator showing circle/diamond/triangle mapping)
- Filter panel with type and workspace folder toggles
- Real-time file watching with 500ms debounce
- Click-to-open file navigation
- Edge hover tooltip (reference count and types)
- Enhanced hook tooltips (trigger type, description, referenced steerings)
- Multi-workspace support
- Settings panel with real-time physics controls
- Fully offline, no network dependencies
