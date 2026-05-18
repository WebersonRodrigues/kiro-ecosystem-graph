import type {
  GraphNode,
  CognitiveAnalysisResult,
  EcosystemPhaseNumber,
  EcosystemPhaseResult,
  NextStepSuggestion,
} from '../types';

/**
 * Phase names indexed by phase number.
 */
const PHASE_NAMES: Record<EcosystemPhaseNumber, string> = {
  1: 'Foundation',
  2: 'Domain Knowledge',
  3: 'Flows & Security',
  4: 'Automation',
  5: 'Evolution',
};

/**
 * Detect the current ecosystem maturity phase based on graph nodes and analysis.
 */
export function detectEcosystemPhase(
  nodes: GraphNode[],
  analysisResult: CognitiveAnalysisResult,
): EcosystemPhaseResult {
  const steerings = nodes.filter(n => n.type?.startsWith('steering-'));
  const hooks = nodes.filter(n => n.type === 'hook-auto' || n.type === 'hook-manual');
  const hasFlowOrPolicy = steerings.some(
    n => n.type === 'steering-flow' || n.type === 'steering-policy',
  );
  const hookEventCount = analysisResult.hookCoverageMap?.covered.length ?? 0;
  const qualityLevel = analysisResult.qualityGate?.maturityLevel ?? 0;
  const dmlLevel = analysisResult.dmlProtection?.maturityLevel ?? 0;

  if (hookEventCount >= 5 && qualityLevel === 2 && dmlLevel >= 1) {
    return buildPhaseResult(5, nodes, analysisResult);
  }
  if (hooks.length >= 3 && qualityLevel >= 1) {
    return buildPhaseResult(4, nodes, analysisResult);
  }
  if (hasFlowOrPolicy && hooks.length >= 1) {
    return buildPhaseResult(3, nodes, analysisResult);
  }
  if (steerings.length > 2) {
    return buildPhaseResult(2, nodes, analysisResult);
  }
  return buildPhaseResult(1, nodes, analysisResult);
}

/**
 * Build a complete phase result with progress and criteria.
 */
function buildPhaseResult(
  phase: EcosystemPhaseNumber,
  nodes: GraphNode[],
  analysisResult: CognitiveAnalysisResult,
): EcosystemPhaseResult {
  const { met, remaining } = computeCriteria(phase, nodes, analysisResult);
  return {
    phase,
    phaseName: PHASE_NAMES[phase],
    progressPercent: computePhaseProgress(phase, nodes, analysisResult),
    criteriaMet: met,
    criteriaRemaining: remaining,
  };
}

/**
 * Compute progress percentage (0-100) within the current phase.
 */
export function computePhaseProgress(
  phase: EcosystemPhaseNumber,
  nodes: GraphNode[],
  analysisResult: CognitiveAnalysisResult,
): number {
  const { met, remaining } = computeCriteria(phase, nodes, analysisResult);
  const total = met.length + remaining.length;
  if (total === 0) { return 100; }
  return Math.round((met.length / total) * 100);
}

/**
 * Compute met and remaining criteria for a given phase.
 */
function computeCriteria(
  phase: EcosystemPhaseNumber,
  nodes: GraphNode[],
  analysisResult: CognitiveAnalysisResult,
): { met: string[]; remaining: string[] } {
  const steerings = nodes.filter(n => n.type?.startsWith('steering-'));
  const hooks = nodes.filter(n => n.type === 'hook-auto' || n.type === 'hook-manual');
  const met: string[] = [];
  const remaining: string[] = [];

  switch (phase) {
  case 1:
    computePhase1Criteria(steerings, met, remaining);
    break;
  case 2:
    computePhase2Criteria(steerings, met, remaining);
    break;
  case 3:
    computePhase3Criteria(steerings, hooks, met, remaining);
    break;
  case 4:
    computePhase4Criteria(hooks, analysisResult, met, remaining);
    break;
  case 5:
    computePhase5Criteria(analysisResult, met, remaining);
    break;
  }

  return { met, remaining };
}

function computePhase1Criteria(
  steerings: GraphNode[],
  met: string[],
  remaining: string[],
): void {
  const hasProjectOverview = steerings.some(
    n => n.label.toLowerCase().includes('project-overview') || n.label.toLowerCase().includes('project overview'),
  );
  const hasCodeConventions = steerings.some(
    n => n.label.toLowerCase().includes('code-conventions') || n.label.toLowerCase().includes('code conventions'),
  );
  const hasDomainSteering = steerings.some(
    n => n.type === 'steering-domain' || n.type === 'steering-tech',
  );

  hasProjectOverview ? met.push('project-overview') : remaining.push('project-overview');
  hasCodeConventions ? met.push('code-conventions') : remaining.push('code-conventions');
  hasDomainSteering ? met.push('domain-steering') : remaining.push('domain-steering');
}

function computePhase2Criteria(
  steerings: GraphNode[],
  met: string[],
  remaining: string[],
): void {
  const domainTech = steerings.filter(
    n => n.type === 'steering-domain' || n.type === 'steering-tech',
  );
  domainTech.length >= 3 ? met.push('3-domain-steerings') : remaining.push('3-domain-steerings');

  const hasPolicy = steerings.some(n => n.type === 'steering-policy');
  hasPolicy ? met.push('security-policy') : remaining.push('security-policy');

  const hasFlow = steerings.some(n => n.type === 'steering-flow');
  hasFlow ? met.push('flow-steering') : remaining.push('flow-steering');
}

function computePhase3Criteria(
  steerings: GraphNode[],
  hooks: GraphNode[],
  met: string[],
  remaining: string[],
): void {
  const hasFlow = steerings.some(n => n.type === 'steering-flow');
  const hasPolicy = steerings.some(n => n.type === 'steering-policy');
  hasFlow ? met.push('flow-steering') : remaining.push('flow-steering');
  hasPolicy ? met.push('security-policy') : remaining.push('security-policy');
  hooks.length >= 1 ? met.push('first-hook') : remaining.push('first-hook');
  hooks.length >= 3 ? met.push('3-hooks') : remaining.push('3-hooks');
}

function computePhase4Criteria(
  hooks: GraphNode[],
  analysisResult: CognitiveAnalysisResult,
  met: string[],
  remaining: string[],
): void {
  const qualityLevel = analysisResult.qualityGate?.maturityLevel ?? 0;
  const hookEventCount = analysisResult.hookCoverageMap?.covered.length ?? 0;

  hooks.length >= 3 ? met.push('3-hooks') : remaining.push('3-hooks');
  qualityLevel >= 1 ? met.push('quality-gate-partial') : remaining.push('quality-gate-partial');
  hookEventCount >= 5 ? met.push('hook-coverage-5') : remaining.push('hook-coverage-5');
  qualityLevel === 2 ? met.push('quality-gate-complete') : remaining.push('quality-gate-complete');
}

function computePhase5Criteria(
  analysisResult: CognitiveAnalysisResult,
  met: string[],
  remaining: string[],
): void {
  const hookEventCount = analysisResult.hookCoverageMap?.covered.length ?? 0;
  const qualityLevel = analysisResult.qualityGate?.maturityLevel ?? 0;
  const dmlLevel = analysisResult.dmlProtection?.maturityLevel ?? 0;

  hookEventCount >= 5 ? met.push('hook-coverage-5') : remaining.push('hook-coverage-5');
  qualityLevel === 2 ? met.push('quality-gate-complete') : remaining.push('quality-gate-complete');
  dmlLevel >= 1 ? met.push('dml-protection') : remaining.push('dml-protection');
  hookEventCount >= 8 ? met.push('hook-coverage-8') : remaining.push('hook-coverage-8');
}

/**
 * Priority-ordered suggestions for next step based on remaining criteria.
 */
const SUGGESTION_MAP: { criteria: string; suggestion: NextStepSuggestion }[] = [
  {
    criteria: 'project-overview',
    suggestion: {
      fileName: 'project-overview.md',
      fileType: 'steering',
      description: 'Describe your project, stack, and conventions',
      templateKey: 'project-overview',
      targetDir: '.kiro/steering',
    },
  },
  {
    criteria: 'code-conventions',
    suggestion: {
      fileName: 'code-conventions.md',
      fileType: 'steering',
      description: 'Define coding conventions and formatting rules',
      templateKey: 'domain-knowledge',
      targetDir: '.kiro/steering',
    },
  },
  {
    criteria: 'domain-steering',
    suggestion: {
      fileName: 'domain-knowledge.md',
      fileType: 'steering',
      description: 'Document domain rules and business logic',
      templateKey: 'domain-knowledge',
      targetDir: '.kiro/steering',
    },
  },
  {
    criteria: '3-domain-steerings',
    suggestion: {
      fileName: 'domain-knowledge.md',
      fileType: 'steering',
      description: 'Add more domain/tech steerings (need 3+)',
      templateKey: 'domain-knowledge',
      targetDir: '.kiro/steering',
    },
  },
  {
    criteria: 'security-policy',
    suggestion: {
      fileName: 'security-policy.md',
      fileType: 'steering',
      description: 'Define security rules and access policies',
      templateKey: 'security-policy',
      targetDir: '.kiro/steering',
    },
  },
  {
    criteria: 'flow-steering',
    suggestion: {
      fileName: 'flow-steering.md',
      fileType: 'steering',
      description: 'Document workflow steps and process flows',
      templateKey: 'flow-steering',
      targetDir: '.kiro/steering',
    },
  },
  {
    criteria: 'first-hook',
    suggestion: {
      fileName: 'pre-tool-use.json',
      fileType: 'hook',
      description: 'Add a preToolUse hook for automated validation',
      templateKey: 'pre-tool-use-hook',
      targetDir: '.kiro/hooks',
    },
  },
  {
    criteria: '3-hooks',
    suggestion: {
      fileName: 'post-task-execution.json',
      fileType: 'hook',
      description: 'Add more hooks covering different events',
      templateKey: 'post-task-hook',
      targetDir: '.kiro/hooks',
    },
  },
  {
    criteria: 'quality-gate-partial',
    suggestion: {
      fileName: 'pre-tool-use.json',
      fileType: 'hook',
      description: 'Add a quality gate hook (preToolUse/postToolUse)',
      templateKey: 'pre-tool-use-hook',
      targetDir: '.kiro/hooks',
    },
  },
  {
    criteria: 'hook-coverage-5',
    suggestion: {
      fileName: 'post-task-execution.json',
      fileType: 'hook',
      description: 'Increase hook coverage to 5+ IDE events',
      templateKey: 'post-task-hook',
      targetDir: '.kiro/hooks',
    },
  },
  {
    criteria: 'quality-gate-complete',
    suggestion: {
      fileName: 'post-task-execution.json',
      fileType: 'hook',
      description: 'Complete quality gate (post-task review hook)',
      templateKey: 'post-task-hook',
      targetDir: '.kiro/hooks',
    },
  },
  {
    criteria: 'dml-protection',
    suggestion: {
      fileName: 'pre-tool-use.json',
      fileType: 'hook',
      description: 'Add DML protection hook for database safety',
      templateKey: 'pre-tool-use-hook',
      targetDir: '.kiro/hooks',
    },
  },
  {
    criteria: 'hook-coverage-8',
    suggestion: {
      fileName: 'post-task-execution.json',
      fileType: 'hook',
      description: 'Increase hook coverage to 8+ IDE events',
      templateKey: 'post-task-hook',
      targetDir: '.kiro/hooks',
    },
  },
];

/**
 * Suggest the next step based on remaining criteria.
 * Returns null when Phase 5 is fully complete.
 */
export function suggestNextStep(
  phaseResult: EcosystemPhaseResult,
): NextStepSuggestion | null {
  if (phaseResult.criteriaRemaining.length === 0) {
    return null;
  }

  for (const entry of SUGGESTION_MAP) {
    if (phaseResult.criteriaRemaining.includes(entry.criteria)) {
      return entry.suggestion;
    }
  }

  return null;
}
