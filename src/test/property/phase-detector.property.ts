import * as assert from 'assert';
import * as fc from 'fast-check';

import {
  detectEcosystemPhase,
  suggestNextStep,
} from '../../services/phaseDetector';
import type { GraphNode, CognitiveAnalysisResult } from '../../types';

/**
 * Generates a minimal CognitiveAnalysisResult with configurable maturity levels.
 */
function buildAnalysis(params: {
  qualityGateLevel?: 0 | 1 | 2;
  dmlLevel?: 0 | 1 | 2;
  hooksCovered?: number;
}): CognitiveAnalysisResult {
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
    hookCoverageMap: {
      covered: Array.from({ length: params.hooksCovered || 0 }, (_, i) => ({ event: `e${i}`, hookCount: 1 })),
      uncovered: [],
    },
    decisionPathCompleteness: {
      hooksWithoutDecisionSteering: [],
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

const STEERING_TYPES = [
  'steering-flow', 'steering-domain', 'steering-tech',
  'steering-policy', 'steering-product', 'steering-agent',
  'steering-help', 'steering-playbook', 'steering-observability',
] as const;

const HOOK_TYPES = ['hook-auto', 'hook-manual'] as const;

const HOOK_EVENTS = [
  'fileEdited', 'fileCreated', 'fileDeleted', 'userTriggered',
  'promptSubmit', 'agentStop', 'preToolUse', 'postToolUse',
  'preTaskExecution', 'postTaskExecution',
];

/**
 * Arbitrary for generating a random steering node.
 */
const steeringNodeArb = fc.record({
  idx: fc.nat({ max: 999 }),
  type: fc.constantFrom(...STEERING_TYPES),
}).map(({ idx, type }): GraphNode => ({
  id: `steering-${idx}`,
  label: `steering-${idx}`,
  type,
  workspaceFolder: 'Workspace',
  filePath: `.kiro/steering/steering-${idx}.md`,
  resolved: true,
  source: 'local',
}));

/**
 * Arbitrary for generating a random hook node.
 */
const hookNodeArb = fc.record({
  idx: fc.nat({ max: 999 }),
  type: fc.constantFrom(...HOOK_TYPES),
  whenType: fc.constantFrom(...HOOK_EVENTS),
}).map(({ idx, type, whenType }): GraphNode => ({
  id: `hook-${idx}`,
  label: `hook-${idx}`,
  type,
  workspaceFolder: 'Workspace',
  filePath: `.kiro/hooks/hook-${idx}.json`,
  resolved: true,
  source: 'local',
  metadata: { whenType },
}));

/**
 * Arbitrary for generating a mixed array of nodes.
 */
const nodesArb = fc.array(fc.oneof(steeringNodeArb, hookNodeArb), { maxLength: 30 });

/**
 * Arbitrary for analysis maturity levels.
 */
const analysisArb = fc.record({
  qualityGateLevel: fc.constantFrom(0 as const, 1 as const, 2 as const),
  dmlLevel: fc.constantFrom(0 as const, 1 as const, 2 as const),
  hooksCovered: fc.nat({ max: 10 }),
}).map(buildAnalysis);

describe('PhaseDetector — Property-Based Tests', function () {
  /**
   * **Validates: Requirements 1.1**
   * Property: phase is always in [1, 5] for any input.
   */
  it('phase is always in [1, 5] for any input', function () {
    fc.assert(
      fc.property(nodesArb, analysisArb, (nodes, analysis) => {
        const result = detectEcosystemPhase(nodes, analysis);
        assert.ok(result.phase >= 1 && result.phase <= 5,
          `Phase ${result.phase} out of range [1, 5]`);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 1.7**
   * Property: progressPercent is always in [0, 100].
   */
  it('progressPercent is always in [0, 100]', function () {
    fc.assert(
      fc.property(nodesArb, analysisArb, (nodes, analysis) => {
        const result = detectEcosystemPhase(nodes, analysis);
        assert.ok(result.progressPercent >= 0 && result.progressPercent <= 100,
          `Progress ${result.progressPercent} out of range [0, 100]`);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 1.1**
   * Property: adding more nodes never decreases the phase (monotonic).
   */
  it('adding more nodes never decreases the phase (monotonic)', function () {
    fc.assert(
      fc.property(nodesArb, nodesArb, analysisArb, (baseNodes, extraNodes, analysis) => {
        const resultBase = detectEcosystemPhase(baseNodes, analysis);
        const combined = [...baseNodes, ...extraNodes];
        const resultCombined = detectEcosystemPhase(combined, analysis);
        assert.ok(resultCombined.phase >= resultBase.phase,
          `Phase decreased from ${resultBase.phase} to ${resultCombined.phase} after adding nodes`);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 3.4**
   * Property: suggestNextStep is non-null for phases 1-4.
   */
  it('suggestNextStep is non-null for phases 1-4', function () {
    fc.assert(
      fc.property(nodesArb, analysisArb, (nodes, analysis) => {
        const result = detectEcosystemPhase(nodes, analysis);
        if (result.phase < 5 || result.criteriaRemaining.length > 0) {
          const suggestion = suggestNextStep(result);
          if (result.criteriaRemaining.length > 0) {
            assert.ok(suggestion !== null,
              `suggestNextStep returned null for phase ${result.phase} with remaining criteria`);
          }
        }
      }),
      { numRuns: 200 },
    );
  });
});
