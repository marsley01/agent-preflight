import { Command } from 'commander';
import chalk from 'chalk';
import { OutputManager } from '../utils/output.js';
import { formatDuration } from '../utils/formatting.js';

interface RunAgentOptions {
  input?: string;
  params?: string;
  timeout?: string;
  watch?: boolean;
}

interface RunWorkflowOptions {
  input?: string;
  params?: string;
  timeout?: string;
  watch?: boolean;
}

function parseParams(paramStr?: string): Record<string, unknown> {
  if (!paramStr) return {};
  try {
    return JSON.parse(paramStr) as Record<string, unknown>;
  } catch {
    const params: Record<string, unknown> = {};
    for (const part of paramStr.split(',')) {
      const [key, ...rest] = part.split('=');
      if (key) {
        params[key.trim()] = rest.join('=').trim();
      }
    }
    return params;
  }
}

function parseTimeout(timeoutStr?: string): number {
  if (!timeoutStr) return 30000;
  const match = timeoutStr.match(/^(\d+)(ms|s|m)?$/);
  if (!match) return 30000;
  const value = parseInt(match[1]!, 10);
  const unit = match[2] ?? 'ms';
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60000;
    default: return value;
  }
}

async function simulateRunAgent(
  name: string,
  input: string | undefined,
  params: Record<string, unknown>,
  timeout: number,
  onLog: (msg: string) => void,
): Promise<{ duration: number; output: string }> {
  const start = Date.now();
  onLog(chalk.gray(`[${new Date().toISOString()}] Starting agent "${name}"...`));
  await sleep(200);
  onLog(chalk.gray(`[${new Date().toISOString()}] Initializing runtime...`));
  await sleep(300);

  if (input) {
    onLog(chalk.gray(`[${new Date().toISOString()}] Processing input: ${chalk.yellow(input)}`));
    await sleep(400);
  }

  if (Object.keys(params).length > 0) {
    onLog(chalk.gray(`[${new Date().toISOString()}] Applying parameters: ${chalk.yellow(JSON.stringify(params))}`));
    await sleep(200);
  }

  onLog(chalk.gray(`[${new Date().toISOString()}] Agent running...`));
  await sleep(600);

  const output = `Task completed by agent "${name}"`;
  onLog(chalk.gray(`[${new Date().toISOString()}] ${chalk.green(output)}`));

  return { duration: Date.now() - start, output };
}

async function simulateRunWorkflow(
  name: string,
  input: string | undefined,
  params: Record<string, unknown>,
  timeout: number,
  onLog: (msg: string) => void,
): Promise<{ duration: number; steps: number }> {
  const start = Date.now();
  const steps = ['ingest', 'process', 'transform', 'output'];

  onLog(chalk.gray(`[${new Date().toISOString()}] Starting workflow "${name}"...`));
  await sleep(200);

  for (const step of steps) {
    onLog(chalk.gray(`[${new Date().toISOString()}] Executing step: ${chalk.cyan(step)}`));
    await sleep(400);
  }

  onLog(chalk.gray(`[${new Date().toISOString()}] ${chalk.green('Workflow completed')}`));
  return { duration: Date.now() - start, steps: steps.length };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerRunCommand(program: Command, output: OutputManager): void {
  const runCmd = program
    .command('run')
    .description('Run agents or workflows');

  runCmd
    .command('agent <name>')
    .description('Run a single agent')
    .option('-i, --input <data>', 'Input data for the agent')
    .option('-p, --params <json>', 'Parameters as JSON key=val,key=val')
    .option('-t, --timeout <duration>', 'Timeout (e.g. 30s, 5m)', '30s')
    .option('-w, --watch', 'Watch mode — stream output in real-time')
    .action(async (name: string, options: RunAgentOptions) => {
      try {
        const params = parseParams(options.params);
        const timeout = parseTimeout(options.timeout);

        output.heading(`Running Agent: ${chalk.bold(name)}`);

        const logs: string[] = [];
        const result = await simulateRunAgent(name, options.input, params, timeout, (msg) => {
          logs.push(msg);
          if (options.watch) {
            output.raw(msg);
          }
        });

        if (!options.watch) {
          for (const log of logs) {
            output.raw(log);
          }
        }

        output.raw('');
        output.object({
          Agent: name,
          Status: chalk.green('Completed'),
          Duration: formatDuration(result.duration),
          Output: result.output,
        });
      } catch (error) {
        output.error(`Agent run failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  runCmd
    .command('workflow <name>')
    .description('Run a workflow')
    .option('-i, --input <data>', 'Input data for the workflow')
    .option('-p, --params <json>', 'Parameters as JSON')
    .option('-t, --timeout <duration>', 'Timeout (e.g. 30s, 5m)', '5m')
    .option('-w, --watch', 'Watch mode — stream output in real-time')
    .action(async (name: string, options: RunWorkflowOptions) => {
      try {
        const params = parseParams(options.params);
        const timeout = parseTimeout(options.timeout);

        output.heading(`Running Workflow: ${chalk.bold(name)}`);

        const logs: string[] = [];
        const result = await simulateRunWorkflow(name, options.input, params, timeout, (msg) => {
          logs.push(msg);
          if (options.watch) {
            output.raw(msg);
          }
        });

        if (!options.watch) {
          for (const log of logs) {
            output.raw(log);
          }
        }

        output.raw('');
        output.object({
          Workflow: name,
          Status: chalk.green('Completed'),
          Duration: formatDuration(result.duration),
          Steps: result.steps,
        });
      } catch (error) {
        output.error(`Workflow run failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
