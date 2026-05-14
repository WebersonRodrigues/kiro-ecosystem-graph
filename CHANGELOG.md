# Changelog

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
