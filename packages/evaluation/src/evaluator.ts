import { v4 as uuidv4 } from "uuid";
import type { EvaluationMetric } from "@agent-preflight/types";
import type {
  EvalRunConfig,
  EvalDataset,
  EvalItem,
  EvalResult,
  EvalItemResult,
  EvalScore,
  ScoringCriteria,
} from "./types.js";
import { getMetricCalculator } from "./metrics.js";

export class Evaluator {
  private defaultConfig: EvalRunConfig = {
    metrics: [
      { metric: "ACCURACY", weight: 1.0 },
      { metric: "COMPLETENESS", weight: 0.8 },
      { metric: "REASONING", weight: 0.7 },
      { metric: "EFFICIENCY", weight: 0.5 },
      { metric: "SAFETY", weight: 1.5 },
      { metric: "HALLUCINATION_RISK", weight: 1.0 },
    ],
    model: "default",
    dataset: "",
    threshold: 0.7,
  };

  constructor(config?: Partial<EvalRunConfig>) {
    if (config) {
      this.defaultConfig = { ...this.defaultConfig, ...config };
    }
  }

  async evaluate(
    actualOutput: string,
    expectedOutput: string,
    config?: Partial<EvalRunConfig>,
  ): Promise<EvalResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const startTime = performance.now();

    const scores = await Promise.all(
      mergedConfig.metrics.map(async (metricConfig) => {
        const calculator = getMetricCalculator(metricConfig.metric);
        const score = await calculator.calculate(actualOutput, expectedOutput);
        return { ...score, weight: metricConfig.weight };
      }),
    );

    const duration = performance.now() - startTime;

    const overallScore = this.aggregate(scores, mergedConfig.scoringCriteria);
    const passed = this.determinePassFail(overallScore, mergedConfig.threshold);

    return {
      runId: uuidv4(),
      datasetId: "",
      model: mergedConfig.model,
      timestamp: new Date().toISOString(),
      duration,
      cost: 0,
      itemResults: [
        {
          itemIndex: 0,
          input: "",
          expectedOutput,
          actualOutput,
          scores,
          overallScore,
          passed,
          duration,
        },
      ],
      aggregateScores: scores,
      overallScore,
      passed,
      threshold: mergedConfig.threshold,
    };
  }

  async evaluateBatch(
    agentFn: (input: string) => Promise<string> | string,
    dataset: EvalDataset,
    config?: Partial<EvalRunConfig>,
  ): Promise<EvalResult> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const startTime = performance.now();

    const itemResults: EvalItemResult[] = [];
    let totalCost = 0;

    for (let i = 0; i < dataset.items.length; i++) {
      const item = dataset.items[i];
      try {
        const itemStart = performance.now();
        const actualOutput = await agentFn(item.input);
        const itemDuration = performance.now() - itemStart;

        const scores = await Promise.all(
          mergedConfig.metrics.map(async (metricConfig) => {
            const calculator = getMetricCalculator(metricConfig.metric);
            const score = await calculator.calculate(
              actualOutput,
              item.expectedOutput,
              item.context,
            );
            return { ...score, weight: metricConfig.weight };
          }),
        );

        const itemOverall = this.aggregate(scores, mergedConfig.scoringCriteria);
        const itemPassed = this.determine(itemOverall, mergedConfig.threshold);

        itemResults.push({
          itemIndex: i,
          input: item.input,
          expectedOutput: item.expectedOutput,
          actualOutput,
          scores,
          overallScore: itemOverall,
          passed: itemPassed,
          duration: itemDuration,
        });
      } catch (error) {
        itemResults.push({
          itemIndex: i,
          input: item.input,
          expectedOutput: item.expectedOutput,
          actualOutput: "",
          scores: [],
          overallScore: 0,
          passed: false,
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const duration = performance.now() - startTime;

    const aggregateScores = this.computeAggregateScores(itemResults, mergedConfig.metrics);
    const overallScore = this.aggregate(
      aggregateScores,
      mergedConfig.scoringCriteria,
    );
    const passed = this.determine(overallScore, mergedConfig.threshold);

    return {
      runId: uuidv4(),
      datasetId: dataset.id,
      model: mergedConfig.model,
      timestamp: new Date().toISOString(),
      duration,
      cost: totalCost,
      itemResults,
      aggregateScores,
      overallScore,
      passed,
      threshold: mergedConfig.threshold,
    };
  }

  score(actualOutput: string, expectedOutput: string): Promise<EvalScore[]> {
    return Promise.all(
      this.defaultConfig.metrics.map(async (metricConfig) => {
        const calculator = getMetricCalculator(metricConfig.metric);
        const score = await calculator.calculate(actualOutput, expectedOutput);
        return { ...score, weight: metricConfig.weight };
      }),
    );
  }

  aggregate(scores: EvalScore[], criteria?: ScoringCriteria): number {
    if (scores.length === 0) return 0;

    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight === 0) return 0;

    const weightedSum = scores.reduce((sum, s) => sum + s.value * s.weight, 0);
    let result = weightedSum / totalWeight;

    if (criteria?.confidenceRequired) {
      const avgConfidence =
        scores
          .filter((s) => s.confidence !== undefined)
          .reduce((sum, s) => sum + (s.confidence ?? 0), 0) /
        scores.filter((s) => s.confidence !== undefined).length;

      if (avgConfidence < criteria.confidenceRequired) {
        result *= avgConfidence / criteria.confidenceRequired;
      }
    }

    return Math.max(0, Math.min(1, result));
  }

  compare(a: EvalScore[], b: EvalScore[]): { winner: "A" | "B" | "TIE"; deltas: Map<string, number> } {
    const deltas = new Map<string, number>();
    let aTotal = 0;
    let bTotal = 0;

    for (const scoreA of a) {
      const scoreB = b.find((s) => s.metric === scoreA.metric);
      if (scoreB) {
        const delta = scoreA.value - scoreB.value;
        deltas.set(scoreA.metric, delta);
        aTotal += delta > 0 ? 1 : 0;
        bTotal += delta < 0 ? 1 : 0;
      }
    }

    const winner = aTotal > bTotal ? "A" : bTotal > aTotal ? "B" : "TIE";
    return { winner, deltas };
  }

  private determine(score: number, threshold: number): boolean {
    return score >= threshold;
  }

  private computeAggregateScores(
    results: EvalItemResult[],
    metricsConfig: EvalRunConfig["metrics"],
  ): EvalScore[] {
    const metricMap = new Map<string, { values: number[]; weight: number }>();

    for (const config of metricsConfig) {
      metricMap.set(config.metric, { values: [], weight: config.weight });
    }

    for (const item of results) {
      for (const score of item.scores) {
        const entry = metricMap.get(score.metric);
        if (entry) {
          entry.values.push(score.value ?? 0);
        }
      }
    }

    return Array.from(metricMap.entries()).map(([metric, entry]) => {
      const avg =
        entry.values.length > 0
          ? entry.values.reduce((a, b) => a + b, 0) / entry.values.length
          : 0;
      return {
        metric: metric as EvaluationMetric,
        value: avg,
        weight: entry.weight,
        rationale: `average over ${entry.values.length} items`,
      };
    });
  }
}