import * as assert from 'assert';
import { generateCognitiveReport } from '../../services/markdownReportGenerator';
import type { CognitiveAnalysisResult } from '../../types';

function createMinimalResult(): CognitiveAnalysisResult {
  return {
    steeringsSoltos: [],
    vinculosFrageis: [],
    arquivosSemContexto: [],
    coverageGaps: [],
    weakInstructions: [],
    contextOverload: [],
    totalAlwaysLines: 0,
    hooksWithoutInstruction: [],
    steeringsWithoutAccess: [],
    sugestoes: [],
    deadLoops: [],
    hopsToReach: [],
    duplicateIntent: [],
    passiveKnowledge: [],
    signalToNoise: [],
    contradictions: [],
    hookCoverageMap: { covered: [], uncovered: [] },
    decisionPathCompleteness: {
      hooksWithoutDecisionSteering: [],
      steeringsWithoutHook: [],
    },
    qualityGate: {
      maturityLevel: 0,
      selfReviewHooks: [],
      qualitySteerings: [],
      postTaskReviewHooks: [],
      missing: {
        needsSelfReview: true,
        needsQualitySteering: true,
        needsPostTaskReview: true,
      },
    },
    dmlProtection: {
      maturityLevel: 0,
      dmlHooks: [],
      dmlSteerings: [],
      riskSteerings: [],
      hooksWithRiskSteering: [],
      missing: {
        needsDmlHook: true,
        needsDmlSteering: true,
        needsRiskIntegration: true,
      },
    },
  };
}

describe('MarkdownReportGenerator', function () {
  describe('generateCognitiveReport()', function () {
    it('includes Summary table with all metrics', function () {
      const data = createMinimalResult();
      data.steeringsSoltos = [{ id: 'a.md', label: 'a' }];
      data.vinculosFrageis = [{ source: 'a', target: 'b', sourceLabel: 'a', targetLabel: 'b' }];
      data.arquivosSemContexto = [{ id: 'c.md', label: 'c', type: 'steering-domain' }];

      const report = generateCognitiveReport(data);

      assert.ok(report.includes('## Summary'));
      assert.ok(report.includes('| Orphan Steerings | 1 |'));
      assert.ok(report.includes('| Fragile Links | 1 |'));
      assert.ok(report.includes('| Isolated Files | 1 |'));
      assert.ok(report.includes('| Coverage Gaps | 0 |'));
      assert.ok(report.includes('| Dead Loops | 0 |'));
      assert.ok(report.includes('| Quality Gate Level |'));
      assert.ok(report.includes('| DML Protection Level |'));
    });

    it('includes sections for non-empty validations only', function () {
      const data = createMinimalResult();
      // All empty — should NOT include section headers for empty validations
      const report = generateCognitiveReport(data);

      assert.ok(!report.includes('## Orphan Steerings'));
      assert.ok(!report.includes('## Fragile Links'));
      assert.ok(!report.includes('## Isolated Files'));
      assert.ok(!report.includes('## Dead Loops'));
      assert.ok(!report.includes('## Hops to Reach'));
      assert.ok(!report.includes('## Duplicate Intent'));
      assert.ok(!report.includes('## Passive Knowledge'));
      assert.ok(!report.includes('## Signal-to-Noise'));
      assert.ok(!report.includes('## Contradictions'));
    });

    it('includes section when validation has items', function () {
      const data = createMinimalResult();
      data.deadLoops = [
        { nodes: [{ id: 'a.md', label: 'a' }, { id: 'b.md', label: 'b' }], size: 2 },
      ];

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('## Dead Loops'));
      assert.ok(report.includes('| 2 | a, b |'));
    });

    it('hops shows ∞ for unreachable (999)', function () {
      const data = createMinimalResult();
      data.hopsToReach = [
        { id: 'deep.md', label: 'deep', hops: 999 },
      ];

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('## Hops to Reach'));
      assert.ok(report.includes('| ∞ |'));
    });

    it('hops shows ∞ for null hops', function () {
      const data = createMinimalResult();
      data.hopsToReach = [
        { id: 'deep.md', label: 'deep', hops: null as unknown as number },
      ];

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('| ∞ |'));
    });

    it('hops shows numeric value for reachable nodes', function () {
      const data = createMinimalResult();
      data.hopsToReach = [
        { id: 'far.md', label: 'far', hops: 5 },
      ];

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('| 5 |'));
    });

    it('Quality Gate shows maturity level', function () {
      const data = createMinimalResult();
      data.qualityGate = {
        maturityLevel: 2,
        selfReviewHooks: [{ id: 'h1', label: 'review' }],
        qualitySteerings: [{ id: 's1', label: 'quality' }],
        postTaskReviewHooks: [{ id: 'h2', label: 'post-task' }],
        missing: {
          needsSelfReview: false,
          needsQualitySteering: false,
          needsPostTaskReview: false,
        },
      };

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('## Quality Gate'));
      assert.ok(report.includes('**Maturity Level: 2/2 (Complete)**'));
    });

    it('Quality Gate shows partial level with missing components', function () {
      const data = createMinimalResult();
      data.qualityGate = {
        maturityLevel: 1,
        selfReviewHooks: [{ id: 'h1', label: 'review' }],
        qualitySteerings: [],
        postTaskReviewHooks: [],
        missing: {
          needsSelfReview: false,
          needsQualitySteering: true,
          needsPostTaskReview: true,
        },
      };

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('**Maturity Level: 1/2 (Partial)**'));
      assert.ok(report.includes('✗ Missing'));
      assert.ok(report.includes('✓ Present'));
    });

    it('DML Protection shows maturity level', function () {
      const data = createMinimalResult();
      data.dmlProtection = {
        maturityLevel: 2,
        dmlHooks: [{ id: 'h1', label: 'dml-hook' }],
        dmlSteerings: [{ id: 's1', label: 'db-rules' }],
        riskSteerings: [{ id: 's2', label: 'risk' }],
        hooksWithRiskSteering: [{ id: 'h1', label: 'dml-hook' }],
        missing: {
          needsDmlHook: false,
          needsDmlSteering: false,
          needsRiskIntegration: false,
        },
      };

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('## DML Protection'));
      assert.ok(report.includes('**Maturity Level: 2/2 (Smart Protection)**'));
    });

    it('DML Protection shows blind block level', function () {
      const data = createMinimalResult();
      data.dmlProtection = {
        maturityLevel: 1,
        dmlHooks: [{ id: 'h1', label: 'dml-hook' }],
        dmlSteerings: [{ id: 's1', label: 'db-rules' }],
        riskSteerings: [],
        hooksWithRiskSteering: [],
        missing: {
          needsDmlHook: false,
          needsDmlSteering: false,
          needsRiskIntegration: true,
        },
      };

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('**Maturity Level: 1/2 (Blind Block)**'));
    });

    it('Instructions for AI section generated correctly', function () {
      const data = createMinimalResult();
      data.steeringsSoltos = [{ id: 'orphan.md', label: 'orphan' }];
      data.deadLoops = [
        { nodes: [{ id: 'a.md', label: 'a' }], size: 1 },
      ];

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('## Instructions for Kiro AI'));
      assert.ok(report.includes('```text'));
      assert.ok(report.includes('For each Orphan Steering, add cross-references'));
      assert.ok(report.includes('For each Dead Loop, add an external entry point'));
      assert.ok(report.includes('Prioritize changes that increase overall graph connectivity'));
    });

    it('Instructions for AI omits steps for empty validations', function () {
      const data = createMinimalResult();
      // All empty
      const report = generateCognitiveReport(data);
      assert.ok(report.includes('## Instructions for Kiro AI'));
      // Should not contain specific fix instructions since all are empty
      assert.ok(!report.includes('For each Orphan Steering'));
      assert.ok(!report.includes('For each Dead Loop'));
    });

    it('report starts with title and timestamp', function () {
      const data = createMinimalResult();
      const report = generateCognitiveReport(data);
      assert.ok(report.startsWith('# Cognitive Analysis Report'));
      assert.ok(report.includes('Generated:'));
    });

    it('Stale Content section generated with valid data', function () {
      const data = createMinimalResult();
      data.staleContent = [
        { id: 'old-hub.md', label: 'old-hub', stalenessDays: 120, degree: 5, riskScore: 600 },
        { id: 'stale.md', label: 'stale', stalenessDays: 95, degree: 3, riskScore: 285 },
      ];

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('## Stale Content'));
      assert.ok(report.includes('| `old-hub.md` | old-hub | 120 | 5 | 600 |'));
      assert.ok(report.includes('| `stale.md` | stale | 95 | 3 | 285 |'));
      assert.ok(report.includes('| File | Label | Days Stale | Degree | Risk Score | Tip |'));
    });

    it('Stale Content section omitted when empty', function () {
      const data = createMinimalResult();
      data.staleContent = [];

      const report = generateCognitiveReport(data);
      assert.ok(!report.includes('## Stale Content'));
    });

    it('Stale Content included in Summary table', function () {
      const data = createMinimalResult();
      data.staleContent = [
        { id: 'old.md', label: 'old', stalenessDays: 100, degree: 4, riskScore: 400 },
      ];

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('| Stale Content | 1 |'));
    });

    it('Stale Content not in Summary when empty', function () {
      const data = createMinimalResult();
      // staleContent undefined
      const report = generateCognitiveReport(data);
      assert.ok(!report.includes('| Stale Content |'));
    });

    it('Instructions for AI includes stale content step', function () {
      const data = createMinimalResult();
      data.staleContent = [
        { id: 'old.md', label: 'old', stalenessDays: 100, degree: 4, riskScore: 400 },
      ];

      const report = generateCognitiveReport(data);
      assert.ok(report.includes('For each Stale Content steering, review and update'));
    });
  });
});
