// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  EvalRunConfig,
  EvalMetricConfig,
  ScoringCriteria,
  EvalDataset,
  EvalItem,
  EvalResult,
  EvalItemResult,
  EvalScore,
  ConfidenceInterval,
  EvalReport,
  EvalReportSummary,
  BenchmarkResult,
  ComparisonResult,
  EvalMetricCalculator,
} from "./types.js";

// ─── Metrics ─────────────────────────────────────────────────────────────────
export {
  AccuracyMetric,
  CompletenessMetric,
  ReasoningMetric,
  CitationQualityMetric,
  ToolUsageMetric,
  EfficiencyMetric,
  SafetyMetric,
  HallucinationRiskMetric,
  ConfidenceMetric,
  LatencyMetric,
  getMetricCalculator,
  listAvailableMetrics,
} from "./metrics.js";

// ─── Evaluator ───────────────────────────────────────────────────────────────
export { Evaluator } from "./evaluator.js";

// ─── Dataset ─────────────────────────────────────────────────────────────────
export { DatasetManager } from "./dataset.js";
export type { DatasetSplit } from "./dataset.js";

// ─── Runner ──────────────────────────────────────────────────────────────────
export { EvalRunner } from "./runner.js";

// ─── Report ──────────────────────────────────────────────────────────────────
export { ReportGenerator } from "./report.js";