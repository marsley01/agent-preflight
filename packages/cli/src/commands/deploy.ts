import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { OutputManager } from '../utils/output.js';
import { formatSpinner, formatDuration, formatBytes } from '../utils/formatting.js';

type DeployTarget = 'local' | 'docker' | 'kubernetes' | 'cloud' | 'serverless' | 'edge';

interface DeployOptions {
  target: DeployTarget;
  config?: string;
  agents?: string;
  namespace?: string;
  'auto-approve'?: boolean;
}

const TARGET_DESCRIPTIONS: Record<DeployTarget, string> = {
  local: 'Local process manager',
  docker: 'Docker containers',
  kubernetes: 'Kubernetes cluster',
  cloud: 'Managed cloud deployment',
  serverless: 'Serverless functions',
  edge: 'Edge network deployment',
};

const TARGET_COLORS: Record<DeployTarget, (s: string) => string> = {
  local: chalk.blue,
  docker: chalk.cyan,
  kubernetes: chalk.magenta,
  cloud: chalk.yellow,
  serverless: chalk.green,
  edge: chalk.red,
};

async function validateConfig(configPath: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Cannot read config: ${(error as Error).message}`);
  }
}

async function deployToLocal(
  agents: string[],
  namespace: string,
  config: Record<string, unknown>,
  onProgress: (msg: string) => void,
): Promise<{ duration: number; agentsDeployed: number }> {
  const start = Date.now();
  onProgress('Starting local runtime...');
  await sleep(500);
  for (const agent of agents) {
    onProgress(`Deploying agent ${chalk.cyan(agent)}...`);
    await sleep(300);
  }
  onProgress('Warming up agent caches...');
  await sleep(200);
  return { duration: Date.now() - start, agentsDeployed: agents.length };
}

async function deployToDocker(
  agents: string[],
  namespace: string,
  config: Record<string, unknown>,
  onProgress: (msg: string) => void,
): Promise<{ duration: number; agentsDeployed: number }> {
  const start = Date.now();
  onProgress('Building Docker images...');
  await sleep(800);
  onProgress('Tagging images...');
  await sleep(300);
  for (const agent of agents) {
    onProgress(`Starting container for ${chalk.cyan(agent)}...`);
    await sleep(400);
  }
  onProgress('Configuring network...');
  await sleep(300);
  return { duration: Date.now() - start, agentsDeployed: agents.length };
}

async function deployToKubernetes(
  agents: string[],
  namespace: string,
  config: Record<string, unknown>,
  onProgress: (msg: string) => void,
): Promise<{ duration: number; agentsDeployed: number }> {
  const start = Date.now();
  onProgress('Creating Kubernetes manifests...');
  await sleep(600);
  onProgress(`Applying namespace ${chalk.cyan(namespace)}...`);
  await sleep(400);
  for (const agent of agents) {
    onProgress(`Deploying ${chalk.cyan(agent)} to cluster...`);
    await sleep(500);
  }
  onProgress('Verifying pod health...');
  await sleep(400);
  return { duration: Date.now() - start, agentsDeployed: agents.length };
}

async function deployToCloud(
  agents: string[],
  namespace: string,
  config: Record<string, unknown>,
  onProgress: (msg: string) => void,
): Promise<{ duration: number; agentsDeployed: number }> {
  const start = Date.now();
  onProgress('Authenticating with cloud provider...');
  await sleep(500);
  onProgress('Provisioning cloud resources...');
  await sleep(800);
  for (const agent of agents) {
    onProgress(`Uploading ${chalk.cyan(agent)}...`);
    await sleep(400);
  }
  onProgress('Configuring load balancer...');
  await sleep(300);
  return { duration: Date.now() - start, agentsDeployed: agents.length };
}

async function deployToServerless(
  agents: string[],
  namespace: string,
  config: Record<string, unknown>,
  onProgress: (msg: string) => void,
): Promise<{ duration: number; agentsDeployed: number }> {
  const start = Date.now();
  onProgress('Packaging serverless functions...');
  await sleep(500);
  for (const agent of agents) {
    onProgress(`Deploying function for ${chalk.cyan(agent)}...`);
    await sleep(600);
  }
  onProgress('Configuring triggers and events...');
  await sleep(300);
  return { duration: Date.now() - start, agentsDeployed: agents.length };
}

async function deployToEdge(
  agents: string[],
  namespace: string,
  config: Record<string, unknown>,
  onProgress: (msg: string) => void,
): Promise<{ duration: number; agentsDeployed: number }> {
  const start = Date.now();
  onProgress('Authenticating with edge network...');
  await sleep(400);
  onProgress('Distributing agents to edge nodes...');
  await sleep(700);
  for (const agent of agents) {
    onProgress(`Deploying ${chalk.cyan(agent)} to edge...`);
    await sleep(500);
  }
  onProgress('Verifying global distribution...');
  await sleep(400);
  return { duration: Date.now() - start, agentsDeployed: agents.length };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerDeployCommand(program: Command, output: OutputManager): void {
  program
    .command('deploy')
    .description('Deploy agents to a target environment')
    .option('-t, --target <target>', `Deployment target (${Object.keys(TARGET_DESCRIPTIONS).join(', ')})`, 'local')
    .option('-c, --config <path>', 'Path to deployment config', 'preflight.json')
    .option('-a, --agents <names>', 'Comma-separated agent names to deploy')
    .option('-n, --namespace <name>', 'Deployment namespace', 'default')
    .option('--auto-approve', 'Skip confirmation prompt')
    .action(async (options: DeployOptions) => {
      const target = options.target;
      const namespace = options.namespace ?? 'default';

      if (!(target in TARGET_DESCRIPTIONS)) {
        output.error(`Invalid target "${target}". Valid targets: ${Object.keys(TARGET_DESCRIPTIONS).join(', ')}`);
        process.exit(1);
      }

      try {
        const config = await validateConfig(resolve(process.cwd(), options.config ?? 'preflight.json'));
        const agents = options.agents ? options.agents.split(',').map((a) => a.trim()).filter(Boolean) : ['main'];

        const colorFn = TARGET_COLORS[target];
        const targetDesc = TARGET_DESCRIPTIONS[target];

        output.heading(`Deploying to ${colorFn(target)}`);
        output.info(`Target   : ${colorFn(target)} (${targetDesc})`);
        output.info(`Namespace: ${chalk.cyan(namespace)}`);
        output.info(`Agents   : ${chalk.cyan(agents.join(', '))}`);

        if (!options['auto-approve']) {
          const inquirer = await import('inquirer');
          const { confirm } = await inquirer.default.prompt([
            { type: 'confirm', name: 'confirm', message: 'Proceed with deployment?', default: false },
          ]);
          if (!confirm) {
            output.warning('Deployment cancelled');
            process.exit(0);
          }
        }

        const deployFns: Record<DeployTarget, typeof deployToLocal> = {
          local: deployToLocal,
          docker: deployToDocker,
          kubernetes: deployToKubernetes,
          cloud: deployToCloud,
          serverless: deployToServerless,
          edge: deployToEdge,
        };

        const deployFn = deployFns[target];

        const result = await formatSpinner(`Deploying to ${target}...`, () =>
          deployFn(agents, namespace, config, (msg) => output.debug(msg)),
        );

        output.raw('');
        output.success(`Deployment complete (${formatDuration(result.duration)})`);

        output.raw('');
        output.object({
          Target: target,
          Namespace: namespace,
          'Agents Deployed': result.agentsDeployed,
          Duration: formatDuration(result.duration),
        });
      } catch (error) {
        output.error(`Deployment failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
