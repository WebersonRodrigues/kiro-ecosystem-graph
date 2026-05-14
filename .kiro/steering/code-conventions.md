---
inclusion: always
---
# Code Conventions

## Principles

- TypeScript strict mode always
- No `any` types — use proper interfaces
- Functions under 30 lines — split if larger
- Meaningful names — no abbreviations except well-known ones (ctx, req, res)

## Formatting

- 2 spaces indentation
- Single quotes for strings
- Semicolons always
- Trailing commas in multiline

## Error Handling

- Never swallow errors silently — at minimum log them
- Use typed errors when possible
- Always handle Promise rejections

## Imports

- Group: node builtins → external packages → internal modules
- Use relative paths for internal imports
- Never use barrel exports (index.ts re-exports)

## Related

- See `project-overview.md` for project structure
- See `security-policies.md` for security rules
- See `testing-guide.md` for test conventions
