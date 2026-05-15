import * as assert from 'assert';
import * as fc from 'fast-check';
import { ParserService } from '../../services/parserService';
import { NodeClassifier } from '../../services/nodeClassifier';
import { PathResolver } from '../../services/pathResolver';
import type { SteeringFile } from '../../types';

/**
 * Property-Based Test: Bug Condition Exploration
 *
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 *
 * This test demonstrates the phantom file detection bug exists on UNFIXED code.
 * It generates random non-ecosystem file paths and verifies that the parser
 * should NOT emit references for them. On unfixed code, this test FAILS because
 * extractTablePaths() and extractMarkdownLinks() emit references indiscriminately.
 */

// Non-ecosystem extensions that should NOT produce graph references
const NON_ECOSYSTEM_EXTENSIONS = ['.cs', '.ts', '.py', '.js', '.png', '.svc.cs'];

// Valid filename characters (letters, digits, hyphens, underscores)
const FILENAME_CHAR_ARB = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '-', '_',
  ),
  { minLength: 1, maxLength: 20 },
);

// Optional directory prefix
const DIRECTORY_ARB = fc.oneof(
  fc.constant(''),           // bare filename (critical edge case)
  fc.constant('src/'),
  fc.constant('src/services/'),
  fc.constant('Estoque/'),
  fc.constant('tools/'),
  fc.constant('lib/utils/'),
);

// Generate a non-ecosystem file path
const nonEcosystemPathArb = fc.tuple(
  DIRECTORY_ARB,
  FILENAME_CHAR_ARB,
  fc.constantFrom(...NON_ECOSYSTEM_EXTENSIONS),
).map(([dir, name, ext]) => {
  // Ensure the name starts with a letter (required by the table-path regex)
  const safeName = 'I' + name;
  return `${dir}${safeName}${ext}`;
});

// Create a mock SteeringFile for testing
function createMockSteeringFile(): SteeringFile {
  return {
    uri: { fsPath: '/workspace/.kiro/steering/test-steering.md' } as unknown as SteeringFile['uri'],
    workspaceFolder: 'Workspace',
    relativePath: '.kiro/steering/test-steering.md',
  };
}

describe('Bug Condition — Non-Ecosystem References Produce Phantom Nodes', function () {
  this.timeout(30000); // PBT can take longer

  const nodeClassifier = new NodeClassifier();
  const pathResolver = new PathResolver();
  const parserService = new ParserService(nodeClassifier, pathResolver);
  const mockFile = createMockSteeringFile();
  const knownSteeringFiles = new Map<string, string>();

  it('Property 1: extractTablePaths() should NOT emit references for non-ecosystem paths', function () {
    fc.assert(
      fc.property(nonEcosystemPathArb, (generatedPath: string) => {
        // Create steering content with the generated path in a table cell
        const content = [
          '# Test Steering',
          '',
          '| File | Description |',
          '|------|-------------|',
          `| ${generatedPath} | Example code |`,
          '',
        ].join('\n');

        const result = parserService.parse(mockFile, content, knownSteeringFiles);

        // Resolve the path the same way the parser does
        const resolved = pathResolver.resolve(
          generatedPath,
          mockFile.relativePath,
          mockFile.workspaceFolder,
        );

        // Assert: NO reference should exist with target matching the resolved non-ecosystem path
        const phantomRefs = result.references.filter(
          (ref) => ref.target === resolved && ref.type === 'table-path',
        );

        // On UNFIXED code, this WILL FAIL because extractTablePaths() emits references
        // for ALL paths regardless of extension
        assert.strictEqual(
          phantomRefs.length,
          0,
          `Phantom reference emitted for non-ecosystem path: "${generatedPath}" resolved to "${resolved}"`,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('Property 1: extractMarkdownLinks() should NOT emit references for non-ecosystem paths', function () {
    fc.assert(
      fc.property(nonEcosystemPathArb, (generatedPath: string) => {
        // Create steering content with the generated path in a markdown link
        const content = [
          '# Test Steering',
          '',
          `See [example](${generatedPath}) for implementation details.`,
          '',
        ].join('\n');

        const result = parserService.parse(mockFile, content, knownSteeringFiles);

        // Resolve the path the same way the parser does
        const resolved = pathResolver.resolve(
          generatedPath,
          mockFile.relativePath,
          mockFile.workspaceFolder,
        );

        // Assert: NO reference should exist with target matching the resolved non-ecosystem path
        const phantomRefs = result.references.filter(
          (ref) => ref.target === resolved && ref.type === 'markdown-link',
        );

        // On UNFIXED code, this WILL FAIL because extractMarkdownLinks() emits references
        // for ALL non-HTTP paths regardless of extension
        assert.strictEqual(
          phantomRefs.length,
          0,
          `Phantom reference emitted for non-ecosystem path: "${generatedPath}" resolved to "${resolved}"`,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('Property 1 (edge case): bare filenames resolved to .kiro/steering/ should still be filtered', function () {
    // CRITICAL EDGE CASE: PathResolver resolves bare filenames to .kiro/steering/
    // The filter must NOT be fooled by the .kiro/ prefix
    fc.assert(
      fc.property(
        fc.tuple(
          FILENAME_CHAR_ARB,
          fc.constantFrom(...NON_ECOSYSTEM_EXTENSIONS),
        ),
        ([name, ext]) => {
          const bareFilename = 'I' + name + ext; // e.g., "IProdutoService.cs"

          // Table cell with bare filename
          const content = [
            '# Test Steering',
            '',
            '| File | Description |',
            '|------|-------------|',
            `| ${bareFilename} | Service interface |`,
            '',
          ].join('\n');

          const result = parserService.parse(mockFile, content, knownSteeringFiles);

          // PathResolver resolves bare filenames to source directory
          // e.g., "IProdutoService.cs" → ".kiro/steering/IProdutoService.cs"
          const resolved = pathResolver.resolve(
            bareFilename,
            mockFile.relativePath,
            mockFile.workspaceFolder,
          );

          // Verify PathResolver adds .kiro/steering/ prefix for bare filenames
          assert.ok(
            resolved.includes('.kiro/steering/'),
            `Expected resolved path to include .kiro/steering/, got: "${resolved}"`,
          );

          // Assert: even with .kiro/ prefix, non-ecosystem extensions must be filtered
          const phantomRefs = result.references.filter(
            (ref) => ref.target === resolved,
          );

          assert.strictEqual(
            phantomRefs.length,
            0,
            `Phantom reference emitted for bare filename "${bareFilename}" resolved to "${resolved}" — .kiro/ prefix should NOT bypass extension check`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Property-Based Test: Preservation — Ecosystem References Continue to Produce Nodes and Edges
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * These tests verify that ecosystem-relevant references CONTINUE to produce nodes and edges
 * on the current (unfixed) code. They establish the baseline behavior that must be preserved
 * after the fix is applied.
 */

// Ecosystem-relevant extensions that MUST produce graph references
const ECOSYSTEM_EXTENSIONS = ['.md', '.json'];

// Valid filename characters for ecosystem paths
const ECO_FILENAME_CHAR_ARB = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '-', '_',
  ),
  { minLength: 1, maxLength: 15 },
);

// Directory prefixes for ecosystem paths used in markdown links (any prefix works)
const ECO_DIRECTORY_LINK_ARB = fc.oneof(
  fc.constant('.kiro/steering/'),
  fc.constant('.kiro/hooks/'),
  fc.constant('.kiro/skills/'),
  fc.constant('docs/'),
  fc.constant('some-dir/'),
  fc.constant('hooks/'),
);

// Directory prefixes for table paths — MUST start with [a-zA-Z] per tablePath regex
const ECO_DIRECTORY_TABLE_ARB = fc.oneof(
  fc.constant('docs/'),
  fc.constant('some-dir/'),
  fc.constant('hooks/'),
  fc.constant('steering/'),
  fc.constant('config/'),
);

// Generate an ecosystem-relevant file path for TABLE cells (.md or .json)
// Table regex requires path to start with [a-zA-Z], so use letter-starting dirs
const ecosystemTablePathArb = fc.tuple(
  ECO_DIRECTORY_TABLE_ARB,
  ECO_FILENAME_CHAR_ARB,
  fc.constantFrom(...ECOSYSTEM_EXTENSIONS),
).map(([dir, name, ext]) => {
  // Ensure the name starts with a letter (required by the table-path regex)
  const safeName = 'f' + name;
  return `${dir}${safeName}${ext}`;
});

// Generate a .kiro.hook path for TABLE cells (must start with letter)
const kiroHookTablePathArb = fc.tuple(
  fc.oneof(fc.constant('hooks/'), fc.constant('config/')),
  ECO_FILENAME_CHAR_ARB,
).map(([dir, name]) => {
  const safeName = 'h' + name;
  return `${dir}${safeName}.kiro.hook`;
});

// Combined ecosystem path arbitrary for table paths
const allEcosystemTablePathArb = fc.oneof(ecosystemTablePathArb, kiroHookTablePathArb);

// Generate an ecosystem-relevant file path for MARKDOWN LINKS (any prefix works)
const ecosystemLinkPathArb = fc.tuple(
  ECO_DIRECTORY_LINK_ARB,
  ECO_FILENAME_CHAR_ARB,
  fc.constantFrom(...ECOSYSTEM_EXTENSIONS),
).map(([dir, name, ext]) => {
  const safeName = 'f' + name;
  return `${dir}${safeName}${ext}`;
});

// Generate a .kiro.hook path for markdown links
const kiroHookLinkPathArb = fc.tuple(
  fc.oneof(fc.constant('.kiro/hooks/'), fc.constant('hooks/'), fc.constant('config/')),
  ECO_FILENAME_CHAR_ARB,
).map(([dir, name]) => {
  const safeName = 'h' + name;
  return `${dir}${safeName}.kiro.hook`;
});

// Combined ecosystem path arbitrary for markdown links
const allEcosystemLinkPathArb = fc.oneof(ecosystemLinkPathArb, kiroHookLinkPathArb);

// Generate ANY file path for wiki-link tests (any extension, including non-ecosystem)
const ANY_EXTENSION_ARB = fc.constantFrom('.cs', '.ts', '.py', '.js', '.md', '.json', '.png', '.txt', '.yaml');

const anyPathArb = fc.tuple(
  fc.oneof(
    fc.constant(''),
    fc.constant('src/'),
    fc.constant('src/services/'),
    fc.constant('.kiro/steering/'),
    fc.constant('lib/'),
  ),
  ECO_FILENAME_CHAR_ARB,
  ANY_EXTENSION_ARB,
).map(([dir, name, ext]) => {
  const safeName = 'w' + name;
  return `${dir}${safeName}${ext}`;
});

describe('Preservation — Ecosystem References Continue to Produce Nodes and Edges', function () {
  this.timeout(30000); // PBT can take longer

  const nodeClassifier = new NodeClassifier();
  const pathResolver = new PathResolver();
  const parserService = new ParserService(nodeClassifier, pathResolver);
  const mockFile = createMockSteeringFile();
  const knownSteeringFiles = new Map<string, string>();

  it('Property 2a: extractTablePaths() MUST emit references for ecosystem-relevant paths', function () {
    fc.assert(
      fc.property(allEcosystemTablePathArb, (generatedPath: string) => {
        // Create steering content with the generated ecosystem path in a table cell
        const content = [
          '# Test Steering',
          '',
          '| File | Description |',
          '|------|-------------|',
          `| ${generatedPath} | Ecosystem file |`,
          '',
        ].join('\n');

        const result = parserService.parse(mockFile, content, knownSteeringFiles);

        // Resolve the path the same way the parser does
        const resolved = pathResolver.resolve(
          generatedPath,
          mockFile.relativePath,
          mockFile.workspaceFolder,
        );

        // Assert: reference MUST exist with target matching the resolved ecosystem path
        const ecoRefs = result.references.filter(
          (ref) => ref.target === resolved && ref.type === 'table-path',
        );

        assert.ok(
          ecoRefs.length > 0,
          `Expected reference for ecosystem path "${generatedPath}" resolved to "${resolved}", but none found`,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('Property 2b: extractMarkdownLinks() MUST emit references for ecosystem-relevant paths', function () {
    fc.assert(
      fc.property(allEcosystemLinkPathArb, (generatedPath: string) => {
        // Create steering content with the generated ecosystem path in a markdown link
        const content = [
          '# Test Steering',
          '',
          `See [ecosystem file](${generatedPath}) for details.`,
          '',
        ].join('\n');

        const result = parserService.parse(mockFile, content, knownSteeringFiles);

        // Resolve the path the same way the parser does
        const resolved = pathResolver.resolve(
          generatedPath,
          mockFile.relativePath,
          mockFile.workspaceFolder,
        );

        // Assert: reference MUST exist with target matching the resolved ecosystem path
        const ecoRefs = result.references.filter(
          (ref) => ref.target === resolved && ref.type === 'markdown-link',
        );

        assert.ok(
          ecoRefs.length > 0,
          `Expected reference for ecosystem path "${generatedPath}" resolved to "${resolved}", but none found`,
        );
      }),
      { numRuns: 100 },
    );
  });

  it('Property 2c: wiki-links to ANY path (including non-ecosystem) MUST emit references', function () {
    fc.assert(
      fc.property(anyPathArb, (generatedPath: string) => {
        // Wiki-links are NEVER filtered regardless of target extension
        const content = [
          '# Test Steering',
          '',
          `Reference: #[[file:${generatedPath}]]`,
          '',
        ].join('\n');

        const result = parserService.parse(mockFile, content, knownSteeringFiles);

        // Resolve the path the same way the parser does
        const resolved = pathResolver.resolve(
          generatedPath,
          mockFile.relativePath,
          mockFile.workspaceFolder,
        );

        // Assert: wiki-link reference MUST exist regardless of extension
        const wikiRefs = result.references.filter(
          (ref) => ref.target === resolved && ref.type === 'wiki-link',
        );

        assert.ok(
          wikiRefs.length > 0,
          `Expected wiki-link reference for path "${generatedPath}" resolved to "${resolved}", but none found. Wiki-links must NEVER be filtered.`,
        );
      }),
      { numRuns: 100 },
    );
  });
});
