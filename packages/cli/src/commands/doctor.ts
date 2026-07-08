import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'module';
import { hostname, platform, release, totalmem, freemem, arch, cpus } from 'os';
import { access, constants } from 'fs/promises';
import { resolve } from 'path';
import semver from 'semver';
import { OutputManager } from '../utils/output.js';
import { formatBytes, formatStatus } from '../utils/formatting.js';

const __require = createRequire(import.meta.url);

interface DoctorOptions {
  verbose?: boolean;
}

interface CheckResult {
  name: string;
  status: 'success' | 'error' | 'warning' | 'info' | 'pending' | 'running';
  message: string;
  detail?: string;
}

async function checkNodeVersion(): Promise<CheckResult> {
  const current = process.versions.node;
  const minVersion = '18.0.0';
  if (semver.gte(current, minVersion)) {
    return {
      name: 'Node.js Version',
      status: 'success',
      message: `${current} (minimum ${minVersion})`,
    };
  }
  return {
    name: 'Node.js Version',
    status: 'error',
    message: `${current} — upgrade to >= ${minVersion}`,
  };
}

async function checkPackageManager(): Promise<CheckResult> {
  const hasPnpm = await fileExists(process.cwd(), 'pnpm-lock.yaml');
  const hasNpm = await fileExists(process.cwd(), 'package-lock.json');
  const hasYarn = await fileExists(process.cwd(), 'yarn.lock');
  if (hasPnpm) return { name: 'Package Manager', status: 'success', message: 'pnpm' };
  if (hasYarn) return { name: 'Package Manager', status: 'warning', message: 'yarn (recommended: pnpm)' };
  if (hasNpm) return { name: 'Package Manager', status: 'warning', message: 'npm (recommended: pnpm)' };
  return { name: 'Package Manager', status: 'info', message: 'Not detected' };
}

async function checkDependencies(): Promise<CheckResult> {
  try {
    const modules = resolve(process.cwd(), 'node_modules', '@agent-preflight');
    await access(modules, constants.F_OK);
    return { name: 'Dependencies', status: 'success', message: 'Installed' };
  } catch {
    return { name: 'Dependencies', status: 'warning', message: 'Not installed — run pnpm install' };
  }
}

async function checkConfig(): Promise<CheckResult> {
  const configPath = resolve(process.cwd(), 'preflight.json');
  try {
    await access(configPath, constants.F_OK);
    return { name: 'Configuration', status: 'success', message: 'preflight.json found' };
  } catch {
    return { name: 'Configuration', status: 'warning', message: 'preflight.json not found' };
  }
}

async function checkEnvFile(): Promise<CheckResult> {
  const envPath = resolve(process.cwd(), '.env');
  const envExample = resolve(process.cwd(), '.env.example');
  try {
    await access(envPath, constants.F_OK);
    return { name: 'Environment', status: 'success', message: '.env found' };
  } catch {
    try {
      await access(envExample, constants.F_OK);
      return { name: 'Environment', status: 'warning', message: 'Copy .env.example to .env' };
    } catch {
      return { name: 'Environment', status: 'info', message: 'No .env file' };
    }
  }
}

async function checkDiskSpace(): Promise<CheckResult> {
  const mem = totalmem();
  const free = freemem();
  const usage = ((mem - free) / mem) * 100;
  if (usage > 90) {
    return { name: 'Memory Usage', status: 'warning', message: `${usage.toFixed(1)}% used` };
  }
  return { name: 'Memory Usage', status: 'success', message: `${usage.toFixed(1)}% used` };
}

async function checkSystemInfo(): Promise<CheckResult> {
  const cpuModel = cpus()[0]?.model ?? 'unknown';
  const cpuCores = cpus().length;
  return {
    name: 'System',
    status: 'info',
    message: `${platform()} ${release()} — ${cpuCores} cores`,
    detail: cpuModel,
  };
}

async function fileExists(dir: string, file: string): Promise<boolean> {
  try {
    await access(resolve(dir, file), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

const CHECKS: (() => Promise<CheckResult>)[] = [
  checkNodeVersion,
  checkPackageManager,
  checkDependencies,
  checkConfig,
  checkEnvFile,
  checkDiskSpace,
  checkSystemInfo,
];

export function registerDoctorCommand(program: Command, output: OutputManager): void {
  program
    .command('doctor')
    .description('Run system diagnostics and health checks')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (options: DoctorOptions) => {
      output.heading('Agent Preflight Diagnostics');
      output.raw(chalk.gray(`${platform()} ${arch()} — ${hostname()}\n`));

      const results: CheckResult[] = [];
      const errors: string[] = [];

      for (const check of CHECKS) {
        try {
          const result = await check();
          results.push(result);
          if (options.verbose && result.detail) {
            output.raw(`  ${chalk.gray('→')} ${result.detail}`);
          }
        } catch (error) {
          results.push({
            name: check.name || 'Unknown check',
            status: 'error',
            message: (error as Error).message,
          });
          errors.push((error as Error).message);
        }
      }

      output.raw('');
      output.statusTable(results);

      const failed = results.filter((r) => r.status === 'error');
      const warnings = results.filter((r) => r.status === 'warning');

      output.raw('');
      output.divider();

      if (failed.length === 0 && warnings.length === 0) {
        output.success('All checks passed');
      } else if (failed.length === 0) {
        output.warning(`${warnings.length} warning(s) found`);
      } else {
        output.error(`${failed.length} error(s), ${warnings.length} warning(s) found`);
      }
    });
}
