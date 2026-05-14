# Changelog

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
