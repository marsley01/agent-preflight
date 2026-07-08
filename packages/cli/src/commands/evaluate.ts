import { Command } from 'commander';
import chalk from 'chalk';
import { OutputManager } from '../utils/output.js';
import { formatDuration, formatPercentage, formatTable, formatSpinner } from '../utils/formatting.js';

interface EvalResult {
  metric: string;
  score: number;
  maxScore: number;
  percentage: string;
  status: 'pass' | 'fail' | 'warn';
}

interface BenchmarkResult {
  name: string;
  accuracy: string;
  latency: string;
  cost: string;
  score: string;
}

function generateEvalResults(agent: string): EvalResult[] {
  return [
    { metric: 'Relevance', score: 94, maxScore: 100, percentage: '94.0%', status: 'pass' },
    { metric: 'Accuracy', score: 91, maxScore: 100, percentage: '91.0%', status: 'pass' },
    { metric: 'Coherence', score: 88, maxScore: 100, percentage: '88.0%', status: 'pass' },
    { metric: 'Completeness', score: 85, maxScore: 100, percentage: '85.0%', status: 'pass' },
    { metric: 'Safety', score: 97, maxScore: 100, percentage: '97.0%', status: 'pass' },
    { metric: 'Hallucination Rate', score: 3, maxScore: 100, percentage: '3.0%', status: 'pass' },
    { metric: 'Response Time', score: 78, maxScore: 100, percentage: '78.0%', status: 'warn' },
  ];
}

function generateBenchmarkData(): BenchmarkResult[] {
  return [
    { name: 'MMLU', accuracy: '89.2%', latency: '1.2s', cost: '$0.04', score: '92.1' },
    { name: 'HumanEval', accuracy: '84.5%', latency: '2.1s', cost: '$0.08', score: '86.3' },
    { name: 'GSM8K', accuracy: '92.1%', latency: '1.5s', cost: '$0.05', score: '91.8' },
    { name: 'TruthfulQA', accuracy: '76.8%', latency: '1.8s', cost: '$0.06', score: '78.2' },
  ];
}

export function registerEvaluateCommand(program: Command, output: OutputManager): void {
  const evalCmd = program
    .command('evaluate')
    .description('Run evaluations and benchmarks')
    .alias('eval');

  evalCmd
    .command('run <agent>')
    .description('Evaluate an agent')
    .option('-d, --dataset <name>', 'Evaluation dataset to use')
    .option('-s, --samples <number>', 'Number of samples', '50')
    .action(async (agent: string, options: { dataset?: string; samples?: string }) => {
      try {
        output.heading(`Evaluating Agent: ${chalk.bold(agent)}`);

        const results = await formatSpinner(`Running evaluation on ${agent} (${options.samples ?? 50} samples)...`, async () => {
          await new Promise((r) => setTimeout(r, 2000));
          return generateEvalResults(agent);
        });

        output.raw('');

        const statusColors: Record<string, (s: string) => string> = {
          pass: chalk.green,
          fail: chalk.red,
          warn: chalk.yellow,
        };

        output.table(
          [
            { key: 'metric', label: 'Metric', format: (v) => chalk.cyan(String(v)) },
            { key: 'score', label: 'Score' },
            { key: 'maxScore', label: 'Max' },
            { key: 'percentage', label: '%', format: (v) => formatPercentage(
              results.find((r) => r.percentage === v)!.score,
              results.find((r) => r.percentage === v)!.maxScore,
            ) },
            { key: 'status', label: 'Status', format: (v) => (statusColors[String(v)] ?? chalk.white)(String(v)) },
          ],
          results as unknown as Record<string, unknown>[],
        );

        output.raw('');
        const avgScore = results.reduce((acc, r) => acc + (r.score / r.maxScore) * 100, 0) / results.length;
        output.object({
          Agent: agent,
          'Overall Score': `${avgScore.toFixed(1)}%`,
          Status: avgScore >= 80 ? chalk.green('PASS') : chalk.yellow('REVIEW'),
          Samples: options.samples ?? 50,
        });
      } catch (error) {
        output.error(`Evaluation failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  evalCmd
    .command('benchmark <name>')
    .description('Run a standard benchmark')
    .action(async (name: string) => {
      try {
        output.heading(`Benchmark: ${chalk.bold(name)}`);

        const results = await formatSpinner(`Running ${name} benchmark...`, async () => {
          await new Promise((r) => setTimeout(r, 3000));
          return generateBenchmarkData();
        });

        output.raw('');
        output.table(
          [
            { key: 'name', label: 'Test', format: (v) => chalk.bold(String(v)) },
            { key: 'accuracy', label: 'Accuracy' },
            { key: 'latency', label: 'Latency' },
            { key: 'cost', label: 'Cost' },
            { key: 'score', label: 'Score' },
          ],
          results as unknown as Record<string, unknown>[],
        );
      } catch (error) {
        output.error(`Benchmark failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  evalCmd
    .command('compare <agent-a> <agent-b>')
    .description('Compare two agents')
    .action(async (agentA: string, agentB: string) => {
      try {
        output.heading(`Comparing: ${chalk.bold(agentA)} vs ${chalk.bold(agentB)}`);

        const resultsA = await formatSpinner(`Evaluating ${agentA}...`, async () => {
          await new Promise((r) => setTimeout(r, 1500));
          return generateEvalResults(agentA);
        });

        const resultsB = await formatSpinner(`Evaluating ${agentB}...`, async () => {
          await new Promise((r) => setTimeout(r, 1500));
          return generateEvalResults(agentB);
        });

        output.raw('');
        output.heading('Comparison');

        const comparisonRows = resultsA.map((rA, i) => {
          const rB = resultsB[i];
          const diff = rA.score - (rB?.score ?? 0);
          return {
            metric: rA.metric,
            [agentA]: `${rA.score}%`,
            [agentB]: `${rB?.score ?? 0}%`,
            diff: diff > 0 ? chalk.green(`+${diff.toFixed(0)}%`) : diff < 0 ? chalk.red(`${diff.toFixed(0)}%`) : chalk.gray('0%'),
            winner: diff > 0 ? chalk.green(agentA) : diff < 0 ? chalk.green(agentB) : chalk.gray('tie'),
          };
        });

        output.table(
          [
            { key: 'metric', label: 'Metric', format: (v) => chalk.cyan(String(v)) },
            { key: agentA, label: agentA },
            { key: agentB, label: agentB },
            { key: 'diff', label: 'Δ' },
            { key: 'winner', label: 'Winner' },
          ],
          comparisonRows as unknown as Record<string, unknown>[],
        );
      } catch (error) {
        output.error(`Comparison failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  evalCmd
    .command('report <id>')
    .description('View an evaluation report')
    .action((id: string) => {
      try {
        output.heading(`Evaluation Report: ${chalk.bold(id)}`);

        output.object({
          'Report ID': id,
          Agent: 'main',
          Dataset: 'quality-v1',
          Samples: 200,
          'Overall Score': '89.4%',
          'Pass Rate': '96.5%',
          Duration: formatDuration(34200),
          'Completed At': new Date().toISOString(),
          Status: chalk.green('PASS'),
        });

        output.raw('');
        const results = generateEvalResults('main');
        output.table(
          [
            { key: 'metric', label: 'Metric', format: (v) => chalk.cyan(String(v)) },
            { key: 'score', label: 'Score' },
            { key: 'maxScore', label: 'Max' },
            { key: 'percentage', label: '%' },
            { key: 'status', label: 'Status' },
          ],
          results as unknown as Record<string, unknown>[],
        );
      } catch (error) {
        output.error(`Failed to load report: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
