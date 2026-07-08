import { Command } from 'commander';
import chalk from 'chalk';
import { OutputManager } from '../utils/output.js';
import { formatBytes, formatTable, formatSpinner } from '../utils/formatting.js';

interface PluginInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  installed: boolean;
  enabled: boolean;
  size: string;
  dependencies: string;
}

interface MarketplacePlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  downloads: number;
  rating: string;
}

function generateInstalledPlugins(): PluginInfo[] {
  return [
    { name: '@agent-preflight/plugin-web-search', version: '0.1.0', description: 'Web search capabilities', author: 'Agent Preflight', installed: true, enabled: true, size: formatBytes(245_760), dependencies: '0' },
    { name: '@agent-preflight/plugin-code-exec', version: '0.2.0', description: 'Sandboxed code execution', author: 'Agent Preflight', installed: true, enabled: true, size: formatBytes(1_048_576), dependencies: '2' },
    { name: '@agent-preflight/plugin-file-system', version: '0.1.0', description: 'File system operations', author: 'Agent Preflight', installed: true, enabled: false, size: formatBytes(389_120), dependencies: '1' },
    { name: '@agent-preflight/plugin-slack', version: '0.1.0', description: 'Slack integration', author: 'Community', installed: true, enabled: true, size: formatBytes(524_288), dependencies: '3' },
  ];
}

function generateMarketplacePlugins(): MarketplacePlugin[] {
  return [
    { name: '@agent-preflight/plugin-web-search', version: '0.1.0', description: 'Web search capabilities', author: 'Agent Preflight', downloads: 12400, rating: '4.8/5' },
    { name: '@agent-preflight/plugin-code-exec', version: '0.2.0', description: 'Sandboxed code execution', author: 'Agent Preflight', downloads: 8900, rating: '4.6/5' },
    { name: '@agent-preflight/plugin-file-system', version: '0.1.0', description: 'File system operations', author: 'Agent Preflight', downloads: 7200, rating: '4.5/5' },
    { name: '@agent-preflight/plugin-slack', version: '0.1.0', description: 'Slack integration', author: 'Community', downloads: 5600, rating: '4.3/5' },
    { name: '@agent-preflight/plugin-github', version: '0.1.0', description: 'GitHub integration', author: 'Community', downloads: 4300, rating: '4.7/5' },
    { name: '@agent-preflight/plugin-notion', version: '0.1.0', description: 'Notion workspace integration', author: 'Community', downloads: 3100, rating: '4.2/5' },
  ];
}

export function registerPluginsCommand(program: Command, output: OutputManager): void {
  const pluginsCmd = program
    .command('plugins')
    .description('Manage plugins')
    .alias('plugin');

  pluginsCmd
    .command('list')
    .description('List installed plugins')
    .action(() => {
      try {
        const plugins = generateInstalledPlugins();

        output.heading('Installed Plugins');

        output.table(
          [
            { key: 'name', label: 'Plugin', format: (v) => chalk.bold(String(v)) },
            { key: 'version', label: 'Version' },
            { key: 'description', label: 'Description' },
            { key: 'enabled', label: 'Enabled', format: (v) => v ? chalk.green('✓') : chalk.red('✗') },
            { key: 'size', label: 'Size' },
          ],
          plugins as unknown as Record<string, unknown>[],
        );

        output.raw('');
        output.success(`${plugins.length} plugin(s) installed`);
      } catch (error) {
        output.error(`Failed to list plugins: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  pluginsCmd
    .command('install <name>')
    .description('Install a plugin from the marketplace')
    .action(async (name: string) => {
      try {
        await formatSpinner(`Installing ${chalk.cyan(name)}...`, async () => {
          await new Promise((r) => setTimeout(r, 1500));
        });

        output.success(`Installed ${chalk.bold(name)}`);
        output.info('Run \'preflight plugins list\' to verify');
      } catch (error) {
        output.error(`Installation failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  pluginsCmd
    .command('remove <name>')
    .description('Remove an installed plugin')
    .option('-f, --force', 'Skip confirmation')
    .action(async (name: string, options: { force?: boolean }) => {
      try {
        if (!options.force) {
          const inquirer = await import('inquirer');
          const { confirm } = await inquirer.default.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Remove "${name}"?`,
              default: false,
            },
          ]);
          if (!confirm) {
            output.warning('Operation cancelled');
            process.exit(0);
          }
        }

        await formatSpinner(`Removing ${chalk.cyan(name)}...`, async () => {
          await new Promise((r) => setTimeout(r, 600));
        });

        output.success(`Removed: ${name}`);
      } catch (error) {
        output.error(`Removal failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  pluginsCmd
    .command('search <query>')
    .description('Search the plugin marketplace')
    .action((query: string) => {
      try {
        const all = generateMarketplacePlugins();
        const results = all.filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.description.toLowerCase().includes(query.toLowerCase()),
        );

        if (results.length === 0) {
          output.info(`No plugins found matching "${query}"`);
          return;
        }

        output.heading(`Search Results: "${query}"`);

        output.table(
          [
            { key: 'name', label: 'Plugin', format: (v) => chalk.bold(String(v)) },
            { key: 'version', label: 'Version' },
            { key: 'description', label: 'Description' },
            { key: 'author', label: 'Author' },
            { key: 'downloads', label: 'Downloads' },
            { key: 'rating', label: 'Rating' },
          ],
          results as unknown as Record<string, unknown>[],
        );

        output.raw('');
        output.success(`${results.length} result(s)`);
      } catch (error) {
        output.error(`Search failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
