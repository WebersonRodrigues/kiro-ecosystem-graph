# Requirements Document

## Introduction

Export the Cognitive Analysis panel results (orphan steerings, fragile links, isolated files, coverage gaps, and suggestions) as a structured Markdown file. This closes the loop between visualization and action — the user sees problems in the graph's cognitive panel, exports a `.md` with actionable recommendations, and feeds it to Kiro AI to automatically resolve the identified issues.

## Glossary

- **Cognitive_Panel**: The webview DOM overlay panel (`cognitive-panel.js`) that computes and displays cognitive analysis metrics from the ecosystem graph.
- **Analysis_Result**: The computed object containing orphan steerings, fragile links, isolated files, coverage gaps, and suggestions produced by `CognitivePanel.computeAnalysis()`.
- **Export_Button**: A UI button within the Cognitive Panel that triggers the Markdown export flow.
- **Extension_Host**: The VS Code extension backend (`webviewProvider.ts`) that handles file system operations and receives messages from the webview.
- **Markdown_Report**: The generated `.md` file containing structured cognitive analysis results formatted for consumption by Kiro AI.
- **Webview**: The VS Code webview panel rendering the force-directed graph and all overlay panels.

## Requirements

### Requirement 1: Export Button in Cognitive Panel

**User Story:** As a developer, I want an export button visible in the Cognitive Analysis panel, so that I can trigger the Markdown export with a single click.

#### Acceptance Criteria

1. WHILE the Cognitive_Panel is visible AND an Analysis_Result is available, THE Export_Button SHALL be displayed within the Cognitive_Panel header area.
2. WHILE the Cognitive_Panel is visible AND no Analysis_Result is available, THE Export_Button SHALL be hidden or disabled.
3. WHEN the user clicks the Export_Button, THE Webview SHALL send an `exportCognitiveAnalysis` message to the Extension_Host containing the full Analysis_Result data.

### Requirement 2: Markdown Report Generation

**User Story:** As a developer, I want the cognitive analysis exported as a well-structured Markdown file with detailed tips and improvement suggestions for each issue, so that I can feed it directly to Kiro AI for automated fixes.

#### Acceptance Criteria

1. WHEN the Extension_Host receives an `exportCognitiveAnalysis` message, THE Extension_Host SHALL generate a Markdown_Report from the Analysis_Result data.
2. THE Markdown_Report SHALL contain a title header with the text "Cognitive Analysis Report" and a generation timestamp.
3. THE Markdown_Report SHALL contain a "Summary" section listing the count of orphan steerings, fragile links, isolated files, and coverage gaps.
4. WHERE orphan steerings exist in the Analysis_Result, THE Markdown_Report SHALL contain an "Orphan Steerings" section listing each orphan steering file path and label, with a tip explaining how to integrate it (e.g., "Add a reference to this file from a related steering using backtick syntax").
5. WHERE fragile links exist in the Analysis_Result, THE Markdown_Report SHALL contain a "Fragile Links" section listing each fragile link with source and target file paths, with a tip explaining how to strengthen it (e.g., "Add at least one additional cross-reference between these files").
6. WHERE isolated files exist in the Analysis_Result, THE Markdown_Report SHALL contain an "Isolated Files" section listing each isolated file path, label, and type, with a tip explaining how to connect it (e.g., "Reference this file from the most relevant steering or skill file").
7. WHERE coverage gaps exist in the Analysis_Result, THE Markdown_Report SHALL contain a "Coverage Gaps" section listing each workspace folder lacking steering files, with a tip explaining how to fix it (e.g., "Create a steering file in .kiro/steering/ covering this folder's domain").
8. THE Markdown_Report SHALL contain a "Recommendations" section listing all suggestions from the Analysis_Result as actionable bullet points.
9. THE Markdown_Report SHALL contain an "Instructions for Kiro AI" section with a prompt instructing Kiro to resolve the listed issues by creating cross-references, strengthening links, and adding steering files.
10. THE Markdown_Report SHALL be entirely in English.

### Requirement 3: File Save Dialog

**User Story:** As a developer, I want to choose where to save the exported Markdown file, so that I can place it in a convenient location for my workflow.

#### Acceptance Criteria

1. WHEN the Extension_Host generates the Markdown_Report, THE Extension_Host SHALL present a save file dialog with a default filename of `cognitive-analysis-YYYY-MM-DD.md` (using the current date).
2. WHEN the user confirms the save location, THE Extension_Host SHALL write the Markdown_Report content to the selected file path.
3. WHEN the file is saved successfully, THE Extension_Host SHALL display an information message confirming the export with the filename.
4. IF the user cancels the save dialog, THEN THE Extension_Host SHALL abort the export without writing any file or showing an error.
5. IF a file write error occurs, THEN THE Extension_Host SHALL display a warning message indicating the export failed.

### Requirement 4: Markdown Report Formatting for AI Consumption

**User Story:** As a developer, I want the exported Markdown to be structured in a way that Kiro AI can parse and act on, so that I can paste it directly into chat for automated resolution.

#### Acceptance Criteria

1. THE Markdown_Report SHALL use heading level 1 for the report title, heading level 2 for each section, and heading level 3 for subsections.
2. THE Markdown_Report SHALL list file paths using inline code formatting (backticks) to ensure unambiguous parsing.
3. THE Markdown_Report SHALL use bullet lists for individual items within each section.
4. THE Markdown_Report SHALL include the workspace folder context for each item where applicable.
5. THE Markdown_Report SHALL use a fenced code block for the "Instructions for Kiro AI" prompt text to clearly delineate the actionable request.

### Requirement 5: Message Protocol Extension

**User Story:** As a developer maintaining the extension, I want the webview-to-extension message protocol extended cleanly, so that the export feature integrates without breaking existing functionality.

#### Acceptance Criteria

1. THE Webview SHALL send messages of type `exportCognitiveAnalysis` with a `data` field containing the serialized Analysis_Result object.
2. THE Extension_Host SHALL handle the `exportCognitiveAnalysis` message type in the existing message handler switch statement.
3. THE Extension_Host SHALL ignore `exportCognitiveAnalysis` messages where the `data` field is null or empty.
