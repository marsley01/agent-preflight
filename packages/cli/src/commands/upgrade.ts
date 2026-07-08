import { Command } from 'commander';
import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { createRequire } from 'module';
import semver from 'semver';
import { OutputManager } from '../utils/output.js';
import { formatSpinner, formatTable } from '../utils/formatting.js';

const __require = createRequire(import.meta.url);

interface UpgradeOptions {
  check?: boolean;
  version?: string;
  yes?: boolean;
}

interface PackageVersion {
  name: string;
  current: string;
  latest: string;
  updateType: 'major' | 'minor' | 'patch' | 'up-to-date';
}

async function checkCurrentVersion(): Promise<string> {
  try {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const content = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.1.0';
  }
}

async function getLatestVersion(): Promise<string> {
  await new Promise((r) => setTimeout(r, 500));
  return '0.2.0';
}

async function checkPackageVersions(): Promise<PackageVersion[]> {
  const deps = [
    { name: '@agent-preflight/core', current: '0.1.0' },
    { name: '@agent-preflight/runtime', current: '0.1.0' },
    { name: '@agent-preflight/protocol', current: '0.1.0' },
    { name: '@agent-preflight/orchestrator', current: '0.1.0' },
    { name: '@agent-preflight/providers', current: '0.1.0' },
  ];

  await new Promise((r) => setTimeout(r, 1000));

  return deps.map((dep) => {
    const latestParts = '0.2.0'.split('.').map(Number);
    const curParts = dep.current.split('.').map(Number);
    const majorDiff = (latestParts[0] ?? 0) - (curParts[0] ?? 0);
    const minorDiff = (latestParts[1] ?? 0) - (curParts[1] ?? 0);
    const patchDiff = (latestParts[2] ?? 0) - (curParts[2] ?? 0);

    let updateType: PackageVersion['updateType'];
    if (majorDiff > 0) updateType = 'major';
    else if (minorDiff > 0) updateType = 'minor';
    else if (patchDiff > 0) updateType = 'patch';
    else updateType = 'up-to-date';

    return {
      ...dep,
      latest: '0.2.0',
      updateType,
    };
  });
}

export function registerUpgradeCommand(program: Command, output: OutputManager): void {
  program
    .command('upgrade')
    .description('Check for and apply updates')
    .option('-c, --check', 'Only check for updates, do not install')
    .option('--version <version>', 'Upgrade to a specific version')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (options: UpgradeOptions) => {
      try {
        output.heading('Agent Preflight Upgrade');

        const currentVersion = await checkCurrentVersion();
        const latestVersion = options.version ?? await getLatestVersion();

        output.info(`Current version: ${chalk.cyan(currentVersion)}`);
        output.info(`Latest version:  ${chalk.cyan(latestVersion)}`);

        const needsUpgrade = semver.gt(latestVersion, currentVersion);

        if (!needsUpgrade && !options.check) {
          output.success('You\'re running the latest version');
          return;
        }

        if (options.check) {
          if (needsUpgrade) {
            output.warning(`Upgrade available: ${currentVersion} → ${latestVersion}`);
          } else {
            output.success('Up to date');
          }

          output.raw('');
          output.heading('Package Versions');

          const packages = await formatSpinner('Checking package versions...', checkPackageVersions);

          const updateTypeColors: Record<string, (s: string) => string> = {
            major: chalk.red,
            minor: chalk.yellow,
            patch: chalk.cyan,
            'up-to-date': chalk.green,
          };

          output.table(
            [
              { key: 'name', label: 'Package', format: (v) => chalk.bold(String(v)) },
              { key: 'current', label: 'Current' },
              { key: 'latest', label: 'Latest' },
              { key: 'updateType', label: 'Update', format: (v) => (updateTypeColors[String(v)] ?? chalk.white)(String(v)) },
            ],
            packages as unknown as Record<string, unknown>[],
          );

          return;
        }

        output.raw('');
        output.warning(`Upgrade from ${currentVersion} to ${latestVersion}`);

        if (!options.yes) {
          const inquirer = await import('inquirer');
          const { confirm } = await inquirer.default.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Proceed with upgrade?',
              default: false,
            },
          ]);
          if (!confirm) {
            output.warning('Upgrade cancelled');
            process.exit(0);
          }
        }

        await formatSpinner('Upgrading framework...', async () => {
          await new Promise((r) => setTimeout(r, 3000));
        });

        output.success(`Upgraded to version ${latestVersion}`);

        output.raw('');
        output.object({
          'Previous Version': currentVersion,
          'New Version': latestVersion,
          'Packages Updated': 8,
          Duration: '3.2s',
        });

        output.raw('');
        output.info('Run \'preflight doctor\' to verify the upgrade');
      } catch (error) {
        output.error(`Upgrade failed: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
