# Implementation Plan: Export Cognitive Analysis

## Overview

Add a Markdown export capability to the Cognitive Analysis panel. The webview collects analysis results, sends them to the extension host via postMessage, and the extension host generates a structured Markdown report and presents a save dialog. Implementation follows the existing `exportImage` pattern.

## Tasks

- [x] 1. Define types and extend message protocol
  - [x] 1.1 Add `CognitiveAnalysisResult` interface to `src/types.ts`
    - Define interface with fields: `steeringsSoltos`, `vinculosFrageis`, `arquivosSemContexto`, `coverageGaps`, `sugestoes`
    - Each field typed with its specific shape as defined in the design document
    - _Requirements: 5.1_
  - [x] 1.2 Extend `WebviewMessage` union type in `src/types.ts`
    - Add variant `| { type: 'exportCognitiveAnalysis'; data: CognitiveAnalysisResult | null }`
    - _Requirements: 5.1, 5.2_

- [x] 2. Implement Markdown report generator
  - [x] 2.1 Create `src/services/markdownReportGenerator.ts` with `generateCognitiveReport` function
    - Pure function: `(data: CognitiveAnalysisResult) => string`
    - Generate title header "Cognitive Analysis Report" with ISO timestamp
    - Generate Summary table with counts of each category
    - Generate sections for Orphan Steerings, Fragile Links, Isolated Files, Coverage Gaps
    - File paths formatted with backticks for inline code
    - Generate Recommendations section with bullet points
    - Generate "Instructions for Kiro AI" section with fenced code block prompt
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 2.2 Write property test: Report contains all input items
    - **Property 1: Report contains all input items**
    - **Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.8, 4.4**
    - Test file: `src/test/property/cognitiveReport.property.ts`
    - Generate random `CognitiveAnalysisResult` with fast-check, verify all ids/paths/folders/suggestions appear in output
  - [ ]* 2.3 Write property test: Summary counts match input lengths
    - **Property 2: Summary counts match input lengths**
    - **Validates: Requirements 2.3**
    - Verify numeric values in Summary table equal array lengths from input
  - [ ]* 2.4 Write property test: Report structural invariants
    - **Property 3: Report structural invariants**
    - **Validates: Requirements 2.2, 2.9, 4.1, 4.5**
    - Verify output starts with `# Cognitive Analysis Report`, contains `Generated:`, has level-2 headings, contains "Instructions for Kiro AI" in fenced code block
  - [ ]* 2.5 Write property test: File paths are backtick-formatted
    - **Property 4: File paths are backtick-formatted**
    - **Validates: Requirements 4.2, 4.3**
    - Verify every file path from input appears wrapped in backticks in the output

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add export handler to extension host
  - [x] 4.1 Add `handleExportCognitiveAnalysis` method to `EcosystemGraphProvider` in `src/webview/webviewProvider.ts`
    - Import `CognitiveAnalysisResult` from types and `generateCognitiveReport` from the new service
    - Validate data is non-null and has at least one non-empty array (early return otherwise)
    - Call `generateCognitiveReport(data)` to produce Markdown content
    - Show save dialog with default filename `cognitive-analysis-YYYY-MM-DD.md` and filter `{ 'Markdown': ['md'] }`
    - Default location: workspace root folder
    - On confirm: write file, show info message with filename
    - On cancel: abort silently
    - On write error: show warning message
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 3.5, 5.3_
  - [x] 4.2 Add `exportCognitiveAnalysis` case to `handleMessage` switch statement
    - Route to `this.handleExportCognitiveAnalysis(message.data)`
    - _Requirements: 5.2, 5.3_
  - [ ]* 4.3 Write unit tests for handler integration
    - Test file: `src/test/unit/cognitiveReport.test.ts`
    - Test: handler calls save dialog with correct default filename format
    - Test: handler shows info message on successful write
    - Test: handler shows warning on write failure
    - Test: handler does nothing when dialog is cancelled
    - Test: handler returns early when data is null or all arrays empty
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.3_

- [x] 5. Add export button to cognitive panel webview
  - [x] 5.1 Add export button element to `src/webview/media/cognitive-panel.js`
    - Create button in the panel header area (next to "Cognitive Analysis" title)
    - Button visible only when analysis result is non-null; hidden/disabled otherwise
    - On click: call `vscode.postMessage({ type: 'exportCognitiveAnalysis', data: analysis })` where `analysis` is the current computed result
    - Store latest analysis result in a module-scoped variable for access by the button click handler
    - Style consistent with existing panel buttons
    - _Requirements: 1.1, 1.2, 1.3, 5.1_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate the pure `generateCognitiveReport` function (no VS Code API dependency)
- Unit tests mock VS Code APIs (`showSaveDialog`, `writeFile`, `showInformationMessage`)
- The implementation follows the existing `exportImage` pattern in `webviewProvider.ts`
