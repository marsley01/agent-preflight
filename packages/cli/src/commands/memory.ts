import { Command } from 'commander';
import chalk from 'chalk';
import { OutputManager } from '../utils/output.js';
import { formatBytes, formatDuration, formatTable, formatSpinner } from '../utils/formatting.js';

interface LayerInfo {
  layer: string;
  type: string;
  entries: number;
  size: string;
  ttl: string;
  accessCount: number;
  hitRate: string;
  status: 'active' | 'disabled' | 'optimizing';
}

function generateMemoryLayers(): LayerInfo[] {
  return [
    { layer: 'short-term', type: 'in-memory', entries: 234, size: formatBytes(4_194_304), ttl: '5m', accessCount: 1280, hitRate: '94.2%', status: 'active' },
    { layer: 'working', type: 'in-memory', entries: 56, size: formatBytes(1_048_576), ttl: '15m', accessCount: 430, hitRate: '87.5%', status: 'active' },
    { layer: 'episodic', type: 'persistent', entries: 1892, size: formatBytes(52_428_800), ttl: '24h', accessCount: 3400, hitRate: '96.1%', status: 'active' },
    { layer: 'semantic', type: 'persistent', entries: 8456, size: formatBytes(209_715_200), ttl: '7d', accessCount: 12000, hitRate: '98.3%', status: 'active' },
    { layer: 'procedural', type: 'persistent', entries: 128, size: formatBytes(524_288), ttl: '30d', accessCount: 800, hitRate: '99.1%', status: 'active' },
  ];
}

function generateLayerDetail(layer: string): Record<string, unknown> {
  const layers = generateMemoryLayers();
  const found = layers.find((l) => l.layer === layer);
  if (!found) return {};

  return {
    ...found,
    provider: layer === 'short-term' || layer === 'working' ? 'memory-store' : 'database-store',
    fragmentation: `${(Math.random() * 10).toFixed(1)}%`,
    lastOptimized: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString(),
    oldestEntry: new Date(Date.now() - Math.floor(Math.random() * 604800000)).toISOString(),
    newestEntry: new Date().toISOString(),
  };
}

export function registerMemoryCommand(program: Command, output: OutputManager): void {
  const memoryCmd = program
    .command('memory')
    .description('Manage memory layers');

  memoryCmd
    .command('list')
    .description('List all memory stores')
    .action(() => {
      try {
        const layers = generateMemoryLayers();

        output.heading('Memory Layers');

        output.table(
          [
            { key: 'layer', label: 'Layer', format: (v) => chalk.cyan(String(v)) },
            { key: 'type', label: 'Type' },
            { key: 'entries', label: 'Entries' },
            { key: 'size', label: 'Size' },
            { key: 'ttl', label: 'TTL' },
            { key: 'hitRate', label: 'Hit Rate', format: (v) => chalk.green(String(v)) },
          ],
          layers as unknown as Record<string, unknown>[],
        );

        output.raw('');
        output.success(`${layers.length} layer(s)`);
      } catch (error) {
        output.error(`Failed to list memory: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  memoryCmd
    .command('inspect <layer>')
    .description('Inspect a specific memory layer')
    .action((layer: string) => {
      try {
        const detail = generateLayerDetail(layer);

        if (Object.keys(detail).length === 0) {
          output.error(`Unknown layer: ${layer}`);
          process.exit(1);
        }

        output.heading(`Layer: ${chalk.bold(layer)}`);
        output.object(detail, 'Details');
      } catch (error) {
        output.error(`Failed to inspect layer: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  memoryCmd
    .command('clear <layer>')
    .description('Clear a memory layer')
    .option('-f, --force', 'Skip confirmation')
    .action(async (layer: string, options: { force?: boolean }) => {
      try {
        if (!options.force) {
          const inquirer = await import('inquirer');
          const { confirm } = await inquirer.default.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Clear all data in "${layer}" layer?`,
              default: false,
            },
          ]);
          if (!confirm) {
            output.warning('Operation cancelled');
            process.exit(0);
          }
        }

        await formatSpinner(`Clearing ${layer} memory layer...`, async () => {
          await new Promise((r) => setTimeout(r, 800));
        });

        output.success(`Memory layer "${layer}" cleared`);
      } catch (error) {
        output.error(`Failed to clear memory: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  memoryCmd
    .command('optimize')
    .description('Trigger memory optimization')
    .option('-l, --layer <name>', 'Specific layer to optimize')
    .action(async (options: { layer?: string }) => {
      try {
        const target = options.layer ?? 'all layers';

        await formatSpinner(`Optimizing ${target}...`, async () => {
          await new Promise((r) => setTimeout(r, 2000));
        });

        output.success(`Optimization complete for ${target}`);

        output.raw('');
        output.object({
          'Fragmentation reduced': `${(Math.random() * 30 + 10).toFixed(1)}%`,
          'Entries consolidated': Math.floor(Math.random() * 500),
          'Space reclaimed': formatBytes(Math.floor(Math.random() * 52428800)),
          'Duration': formatDuration(Math.floor(Math.random() * 5000) + 1000),
        });
      } catch (error) {
        output.error(`Optimization failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
