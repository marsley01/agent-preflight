import type { Duration, Timestamp, Percentage, EvaluationMetric } from "@agent-preflight/types";

// ─── Evaluation Run Configuration ────────────────────────────────────────────

export interface EvalRunConfig {
  metrics: EvalMetricConfig[];
  model: string;
  dataset: string;
  scoringCriteria?: ScoringCriteria | undefined;
  threshold: number;
}

export interface EvalMetricConfig {
  metric: EvaluationMetric;
  weight: number;
  threshold?: number | undefined;
  params?: Record<string, unknown> | undefined;
}

export interface ScoringCriteria {
  overallWeighted: boolean;
  failIfAnyBelow: number;
  confidenceRequired: number;
}

// ─── Dataset ─────────────────────────────────────────────────────────────────

export interface EvalDataset {
  id: string;
  name: string;
  description: string;
  items: EvalItem[];
  version?: string | undefined;
  createdAt?: Timestamp | undefined;
  tags?: string[] | undefined;
}

export interface EvalItem {
  input: string;
  expectedOutput: string;
  context?: Record<string, unknown> | undefined;
  tags?: string[] | undefined;
}

// ─── Results ─────────────────────────────────────────────────────────────────

export interface EvalResult {
  runId: string;
  datasetId: string;
  model: string;
  timestamp: Timestamp;
  duration: number;
  cost: number;
  itemResults: EvalItemResult[];
  aggregateScores: EvalScore[];
  overallScore: number;
  passed: boolean;
  threshold: number;
}

export interface EvalItemResult {
  itemIndex: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  scores: EvalScore[];
  overallScore: number;
  passed: boolean;
  duration: number;
  error?: string | undefined;
}

// ─── Scores ──────────────────────────────────────────────────────────────────

export interface EvalScore {
  metric: EvaluationMetric;
  value: number;
  weight: number;
  confidence?: number | undefined;
  confidenceInterval?: ConfidenceInterval | undefined;
  rationale?: string | undefined;
  details?: Record<string, unknown> | undefined;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidenceLevel: number;
}

// ─── Report ──────────────────────────────────────────────────────────────────

export interface EvalReport {
  id: string;
  title: string;
  run: EvalResult;
  summary: EvalReportSummary;
  detailedScores: EvalScore[];
  recommendations: string[];
  generatedAt: Timestamp;
}

export interface EvalReportSummary {
  overallScore: number;
  passed: boolean;
  totalItems: number;
  passedItems: number;
  failedItems: number;
  averageItemScore: number;
  medianItemScore: number;
  stdDevScore: number;
  totalDuration: number;
  totalCost: number;
  strengths: string[];
  weaknesses: string[];
}

// ─── Benchmark ───────────────────────────────────────────────────────────────

export interface BenchmarkResult {
  benchmarkId: string;
  name: string;
  description: string;
  results: EvalResult[];
  aggregate: EvalScore[];
  duration: number;
}

export interface ComparisonResult {
  comparisonId: string;
  agents: string[];
  results: Map<string, EvalResult>;
  winner: string;
  scoreDeltas: Map<string, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export interface EvalMetricCalculator {
  readonly name: EvaluationMetric;
  calculate(actual: string, expected: string, context?: Record<string, unknown>): Promise<EvalScore>;
}