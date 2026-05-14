---
inclusion: auto
description: Known problems and solutions for the extension. Use when debugging issues or investigating errors.
---
# Troubleshooting Guide

## Extension doesn't load on other machines

**Symptom:** Extension installs but shows empty panel, no graph.

**Cause:** Webview scripts referenced from `src/` which is excluded from .vsix by `.vscodeignore`.

**Solution:** All scripts must be served from `dist/`. The esbuild config copies them during build.

**Prevention:** Always test with `npx vsce package` + install from .vsix before publishing.

## Graph shows no nodes

**Symptom:** Panel opens but says "No ecosystem data found."

**Cause:** No `.kiro/steering/*.md`, `.kiro/skills/*.md`, or `.kiro/hooks/*.json` files in workspace.

**Solution:** Create at least one steering file in `.kiro/steering/`.

## 3D mode shows black screen

**Symptom:** Clicking 3D button shows nothing.

**Cause:** WebGL not available or 3d-force-graph script failed to load.

**Solution:** Check browser console for errors. Fallback to 2D mode.

## Related

- See `project-overview.md` for architecture
- See `publishing-flow.md` for packaging steps
- See `code-conventions.md` for development standards
