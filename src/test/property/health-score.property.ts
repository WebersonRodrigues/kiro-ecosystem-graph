import * as assert from 'assert';
import * as fc from 'fast-check';

import {
  computeUnifiedHealthScore,
  computeConnectivitySubScore,
  computeContentQualitySubScore,
  computeCompletenessSubScore,
  computeMaturitySubScore,
} from '../../services/healthScoreCalculator';
import type { CognitiveAnalysisResult } from '../../types';

/**
 * Generates a minimal CognitiveAnalysisResult with configurable issue counts.
 */
function buildAnalysis(params: {
  orphans?: number;
  fragile?: number;
  isolated?: number;
  gaps?: number;
  deadLoops?: number;
  hops?: number;
  passive?: number;
  signalNoise?: number;
  duplicate?: number;
  contradictions?: number;
  hooksNoInstruction?: number;
  steeringsNoAccess?: number;
  weak?: number;
  overload?: number;
  qualityGateLevel?: 0 | 1 | 2;
  dmlLevel?: 0 | 1 | 2;
  hooksCovered?: number;
  decisionIssues?: number;
}): CognitiveAnalysisResult {
  return {
    steeringsSoltos: Array.from({ length: params.orphans || 0 }, (_, i) => ({ id: `o${i}`, label: `o${i}` })),
    vinculosFrageis: Array.from({ length: params.fragile || 0 }, (_, i) => ({ source: `s${i}`, target: `t${i}`, sourceLabel: `s${i}`, targetLabel: `t${i}` })),
    arquivosSemContexto: Array.from({ length: params.isolated || 0 }, (_, i) => ({ id: `i${i}`, label: `i${i}`, type: 'unknown' })),
    coverageGaps: Array.from({ length: params.gaps || 0 }, (_, i) => ({ folder: `f${i}` })),
    deadLoops: Array.from({ length: params.deadLoops || 0 }, (_, i) => ({ nodes: [{ id: `dl${i}`, label: `dl${i}` }], size: 1 })),
    hopsToReach: Array.from({ length: params.hops || 0 }, (_, i) => ({ id: `h${i}`, label: `h${i}`, hops: 5 })),
    passiveKnowledge: Array.from({ length: params.passive || 0 }, (_, i) => ({ id: `p${i}`, label: `p${i}`, actionablePercent: 5 })),
    signalToNoise: Array.from({ length: params.signalNoise || 0 }, (_, i) => ({ id: `sn${i}`, label: `sn${i}`, signalRatio: 15 })),
    duplicateIntent: Array.from({ length: params.duplicate || 0 }, (_, i) => ({ nodeA: { id: `da${i}`, label: `da${i}` }, nodeB: { id: `db${i}`, label: `db${i}` }, overlap: 70 })),
    contradictions: Array.from({ length: params.contradictions || 0 }, (_, i) => ({ nodeA: { id: `ca${i}`, label: `ca${i}` }, nodeB: { id: `cb${i}`, label: `cb${i}` }, snippetA: 'x', snippetB: 'y', conflictType: 'always vs never' })),
    hooksWithoutInstruction: Array.from({ length: params.hooksNoInstruction || 0 }, (_, i) => ({ id: `hi${i}`, label: `hi${i}` })),
    steeringsWithoutAccess: Array.from({ length: params.steeringsNoAccess || 0 }, (_, i) => ({ id: `sa${i}`, label: `sa${i}`, inclusion: 'manual' })),
    weakInstructions: Array.from({ length: params.weak || 0 }, (_, i) => ({ id: `w${i}`, label: `w${i}`, lineCount: 5 })),
    contextOverload: Array.from({ length: params.overload || 0 }, (_, i) => ({ id: `co${i}`, label: `co${i}`, lineCount: 500 })),
    totalAlwaysLines: 0,
    sugestoes: [],
    hookCoverageMap: {
      covered: Array.from({ length: params.hooksCovered || 0 }, (_, i) => ({ event: `e${i}`, hookCount: 1 })),
      uncovered: [],
    },
    decisionPathCompleteness: {
      hooksWithoutDecisionSteering: Array.from({ length: params.decisionIssues || 0 }, (_, i) => ({ id: `dp${i}`, label: `dp${i}`, gap: 'no-steering' })),
      steeringsWithoutHook: [],
    },
    qualityGate: {
      maturityLevel: params.qualityGateLevel || 0,
      selfReviewHooks: [],
      qualitySteerings: [],
      postTaskReviewHooks: [],
      missing: { needsSelfReview: true, needsQualitySteering: true, needsPostTaskReview: true },
    },
    dmlProtection: {
      maturityLevel: params.dmlLevel || 0,
      dmlHooks: [],
      dmlSteerings: [],
      riskSteerings: [],
      hooksWithRiskSteering: [],
      missing: { needsDmlHook: true, needsDmlSteering: true, needsRiskIntegration: true },
    },
  };
}

describe('HealthScore Property-Based Tests', function () {
  this.timeout(30000);

  /**
   * **Validates: Requirements 1.1, 1.7**
   * Property: score always between 0 and 100 for any valid input.
   */
  describe('Property: score always between 0 and 100', function () {
    it('unified score is bounded [0, 100] for arbitrary inputs', function () {
      const issueCountArb = fc.integer({ min: 0, max: 50 });
      const totalNodesArb = fc.integer({ min: 0, max: 100 });
      const maturityLevelArb = fc.constantFrom(0, 1, 2) as fc.Arbitrary<0 | 1 | 2>;

      fc.assert(
        fc.property(
          issueCountArb, issueCountArb, issueCountArb, issueCountArb,
          issueCountArb, issueCountArb,
          issueCountArb, issueCountArb, issueCountArb, issueCountArb,
          issueCountArb, issueCountArb, issueCountArb, issueCountArb,
          maturityLevelArb, maturityLevelArb,
          fc.integer({ min: 0, max: 10 }),
          issueCountArb,
          totalNodesArb,
          function (orphans, fragile, isolated, gaps, deadLoops, hops,
            passive, signalNoise, duplicate, contradictions,
            hooksNoInstr, steeringsNoAccess, weak, overload,
            qgLevel, dmlLevel, hooksCovered, decisionIssues,
            totalNodes) {
            const data = buildAnalysis({
              orphans, fragile, isolated, gaps, deadLoops, hops,
              passive, signalNoise, duplicate, contradictions,
              hooksNoInstruction: hooksNoInstr,
              steeringsNoAccess,
              weak, overload,
              qualityGateLevel: qgLevel,
              dmlLevel,
              hooksCovered,
              decisionIssues,
            });
            const result = computeUnifiedHealthScore(data, totalNodes);
            assert.ok(result.score >= 0, `score ${result.score} < 0`);
            assert.ok(result.score <= 100, `score ${result.score} > 100`);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * **Validates: Requirements 7.5**
   * Property: score monotonically non-decreasing as issues are removed.
   */
  describe('Property: score monotonically non-decreasing as issues are removed', function () {
    it('removing issues never decreases the score', function () {
      const issueCountArb = fc.integer({ min: 1, max: 20 });
      const totalNodesArb = fc.integer({ min: 5, max: 50 });

      fc.assert(
        fc.property(
          issueCountArb, issueCountArb, issueCountArb, issueCountArb,
          totalNodesArb,
          function (orphans, passive, weak, hooksNoInstr, totalNodes) {
            // Score with issues
            const dataWithIssues = buildAnalysis({
              orphans,
              passive,
              weak,
              hooksNoInstruction: hooksNoInstr,
            });
            const scoreWithIssues = computeUnifiedHealthScore(dataWithIssues, totalNodes);

            // Score with fewer issues (remove half, rounding down)
            const dataWithFewerIssues = buildAnalysis({
              orphans: Math.floor(orphans / 2),
              passive: Math.floor(passive / 2),
              weak: Math.floor(weak / 2),
              hooksNoInstruction: Math.floor(hooksNoInstr / 2),
            });
            const scoreWithFewerIssues = computeUnifiedHealthScore(dataWithFewerIssues, totalNodes);

            assert.ok(
              scoreWithFewerIssues.score >= scoreWithIssues.score,
              `Fewer issues (${scoreWithFewerIssues.score}) should be >= more issues (${scoreWithIssues.score})`,
            );
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * **Validates: Requirements 7.6**
   * Property: round-trip — compute score, decompose, recompose = same total.
   */
  describe('Property: round-trip decomposition', function () {
    it('recomposing sub-scores with formula yields same total', function () {
      const issueCountArb = fc.integer({ min: 0, max: 20 });
      const totalNodesArb = fc.integer({ min: 1, max: 50 });
      const maturityLevelArb = fc.constantFrom(0, 1, 2) as fc.Arbitrary<0 | 1 | 2>;

      fc.assert(
        fc.property(
          issueCountArb, issueCountArb, issueCountArb, issueCountArb,
          issueCountArb, issueCountArb, issueCountArb, issueCountArb,
          maturityLevelArb, maturityLevelArb,
          fc.integer({ min: 0, max: 10 }),
          issueCountArb,
          totalNodesArb,
          function (orphans, fragile, passive, signalNoise,
            weak, overload, hooksNoInstr, steeringsNoAccess,
            qgLevel, dmlLevel, hooksCovered, decisionIssues,
            totalNodes) {
            const data = buildAnalysis({
              orphans, fragile,
              passive, signalNoise,
              weak, overload,
              hooksNoInstruction: hooksNoInstr,
              steeringsNoAccess,
              qualityGateLevel: qgLevel,
              dmlLevel,
              hooksCovered,
              decisionIssues,
            });
            const result = computeUnifiedHealthScore(data, totalNodes);

            // Recompose from sub-scores
            const recomposed = Math.round(
              result.connectivity * 0.3 +
              result.contentQuality * 0.25 +
              result.completeness * 0.25 +
              result.maturity * 0.2,
            );

            assert.strictEqual(result.score, recomposed,
              `score ${result.score} !== recomposed ${recomposed}`);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  /**
   * **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
   * Property: sub-scores always between 0 and 100.
   */
  describe('Property: sub-scores always between 0 and 100', function () {
    it('all sub-scores are bounded [0, 100]', function () {
      const issueCountArb = fc.integer({ min: 0, max: 50 });
      const totalNodesArb = fc.integer({ min: 0, max: 100 });
      const maturityLevelArb = fc.constantFrom(0, 1, 2) as fc.Arbitrary<0 | 1 | 2>;

      fc.assert(
        fc.property(
          issueCountArb, issueCountArb, issueCountArb, issueCountArb,
          issueCountArb, issueCountArb,
          issueCountArb, issueCountArb, issueCountArb, issueCountArb,
          issueCountArb, issueCountArb, issueCountArb, issueCountArb,
          maturityLevelArb, maturityLevelArb,
          fc.integer({ min: 0, max: 10 }),
          issueCountArb,
          totalNodesArb,
          function (orphans, fragile, isolated, gaps, deadLoops, hops,
            passive, signalNoise, duplicate, contradictions,
            hooksNoInstr, steeringsNoAccess, weak, overload,
            qgLevel, dmlLevel, hooksCovered, decisionIssues,
            totalNodes) {
            const data = buildAnalysis({
              orphans, fragile, isolated, gaps, deadLoops, hops,
              passive, signalNoise, duplicate, contradictions,
              hooksNoInstruction: hooksNoInstr,
              steeringsNoAccess,
              weak, overload,
              qualityGateLevel: qgLevel,
              dmlLevel,
              hooksCovered,
              decisionIssues,
            });

            const connectivity = computeConnectivitySubScore(data, totalNodes);
            const contentQuality = computeContentQualitySubScore(data, totalNodes);
            const completeness = computeCompletenessSubScore(data, totalNodes);
            const maturity = computeMaturitySubScore(data);

            assert.ok(connectivity >= 0 && connectivity <= 100, `connectivity ${connectivity} out of bounds`);
            assert.ok(contentQuality >= 0 && contentQuality <= 100, `contentQuality ${contentQuality} out of bounds`);
            assert.ok(completeness >= 0 && completeness <= 100, `completeness ${completeness} out of bounds`);
            assert.ok(maturity >= 0 && maturity <= 100, `maturity ${maturity} out of bounds`);
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});
