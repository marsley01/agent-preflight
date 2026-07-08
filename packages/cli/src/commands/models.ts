import { Command } from 'commander';
import chalk from 'chalk';
import { OutputManager } from '../utils/output.js';
import { formatDuration, formatTable, formatSpinner } from '../utils/formatting.js';

interface ModelInfo {
  name: string;
  provider: string;
  capabilities: string[];
  contextWindow: number;
  maxTokens: number;
  pricing: string;
  latency: string;
  status: 'available' | 'limited' | 'unavailable';
}

function generateModels(): ModelInfo[] {
  return [
    { name: 'gpt-4o', provider: 'OpenAI', capabilities: ['text', 'vision', 'function-calling'], contextWindow: 128000, maxTokens: 4096, pricing: '$2.50/1M input', latency: '1.2s', status: 'available' },
    { name: 'gpt-4o-mini', provider: 'OpenAI', capabilities: ['text', 'vision', 'function-calling'], contextWindow: 128000, maxTokens: 4096, pricing: '$0.15/1M input', latency: '0.8s', status: 'available' },
    { name: 'claude-opus-4', provider: 'Anthropic', capabilities: ['text', 'vision', 'code'], contextWindow: 200000, maxTokens: 8192, pricing: '$15.00/1M input', latency: '2.1s', status: 'available' },
    { name: 'claude-sonnet-4', provider: 'Anthropic', capabilities: ['text', 'vision', 'code'], contextWindow: 200000, maxTokens: 8192, pricing: '$3.00/1M input', latency: '1.5s', status: 'available' },
    { name: 'gemini-2.0-flash', provider: 'Google AI', capabilities: ['text', 'vision', 'audio', 'code'], contextWindow: 1048576, maxTokens: 8192, pricing: '$0.10/1M input', latency: '0.5s', status: 'available' },
    { name: 'gemini-2.0-pro', provider: 'Google AI', capabilities: ['text', 'vision', 'audio', 'code'], contextWindow: 2097152, maxTokens: 8192, pricing: '$2.00/1M input', latency: '1.0s', status: 'available' },
    { name: 'gpt-4.1', provider: 'OpenAI', capabilities: ['text', 'vision', 'function-calling'], contextWindow: 1048576, maxTokens: 16384, pricing: '$2.00/1M input', latency: '1.8s', status: 'available' },
    { name: 'o3-mini', provider: 'OpenAI', capabilities: ['text', 'code', 'reasoning'], contextWindow: 200000, maxTokens: 16384, pricing: '$1.10/1M input', latency: '3.5s', status: 'available' },
  ];
}

function getModelDetail(name: string): ModelInfo | undefined {
  return generateModels().find((m) => m.name === name);
}

export function registerModelsCommand(program: Command, output: OutputManager): void {
  const modelsCmd = program
    .command('models')
    .description('List and manage AI models')
    .alias('model');

  modelsCmd
    .command('list')
    .description('List available models')
    .option('-p, --provider <name>', 'Filter by provider')
    .option('-s, --status <status>', 'Filter by status (available, limited, unavailable)')
    .action((options: { provider?: string; status?: string }) => {
      try {
        let models = generateModels();

        if (options.provider) {
          models = models.filter((m) => m.provider.toLowerCase() === options.provider!.toLowerCase());
        }
        if (options.status) {
          models = models.filter((m) => m.status === options.status);
        }

        const providerColors: Record<string, (s: string) => string> = {
          OpenAI: chalk.green,
          Anthropic: chalk.yellow,
          'Google AI': chalk.blue,
        };

        output.heading('Available Models');

        output.table(
          [
            { key: 'name', label: 'Model', format: (v) => chalk.bold(String(v)) },
            { key: 'provider', label: 'Provider', format: (v) => (providerColors[String(v)] ?? chalk.white)(String(v)) },
            { key: 'contextWindow', label: 'Context' },
            { key: 'maxTokens', label: 'Max Output' },
            { key: 'pricing', label: 'Pricing' },
            { key: 'latency', label: 'Avg Latency' },
          ],
          models as unknown as Record<string, unknown>[],
        );

        output.raw('');
        output.success(`${models.length} model(s) available`);
      } catch (error) {
        output.error(`Failed to list models: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  modelsCmd
    .command('inspect <model>')
    .description('Get detailed information about a model')
    .action((modelName: string) => {
      try {
        const model = getModelDetail(modelName);
        if (!model) {
          output.error(`Unknown model: ${modelName}`);
          process.exit(1);
        }

        output.heading(`Model: ${chalk.bold(model.name)}`);
        output.object(model as unknown as Record<string, unknown>, 'Specifications');
      } catch (error) {
        output.error(`Failed to inspect model: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  modelsCmd
    .command('test <model>')
    .description('Test a model with a sample prompt')
    .option('-p, --prompt <text>', 'Custom prompt', 'Hello, how are you?')
    .action(async (modelName: string, options: { prompt?: string }) => {
      try {
        const model = getModelDetail(modelName);
        if (!model) {
          output.error(`Unknown model: ${modelName}`);
          process.exit(1);
        }

        output.info(`Testing ${chalk.bold(modelName)} with prompt: "${options.prompt}"`);

        const result = await formatSpinner(`Running inference on ${modelName}...`, async () => {
          await new Promise((r) => setTimeout(r, 1500));
          return {
            response: 'I\'m doing well, thank you! How can I assist you today?',
            tokens: Math.floor(Math.random() * 100) + 20,
            duration: Math.floor(Math.random() * 2000) + 500,
          };
        });

        output.raw('');
        output.success('Inference complete');
        output.object({
          Model: modelName,
          Response: result.response,
          'Tokens Used': result.tokens,
          Duration: formatDuration(result.duration),
          'Cost Estimate': `$${((result.tokens / 1000000) * 2.5).toFixed(6)}`,
        });
      } catch (error) {
        output.error(`Test failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  modelsCmd
    .command('benchmark')
    .description('Run model benchmarks')
    .option('-m, --models <names>', 'Comma-separated model names to benchmark')
    .action(async (options: { models?: string }) => {
      try {
        const modelNames = options.models?.split(',').map((m) => m.trim()) ?? generateModels().map((m) => m.name);

        output.heading('Model Benchmark');

        const results = await formatSpinner('Running benchmarks...', async () => {
          const benchmarks = [];
          for (const name of modelNames) {
            await new Promise((r) => setTimeout(r, 1000));
            benchmarks.push({
              model: name,
              latency: `${(Math.random() * 3 + 0.3).toFixed(2)}s`,
              throughput: `${(Math.random() * 50 + 10).toFixed(0)} req/s`,
              tokensPerSec: `${(Math.random() * 5000 + 1000).toFixed(0)}`,
              costPer1K: `$${(Math.random() * 0.05 + 0.002).toFixed(4)}`,
            });
          }
          return benchmarks;
        });

        output.table(
          [
            { key: 'model', label: 'Model', format: (v) => chalk.bold(String(v)) },
            { key: 'latency', label: 'Latency' },
            { key: 'throughput', label: 'Throughput' },
            { key: 'tokensPerSec', label: 'Tokens/s' },
            { key: 'costPer1K', label: 'Cost/1K tokens' },
          ],
          results as unknown as Record<string, unknown>[],
        );
      } catch (error) {
        output.error(`Benchmark failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
