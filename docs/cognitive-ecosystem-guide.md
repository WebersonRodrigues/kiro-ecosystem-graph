# Complete Guide: How to Build an AI Cognitive Ecosystem for Any Project

> This guide is designed for [Kiro IDE](https://kiro.dev) users building cognitive ecosystems with steerings, skills, and hooks. The concepts apply to any AI-assisted development environment, but the tooling and examples are Kiro-native.

---

## The 3 Core Truths

Before diving into layers and architecture, internalize these three principles. Everything in this guide exists to serve them:

### 1. Files are the new software

Your `.md` files are not documentation — they are the application itself. Each steering file becomes an instruction that the AI transforms into behavior, code, and decisions. The asset is no longer compiled code — the asset is the prompt. Treat your steerings with the same rigor you treat production code.

### 2. Guard the context window

After 60% context window token usage, AI quality degrades significantly. The agent starts losing precision, forgetting rules, and producing generic responses. Organize your cognitive memory BEFORE it compacts. Keep individual steerings between 100-350 lines. Use `inclusion: auto` and `fileMatch` aggressively — only load what's needed for the current moment.

### 3. Every agent = Instruction + Access

When building any AI agent or ecosystem, obsess over two things: **instruction** (how precise and specific your directions are) and **access** (the tools and data sources available). Every agent is a good instruction with correct access to the tools it needs. The more precise and specific you are on these two dimensions, the more assertive and performant your agent will be.

---

## What it is and why build one

An AI cognitive ecosystem is a living documentation system that transforms any AI model connected to your workspace into a project specialist. It's not a static set of rules — it's an organism that learns from each session, accumulates verified knowledge, and refines itself over time.

### The two fundamental pillars: Instruction and Access

Before thinking about layers, hooks, or cognitive evolution, understand that every AI agent comes down to two things — and the entire ecosystem exists to optimize these two things:

**1. INSTRUCTION** — How precise and specific your directions to the agent are

The clearer, more detailed, and more contextualized the set of instructions (steerings, persona, rules, playbooks), the more assertive the agent will be. Vague instructions produce vague responses. Precise instructions produce surgical responses.

Examples of bad vs good instruction:
- Bad: "Follow security best practices"
- Good: "Never interpolate variables in SQL. Always use parameters. If you find SQL without parameters, fix it before continuing any task"

**2. ACCESS** — The tools and data sources available to the agent

The more correct access the agent has (MCPs for the database, source code, logs, APIs), the less it needs to guess and the more it can verify before responding. Wrong or incomplete access produces hallucinated responses.

Examples of access:
- MCP for the database (query structure, real data)
- MCP for the code repository (read source code from external systems)
- Codebase search tools (grepSearch, readCode)
- Diagnostic tools (getDiagnostics, build)

**The formula:** `Agent assertiveness = Instruction quality × Access to the right tools`

The entire cognitive ecosystem is, at its core, a system to maximize these two variables in an organized and evolutionary way. Steerings are instruction. MCPs and tools are access. Hooks ensure instruction is followed. Self-learning refines instruction over time.

### Memory in 3 layers

The ecosystem creates a memory system managed semi-automatically by the AI:

| Memory type | What it is | How it works | Example |
|-------------|-----------|--------------|---------|
| **Short-term** | Current session context | Steerings loaded automatically + ongoing conversation | Agent knows who it is, knows the rules, has the map |
| **Medium-term** | Recent accumulated knowledge | Steerings updated after heavy investigations (self-learning) | Problem solved yesterday is already documented |
| **Long-term** | Consolidated base | Verified playbooks, known issues, business rules | Decision trees that have worked for months |

**Self-learning** is the mechanism that moves knowledge from short-term (discovered in a session) to medium/long-term (documented in steerings). Without it, the ecosystem stays static and doesn't evolve.

### What you gain

- Any new agent session starts with complete context (zero dependency on memory between sessions)
- Instant answers for already-solved problems (no re-investigation)
- Code delivered following project standards automatically
- Protection against common errors (security hooks, automatic review)
- Measurable evolution — the system gets smarter with each use
- Instant onboarding — any new dev (human or AI) understands the project in minutes

### Architecture in layers

The ecosystem works in 9 complementary layers:

1. **Identity and Behavior** — who the agent is, how it behaves, execution workflow
2. **Navigation Map** — where to find each type of information
3. **Domain Knowledge** — entities, business rules, FAQ, flows
4. **Decision Trees** — verified playbooks for recurring problems
5. **Security and Quality** — security checklist, code standards
6. **Hooks (Automation)** — automatic behaviors triggered by events
7. **Specs and Implementation** — guided development workflow
8. **Skills (Abilities)** — active capabilities the agent executes on demand
9. **Cognitive Evolution** — maturity map, self-learning, metrics

---

## Folder Structure

```
.kiro/
  steering/           ← Knowledge and behavior documents
  hooks/              ← Automations triggered by events
  skills/             ← Specialized agent abilities (activated on demand)
  specs/              ← Feature/bug specifications
  settings/           ← Configurations (MCP servers, etc.)
```

### Steering Naming Convention

Steering names are up to each team/project. The recommendation is to use clear, objective, and consistent names. Choose a prefix/suffix pattern and maintain it across the ecosystem.

**Suggested suffixes:**

| Suffix | Use |
|--------|-----|
| `*-domain` | Domain knowledge, entities, glossary |
| `*-standards` | Mandatory project standards (absolute rules, identity) |
| `*-conventions` | Code, writing, naming conventions |
| `*-policies` | Security, deploy, governance, access policies |
| `*-flow` | Documented business or work flows |
| `*-playbook` | Verified decision trees |
| `*-guide` | Guides, FAQ, tutorials, quick reference |
| `*-troubleshooting` | Known problems and solutions |
| `*-evolution` | Maturity map and evolution strategy |

**Principle:** the name should be self-explanatory. Anyone (or any agent) reading the filename should immediately understand what it contains without opening it.

**Example filenames using these suffixes:**

```
agent-persona.md              ← Identity and workflow (standards)
project-standards.md          ← Absolute project rules
code-conventions.md           ← Code standards
security-policies.md          ← Security policies
orders-flow.md                ← Orders flow
sync-flow.md                  ← Synchronization flow
auth-flow.md                  ← Authentication flow
entities-domain.md            ← Entities and relationships
business-rules-domain.md      ← Business rules
api-guide.md                  ← Endpoint reference
faq-guide.md                  ← Frequently asked questions
known-issues-troubleshooting.md  ← Known problems
decision-playbook.md          ← Decision trees
cognitive-evolution.md        ← Maturity map
```

### Loading Types (front-matter)

Each steering has a YAML front-matter that defines when it's loaded into context:

```yaml
---
inclusion: always          # Loads in EVERY session (use sparingly — consumes context)
---
```

```yaml
---
inclusion: auto            # Loads when the user's question matches the description
description: Text describing when this steering should activate
---
```

```yaml
---
inclusion: fileMatch       # Loads when a matching file is open/being read
fileMatchPattern: "**/*.py,**/auth/**,**/login/**"
description: Descriptive text
---
```

```yaml
---
inclusion: manual          # Loads only when the user explicitly requests via #name
---
```

**Golden rule:** `always` steerings should be lean (< 350 lines). The total set of steerings loaded in a session should not exceed 60% of the model's token window — above that, the agent loses quality and precision in responses. The more always steerings, the more context consumed in every session. Use `auto` and `fileMatch` for specific knowledge, loading only what's relevant for the moment.

---

## LAYER 1: Identity and Behavior (agent-persona.md)

This is the most important steering. Defines WHO the agent is and HOW it behaves. Must be `always`.

### Recommended structure

```markdown
---
inclusion: always
---
# [AGENT NAME] — Autonomous Execution Workflow

## Who I am

[Persona description: name, role in the team, stack mastery]

Personality:
- [Personality traits — professional but approachable]
- [How it handles user frustration]
- [Level of formality]

How I communicate:
- [Language and style — informal technical, direct, no fluff]
- [What to NEVER do in communication]

## Response pattern

[Define that responses must be SPECIFIC and ACTIONABLE, never generic]

For BUGS: WHERE + WHAT + WHY + HOW TO FIX + IMPACT
For FEATURES: WHAT + WHERE + HOW + WHY + DEPENDENCIES
For QUESTIONS: Verified facts + code snippet + query/result

## Autonomous execution workflow

1. UNDERSTAND → Check steerings first, code second
2. INVESTIGATE → Playbooks and known issues before diving into code
3. IMPLEMENT → Complete, functional code following standards
4. VALIDATE → Diagnostics on all modified files
5. SELF-REVIEW → 3 perspectives (Engineer, Security, QA)
6. VERIFY → Confirm it works, not just compiles
7. DELIVER → Concise report + remind to test

## Where to find information

[Table mapping: "I need X" → "I use Y automatically"]

## Autonomy rules

PROCEED ALONE:
- [List of what can be done without asking]

STOP AND ASK:
- [List of what requires confirmation]

## Known traps

[List of common project errors the agent must NEVER commit]
```

### Practical example (generic)

```markdown
## Dev AI — Who I am

I'm Dev AI, senior developer on the team. I master [your technologies].
I'm active in every session, in every context.

Personality:
- Professional but approachable — I know when to focus and when to lighten up
- Confident without being arrogant — I know what I know, I admit what I don't
- Practical — I prefer solving over theorizing

How I communicate:
- Informal English, like a conversation between devs
- Straight to the point, no fluff
- Never use emojis — professionalism above all
- Give the answer first, context after

## Response pattern

I never give vague answers like "it might be a problem in the service" or "check file X".
Every response is SPECIFIC and ACTIONABLE. The user cannot be left with doubt.

Golden rule: the user must leave the conversation knowing EXACTLY what to do.
```

---

## LAYER 2: Critical Rules (critical-rules.md)

Absolute rules that can NEVER be violated. Must be `always`. Lean and direct.

### What to include

```markdown
---
inclusion: always
---
# Critical Behavior Rules

## Identity — Absolute Rule
[Agent name, never present as another name]

## Response Priority (decision tree)
[Before reading code, check if the answer is already in steerings]

1. Conceptual question → steering X
2. Endpoint question → steering Y
3. Flow question → steering Z
...
9. Specific code question → only then read the file

Rule: only go to code when the steering doesn't have the answer.

## Never invent information
- Source code: read the file before asserting
- Database: query via MCP before saying what exists
- If unable to verify: warn the user

## Critical Project Facts
[List of things the agent can NEVER get wrong — authentication, endpoint format, etc.]

## Verification Tools
[List of MCPs and tools available with description of what each does]
```

**Key tip:** The response priority decision tree prevents the agent from wasting time reading code when the answer is already documented. The more complete this tree, the faster the agent responds.

---

## LAYER 3: Navigation Map (ecosystem-flow.md)

The system's "GPS". Given any question, the agent knows where to look. Must be `always`.

### What to include

- Project overview (2-3 lines)
- Architecture diagram (ASCII)
- "Where to find each information" table mapping questions to steerings/MCPs
- List of all available steerings grouped by loading type
- Active hooks list

**Tip:** This file is the ecosystem index. When creating a new steering, ALWAYS update this map.

---

## LAYER 4: Domain Knowledge

Steerings that document real project knowledge. Use `auto` or `fileMatch`.

- **Entities and Domain** (auto) — entities, fields, relationships
- **Business Rules** (auto) — validations, status, logic
- **FAQ** (auto) — quick answers about auth, database, deploy
- **Business Flows** (auto/fileMatch) — end-to-end flow documentation
- **API Endpoints** (fileMatch) — endpoint reference

---

## LAYER 5: Known Issues and Playbooks

### Known Issues Base

The most valuable knowledge base. Every solved problem that may recur goes here.

```markdown
---
inclusion: auto
description: Known problems and solutions. Use when investigating any reported problem.
---
# Known Problems and Solutions

## [Category A — e.g.: Synchronization]

### [Problem name]
- Symptom: [what the user sees]
- Cause: [what actually happens]
- Diagnosis: [SQL query or command to confirm]
- Solution: [step by step]
- Prevention: [what was done to avoid recurrence]
- Real case: [client/date]

## Recurring Patterns

| Pattern | Description | Where to check |
|---------|-------------|----------------|
| [Name] | [Short description] | [How to identify] |
```

### Decision Playbooks

Verified decision trees. The agent consults BEFORE investigating any problem.

```markdown
---
inclusion: auto
description: Verified decision trees. Consult BEFORE investigating problems.
---
# Decision Playbooks

## CHECKLIST-000: Quick investigation (run BEFORE any playbook)

1. Problem already known?
   → Check known-issues
   → If found: use documented solution

2. [Quick check 2]
   → [How to verify]
   → [What to do if positive]

## [TYPE]-001: [Problem name]

1. [First triage question]
   → [If yes]: [action]
   → [If no]: next step

2. [Second question]
   → [Verification with query/command]
   → [Action based on result]
```

**Fundamental rule:** Playbooks are added ONLY when a real problem is solved and the decision tree is validated. Never add generic or theoretical playbooks.

---

## LAYER 6: Security and Quality

### Security Policies (security-policies.md)

```markdown
---
inclusion: fileMatch
fileMatchPattern: "**/*.{py,ts,js,dart,cs,go}"
description: Security checklist applicable to all produced code.
---
# Secure Development

## Checklist before delivering any code

- [ ] Zero hardcoded secrets
- [ ] Inputs validated (type, size, format)
- [ ] Parameterized queries (never interpolate variables)
- [ ] Generic error messages for client, details only in logs
- [ ] Zero sensitive data in logs
- [ ] Authentication verified on routes
- [ ] Authorization by role

## Secrets and environment variables
[How to manage per stack — env vars, secrets manager, etc.]

## Input validation
[Project-specific rules]

## SQL queries
[Examples of CORRECT vs WRONG for each stack]

## Error handling
[Project standard]
```

### Code Conventions (code-conventions.md)

```markdown
---
inclusion: always
---
# Code Standards

## Principles
- KISS, DRY, Clean Code, SOLID
- All delivered code MUST compile/run without errors
- No incomplete code, placeholders, or TODOs

## Stack per Module
[List each module's stack — prevents the agent from mixing technologies]

## Language
[Define language for code, logs, documentation, communication]

## What to NEVER do
[List of explicit prohibitions]
```

---

## LAYER 7: Hooks — Behavioral Automation

Hooks are automations that fire on specific events. They create a "nervous system" for the agent.

### Essential recommended hooks

| Hook | Trigger | Purpose |
|------|---------|---------|
| Self-learning | agentStop | Evaluates if new knowledge was discovered, suggests documenting |
| Code review | postToolUse:write | Automatic self-review after each code write |
| Post-task checklist | postTaskExecution | Verifies quality after each spec task |
| DML protection | preToolUse | Intercepts database writes, requires confirmation |
| Audit | userTriggered | Periodically audits ecosystem health |

### 7.1 Self-Learning Hook (most important)

Closes the evolution cycle.

```json
{
  "enabled": true,
  "name": "Self-Learning",
  "description": "At the end of each execution, evaluates if new knowledge was discovered and suggests documenting.",
  "version": "1",
  "when": {
    "type": "agentStop"
  },
  "then": {
    "type": "askAgent",
    "prompt": "Evaluate the conversation that just ended. Two evaluations:\n\n1. SELF-LEARNING\nOnly suggest documenting if the investigation was REALLY heavy (8+ investigation interactions, or discovered undocumented rule/trap).\nNormal investigations (3-5 files) are routine — DO NOT suggest.\nIf suggesting: present real data, indicate which steering, suggest exact snippet, ask for authorization.\nNEVER create/update steering without authorization.\n\n2. MATURITY EVALUATION\nIf the interaction involved an area of the maturity map, evaluate if the level should rise.\nIf no area changed: silence."
  }
}
```

### 7.2 Code Review Hook (Self-Review)

Automatic code review the AI performs on its own code after EACH file write. Reviews under 3 perspectives. This means when the dev receives code to review, it has already passed through an automatic filter of engineering, security, and QA.

```json
{
  "enabled": true,
  "name": "Code Review",
  "description": "Automatic self-review after each code write — 3 perspectives before human review.",
  "version": "1",
  "when": {
    "type": "postToolUse",
    "toolTypes": ["write"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "I just wrote/edited a file. Quick self-review in 3 perspectives:\n\n1. ENGINEER: code follows project standards? Duplication? Correct imports? Adequate names?\n2. SECURITY: hardcoded secrets? SQL without parameters? Sensitive data in logs? Route without auth?\n3. QA: what if input is null/empty? What if API/DB fails? Complete error handling? Edge cases covered?\n\nIf problem found: fix NOW before continuing.\nIf all good: proceed in silence, without reporting that review was done.\n\nThis review applies to both code I wrote AND code generated by sub-agents I delegated."
  }
}
```

**Why 3 perspectives?**
- Engineer catches: duplicated code, wrong imports, bad names, violated standards
- Security catches: exposed secrets, SQL injection, sensitive data in logs, open routes
- QA catches: null pointer, unhandled timeout, silent error, ignored edge case

### 7.3 DML Protection Hook

```json
{
  "enabled": true,
  "name": "DML Protection",
  "description": "Intercepts database writes and requires explicit confirmation.",
  "version": "1",
  "when": {
    "type": "preToolUse",
    "toolTypes": [".*execute_dml.*", ".*executar_consulta.*"]
  },
  "then": {
    "type": "askAgent",
    "prompt": "ATTENTION: Database WRITE operation.\n1. SHOW the complete query to the user\n2. EXPLAIN what it does and how many records it affects\n3. IDENTIFY the risk (critical table?)\n4. IDENTIFY the target database (production?)\n5. WAIT for explicit confirmation\nIf not confirmed: cancel. NEVER execute DML silently."
  }
}
```

### 7.4 Post-Task Checklist Hook

```json
{
  "enabled": true,
  "name": "Post-Task Checklist",
  "description": "Verifies quality after each spec task.",
  "version": "1",
  "when": {
    "type": "postTaskExecution"
  },
  "then": {
    "type": "askAgent",
    "prompt": "Mandatory checklist before marking task as complete:\n1. Did I run getDiagnostics on ALL edited files?\n2. Tests created (if required)?\n3. Backward compatibility verified (grepSearch on usages)?\n4. Steerings consistent with what I implemented?\n5. Security ok?\n6. Code standards followed?\nIf ALL passed: silence. If any failed: fix NOW."
  }
}
```

### 7.5 Ecosystem Audit Hook

```json
{
  "enabled": true,
  "name": "Steering Audit",
  "description": "Audits ecosystem health: duplications, inconsistencies, size, outdated content.",
  "version": "1",
  "when": {
    "type": "userTriggered"
  },
  "then": {
    "type": "askAgent",
    "prompt": "Audit steering ecosystem:\n1. Inventory (count by type)\n2. Read all steerings\n3. Check: duplications, inconsistencies, broken references, excessive size, outdated content, consolidation opportunities\n4. Structured report\nNever fix without authorization — only suggest."
  }
}
```

---

## LAYER 8: Skills — Specialized Abilities

Skills are abilities you teach the agent. Unlike steerings (passive knowledge loaded in context), skills are active capabilities the agent can execute on demand.

- **Steering** = knowledge (the agent KNOWS something)
- **Skill** = ability (the agent KNOWS HOW TO DO something)

A skill is a set of detailed instructions for executing a complex, repetitive task in a standardized way. The agent activates the skill when it recognizes the situation calls for that specific ability.

### When to create a Skill

- Complex task that repeats frequently and needs a specific pattern
- Multi-step process requiring a precise sequence of actions
- Ability involving integration with external tools (APIs, CLIs, services)
- Capability that needs instructions too detailed to fit in a steering

### When NOT to create a Skill (use steering instead)

- Reference information (entities, rules, FAQ) → steering
- Passive knowledge the agent consults → steering
- Documented business flows → steering (flow-*)
- Code standards → steering (code-conventions)

### Skill structure

```
.kiro/
  skills/
    skill-name.md    ← Complete ability instructions
```

### Recommended format

```markdown
# Skill: [Ability Name]

## When to activate
[Conditions indicating this skill should be used]

## What it does
[Clear description of expected result]

## Step by step

### 1. [First step]
[Detailed instructions, including commands, queries, or code]

### 2. [Second step]
[...]

### 3. [Third step]
[...]

## Rules
- [Rule 1 — what to NEVER do]
- [Rule 2 — what to ALWAYS do]
- [Rule 3 — when to stop and ask]

## Examples
[Example of input → expected output]
```

### Examples of useful Skills

| Skill | What it does | When activated |
|-------|-------------|----------------|
| Generate migration | Creates migration following project pattern, with rollback | When schema change needed |
| Create CRUD endpoint | Generates model + serializer + view + url + tests | When new endpoint needed |
| Generate technical report | Builds implementation report for QA team | When dev requests report |
| Performance analysis | Investigates slow query with EXPLAIN, suggests indexes | When slowness reported |
| Feature setup | Creates feature structure (store + page + widgets) | When new feature needed |
| Deploy checklist | Executes pre-deploy checklist (migrations, env vars, secrets) | Before production deploy |

### Difference between Skill, Steering, and Hook

| Aspect | Steering | Skill | Hook |
|--------|----------|-------|------|
| Nature | Passive knowledge | Active ability | Reactive automation |
| When it acts | When loaded in context | When activated by user/context | When event fires |
| Format | Documentation/reference | Step-by-step instructions | JSON with trigger + action |
| Example | "Orders have status T, I, R, X" | "How to create a complete CRUD endpoint" | "After writing code, do review" |
| Control | Automatic (always/auto/fileMatch) | On demand or by recognition | Automatic by event |

### Tips for creating good Skills

1. **Be specific** — One skill does ONE thing well. Don't mix responsibilities.
2. **Include real examples** — Show input and expected output from your project.
3. **Define when to stop** — If the skill encounters ambiguity, it should ask the dev.
4. **Keep updated** — If the project pattern changes, the skill must reflect it.
5. **Test before trusting** — Execute the skill manually once to validate the result.
6. **Don't duplicate steerings** — If the information is reference, it goes in the steering. Skill is for ACTION.

---

## LAYER 9: Cognitive Evolution

### Maturity Map

Track ecosystem maturity with scores:

| Level | Weight | Meaning |
|-------|--------|---------|
| High | 90% | Mastered. Near-instant response. |
| Medium | 50% | Know the basics. Need to investigate to complete. |
| Basic | 20% | Know it exists. Need to investigate almost everything. |
| No coverage | 5% | Only know the name. |

### Self-Learning Rules (self-learning-conventions.md)

```markdown
---
inclusion: fileMatch
fileMatchPattern: "**/.kiro/steering/**,**/.kiro/hooks/**"
description: Rules for when and how to document knowledge.
---
# Self-Learning

## When to suggest documenting

### Trigger 1: Heavy investigation
- 8+ investigation interactions on the same question
- OR discovered undocumented critical rule/flow
- OR found undocumented technical trap
- OR found divergence between steering and code
- OR solved bug whose cause reveals a repeatable pattern

### Trigger 2: Feature implemented
- New pattern that needs documenting?
- Navigation steering needs updating?
- Maturity of some area should rise?

### What is NOT a trigger
- Small investigations (3-5 files) — routine
- Simple refactorings
- Punctual fixes without pattern
- Information that already exists in some steering

## How to suggest
1. NEVER create/update without authorization
2. Present real data (how many files read, how many queries made)
3. Explain concrete benefit
4. Let the dev decide — no pressure

## Routing table — where to put each type of information

| Type | Put in | NEVER put in |
|------|--------|--------------|
| Business rule | domain or business-rules | agent-persona |
| Quick FAQ | faq | agent-persona |
| Documented flow | flow-<name>.md | faq |
| Known problem | known-issues | playbooks |
| Decision tree | playbooks | known-issues |
| Code standard | code-conventions | agent-persona |
| Security rule | security-policies | code-conventions |

Principle: each piece of information has ONE correct place. No duplication.

## Duplication validation (MANDATORY)
1. READ the target steering completely
2. Search for keywords of what would be added
3. If similar content found: DO NOT suggest — total silence
4. If genuinely new: proceed
```

### Evolution Cycles

**Cycle 1:** Heavy investigation → Documentation
```
New problem → Heavy investigation (8+ interactions) → Answer →
Hook suggests documenting → Dev authorizes → Steering updated →
Maturity rises → Next time: instant answer
```

**Cycle 2:** Feature implemented → Ecosystem integration
```
Spec completed → Post-implementation checklist →
New pattern needs documenting? → Suggestion → Dev authorizes →
Steering created/updated → Maturity rises
```

**Cycle 3:** Audit → Refinement
```
Dev triggers audit → Agent reads all steerings →
Identifies duplications/inconsistencies → Report →
Dev authorizes corrections → Cleaner ecosystem
```

---

## Step by Step: How to Build from Scratch

### Phase 1: Foundation (day 1)

Create these 4 files in order:

1. **`agent-persona.md`** (always) — Identity, workflow, autonomy
2. **`critical-rules.md`** (always) — Absolute rules, decision tree, critical facts
3. **`ecosystem-flow.md`** (always) — Navigation map, architecture, where to look
4. **`code-conventions.md`** (always) — Code standards, stack, prohibitions

With these 4, the agent already knows who it is, how to behave, where to find information, and how to write code.

### Phase 2: Domain Knowledge (week 1)

5. **`domain.md`** (auto) — Entities, fields, relationships
6. **`faq.md`** (auto) — Frequently asked questions
7. **`business-rules.md`** (auto) — Business rules, validations

### Phase 3: Flows and Security (week 2)

8. **`flow-[main].md`** (auto/fileMatch) — Most important project flow
9. **`security-policies.md`** (fileMatch) — Security checklist
10. **`known-issues.md`** (auto) — First documented solved problem

### Phase 4: Automation (week 2-3)

11. **Code review hook** — Automatic self-review
12. **Self-learning hook** — Evolution cycle
13. **DML protection hook** — If using database via MCP

### Phase 5: Evolution (ongoing)

14. **`cognitive-evolution.md`** (auto) — Maturity map
15. **`self-learning-conventions.md`** (fileMatch) — Rules for when to document
16. **`playbooks.md`** (auto) — First playbook after solving a real problem
17. **Audit hook** — Periodic ecosystem health check

---

## Practical Tips

1. **Start small, evolve organically** — Don't try to document everything at once. Start with Phase 1's 4 steerings and let the ecosystem grow naturally.

2. **Document only VERIFIED knowledge** — Never document assumptions, future plans, or unconfirmed information.

3. **One piece of information, one place** — Each piece of information has ONE correct place. Other steerings can REFERENCE but never DUPLICATE.

4. **Always steerings must be lean** — Everything `always` loads in EVERY session and consumes context. Keep below 350 lines. If it grows too much, move to `auto` or `fileMatch`.

5. **The self-learning hook is the evolution engine** — Without it, the ecosystem stays static. With it, every heavy investigation becomes a documentation suggestion.

6. **Playbooks only based on REAL problems** — Never create generic or theoretical playbooks. Each decision tree must be based on a real problem that was solved and validated.

7. **Periodic audits maintain health** — Over time, steerings can become outdated, duplicated, or inconsistent. The audit hook allows periodic review.

8. **Protect the production database** — The DML protection hook is an essential safety net.

9. **Self-review in 3 perspectives** — The code review hook is a quality layer that runs BEFORE human review. Reduces basic errors drastically.

10. **Measure evolution** — The maturity map with numeric scores allows measuring progress. When the score rises, the agent investigates less and responds faster.

---

## Common Mistakes to Avoid

1. **Documenting too much too early** — Generates empty steerings or unverified information
2. **Always steerings too large** — Consumes context unnecessarily
3. **Duplicating information** — Creates inconsistency when one copy is updated and another isn't
4. **Theoretical playbooks** — Untested decision trees don't work
5. **Ignoring the navigation map** — If ecosystem-flow doesn't reflect reality, the agent gets lost
6. **Not using hooks** — Without automation, the ecosystem depends on manual discipline (which fails)
7. **Documenting volatile data** — Configs, passwords, counts that change should be queried via MCP, not documented
8. **Forgetting to update navigation steerings** — When creating a new steering, ALWAYS update persona, ecosystem-flow, and critical-rules

---

## Final Summary

The cognitive ecosystem is composed of:

- **4 always steerings** (foundation): persona, critical rules, navigation map, code conventions
- **N auto/fileMatch steerings** (knowledge): domain, rules, FAQ, flows, issues, playbooks, security
- **N skills** (abilities): active capabilities the agent executes on demand
- **5-6 hooks** (automation): self-learning, code review, post-task checklist, DML protection, audit
- **1 evolution steering** (meta): maturity map with scores and history

The result: an agent that masters your project, responds assertively, evolves on its own, and protects against errors. The more the team uses it, the smarter it gets.
