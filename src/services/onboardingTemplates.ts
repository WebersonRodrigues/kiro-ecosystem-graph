/**
 * Onboarding templates for ecosystem file creation.
 * Each template provides starter content with front-matter, section headers, and TODOs.
 */

const TEMPLATES: Record<string, string> = {
  'project-overview': `---
inclusion: always
---
# Project Overview

<!-- TODO: Describe your project in 2-3 sentences -->

## Stack

<!-- TODO: List your tech stack (language, framework, database, etc.) -->

## Structure

<!-- TODO: Describe the main directories and their purpose -->

## Commands

| Action | Command |
|--------|---------|
| Build | \`<!-- TODO -->\` |
| Test | \`<!-- TODO -->\` |
| Deploy | \`<!-- TODO -->\` |

## Conventions

<!-- TODO: List coding conventions the AI agent should follow -->
`,

  'domain-knowledge': `---
inclusion: auto
---
# Domain Knowledge

<!-- TODO: Document your domain rules and business logic -->

## Entities

<!-- TODO: List core domain entities and their relationships -->

## Business Rules

<!-- TODO: Document invariants and constraints -->

## Glossary

<!-- TODO: Define domain-specific terms -->
`,

  'security-policy': `---
inclusion: always
---
# Security Policy

<!-- TODO: Define security rules for the AI agent -->

## Access Control

<!-- TODO: What the agent must never access or modify -->

## Sensitive Data

<!-- TODO: List sensitive fields, files, or patterns to protect -->

## Forbidden Operations

<!-- TODO: Operations the agent must never perform -->
`,

  'flow-steering': `---
inclusion: auto
---
# Flow: <!-- TODO: Name this flow -->

<!-- TODO: Describe the workflow this steering documents -->

## Trigger

<!-- TODO: What initiates this flow? -->

## Steps

<!-- TODO: List the sequential steps -->
1. Step one
2. Step two
3. Step three

## Validation

<!-- TODO: How to verify the flow completed correctly -->
`,

  'pre-tool-use-hook': `{
  "name": "<!-- TODO: Hook name -->",
  "description": "<!-- TODO: What this hook validates -->",
  "when": {
    "event": "preToolUse",
    "toolTypes": "write"
  },
  "then": {
    "action": "askAgent",
    "prompt": "<!-- TODO: Instructions for the agent before executing the tool -->"
  }
}
`,

  'post-task-hook': `{
  "name": "<!-- TODO: Hook name -->",
  "description": "<!-- TODO: What this hook checks after task completion -->",
  "when": {
    "event": "postTaskExecution"
  },
  "then": {
    "action": "askAgent",
    "prompt": "<!-- TODO: Instructions for the agent to review the completed task -->"
  }
}
`,
};

/**
 * Retrieve a template by key.
 * Returns undefined if the key is not found.
 */
export function getTemplate(templateKey: string): string | undefined {
  return TEMPLATES[templateKey];
}
