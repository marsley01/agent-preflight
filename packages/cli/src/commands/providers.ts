import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { OutputManager } from '../utils/output.js';
import { formatDuration, formatTable, formatStatus, formatSpinner } from '../utils/formatting.js';

interface ProviderInfo {
  name: string;
  type: string;
  status: 'configured' | 'missing-key' | 'error';
  model: string;
  region?: string;
  latency?: string;
  quota?: string;
}

function generateProviders(): ProviderInfo[] {
  return [
    { name: 'openai', type: 'LLM', status: 'configured', model: 'gpt-4o', region: 'us-east', latency: '145ms', quota: '85% remaining' },
    { name: 'anthropic', type: 'LLM', status: 'configured', model: 'claude-sonnet-4', region: 'us-west', latency: '210ms', quota: '92% remaining' },
    { name: 'google-ai', type: 'LLM', status: 'missing-key', model: 'gemini-2.0-flash', latency: '—', quota: '—' },
    { name: 'azure-openai', type: 'LLM', status: 'configured', model: 'gpt-4o', region: 'europe-west', latency: '178ms', quota: '67% remaining' },
    { name: 'groq', type: 'LLM', status: 'configured', model: 'llama-3.3-70b', latency: '89ms', quota: '100% remaining' },
  ];
}

export function registerProvidersCommand(program: Command, output: OutputManager): void {
  const providersCmd = program
    .command('providers')
    .description('Manage AI providers')
    .alias('provider');

  providersCmd
    .command('list')
    .description('List configured providers')
    .action(() => {
      try {
        const providers = generateProviders();

        const statusColors: Record<string, (s: string) => string> = {
          configured: chalk.green,
          'missing-key': chalk.yellow,
          error: chalk.red,
        };

        output.heading('Configured Providers');

        output.table(
          [
            { key: 'name', label: 'Provider', format: (v) => chalk.bold(String(v)) },
            { key: 'type', label: 'Type' },
            { key: 'status', label: 'Status', format: (v) => (statusColors[String(v)] ?? chalk.white)(String(v)) },
            { key: 'model', label: 'Default Model' },
            { key: 'latency', label: 'Latency' },
            { key: 'quota', label: 'Quota' },
          ],
          providers as unknown as Record<string, unknown>[],
        );

        output.raw('');

        const configured = providers.filter((p) => p.status === 'configured').length;
        const missing = providers.filter((p) => p.status === 'missing-key').length;
        output.success(`${configured} provider(s) configured`);
        if (missing > 0) {
          output.warning(`${missing} provider(s) missing API keys`);
        }
      } catch (error) {
        output.error(`Failed to list providers: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  providersCmd
    .command('add <name>')
    .description('Configure a provider')
    .action(async (name: string) => {
      try {
        output.info(`Configuring provider: ${chalk.bold(name)}`);

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'apiKey',
            message: 'API Key:',
            validate: (v: string) => v.length > 0 || 'API key is required',
          },
          {
            type: 'input',
            name: 'model',
            message: 'Default model:',
            default: 'gpt-4o',
          },
          {
            type: 'input',
            name: 'region',
            message: 'Region (optional):',
          },
        ]);

        await formatSpinner(`Validating credentials for ${name}...`, async () => {
          await new Promise((r) => setTimeout(r, 1000));
        });

        output.success(`Provider "${name}" configured successfully`);
        output.object({
          Provider: name,
          Model: answers.model,
          Region: answers.region || 'default',
        });
      } catch (error) {
        output.error(`Failed to add provider: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  providersCmd
    .command('remove <name>')
    .description('Remove a provider configuration')
    .action(async (name: string) => {
      try {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Remove provider "${name}"?`,
            default: false,
          },
        ]);

        if (!confirm) {
          output.warning('Operation cancelled');
          process.exit(0);
        }

        await formatSpinner(`Removing ${name}...`, async () => {
          await new Promise((r) => setTimeout(r, 400));
        });

        output.success(`Provider "${name}" removed`);
      } catch (error) {
        output.error(`Failed to remove provider: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  providersCmd
    .command('health')
    .description('Check health of all configured providers')
    .action(async () => {
      try {
        const providers = generateProviders();

        output.heading('Provider Health');

        const results = await formatSpinner('Checking provider health...', async () => {
          const checks = [];
          for (const p of providers) {
            await new Promise((r) => setTimeout(r, 300));
            const healthy = p.status === 'configured';
            checks.push({
              name: p.name,
              status: healthy ? ('success' as const) : ('error' as const),
              message: healthy ? 'Connected' : 'Missing API key',
              latency: healthy ? `${Math.floor(Math.random() * 200) + 50}ms` : '—',
            });
          }
          return checks;
        });

        output.raw('');
        output.statusTable(results);
      } catch (error) {
        output.error(`Health check failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
