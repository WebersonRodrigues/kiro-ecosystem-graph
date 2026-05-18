import * as assert from 'assert';

import {
  computeUnifiedHealthScore,
  computeConnectivitySubScore,
  computeContentQualitySubScore,
  computeCompletenessSubScore,
  computeMaturitySubScore,
  computeScoreTrend,
} from '../../services/healthScoreCalculator';
import type { CognitiveAnalysisResult, DailySnapshot } from '../../types';

function createMinimalAnalysis(): CognitiveAnalysisResult {
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
      missing: { needsSelfReview: true, needsQualitySteering: true, needsPostTaskReview: true },
    },
    dmlProtection: {
      maturityLevel: 0,
      dmlHooks: [],
      dmlSteerings: [],
      riskSteerings: [],
      hooksWithRiskSteering: [],
      missing: { needsDmlHook: true, needsDmlSteering: true, needsRiskIntegration: true },
    },
  };
}

describe('HealthScoreCalculator', function () {
  describe('computeConnectivitySubScore', function () {
    it('returns 0 when totalNodes is 0', function () {
      const data = createMinimalAnalysis();
      assert.strictEqual(computeConnectivitySubScore(data, 0), 0);
    });

    it('returns 100 when no connectivity issues', function () {
      const data = createMinimalAnalysis();
      assert.strictEqual(computeConnectivitySubScore(data, 10), 100);
    });

    it('decreases proportionally with issues', function () {
      const data = createMinimalAnalysis();
      data.steeringsSoltos = [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }];
      data.vinculosFrageis = [{ source: 'x', target: 'y', sourceLabel: 'x', targetLabel: 'y' }];
      // 3 issues out of 10 nodes = 30% issues = 70 score
      assert.strictEqual(computeConnectivitySubScore(data, 10), 70);
    });

    it('counts all connectivity issue types', function () {
      const data = createMinimalAnalysis();
      data.steeringsSoltos = [{ id: 'a', label: 'a' }];
      data.vinculosFrageis = [{ source: 'x', target: 'y', sourceLabel: 'x', targetLabel: 'y' }];
      data.arquivosSemContexto = [{ id: 'b', label: 'b', type: 'steering-domain' }];
      data.coverageGaps = [{ folder: 'f' }];
      data.deadLoops = [{ nodes: [{ id: 'c', label: 'c' }], size: 1 }];
      data.hopsToReach = [{ id: 'd', label: 'd', hops: 5 }];
      // 6 issues out of 10 nodes = 60% issues = 40 score
      assert.strictEqual(computeConnectivitySubScore(data, 10), 40);
    });

    it('floors at 0 when issues exceed nodes', function () {
      const data = createMinimalAnalysis();
      data.steeringsSoltos = [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }, { id: 'c', label: 'c' }];
      // 3 issues out of 2 nodes = 150% issues → clamped to 0
      assert.strictEqual(computeConnectivitySubScore(data, 2), 0);
    });
  });

  describe('computeContentQualitySubScore', function () {
    it('returns 0 when totalNodes is 0', function () {
      const data = createMinimalAnalysis();
      assert.strictEqual(computeContentQualitySubScore(data, 0), 0);
    });

    it('returns 100 when no content issues', function () {
      const data = createMinimalAnalysis();
      assert.strictEqual(computeContentQualitySubScore(data, 10), 100);
    });

    it('decreases with content issues', function () {
      const data = createMinimalAnalysis();
      data.passiveKnowledge = [{ id: 'a', label: 'a', actionablePercent: 5 }];
      data.signalToNoise = [{ id: 'b', label: 'b', signalRatio: 15 }];
      // 2 issues out of 10 nodes = 20% issues = 80 score
      assert.strictEqual(computeContentQualitySubScore(data, 10), 80);
    });
  });

  describe('computeCompletenessSubScore', function () {
    it('returns 0 when totalNodes is 0', function () {
      const data = createMinimalAnalysis();
      assert.strictEqual(computeCompletenessSubScore(data, 0), 0);
    });

    it('returns 100 when no completeness issues', function () {
      const data = createMinimalAnalysis();
      assert.strictEqual(computeCompletenessSubScore(data, 10), 100);
    });

    it('decreases with completeness issues', function () {
      const data = createMinimalAnalysis();
      data.hooksWithoutInstruction = [{ id: 'a', label: 'a' }];
      data.steeringsWithoutAccess = [{ id: 'b', label: 'b', inclusion: 'manual' }];
      data.weakInstructions = [{ id: 'c', label: 'c', lineCount: 5 }];
      data.contextOverload = [{ id: 'd', label: 'd', lineCount: 500 }];
      // 4 issues out of 10 nodes = 40% issues = 60 score
      assert.strictEqual(computeCompletenessSubScore(data, 10), 60);
    });
  });

  describe('computeMaturitySubScore', function () {
    it('returns 0 when all maturity indicators are at minimum', function () {
      const data = createMinimalAnalysis();
      // qualityGate level 0, dmlProtection level 0, no hook coverage, decision path issues
      data.decisionPathCompleteness = {
        hooksWithoutDecisionSteering: [{ id: 'h', label: 'h', gap: 'no-steering' }],
        steeringsWithoutHook: [],
      };
      const score = computeMaturitySubScore(data);
      // qg=0, dml=0, hc=0, dp=max(0, 100-1*20)=80 → (0+0+0+80)/4 = 20
      assert.strictEqual(score, 20);
    });

    it('returns 100 when all maturity indicators are at maximum', function () {
      const data = createMinimalAnalysis();
      data.qualityGate = {
        maturityLevel: 2,
        selfReviewHooks: [],
        qualitySteerings: [],
        postTaskReviewHooks: [],
        missing: { needsSelfReview: false, needsQualitySteering: false, needsPostTaskReview: false },
      };
      data.dmlProtection = {
        maturityLevel: 2,
        dmlHooks: [],
        dmlSteerings: [],
        riskSteerings: [],
        hooksWithRiskSteering: [],
        missing: { needsDmlHook: false, needsDmlSteering: false, needsRiskIntegration: false },
      };
      data.hookCoverageMap = {
        covered: Array.from({ length: 10 }, (_, i) => ({ event: `e${i}`, hookCount: 1 })),
        uncovered: [],
      };
      data.decisionPathCompleteness = {
        hooksWithoutDecisionSteering: [],
        steeringsWithoutHook: [],
      };
      // qg=100, dml=100, hc=100, dp=100 → (100+100+100+100)/4 = 100
      assert.strictEqual(computeMaturitySubScore(data), 100);
    });
  });

  describe('computeUnifiedHealthScore', function () {
    it('returns all zeros when totalNodes is 0', function () {
      const data = createMinimalAnalysis();
      const result = computeUnifiedHealthScore(data, 0);
      assert.strictEqual(result.score, 0);
      assert.strictEqual(result.connectivity, 0);
      assert.strictEqual(result.contentQuality, 0);
      assert.strictEqual(result.completeness, 0);
      assert.strictEqual(result.maturity, 0);
    });

    it('computes weighted formula correctly with known values', function () {
      const data = createMinimalAnalysis();
      // No issues → all sub-scores at 100 except maturity
      // maturity: qg=0, dml=0, hc=0, dp=100 → (0+0+0+100)/4 = 25
      data.decisionPathCompleteness = {
        hooksWithoutDecisionSteering: [],
        steeringsWithoutHook: [],
      };
      const result = computeUnifiedHealthScore(data, 10);
      assert.strictEqual(result.connectivity, 100);
      assert.strictEqual(result.contentQuality, 100);
      assert.strictEqual(result.completeness, 100);
      assert.strictEqual(result.maturity, 25);
      // score = 100*0.3 + 100*0.25 + 100*0.25 + 25*0.2 = 30+25+25+5 = 85
      assert.strictEqual(result.score, 85);
    });

    it('returns integer values for all fields', function () {
      const data = createMinimalAnalysis();
      data.steeringsSoltos = [{ id: 'a', label: 'a' }];
      const result = computeUnifiedHealthScore(data, 3);
      assert.strictEqual(result.score, Math.round(result.score));
      assert.strictEqual(result.connectivity, Math.round(result.connectivity));
      assert.strictEqual(result.contentQuality, Math.round(result.contentQuality));
      assert.strictEqual(result.completeness, Math.round(result.completeness));
      assert.strictEqual(result.maturity, Math.round(result.maturity));
    });

    it('handles single node with no issues', function () {
      const data = createMinimalAnalysis();
      data.decisionPathCompleteness = {
        hooksWithoutDecisionSteering: [],
        steeringsWithoutHook: [],
      };
      const result = computeUnifiedHealthScore(data, 1);
      assert.strictEqual(result.connectivity, 100);
      assert.strictEqual(result.contentQuality, 100);
      assert.strictEqual(result.completeness, 100);
    });

    it('handles all issues present', function () {
      const data = createMinimalAnalysis();
      data.steeringsSoltos = [{ id: 'a', label: 'a' }];
      data.vinculosFrageis = [{ source: 'a', target: 'b', sourceLabel: 'a', targetLabel: 'b' }];
      data.arquivosSemContexto = [{ id: 'b', label: 'b', type: 'unknown' }];
      data.coverageGaps = [{ folder: 'f' }];
      data.deadLoops = [{ nodes: [{ id: 'c', label: 'c' }], size: 1 }];
      data.hopsToReach = [{ id: 'd', label: 'd', hops: 5 }];
      data.passiveKnowledge = [{ id: 'e', label: 'e', actionablePercent: 5 }];
      data.signalToNoise = [{ id: 'f', label: 'f', signalRatio: 15 }];
      data.duplicateIntent = [{ nodeA: { id: 'g', label: 'g' }, nodeB: { id: 'h', label: 'h' }, overlap: 70 }];
      data.contradictions = [{ nodeA: { id: 'i', label: 'i' }, nodeB: { id: 'j', label: 'j' }, snippetA: 'x', snippetB: 'y', conflictType: 'always vs never' }];
      data.hooksWithoutInstruction = [{ id: 'k', label: 'k' }];
      data.steeringsWithoutAccess = [{ id: 'l', label: 'l', inclusion: 'manual' }];
      data.weakInstructions = [{ id: 'm', label: 'm', lineCount: 5 }];
      data.contextOverload = [{ id: 'n', label: 'n', lineCount: 500 }];
      const result = computeUnifiedHealthScore(data, 2);
      assert.ok(result.score >= 0);
      assert.ok(result.score <= 100);
    });
  });

  describe('computeScoreTrend', function () {
    it('returns null when no snapshots have healthScore', function () {
      const snapshots: DailySnapshot[] = [
        { date: '2024-01-01', nodeCount: 10, edgeCount: 5 },
        { date: '2024-01-02', nodeCount: 12, edgeCount: 6 },
      ];
      const result = computeScoreTrend(80, snapshots);
      assert.strictEqual(result, null);
    });

    it('returns null for empty snapshots array', function () {
      const result = computeScoreTrend(80, []);
      assert.strictEqual(result, null);
    });

    it('returns up direction when current > previous', function () {
      const snapshots: DailySnapshot[] = [
        { date: '2024-01-01', nodeCount: 10, edgeCount: 5, healthScore: 60 },
      ];
      const result = computeScoreTrend(80, snapshots);
      assert.ok(result !== null);
      assert.strictEqual(result!.direction, 'up');
      assert.strictEqual(result!.delta, 20);
      assert.strictEqual(result!.previousScore, 60);
    });

    it('returns down direction when current < previous', function () {
      const snapshots: DailySnapshot[] = [
        { date: '2024-01-01', nodeCount: 10, edgeCount: 5, healthScore: 90 },
      ];
      const result = computeScoreTrend(70, snapshots);
      assert.ok(result !== null);
      assert.strictEqual(result!.direction, 'down');
      assert.strictEqual(result!.delta, 20);
      assert.strictEqual(result!.previousScore, 90);
    });

    it('returns neutral direction when current equals previous', function () {
      const snapshots: DailySnapshot[] = [
        { date: '2024-01-01', nodeCount: 10, edgeCount: 5, healthScore: 75 },
      ];
      const result = computeScoreTrend(75, snapshots);
      assert.ok(result !== null);
      assert.strictEqual(result!.direction, 'neutral');
      assert.strictEqual(result!.delta, 0);
    });

    it('uses the most recent snapshot with healthScore', function () {
      const snapshots: DailySnapshot[] = [
        { date: '2024-01-01', nodeCount: 10, edgeCount: 5, healthScore: 50 },
        { date: '2024-01-02', nodeCount: 12, edgeCount: 6 },
        { date: '2024-01-03', nodeCount: 14, edgeCount: 7, healthScore: 70 },
        { date: '2024-01-04', nodeCount: 15, edgeCount: 8 },
      ];
      const result = computeScoreTrend(80, snapshots);
      assert.ok(result !== null);
      assert.strictEqual(result!.previousScore, 70);
      assert.strictEqual(result!.delta, 10);
    });

    it('backward compatibility: snapshots without healthScore are skipped', function () {
      const snapshots: DailySnapshot[] = [
        { date: '2024-01-01', nodeCount: 10, edgeCount: 5 },
        { date: '2024-01-02', nodeCount: 12, edgeCount: 6 },
      ];
      // No healthScore in any snapshot → returns null
      const result = computeScoreTrend(80, snapshots);
      assert.strictEqual(result, null);
    });
  });
});
