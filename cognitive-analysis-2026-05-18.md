# Cognitive Analysis Report

Generated: 2026-05-18T18:12:00.649Z

## Summary

| Metric | Count |
|--------|-------|
| Orphan Steerings | 0 |
| Fragile Links | 25 |
| Isolated Files | 0 |
| Coverage Gaps | 0 |
| Weak Instructions | 0 |
| Context Overload (350+ lines) | 0 |
| Total Always-Loaded Lines | 425 |
| Hooks Without Instruction | 1 |
| Steerings Without Access | 0 |
| Dead Loops | 0 |
| Hops to Reach (4+) | 3 |
| Duplicate Intent Pairs | 0 |
| Passive Knowledge | 3 |
| Low Signal-to-Noise | 2 |
| Contradictions | 0 |
| Hook Coverage | 4/10 |
| Quality Gate Level | 2/2 |
| DML Protection Level | 1/2 |

## Fragile Links

Connections relying on a single backtick reference — one deletion breaks the link.

| Source | Target | Tip |
|--------|--------|-----|
| `.kiro/steering/code-conventions.md` | `.kiro/steering/project-overview.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/code-conventions.md` | `.kiro/steering/security-policies.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/code-conventions.md` | `.kiro/steering/testing-guide.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/troubleshooting-guide.md` | `.kiro/steering/project-overview.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/troubleshooting-guide.md` | `.kiro/steering/publishing-flow.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/troubleshooting-guide.md` | `.kiro/steering/code-conventions.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/webview-architecture.md` | `.kiro/steering/project-overview.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/webview-architecture.md` | `.kiro/steering/code-conventions.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/webview-architecture.md` | `.kiro/steering/testing-guide.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/testing-guide.md` | `.kiro/steering/code-conventions.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/testing-guide.md` | `.kiro/steering/project-overview.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/testing-guide.md` | `.kiro/steering/security-policies.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/security-policies.md` | `.kiro/steering/code-conventions.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/security-policies.md` | `.kiro/steering/project-overview.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/publishing-flow.md` | `.kiro/steering/project-overview.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/publishing-flow.md` | `.kiro/steering/code-conventions.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/steering/publishing-flow.md` | `.kiro/steering/testing-guide.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/skills/generate-component.md` | `.kiro/steering/project-overview.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/skills/code-review.md` | `.kiro/steering/testing-guide.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/hooks/self-learning.kiro.hook` | `.kiro/steering/project-overview.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/hooks/self-learning.kiro.hook` | `.kiro/steering/code-conventions.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/hooks/post-task-checklist.kiro.hook` | `.kiro/steering/security-policies.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/hooks/post-task-checklist.kiro.hook` | `.kiro/steering/code-conventions.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/hooks/code-review-hook.kiro.hook` | `.kiro/steering/code-conventions.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |
| `.kiro/hooks/code-review-hook.kiro.hook` | `.kiro/steering/security-policies.md` | Add at least one additional cross-reference (wiki-link or markdown-link) between these files |

## Instruction ↔ Access Gap

### Hooks Without Instruction

| Hook | Label | Tip |
|------|-------|-----|
| `.kiro/hooks/analise-manual.kiro.hook` | Analise manual | Add a steering reference in the hook prompt |

## Hops to Reach

Steerings that are 4+ hops from any entry point — too deep for efficient agent navigation.

| File | Label | Hops | Tip |
|------|-------|------|-----|
| `.kiro/steering/troubleshooting-guide.md` | troubleshooting-guide | ∞ | Create a direct reference from an entry point to this steering |
| `.kiro/steering/publishing-flow.md` | publishing-flow | ∞ | Create a direct reference from an entry point to this steering |
| `.kiro/steering/webview-architecture.md` | webview-architecture | ∞ | Create a direct reference from an entry point to this steering |

## Passive Knowledge

Steerings with <10% actionable content — they describe but do not instruct.

| File | Label | Actionable % | Tip |
|------|-------|-------------|-----|
| `.kiro/steering/project-overview.md` | project-overview | 2% | Add imperative instructions (use, always, never, must) |
| `.kiro/steering/publishing-flow.md` | publishing-flow | 4% | Add imperative instructions (use, always, never, must) |
| `.kiro/steering/webview-architecture.md` | webview-architecture | 3% | Add imperative instructions (use, always, never, must) |

## Signal-to-Noise

Steerings with 10-20% actionable content — mostly descriptive, low instruction density.

| File | Label | Signal % | Tip |
|------|-------|---------|-----|
| `.kiro/steering/security-policies.md` | security-policies | 14% | Condense descriptive text and increase instruction density |
| `.kiro/steering/testing-guide.md` | testing-guide | 14% | Condense descriptive text and increase instruction density |

## Hook Coverage Map

IDE events without any hook configured — potential automation opportunities.

| Event | Status | Tip |
|-------|--------|-----|
| fileEdited | ✗ Uncovered | Evaluate if automation is needed for this event |
| fileCreated | ✗ Uncovered | Evaluate if automation is needed for this event |
| fileDeleted | ✗ Uncovered | Evaluate if automation is needed for this event |
| promptSubmit | ✗ Uncovered | Evaluate if automation is needed for this event |
| preToolUse | ✗ Uncovered | Evaluate if automation is needed for this event |
| preTaskExecution | ✗ Uncovered | Evaluate if automation is needed for this event |
| userTriggered | ✓ 1 hook(s) | — |
| agentStop | ✓ 1 hook(s) | — |
| postToolUse | ✓ 1 hook(s) | — |
| postTaskExecution | ✓ 1 hook(s) | — |

## Decision Path Completeness

Incomplete hook→steering chains — the agent cannot fully detect, decide, and execute.

### Hooks Without Decision Steering

| Hook | Label | Tip |
|------|-------|-----|
| `.kiro/hooks/analise-manual.kiro.hook` | Analise manual | Link this hook to a steering with decision criteria |

## Quality Gate

**Maturity Level: 2/2 (Complete)**

## DML Protection

**Maturity Level: 1/2 (Blind Block)**

| Component | Status | Tip |
|-----------|--------|-----|
| DML Hook | ✗ Missing | Create a preToolUse hook with SQL/database keywords |
| DML Steering | ✓ Present | Create a steering with database protection rules |
| Risk Integration | ✗ Missing | Link the DML hook to a steering with risk assessment criteria |

## Recommendations

- Strengthen the 25 fragile link(s) by adding additional cross-references between the connected nodes.
- 1 hook(s) have no steering reference — they have access/trigger but no instruction context. Link them to relevant steerings.
- 3 steering(s) are 4+ hops from any entry point. Create direct shortcuts from entry points to reduce navigation depth.
- 3 steering(s) have <10% actionable content. Add imperative instructions (use, always, never, must) to make them actionable.
- 2 steering(s) have 10-20% actionable content. Condense descriptive text and increase instruction density.
- 6 IDE event(s) have no hooks configured. Evaluate if automation is needed for: fileEdited, fileCreated, fileDeleted, promptSubmit, preToolUse, preTaskExecution.
- 1 decision path gap(s) found. Complete hook→steering chains to give the agent full detect→decide→execute capability.
- DML Protection at level 1/2. Missing: preToolUse hook with DML keywords, hook→risk-steering integration.

## Instructions for Kiro AI

```text
Based on the cognitive analysis above, please resolve the identified issues:

1. For each Fragile Link, add at least one additional reference.
2. For each Hook Without Instruction, add a steering reference.
3. For distant steerings (4+ hops), create direct shortcuts from entry points.
4. For passive steerings, add imperative instructions.
5. For low signal-to-noise steerings, condense descriptive text.
6. For uncovered IDE events, evaluate if hooks are needed.
7. For DML Protection, add missing components to reach level 2.

Prioritize changes that increase overall graph connectivity and reduce context window waste.
```
