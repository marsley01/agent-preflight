import type { CheckDefinition, CheckResult, CheckStatus, CategoryResult, ProductionScore, ScoreCategory, RiskLevel } from './types';
import { CHECKS_BY_CATEGORY, ALL_CHECKS } from './checks/index';

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  critical: 10,
  high: 7,
  medium: 5,
  low: 3,
  info: 1,
};

const STATUS_PENALTY: Record<CheckStatus, number> = {
  pass: 0,
  info: 0.1,
  warn: 0.3,
  fail: 1,
};

export function scoreCategory(categoryId: string, results: CheckResult[]): { score: number; maxScore: number; passed: number; failed: number; warned: number; total: number } {
  const definitions = CHECKS_BY_CATEGORY[categoryId];
  if (!definitions || definitions.length === 0) {
    return { score: 0, maxScore: 0, passed: 0, failed: 0, warned: 0, total: 0 };
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  let passed = 0;
  let failed = 0;
  let warned = 0;

  for (const check of results) {
    const def = definitions.find(d => d.id === check.checkId);
    const weight = def?.weight ?? 5;
    const penalty = STATUS_PENALTY[check.status] ?? 1;

    totalWeight += weight;
    earnedWeight += weight * (1 - penalty);

    if (check.status === 'pass') passed++;
    else if (check.status === 'fail') failed++;
    else if (check.status === 'warn') warned++;
  }

  const score = totalWeight > 0 ? Math.round(earnedWeight) : 0;
  const maxScore = totalWeight;

  return { score, maxScore, passed, failed, warned, total: results.length };
}

export function calculateProductionScore(categoryResults: CategoryResult[]): ProductionScore {
  let overallScore = 0;
  let overallMax = 0;
  const categories: ScoreCategory[] = [];

  for (const cat of categoryResults) {
    const scoreCat: ScoreCategory = {
      id: cat.categoryId as any,
      label: cat.categoryLabel,
      score: cat.score,
      maxScore: cat.maxScore,
      percentage: cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0,
      riskCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        passed: cat.passed,
      },
    };

    for (const check of cat.checks) {
      if (check.status === 'fail') {
        const def = ALL_CHECKS.find(c => c.id === check.checkId);
        if (def) {
          if (def.risk === 'critical') scoreCat.riskCounts.critical++;
          else if (def.risk === 'high') scoreCat.riskCounts.high++;
          else if (def.risk === 'medium') scoreCat.riskCounts.medium++;
          else if (def.risk === 'low') scoreCat.riskCounts.low++;
        }
      }
    }

    categories.push(scoreCat);
    overallScore += cat.score;
    overallMax += cat.maxScore;
  }

  return {
    overall: overallScore,
    maxOverall: overallMax,
    percentage: overallMax > 0 ? Math.round((overallScore / overallMax) * 100) : 0,
    categories,
  };
}

export function getReadinessLabel(percentage: number): { label: string; color: string; description: string } {
  if (percentage >= 90) return { label: 'Production Ready', color: 'emerald', description: 'Safe to deploy. All critical checks pass.' };
  if (percentage >= 75) return { label: 'Near Ready', color: 'blue', description: 'Minor issues remain. Safe with caution.' };
  if (percentage >= 50) return { label: 'Needs Work', color: 'amber', description: 'Significant issues must be addressed before deployment.' };
  if (percentage >= 25) return { label: 'At Risk', color: 'orange', description: 'Critical issues found. Do not deploy.' };
  return { label: 'Unsafe', color: 'red', description: 'Severe vulnerabilities detected. Immediate action required.' };
}

export function getRiskLevel(percentage: number): RiskLevel {
  if (percentage >= 90) return 'low';
  if (percentage >= 75) return 'medium';
  if (percentage >= 50) return 'high';
  return 'critical';
}
