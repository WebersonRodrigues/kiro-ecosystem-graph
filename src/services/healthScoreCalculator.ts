import {
  CognitiveAnalysisResult,
  UnifiedHealthScore,
  ScoreTrend,
  DailySnapshot,
} from '../types';

/**
 * Computes the connectivity sub-score (0-100).
 * Proportion of nodes without structural issues relative to total nodes.
 */
export function computeConnectivitySubScore(
  data: CognitiveAnalysisResult,
  totalNodes: number,
): number {
  if (totalNodes === 0) {
    return 0;
  }
  const issueCount =
    data.steeringsSoltos.length +
    data.arquivosSemContexto.length +
    data.coverageGaps.length +
    data.deadLoops.length +
    data.hopsToReach.length;
  return Math.round(Math.max(0, 100 - (issueCount / totalNodes) * 100));
}

/**
 * Computes the content quality sub-score (0-100).
 * Proportion of nodes without content issues relative to total nodes.
 */
export function computeContentQualitySubScore(
  data: CognitiveAnalysisResult,
  totalNodes: number,
): number {
  if (totalNodes === 0) {
    return 0;
  }
  const issueCount =
    data.passiveKnowledge.length +
    data.signalToNoise.length +
    data.duplicateIntent.length +
    data.contradictions.length;
  return Math.round(Math.max(0, 100 - (issueCount / totalNodes) * 100));
}

/**
 * Computes the completeness sub-score (0-100).
 * Proportion of nodes without completeness issues relative to total nodes.
 */
export function computeCompletenessSubScore(
  data: CognitiveAnalysisResult,
  totalNodes: number,
): number {
  if (totalNodes === 0) {
    return 0;
  }
  const issueCount =
    data.hooksWithoutInstruction.length +
    data.steeringsWithoutAccess.length +
    data.weakInstructions.length +
    data.contextOverload.length;
  return Math.round(Math.max(0, 100 - (issueCount / totalNodes) * 100));
}

/**
 * Computes the maturity sub-score (0-100).
 * Based on quality gate, DML protection, hook coverage, and decision path.
 */
export function computeMaturitySubScore(data: CognitiveAnalysisResult): number {
  const qualityGateScore =
    ((data.qualityGate?.maturityLevel ?? 0) / 2) * 100;

  const dmlProtectionScore =
    ((data.dmlProtection?.maturityLevel ?? 0) / 2) * 100;

  const hookCoverageScore = data.hookCoverageMap
    ? (data.hookCoverageMap.covered.length / 10) * 100
    : 0;

  const totalDecisionIssues =
    (data.decisionPathCompleteness?.hooksWithoutDecisionSteering?.length ?? 0) +
    (data.decisionPathCompleteness?.steeringsWithoutHook?.length ?? 0);
  const decisionPathScore = totalDecisionIssues === 0
    ? 100
    : Math.max(0, 100 - totalDecisionIssues * 20);

  const raw =
    (qualityGateScore + dmlProtectionScore + hookCoverageScore + decisionPathScore) / 4;
  return Math.round(raw);
}

/**
 * Computes the unified health score from all cognitive analysis data.
 * Formula: connectivity×0.3 + contentQuality×0.25 + completeness×0.25 + maturity×0.2
 */
export function computeUnifiedHealthScore(
  data: CognitiveAnalysisResult,
  totalNodes: number,
): UnifiedHealthScore {
  if (totalNodes === 0) {
    return { score: 0, connectivity: 0, contentQuality: 0, completeness: 0, maturity: 0 };
  }

  const connectivity = computeConnectivitySubScore(data, totalNodes);
  const contentQuality = computeContentQualitySubScore(data, totalNodes);
  const completeness = computeCompletenessSubScore(data, totalNodes);
  const maturity = computeMaturitySubScore(data);

  const score = Math.round(
    connectivity * 0.3 +
    contentQuality * 0.25 +
    completeness * 0.25 +
    maturity * 0.2,
  );

  return { score, connectivity, contentQuality, completeness, maturity };
}

/**
 * Computes the score trend by comparing current score with the most recent
 * snapshot that has a healthScore defined.
 * Returns null if no previous snapshot with healthScore exists.
 */
export function computeScoreTrend(
  currentScore: number,
  snapshots: DailySnapshot[],
): ScoreTrend | null {
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const snap = snapshots[i];
    if (snap.healthScore !== undefined) {
      const delta = currentScore - snap.healthScore;
      const direction: ScoreTrend['direction'] =
        delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
      return { direction, delta: Math.abs(delta), previousScore: snap.healthScore };
    }
  }
  return null;
}
