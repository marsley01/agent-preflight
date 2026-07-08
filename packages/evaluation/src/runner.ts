import { v4 as uuidv4 } from "uuid";
import { Evaluator } from "./evaluator.js";
import { DatasetManager } from "./dataset.js";
import { ReportGenerator } from "./report.js";
import type {
  EvalRunConfig,
  EvalDataset,
  EvalResult,
  EvalItem,
  EvalReport,
  ComparisonResult,
  BenchmarkResult,
} from "./types.js";

type AgentFn = (input: string) => Promise<string> | string;

export class EvalRunner {
  private evaluator: Evaluator;
  private datasetManager: DatasetManager;
  private reportGenerator: ReportGenerator;

  constructor(config?: Partial<EvalRunConfig>) {
    this.evaluator = new Evaluator(config);
    this.datasetManager = new DatasetManager();
    this.reportGenerator = new ReportGenerator();
  }

  getEvaluator(): Evaluator {
    return this.evaluator;
  }

  getDatasetManager(): DatasetManager {
    return this.datasetManager;
  }

  getReportGenerator(): ReportGenerator {
    return this.reportGenerator;
  }

  async runEvaluation(
    agent: AgentFn,
    dataset: EvalDataset,
    config?: Partial<EvalRunConfig>,
  ): Promise<EvalResult> {
    return this.evaluator.evaluateBatch(agent, dataset, config);
  }

  async runBenchmark(
    name: string,
    description: string,
    agent: AgentFn,
    datasets: EvalDataset[],
    config?: Partial<EvalRunConfig>,
  ): Promise<BenchmarkResult> {
    const results: EvalResult[] = [];

    for (const dataset of datasets) {
      const runConfig = { ...config, model: config?.model ?? dataset.name };
      const result = await this.runEvaluation(agent, dataset, runConfig);
      results.push(result);
    }

    const aggregateScores = this.computeBenchmarkScores(results);

    return {
      benchmarkId: uuidv4(),
      name,
      description,
      results,
      aggregate: aggregateScores,
      duration: results.reduce((sum, r) => sum + r.duration, 0),
    };
  }

  async runComparison(
    agents: Map<string, AgentFn>,
    dataset: EvalDataset,
    config?: Partial<EvalRunConfig>,
  ): Promise<ComparisonResult> {
    const results = new Map<string, EvalResult>();

    for (const [agentName, agentFn] of agents) {
      const result = await this.runEvaluation(agentFn, dataset, config);
      results.set(agentName, result);
    }

    const scoreDeltas = new Map<string, number>();
    let bestAgent = "";
    let bestScore = -1;

    for (const [name, result] of results) {
      scoreDeltas.set(name, result.overallScore);
      if (result.overallScore > bestScore) {
        bestScore = result.overallScore;
        bestAgent = name;
      }
    }

    // Compute deltas from winner
    for (const [name] of results) {
      const result = results.get(name)!;
      scoreDeltas.set(name, result.overallScore - bestScore);
    }

    return {
      comparisonId: uuidv4(),
      agents: Array.from(agents.keys()),
      results,
      winner: bestAgent,
      scoreDeltas,
    };
  }

  async generateReport(result: EvalResult, title?: string): Promise<EvalReport> {
    return this.reportGenerator.generateDetailedReport(result, title);
  }

  async generateComparisonReport(
    comparison: ComparisonResult,
    title?: string,
  ): Promise<EvalReport> {
    return this.reportGenerator.generateComparisonReport(comparison, title);
  }

  private computeBenchmarkScores(results: EvalResult[]): import("./types.js").EvalScore[] {
    const metricMap = new Map<
      string,
      { values: number[]; weight: number }
    >();

    for (const result of results) {
      for (const score of result.aggregateScores) {
        const entry = metricMap.get(score.metric);
        if (entry) {
          entry.values.push(score.value);
        } else {
          metricMap.set(score.metric, {
            values: [score.value],
            weight: score.weight,
          });
        }
      }
    }

    return Array.from(metricMap.entries()).map(([metric, entry]) => ({
      metric: metric as import("@agent-preflight/types").EvaluationMetric,
      value:
        entry.values.reduce((a, b) => a + b, 0) / entry.values.length,
      weight: entry.weight,
      rationale: `aggregated over ${results.length} dataset(s)`,
    }));
  }
}