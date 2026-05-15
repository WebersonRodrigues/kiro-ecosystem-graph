# Cognitive Analysis Rules — Kiro Ecosystem Graph

## What is this?

The Kiro Ecosystem Graph analyzes the "health" of your cognitive ecosystem (steerings, hooks, skills) and generates a report with issues and suggestions. Each rule below is an automated validation that runs when you open the analysis panel or export the report.

The goal is simple: **the more precise and well-connected the ecosystem, the more assertive and reliable the AI agent becomes.**

---

## Base Rules

### 1. Orphan Steerings

**What it checks:** Steerings with zero connections (no incoming or outgoing references).

**Why it matters:** An orphan steering is invisible to the agent. It exists on disk but is never reached — it's dead knowledge.

**Example:**
```
.kiro/steering/flow-geral.md  →  0 incoming, 0 outgoing  →  ORPHAN
```

**Impact:** The agent will never use the rules in that file. You wrote instructions that nobody reads.

**How to fix:** Add a reference to this steering from a related steering using backtick syntax (`` `flow-geral.md` ``).

---

### 2. Fragile Links

**What it checks:** Connections between steerings that rely on a single backtick reference. If someone deletes that reference, the connection dies.

**Example:**
```
code-conventions.md  →  (1 backtick-ref)  →  testing-guide.md
```
If someone removes the `` `testing-guide.md` `` from code-conventions, the connection disappears.

**Impact:** Fragile network. An accidental edit can isolate an entire steering.

**How to fix:** Add at least one more reference (wiki-link or markdown-link) between the connected files.

---

### 3. Isolated Files

**What it checks:** Nodes in the graph with zero edges (no incoming or outgoing).

**Why it matters:** Files without connections are not part of the knowledge network. The agent has no context about them.

**Impact:** Lost information in the ecosystem.

**How to fix:** Reference the isolated file from the most relevant steering.

---

### 4. Coverage Gaps

**What it checks:** Workspace folders that have no steering files.

**Example:**
```
Workspace "mobile"  →  0 steerings  →  GAP
```

**Impact:** The agent has no instructions about that area of the project. It works "in the dark".

**How to fix:** Create a steering in `.kiro/steering/` covering that workspace's domain.

---

### 5. Weak Instructions

**What it checks:** Steerings with fewer than 10 lines.

**Why it matters:** A 5-line file doesn't have enough context to guide the agent. It's like giving half an instruction.

**Impact:** Agent receives vague direction, produces inconsistent results.

**How to fix:** Expand with context, rules, examples, and expected behavior. Ideal range: 100-350 lines.

---

### 6. Context Overload

**What it checks:** Always-loaded steerings with more than 350 lines, and total always-loaded lines above 500.

**Why it matters:** Each always-loaded steering consumes tokens from the agent's context window. Above 60% usage, quality degrades significantly.

**Example:**
```
Total always-loaded: 1090 lines  →  OVERLOAD
project-overview.md: 420 lines  →  OVERLOAD (max 350)
```

**Impact:** Agent loses reasoning capacity because it's "full" of context.

**How to fix:** Split large steerings into smaller focused files, or change to `inclusion: manual` or `inclusion: fileMatch`.

---

### 7. Hooks Without Instruction

**What it checks:** Hooks that fire but don't reference any steering — the agent executes without context.

**Example:**
```
auto-learn.kiro.hook  →  fires on agentStop  →  but references no steering
```

**Impact:** The hook triggers the agent, but it doesn't know WHAT to do because there's no associated instruction.

**How to fix:** Add a steering reference in the hook's prompt.

---

### 8. Steerings Without Access

**What it checks:** Steerings with `inclusion: manual` or `fileMatch` that no hook references.

**Impact:** The steering has instructions, but is never automatically activated. The agent only sees it if the user manually includes it.

**How to fix:** Create a hook that references this steering, or change to `inclusion: always`.

---

## Advanced Assertiveness Rules (v0.2.1)

### 9. Dead Loops (Isolated Cycles)

**What it checks:** Groups of steerings that reference each other in a cycle, but no external node points to them.

**Example:**
```
A → B → C → A  (cycle)
No other steering points to A, B, or C  →  DEAD LOOP
```

**Impact:** If the agent enters this cycle, it gets stuck navigating between the same 3 files without ever reaching useful information.

**How to fix:** Add a reference from an entry point (always-loaded steering or hook) to at least one node in the cycle.

---

### 10. Hops to Reach (Access Depth)

**What it checks:** How many "hops" the agent needs to get from an entry point to each steering. Alerts when >= 4 hops.

**Example:**
```
hook → steering-A → steering-B → steering-C → steering-D (4 hops)
steering-D is TOO FAR from the entry point
```

**Impact:** The agent likely won't reach deep steerings in time. Important information becomes practically inaccessible.

**How to fix:** Create a direct shortcut — a reference from an entry point to the distant steering.

---

### 11. Duplicate Intent (Instruction Redundancy)

**What it checks:** Pairs of always-loaded steerings with more than 60% keyword overlap.

**Example:**
```
code-conventions.md  ↔  code-standards.md  →  78% overlap
Both talk about: typescript, strict, semicolons, indentation, formatting
```

**Impact:** The agent loads two files saying almost the same thing. Wastes tokens and may receive conflicting micro-variations.

**How to fix:** Consolidate into a single file or clearly differentiate scopes (one for formatting, another for architecture).

---

### 12. Passive Knowledge

**What it checks:** Steerings with less than 10% of lines containing imperative verbs (use, always, never, must, should, avoid, etc.).

**Example:**
```
project-overview.md  →  2% actionable
"The system uses TypeScript..."  ← describes
"The extension renders a graph..."  ← describes
No line tells the agent WHAT TO DO
```

**Impact:** The agent reads the file but receives no direction. It's like reading a manual without instructions — just description.

**How to fix:** Add imperative instructions: "Use TypeScript strict mode", "Always run tests before commit", "Never expose secrets in logs".

---

### 13. Signal-to-Noise (Instruction/Context Ratio)

**What it checks:** Steerings with 10-20% actionable content — they have some instructions but are mostly descriptive.

**Example:**
```
security-policies.md  →  14% signal
300 lines of context about threats
42 lines of actual rules for the agent to follow
```

**Impact:** The agent spends most tokens reading background and has little effective direction.

**How to fix:** Condense descriptive context and increase instruction density. Move background to a separate file with `inclusion: manual`.

---

### 14. Contradictions (Rule Conflicts)

**What it checks:** Always-loaded steerings that contain opposing rules about the same subject.

**Example:**
```
code-conventions.md:  "Always use single quotes"
legacy-support.md:    "Never use single quotes in templates"
                       ↑ CONTRADICTION: always vs never about "single quotes"
```

**Impact:** The agent receives conflicting instructions simultaneously. Unpredictable results — sometimes follows one, sometimes the other.

**How to fix:** Unify the rule in a single steering or define distinct scopes (e.g., "single quotes for TypeScript, double quotes for templates").

---

### 15. Hook Coverage Map (Event Coverage)

**What it checks:** Which of the 10 available IDE events have hooks configured and which don't.

**Available events:**
- `fileEdited` — file saved
- `fileCreated` — file created
- `fileDeleted` — file deleted
- `userTriggered` — manual button
- `promptSubmit` — message sent to agent
- `agentStop` — agent finished execution
- `preToolUse` — before using a tool
- `postToolUse` — after using a tool
- `preTaskExecution` — before starting a task
- `postTaskExecution` — after completing a task

**Example:**
```
✓ agentStop (1 hook)
✓ postToolUse (1 hook)
✓ postTaskExecution (1 hook)
✗ fileEdited — UNCOVERED
✗ preToolUse — UNCOVERED
✗ promptSubmit — UNCOVERED
... 7 events without coverage
```

**Impact:** Events without hooks are missed automation opportunities. The agent could validate code on save, review before executing tools, etc.

**How to fix:** Evaluate which events make sense for your workflow and create hooks for them.

---

### 16. Decision Path (Decision Chain Completeness)

**What it checks:** Whether hook→steering chains are complete. Two problems:
1. Hooks that fire without any steering providing decision criteria
2. Steerings with decision content that no hook triggers

**Example:**
```
PROBLEM 1: hook "auto-format" fires on fileEdited
            → but references no steering with formatting rules
            → agent formats "by feeling" without criteria

PROBLEM 2: steering "when-to-refactor.md" has decision rules
            → but no hook triggers it
            → rules exist but are never used automatically
```

**Impact:** Agent makes decisions without criteria (hook without steering) or has criteria that are never activated (steering without hook).

**How to fix:** Link hooks to steerings with criteria, and create hooks for decision steerings.

---

### 17. Quality Gate (Code Quality Assurance)

**What it checks:** Whether the ecosystem has self-review mechanisms to ensure nothing reaches the developer without being documented, tested, and compliant.

**Maturity levels:**

| Level | Name | Meaning |
|-------|------|---------|
| 0 | No Gate | No review mechanism. Code can be delivered without validation. |
| 1 | Partial | Has quality steering OR review hook, but not integrated. |
| 2 | Complete | Has steering + review hook + post-task hook that validates compliance. |

**Example of Level 2 (ideal):**
```
✓ Hook preToolUse "code-review" → references code-conventions.md
✓ Steering "code-conventions.md" → quality rules
✓ Hook postTaskExecution "checklist" → references code-conventions.md
```

**Impact:** Without a quality gate, the agent can deliver code without tests, without documentation, without following conventions. With level 2, EVERYTHING goes through validation before reaching the developer.

**How to fix:**
1. Create a `preToolUse` or `postToolUse` hook with review keywords
2. Create a steering with quality/convention rules
3. Create a `postTaskExecution` hook that references the quality steering

---

### 18. DML Protection (Destructive Operation Safeguards)

**What it checks:** Whether the ecosystem has protection against database operations (INSERT, UPDATE, DELETE, DROP) executed by the AI agent.

**Maturity levels:**

| Level | Name | Meaning |
|-------|------|---------|
| 0 | No Protection | Agent can execute any SQL without a gate. |
| 1 | Blind Block | Has hook that blocks, but doesn't assess risks — blocks without explaining. |
| 2 | Smart Protection | Hook blocks + steering assesses risks + notifies dev with context. |

**Example of Level 2 (ideal):**
```
✓ Hook preToolUse with toolTypes ".*sql.*" → references database-rules.md
✓ Steering "database-rules.md" → risk criteria (production, rollback, impact)
✓ Hook evaluates: "This DELETE affects 50k records in production. Irreversible. Confirm?"
```

**Example of Level 0 (dangerous):**
```
✗ No hook for SQL
✗ No database steering
→ Agent executes "DELETE FROM users" without asking anything
```

**Impact:** Without DML protection, an AI agent can execute destructive database operations without any validation. With level 2, every operation is assessed for risk before execution.

**How to fix:**
1. Create a `preToolUse` hook with `toolTypes: [".*sql.*", ".*database.*"]`
2. Create a steering with database protection rules (backup, rollback, environments)
3. In the hook prompt, reference the steering so the agent assesses risks before executing

---

## Visual Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    COGNITIVE ANALYSIS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GRAPH STRUCTURE              CONTENT QUALITY                   │
│  ├─ Orphan Steerings          ├─ Passive Knowledge              │
│  ├─ Fragile Links             ├─ Signal-to-Noise                │
│  ├─ Isolated Files            ├─ Duplicate Intent               │
│  ├─ Coverage Gaps             └─ Contradictions                 │
│  ├─ Dead Loops                                                  │
│  └─ Hops to Reach            SECURITY & MATURITY                │
│                               ├─ Quality Gate (0/1/2)           │
│  COMPLETENESS                 ├─ DML Protection (0/1/2)         │
│  ├─ Hooks Without Instruction ├─ Hook Coverage Map              │
│  ├─ Steerings Without Access  └─ Decision Path                  │
│  ├─ Weak Instructions                                           │
│  └─ Context Overload                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## How to Use

1. Open the Kiro Ecosystem Graph (sidebar icon)
2. Click the 🧠 (Brain) button in the toolbar
3. The panel shows all metrics in real-time
4. Click "Export" to generate the Markdown report
5. Paste the report in Kiro chat and ask it to resolve the issues

---

*Version: 0.2.1 | 18 analysis rules | 137 automated tests*
