# Skill: Code Review

## When to activate
When the user asks to review code, or after implementing a feature.

## What it does
Performs a structured code review under 3 perspectives: Engineering, Security, and QA.

## Step by step

### 1. Engineering Review
- Check code follows `code-conventions.md` standards
- Verify no duplication
- Confirm imports are correct and grouped

### 2. Security Review
- Check against `security-policies.md` checklist
- Verify no hardcoded secrets
- Confirm inputs are validated

### 3. QA Review
- Check edge cases (null, empty, overflow)
- Verify error handling is complete
- Confirm happy path and failure path both work

## Rules
- Never skip a perspective
- If a problem is found, fix it immediately
- Report only if all 3 perspectives pass

## Related
- See `code-conventions.md` for standards
- See `security-policies.md` for security rules
- See `testing-guide.md` for test expectations
