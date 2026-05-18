import * as assert from 'assert';

import {
  detectEcosystemPhase,
  computePhaseProgress,
  suggestNextStep,
} from '../../services/phaseDetector';
import type { GraphNode, CognitiveAnalysisResult } from '../../types';

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

function makeSteeringNode(id: string, type: string, label?: string): GraphNode {
  return {
    id,
    label: label || id,
    type: type as GraphNode['type'],
    workspaceFolder: 'Workspace',
    filePath: `.kiro/steering/${id}.md`,
    resolved: true,
    source: 'local',
  };
}

function makeHookNode(id: string, whenType?: string): GraphNode {
  return {
    id,
    label: id,
    type: 'hook-auto',
    workspaceFolder: 'Workspace',
    filePath: `.kiro/hooks/${id}.json`,
    resolved: true,
    source: 'local',
    metadata: { whenType: whenType || 'fileEdited' },
  };
}

describe('PhaseDetector', function () {
  describe('detectEcosystemPhase', function () {
    it('should detect Phase 1 for empty ecosystem', function () {
      const result = detectEcosystemPhase([], createMinimalAnalysis());
      assert.strictEqual(result.phase, 1);
      assert.strictEqual(result.phaseName, 'Foundation');
    });

    it('should detect Phase 1 for only project-overview', function () {
      const nodes = [makeSteeringNode('project-overview', 'steering-domain', 'project-overview')];
      const result = detectEcosystemPhase(nodes, createMinimalAnalysis());
      assert.strictEqual(result.phase, 1);
    });

    it('should detect Phase 2 for 3+ steerings without hooks', function () {
      const nodes = [
        makeSteeringNode('s1', 'steering-domain'),
        makeSteeringNode('s2', 'steering-tech'),
        makeSteeringNode('s3', 'steering-domain'),
      ];
      const result = detectEcosystemPhase(nodes, createMinimalAnalysis());
      assert.strictEqual(result.phase, 2);
      assert.strictEqual(result.phaseName, 'Domain Knowledge');
    });

    it('should detect Phase 3 for flow + policy + hook', function () {
      const nodes = [
        makeSteeringNode('s1', 'steering-domain'),
        makeSteeringNode('s2', 'steering-flow'),
        makeSteeringNode('s3', 'steering-policy'),
        makeHookNode('h1'),
      ];
      const result = detectEcosystemPhase(nodes, createMinimalAnalysis());
      assert.strictEqual(result.phase, 3);
      assert.strictEqual(result.phaseName, 'Flows & Security');
    });

    it('should detect Phase 4 for 3+ hooks + quality gate partial', function () {
      const nodes = [
        makeSteeringNode('s1', 'steering-domain'),
        makeSteeringNode('s2', 'steering-flow'),
        makeSteeringNode('s3', 'steering-policy'),
        makeHookNode('h1', 'fileEdited'),
        makeHookNode('h2', 'preToolUse'),
        makeHookNode('h3', 'postTaskExecution'),
      ];
      const analysis = createMinimalAnalysis();
      analysis.qualityGate!.maturityLevel = 1;
      const result = detectEcosystemPhase(nodes, analysis);
      assert.strictEqual(result.phase, 4);
      assert.strictEqual(result.phaseName, 'Automation');
    });

    it('should detect Phase 5 for full coverage + quality gate complete + DML', function () {
      const nodes = [
        makeSteeringNode('s1', 'steering-domain'),
        makeSteeringNode('s2', 'steering-flow'),
        makeSteeringNode('s3', 'steering-policy'),
        makeHookNode('h1', 'fileEdited'),
        makeHookNode('h2', 'preToolUse'),
        makeHookNode('h3', 'postTaskExecution'),
        makeHookNode('h4', 'promptSubmit'),
        makeHookNode('h5', 'agentStop'),
      ];
      const analysis = createMinimalAnalysis();
      analysis.qualityGate!.maturityLevel = 2;
      analysis.dmlProtection!.maturityLevel = 1;
      analysis.hookCoverageMap = {
        covered: [
          { event: 'fileEdited', hookCount: 1 },
          { event: 'preToolUse', hookCount: 1 },
          { event: 'postTaskExecution', hookCount: 1 },
          { event: 'promptSubmit', hookCount: 1 },
          { event: 'agentStop', hookCount: 1 },
        ],
        uncovered: [],
      };
      const result = detectEcosystemPhase(nodes, analysis);
      assert.strictEqual(result.phase, 5);
      assert.strictEqual(result.phaseName, 'Evolution');
    });

    it('should handle ecosystem with only hooks (no steerings)', function () {
      const nodes = [
        makeHookNode('h1', 'fileEdited'),
        makeHookNode('h2', 'preToolUse'),
      ];
      const result = detectEcosystemPhase(nodes, createMinimalAnalysis());
      // No steerings means phase 1 (steerings.length <= 2)
      assert.strictEqual(result.phase, 1);
    });
  });

  describe('computePhaseProgress', function () {
    it('should return 0-100 for Phase 1 empty ecosystem', function () {
      const progress = computePhaseProgress(1, [], createMinimalAnalysis());
      assert.ok(progress >= 0 && progress <= 100);
      assert.strictEqual(progress, 0);
    });

    it('should return partial progress for Phase 1 with some criteria met', function () {
      const nodes = [makeSteeringNode('project-overview', 'steering-domain', 'project-overview')];
      const progress = computePhaseProgress(1, nodes, createMinimalAnalysis());
      assert.ok(progress > 0 && progress < 100);
    });

    it('should return 100 for Phase 5 with all criteria met', function () {
      const analysis = createMinimalAnalysis();
      analysis.qualityGate!.maturityLevel = 2;
      analysis.dmlProtection!.maturityLevel = 1;
      analysis.hookCoverageMap = {
        covered: Array.from({ length: 8 }, (_, i) => ({ event: `e${i}`, hookCount: 1 })),
        uncovered: [],
      };
      const progress = computePhaseProgress(5, [], analysis);
      assert.strictEqual(progress, 100);
    });
  });

  describe('suggestNextStep', function () {
    it('should suggest project-overview for Phase 1 empty ecosystem', function () {
      const result = detectEcosystemPhase([], createMinimalAnalysis());
      const suggestion = suggestNextStep(result);
      assert.ok(suggestion !== null);
      assert.strictEqual(suggestion!.templateKey, 'project-overview');
      assert.strictEqual(suggestion!.fileType, 'steering');
    });

    it('should suggest security-policy for Phase 2', function () {
      const nodes = [
        makeSteeringNode('s1', 'steering-domain'),
        makeSteeringNode('s2', 'steering-tech'),
        makeSteeringNode('s3', 'steering-domain'),
      ];
      const result = detectEcosystemPhase(nodes, createMinimalAnalysis());
      const suggestion = suggestNextStep(result);
      assert.ok(suggestion !== null);
      // Phase 2 remaining: 3-domain-steerings (met), security-policy, flow-steering
      assert.strictEqual(suggestion!.fileType, 'steering');
    });

    it('should suggest hook for Phase 3 when hooks are missing', function () {
      const nodes = [
        makeSteeringNode('s1', 'steering-domain'),
        makeSteeringNode('s2', 'steering-flow'),
        makeSteeringNode('s3', 'steering-policy'),
        makeHookNode('h1'),
      ];
      const result = detectEcosystemPhase(nodes, createMinimalAnalysis());
      const suggestion = suggestNextStep(result);
      assert.ok(suggestion !== null);
    });

    it('should return null for Phase 5 with all criteria met', function () {
      const analysis = createMinimalAnalysis();
      analysis.qualityGate!.maturityLevel = 2;
      analysis.dmlProtection!.maturityLevel = 1;
      analysis.hookCoverageMap = {
        covered: Array.from({ length: 8 }, (_, i) => ({ event: `e${i}`, hookCount: 1 })),
        uncovered: [],
      };
      const nodes = [
        makeSteeringNode('s1', 'steering-domain'),
        makeHookNode('h1', 'fileEdited'),
        makeHookNode('h2', 'preToolUse'),
        makeHookNode('h3', 'postTaskExecution'),
        makeHookNode('h4', 'promptSubmit'),
        makeHookNode('h5', 'agentStop'),
      ];
      const result = detectEcosystemPhase(nodes, analysis);
      const suggestion = suggestNextStep(result);
      assert.strictEqual(suggestion, null);
    });

    it('should return correct suggestion for each phase', function () {
      // Phase 1
      const r1 = detectEcosystemPhase([], createMinimalAnalysis());
      const s1 = suggestNextStep(r1);
      assert.ok(s1 !== null);
      assert.strictEqual(s1!.targetDir, '.kiro/steering');

      // Phase 4
      const nodes4 = [
        makeSteeringNode('s1', 'steering-domain'),
        makeSteeringNode('s2', 'steering-flow'),
        makeSteeringNode('s3', 'steering-policy'),
        makeHookNode('h1', 'fileEdited'),
        makeHookNode('h2', 'preToolUse'),
        makeHookNode('h3', 'postTaskExecution'),
      ];
      const analysis4 = createMinimalAnalysis();
      analysis4.qualityGate!.maturityLevel = 1;
      const r4 = detectEcosystemPhase(nodes4, analysis4);
      const s4 = suggestNextStep(r4);
      assert.ok(s4 !== null);
    });
  });
});
