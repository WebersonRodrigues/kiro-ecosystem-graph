# Skill: Generate Component

## When to activate
When the user asks to create a new service, provider, or module for the extension.

## What it does
Generates a complete TypeScript component following project patterns.

## Step by step

### 1. Analyze existing patterns
- Read similar services in `src/services/`
- Match naming conventions from `code-conventions.md`

### 2. Create the file
- Place in appropriate directory
- Include JSDoc comments
- Export the class/function

### 3. Register in extension.ts
- Import the new component
- Wire it into the activation flow

### 4. Validate
- Run getDiagnostics on new file
- Verify no circular dependencies

## Rules
- Follow `code-conventions.md` strictly
- No placeholder code or TODOs
- Must compile without errors before delivering

## Related
- See `project-overview.md` for project structure
- See `code-conventions.md` for naming and formatting
