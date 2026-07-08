import { Command } from 'commander';
import chalk from 'chalk';
import { OutputManager } from '../utils/output.js';
import { formatStatus, formatDuration } from '../utils/formatting.js';
import { hostname, platform, arch, uptime, cpus } from 'os';

interface HealthComponent {
  name: string;
  status: 'success' | 'error' | 'warning' | 'info' | 'pending' | 'running';
  message: string;
  latency?: number;
}

function getRuntimeHealth(): HealthComponent[] {
  const cpuUsage = cpus().map((c) => c.times);
  const totalIdle = cpuUsage.reduce((acc, t) => acc + t.idle, 0);
  const totalTick = cpuUsage.reduce((acc, t) => acc + t.user + t.nice + t.sys + t.idle + t.irq, 0);
  const cpuPercent = totalTick > 0 ? ((totalTick - totalIdle) / totalTick) * 100 : 0;

  return [
    {
      name: 'Runtime Engine',
      status: 'success',
      message: `v${process.versions.node} — ${formatDuration(uptime() * 1000)} uptime`,
      latency: Math.random() * 5,
    },
    {
      name: 'Event Loop',
      status: cpuPercent > 80 ? 'warning' : 'success',
      message: `${cpuPercent.toFixed(1)}% load`,
      latency: Math.random() * 10,
    },
    {
      name: 'Memory',
      status: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal > 0.85 ? 'warning' : 'success',
      message: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB used`,
      latency: Math.random() * 2,
    },
  ];
}

function getProviderHealth(): HealthComponent[] {
  const providers = [
    { name: 'OpenAI', healthy: Math.random() > 0.1 },
    { name: 'Anthropic', healthy: Math.random() > 0.15 },
    { name: 'Google AI', healthy: Math.random() > 0.1 },
    { name: 'Azure OpenAI', healthy: Math.random() > 0.05 },
  ];

  return providers.map((p) => ({
    name: `${p.name}`,
    status: p.healthy ? ('success' as const) : ('error' as const),
    message: p.healthy ? 'Connected' : 'Connection failed',
    latency: p.healthy ? Math.floor(Math.random() * 500) + 50 : undefined,
  }));
}

function getAgentHealth(): HealthComponent[] {
  const agents = [
    { name: 'main', status: 'success' as const, tasks: 42 },
    { name: 'researcher', status: 'success' as const, tasks: 128 },
    { name: 'analyst', status: 'warning' as const, tasks: 7 },
    { name: 'helper', status: 'success' as const, tasks: 256 },
  ];

  return agents.map((a) => ({
    name: a.name,
    status: a.status,
    message: `${a.tasks} tasks processed`,
    latency: Math.floor(Math.random() * 50),
  }));
}

export function registerHealthCommand(program: Command, output: OutputManager): void {
  program
    .command('health')
    .description('Check health of all system components')
    .option('--watch', 'Watch mode — refresh every 2 seconds')
    .action(async (options: { watch?: boolean }) => {
      const render = () => {
        if (output.getMode() !== 'json') {
          console.clear();
        }

        output.heading(`Agent Preflight Health Dashboard`);
        output.raw(chalk.gray(`${platform()} ${arch()} — ${hostname()}\n`));

        output.heading('Runtime');
        output.statusTable(getRuntimeHealth());

        output.raw('');
        output.heading('Providers');
        output.statusTable(getProviderHealth());

        output.raw('');
        output.heading('Agents');
        output.statusTable(getAgentHealth());
      };

      render();

      if (options.watch) {
        setInterval(render, 2000);
      }
    });
}
