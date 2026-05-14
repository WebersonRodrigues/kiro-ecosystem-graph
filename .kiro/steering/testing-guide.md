---
inclusion: auto
description: Testing conventions and patterns. Use when writing tests, discussing test strategy, or debugging test failures.
---
# Testing Guide

## Stack

- Mocha — test runner
- fast-check — property-based testing
- No mocking framework — use manual stubs

## File Organization

- Unit tests: `src/test/unit/*.test.ts`
- Property tests: `src/test/property/*.property.ts`
- No integration tests yet (extension host testing requires @vscode/test-electron)

## Property-Based Testing

Use fast-check for pure functions (no VS Code API dependency):
- Generate random inputs covering edge cases
- Verify invariants hold for ALL inputs
- Minimum 100 iterations per property

## Naming Convention

- Test files mirror source: `parserService.ts` → `parserService.test.ts`
- Describe blocks: name of the function/class
- It blocks: "should [expected behavior] when [condition]"

## Running Tests

```bash
npm test
```

## Related

- See `code-conventions.md` for code standards
- See `project-overview.md` for project structure
- See `security-policies.md` for security requirements in tests
