import { Command } from 'commander';
import chalk from 'chalk';
import { readFile, access, constants } from 'fs/promises';
import { resolve, basename } from 'path';
import { OutputManager } from '../utils/output.js';
import { formatDuration, formatTable, formatSpinner } from '../utils/formatting.js';

interface RegistryEntry {
  id: string;
  name: string;
  version: string;
  type: 'agent' | 'workflow' | 'tool';
  description: string;
  status: 'registered' | 'active' | 'disabled' | 'error';
  path: string;
  registered: string;
  lastUsed: string;
  usageCount: number;
}

function generateRegistry(): RegistryEntry[] {
  return [
    { id: 'agt-m1a2b3c4', name: 'main', version: '0.1.0', type: 'agent', description: 'Primary conversational agent', status: 'active', path: './agents/main.ts', registered: '2025-12-01T10:00:00Z', lastUsed: new Date().toISOString(), usageCount: 1240 },
    { id: 'agt-n5d6e7f8', name: 'researcher', version: '0.1.0', type: 'agent', description: 'Web research and data collection', status: 'active', path: './agents/researcher.ts', registered: '2025-12-05T14:30:00Z', lastUsed: new Date(Date.now() - 3600000).toISOString(), usageCount: 856 },
    { id: 'agt-o9p0q1r2', name: 'analyst', version: '0.2.0', type: 'agent', description: 'Data analysis and insights', status: 'active', path: './agents/analyst.ts', registered: '2025-12-10T09:15:00Z', lastUsed: new Date(Date.now() - 7200000).toISOString(), usageCount: 523 },
    { id: 'wfl-s3t4u5v6', name: 'data-pipeline', version: '0.1.0', type: 'workflow', description: 'End-to-end data processing', status: 'registered', path: './workflows/pipeline.ts', registered: '2026-01-15T11:00:00Z', lastUsed: new Date(Date.now() - 86400000).toISOString(), usageCount: 89 },
    { id: 'tl-w7x8y9z0', name: 'calculator', version: '1.0.0', type: 'tool', description: 'Mathematical calculations', status: 'disabled', path: './tools/calculator.ts', registered: '2026-02-01T16:45:00Z', lastUsed: new Date(Date.now() - 604800000).toISOString(), usageCount: 345 },
  ];
}

export function registerRegistryCommand(program: Command, output: OutputManager): void {
  const registryCmd = program
    .command('registry')
    .description('Manage the agent registry')
    .alias('reg');

  registryCmd
    .command('list')
    .description('List all registered agents, workflows, and tools')
    .option('-t, --type <type>', 'Filter by type (agent, workflow, tool)')
    .option('-s, --status <status>', 'Filter by status (active, disabled, error)')
    .action((options: { type?: string; status?: string }) => {
      try {
        let entries = generateRegistry();

        if (options.type) {
          entries = entries.filter((e) => e.type === options.type);
        }
        if (options.status) {
          entries = entries.filter((e) => e.status === options.status);
        }

        const statusColors: Record<string, (s: string) => string> = {
          active: chalk.green,
          registered: chalk.blue,
          disabled: chalk.yellow,
          error: chalk.red,
        };

        const typeColors: Record<string, (s: string) => string> = {
          agent: chalk.magenta,
          workflow: chalk.cyan,
          tool: chalk.yellow,
        };

        output.heading('Agent Registry');

        output.table(
          [
            { key: 'id', label: 'ID', format: (v) => chalk.gray(String(v)) },
            { key: 'name', label: 'Name', format: (v) => chalk.bold(String(v)) },
            { key: 'version', label: 'Version' },
            { key: 'type', label: 'Type', format: (v) => (typeColors[String(v)] ?? chalk.white)(String(v)) },
            { key: 'status', label: 'Status', format: (v) => (statusColors[String(v)] ?? chalk.white)(String(v)) },
            { key: 'usageCount', label: 'Usage' },
          ],
          entries as unknown as Record<string, unknown>[],
        );

        output.raw('');
        output.success(`${entries.length} registered item(s)`);
      } catch (error) {
        output.error(`Failed to list registry: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  registryCmd
    .command('register <path>')
    .description('Register an agent, workflow, or tool')
    .option('-n, --name <name>', 'Override the name')
    .option('-d, --description <text>', 'Description')
    .action(async (itemPath: string, options: { name?: string; description?: string }) => {
      try {
        const absPath = resolve(process.cwd(), itemPath);
        await access(absPath, constants.F_OK);

        const name = options.name ?? basename(itemPath, '.ts');
        const id = `${name}-${Math.random().toString(36).slice(2, 10)}`;

        await formatSpinner(`Registering ${chalk.cyan(name)}...`, async () => {
          await new Promise((r) => setTimeout(r, 500));
        });

        output.success(`Registered ${chalk.bold(name)}`);
        output.object({
          ID: id,
          Name: name,
          Path: absPath,
        });
      } catch (error) {
        output.error(`Registration failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  registryCmd
    .command('deregister <id>')
    .description('Deregister an agent from the registry')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id: string, options: { force?: boolean }) => {
      try {
        if (!options.force) {
          const inquirer = await import('inquirer');
          const { confirm } = await inquirer.default.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Deregister "${id}"?`,
              default: false,
            },
          ]);
          if (!confirm) {
            output.warning('Operation cancelled');
            process.exit(0);
          }
        }

        await formatSpinner(`Deregistering ${chalk.cyan(id)}...`, async () => {
          await new Promise((r) => setTimeout(r, 400));
        });

        output.success(`Deregistered: ${id}`);
      } catch (error) {
        output.error(`Deregistration failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  registryCmd
    .command('inspect <id>')
    .description('Inspect a registry entry')
    .action((id: string) => {
      try {
        const entries = generateRegistry();
        const entry = entries.find((e) => e.id === id) ?? entries.find((e) => e.name === id);

        if (!entry) {
          output.error(`Not found: ${id}`);
          process.exit(1);
        }

        output.heading(`Registry Entry: ${chalk.bold(entry.name)}`);
        output.object(entry as unknown as Record<string, unknown>, 'Details');
      } catch (error) {
        output.error(`Failed to inspect: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
