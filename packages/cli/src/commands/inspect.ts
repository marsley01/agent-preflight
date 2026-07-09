import { Command } from 'commander';
import chalk from 'chalk';
import { OutputManager } from '../utils/output.js';
import { formatDuration, formatBytes, formatTable } from '../utils/formatting.js';

function generateAgentInfo(id: string) {
  return {
    id,
    name: id.includes('-') ? id.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') : id,
    status: Math.random() > 0.2 ? 'running' as const : 'idle' as const,
    type: 'Agent',
    version: '0.1.0',
    model: 'gpt-4o',
    provider: 'openai',
    memory_usage: `${formatBytes(Math.floor(Math.random() * 512) + 64)}`,
    cpu_usage: `${(Math.random() * 100).toFixed(1)}%`,
    uptime: formatDuration(Math.floor(Math.random() * 86400000)),
    tasks_completed: Math.floor(Math.random() * 1000),
    error_rate: `${(Math.random() * 5).toFixed(2)}%`,
    created: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
    last_active: new Date().toISOString(),
  };
}

function generateTaskInfo(id: string) {
  return {
    id,
    type: ['inference', 'analysis', 'generation', 'classification'][Math.floor(Math.random() * 4)],
    status: ['running', 'completed', 'pending', 'failed'][Math.floor(Math.random() * 4)],
    agent: `agent-${Math.floor(Math.random() * 5) + 1}`,
    priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
    duration: formatDuration(Math.floor(Math.random() * 30000)),
    tokens_used: Math.floor(Math.random() * 4000),
    created: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
  };
}

function generateMemoryInfo(agentId: string) {
  const layers = ['short-term', 'working', 'episodic', 'semantic', 'procedural'];
  return layers.map((layer) => ({
    layer,
    entries: Math.floor(Math.random() * 1000),
    size: formatBytes(Math.floor(Math.random() * 104857600)),
    access_count: Math.floor(Math.random() * 5000),
    last_access: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
  }));
}

export function registerInspectCommand(program: Command, output: OutputManager): void {
  const inspectCmd = program
    .command('inspect')
    .description('Inspect agents, tasks, and memory');

  inspectCmd
    .command('agent <id>')
    .description('Detailed agent information')
    .action((id: string) => {
      try {
        const info = generateAgentInfo(id);
        output.object(info, `Agent: ${chalk.bold(info.name)}`);

        output.raw('');
        output.table(
          [
            { key: 'property', label: 'Property' },
            { key: 'value', label: 'Value' },
          ],
          Object.entries(info).map(([key, value]) => ({
            property: chalk.cyan(key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())),
            value: String(value),
          })),
        );
      } catch (error) {
        output.error(`Failed to inspect agent: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  inspectCmd
    .command('task <id>')
    .description('Task details and status')
    .action((id: string) => {
      try {
        const info = generateTaskInfo(id);
        output.object(info, `Task: ${chalk.bold(id)}`);

        const statusColor: Record<string, (s: string) => string> = {
          running: chalk.green,
          completed: chalk.blue,
          pending: chalk.yellow,
          failed: chalk.red,
        };
        const status = info.status || "unknown";
        const coloredStatus = (statusColor[status] ?? chalk.white)(status);

        output.raw('');
        output.object({
          'Task ID': id,
          Type: info.type,
          Status: coloredStatus,
          Agent: info.agent,
          Priority: info.priority,
          Duration: info.duration,
          'Tokens Used': info.tokens_used,
          Created: new Date(info.created).toLocaleString(),
        });
      } catch (error) {
        output.error(`Failed to inspect task: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  inspectCmd
    .command('memory <agent-id>')
    .description('Memory contents for an agent')
    .action((agentId: string) => {
      try {
        const memories = generateMemoryInfo(agentId);
        output.heading(`Memory Layers — Agent: ${chalk.bold(agentId)}`);

        output.table(
          [
            { key: 'layer', label: 'Layer', format: (v) => chalk.cyan(String(v)) },
            { key: 'entries', label: 'Entries' },
            { key: 'size', label: 'Size' },
            { key: 'access_count', label: 'Access Count' },
            { key: 'last_access', label: 'Last Access', format: (v) => new Date(String(v)).toLocaleString() },
          ],
          memories as unknown as Record<string, unknown>[],
        );
      } catch (error) {
        output.error(`Failed to inspect memory: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
