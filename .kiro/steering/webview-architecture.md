---
inclusion: fileMatch
fileMatchPattern: "**/webview/**,**/media/**"
description: Architecture of the webview layer. Use when working on graph rendering, panels, or webview communication.
---
# Webview Architecture

## Overview

The webview is a VS Code WebviewView rendered in the activity bar sidebar. It uses vanilla JavaScript with the force-graph library for 2D rendering and 3d-force-graph for 3D mode.

## Communication Flow

```
Extension Host (TypeScript)
    ↕ postMessage
Webview (JavaScript)
    → ForceGraph / ForceGraph3D
    → DOM overlays (panels, tooltips, controls)
```

## File Structure

| File | Purpose |
|------|---------|
| `webview.js` | Main graph initialization, node rendering, interactions |
| `renderer-manager.js` | 2D/3D mode switching abstraction |
| `cognitive-panel.js` | Brain analysis panel |
| `settings-panel.js` | Physics and visual settings |
| `filter-panel.js` | Type and folder filters |
| `health-panel.js` | Graph health metrics |
| `export-panel.js` | Image export and snapshots |

## Key Globals

- `vscode` — VS Code webview API (postMessage)
- `graph` — ForceGraph 2D instance
- `graphData` — Current { nodes, links } data
- `COLOR_MAP` — Node type → color mapping
- `degreeMap` — Node ID → connection count

## Related

- See `project-overview.md` for full project context
- See `code-conventions.md` for coding standards
- See `testing-guide.md` for test approach
