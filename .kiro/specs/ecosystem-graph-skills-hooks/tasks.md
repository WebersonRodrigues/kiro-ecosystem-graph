# Implementation Plan: Ecosystem Graph — Skills & Hooks

## Overview

Extend the Ecosystem Graph extension to discover, parse, classify, and render Skill (`.kiro/skills/*.md`) and Hook (`.kiro/hooks/*.json`) files as new node types with distinct shapes (diamonds and triangles). Seven existing files are modified; no new files are created.

## Tasks

- [x] 1. Extend type system with new NodeTypes and FileCategory
  - [x] 1.1 Add `skill`, `hook-manual`, `hook-auto` to the `NodeType` union in `src/types.ts`
    - Add the three new string literals to the existing union type
    - _Requirements: 9.1_
  - [x] 1.2 Add `FileCategory` type and `EcosystemFile` interface in `src/types.ts`
    - Define `type FileCategory = 'steering' | 'skill' | 'hook'`
    - Define `EcosystemFile` interface extending `SteeringFile` with a `category: FileCategory` field
    - Keep `SteeringFile` interface unchanged for backward compatibility
    - _Requirements: 9.1, 1.2, 2.2_

- [x] 2. Update FileDiscoveryService for multi-pattern discovery
  - [x] 2.1 Modify `discoverAll()` to scan three glob patterns in parallel
    - Add `**/.kiro/skills/*.md` and `**/.kiro/hooks/*.json` patterns alongside existing steering pattern
    - Return `EcosystemFile[]` with the `category` field set based on which pattern matched
    - Existing steering discovery behavior must remain identical
    - _Requirements: 1.1, 1.4, 2.1, 2.4, 10.1_
  - [x] 2.2 Extend `watchForChanges()` to create three FileSystemWatchers
    - Add watchers for `**/.kiro/skills/*.md` and `**/.kiro/hooks/*.json`
    - Emit unified `FileChangeEvent` objects with category information
    - Keep existing 500ms debounce behavior
    - _Requirements: 1.3, 2.3, 10.1_

- [x] 3. Checkpoint — Ensure types compile cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add parsing logic for skills and hooks in ParserService
  - [x] 4.1 Add `parseSkill()` method to ParserService
    - Reuse existing markdown reference extraction logic (wiki-links, markdown-links, backtick-refs, table-paths)
    - Force `node.type = 'skill'` regardless of filename prefix
    - Set label to filename without `.md` extension
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 4.2 Add `parseHook()` method to ParserService
    - Parse JSON content with try/catch (return `null` on invalid JSON, log warning)
    - Extract `name`, `when.type`, `then.prompt` fields
    - Determine NodeType: `when.type === 'userTriggered'` → `hook-manual`, else → `hook-auto`
    - Set label to `name` field, fallback to filename without `.json`
    - Scan `then.prompt` for known steering filenames (backtick-wrapped or bare `.md` references) to create Reference edges
    - Handle missing `when`/`when.type` (default to `hook-auto`), missing `then.prompt` (no edges)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_
  - [ ]* 4.3 Write property test: Skill files produce skill NodeType (Property 2)
    - **Property 2: Skill files produce skill NodeType**
    - **Validates: Requirements 3.2, 5.1**
  - [ ]* 4.4 Write property test: Hook type determination from when.type (Property 3)
    - **Property 3: Hook type determination from when.type**
    - **Validates: Requirements 4.2, 4.3, 5.2, 5.3**
  - [ ]* 4.5 Write property test: Reference extraction from skill markdown (Property 5)
    - **Property 5: Reference extraction from skill markdown**
    - **Validates: Requirements 3.1, 3.3**
  - [ ]* 4.6 Write property test: Reference extraction from hook prompt (Property 6)
    - **Property 6: Reference extraction from hook prompt**
    - **Validates: Requirements 4.4**
  - [ ]* 4.7 Write property test: Label derivation for skills and hooks (Property 7)
    - **Property 7: Label derivation for skills and hooks**
    - **Validates: Requirements 3.4, 4.6**

- [x] 5. Update NodeClassifier with new color entries
  - [x] 5.1 Add `skill`, `hook-manual`, `hook-auto` entries to `NODE_COLOR_MAP`
    - `'skill': '#B388FF'`, `'hook-manual': '#64B5F6'`, `'hook-auto': '#7C4DFF'`
    - Do not modify any existing entries
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 9.3_
  - [ ]* 5.2 Write property test: Steering classification backward compatibility (Property 10)
    - **Property 10: Steering classification backward compatibility**
    - **Validates: Requirements 10.3, 5.7**

- [x] 6. Wire new parsing logic in extension.ts
  - [x] 6.1 Update `initializeGraph()` to handle EcosystemFile categories
    - Route files by category: `steering` → existing `parse()`, `skill` → `parseSkill()`, `hook` → `parseHook()`
    - Build `knownSteeringFiles` map from steering files only (used by hook prompt scanning)
    - Skip null results from `parseHook()` (invalid JSON)
    - _Requirements: 1.1, 2.1, 3.1, 4.1_
  - [x] 6.2 Update `handleFileChange()` to handle new file categories
    - Apply same category-based routing as `initializeGraph()`
    - Ensure incremental updates work for skill/hook file changes
    - _Requirements: 1.3, 2.3_

- [x] 7. Checkpoint — Ensure extension compiles and existing steering logic unchanged
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update webview rendering for new node shapes
  - [x] 8.1 Add new entries to `COLOR_MAP` in `webview.js`
    - Add `'skill': '#B388FF'`, `'hook-manual': '#64B5F6'`, `'hook-auto': '#7C4DFF'`
    - _Requirements: 9.2_
  - [x] 8.2 Add shape-switching logic in `nodeCanvasObject`
    - `skill` nodes → diamond (rotated square at 45 degrees)
    - `hook-manual` and `hook-auto` nodes → equilateral triangle
    - Existing node types → circle (unchanged)
    - Apply same glow, opacity, and heartbeat animation effects to new shapes
    - Use same degree-based sizing formula for all shapes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - [ ]* 8.3 Write property test: Node sizing is type-agnostic (Property 8)
    - **Property 8: Node sizing is type-agnostic**
    - **Validates: Requirements 6.3, 7.5**

- [x] 9. Verify filter panel works with new types
  - [x] 9.1 Confirm filter panel auto-discovers new types from graph data
    - The filter panel dynamically builds toggles from unique `node.type` values and looks up `COLOR_MAP[type]`
    - No structural changes needed — verify that new types appear as toggle buttons when nodes exist
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [ ]* 9.2 Write property test: Filter visibility matches visibleTypes set (Property 9)
    - **Property 9: Filter visibility matches visibleTypes set**
    - **Validates: Requirements 8.4, 8.5**

- [x] 10. Final checkpoint — Build and verify
  - Ensure all tests pass, ask the user if questions arise.
  - Run `npm run compile` (or equivalent build command) to verify no TypeScript errors
  - Verify backward compatibility: existing steering files still classified and rendered identically

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The implementation language is TypeScript (extension) and JavaScript (webview), matching the existing codebase
