# Changelog

## 0.1.5 (2026-05-14)

### Features

- **Export Cognitive Analysis** — New "Export" button in the Cognitive Analysis panel generates a structured Markdown report with all findings, tips per item, and "Instructions for Kiro AI" section ready to paste into chat
- **3 new analysis categories:**
  - Weak Instructions — steerings with fewer than 10 lines (too short to be effective prompts)
  - Context Window Overload — always-loaded steerings exceeding 350 lines + total context budget tracking
  - Instruction ↔ Access Gap — hooks without steering references and steerings without hook triggers
- **Cognitive Ecosystem Guide** — Complete English guide (`docs/cognitive-ecosystem-guide.md`) covering the 9 layers, hook patterns, skills, and step-by-step setup from scratch
- Guide linked in README for marketplace visibility

### Fixes

- Fixed extension not loading on other machines — all webview scripts and force-graph now served from `dist/` instead of `src/` (which was excluded from .vsix by `.vscodeignore`)
- Removed `StatsHistoryService` — no longer generates `ecosystem-graph-stats.json` in the workspace
- Cleaned `.vscodeignore` to exclude `.kiro/**` and `*.vsix` from package

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
