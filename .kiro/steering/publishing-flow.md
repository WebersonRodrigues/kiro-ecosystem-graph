---
inclusion: manual
description: Step-by-step publishing workflow for VS Code Marketplace and Open VSX. Use when preparing a release.
---
# Publishing Flow

## Pre-Release Checklist

1. All changes committed
2. `npm run compile` passes without errors
3. Version bumped in `package.json`
4. CHANGELOG.md updated with new version entry
5. No `console.log` left in production code

## VS Code Marketplace

```bash
npm run compile
npx vsce package
npx vsce publish
```

## Open VSX (Kiro IDE)

```bash
npx ovsx publish kiro-ecosystem-graph-X.Y.Z.vsix -p TOKEN
```

Or upload manually at https://open-vsx.org → Extensions → "Publish Extension"

## Post-Publish

- Push commit + tag to GitHub
- Verify extension appears on marketplace
- Test install on a clean machine

## Related

- See `project-overview.md` for full project context
- See `code-conventions.md` for code standards before publishing
- See `testing-guide.md` for running tests before release
