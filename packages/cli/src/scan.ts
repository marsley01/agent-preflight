import path from 'path';
import ora from 'ora';
import { runSecurityChecks } from './checks/security';
import { runAuthChecks } from './checks/auth';
import { runPaymentChecks } from './checks/payments';
import { runDatabaseChecks } from './checks/database';
import { runApiChecks } from './checks/api';
import { runWebChecks } from './checks/web';
import { runGraphqlChecks } from './checks/graphql';
import { runRealtimeChecks } from './checks/realtime';
import { runVulnerabilityChecks } from './checks/vulnerabilities';
import { renderReport } from './reporter';

/**
 * Result of a single check within a category.
 */
export interface CheckResult {
  /** Whether the check passed, failed, or is a warning */
  status: 'pass' | 'fail' | 'warn';
  /** Human-readable description of the result */
  message: string;
  /** File path relative to the scanned directory (if applicable) */
  file?: string;
  /** Line number within the file (if applicable) */
  line?: number;
}

/**
 * A named category containing a set of check results.
 */
export interface CategoryResult {
  /** Display name for the category (e.g. "Security", "Database") */
  name: string;
  /** Individual check results within this category */
  checks: CheckResult[];
}

/**
 * CLI options accepted by the scan command.
 */
export interface ScanOptions {
  /** Output results as JSON instead of a terminal report */
  json?: boolean;
  /** Exit with code 1 if any checks fail */
  strict?: boolean;
  /** Run only a single category by name */
  only?: string;
}

/**
 * Run all applicable security checks against a project directory.
 * Iterates through all 9 check categories, filters by `--only` if set,
 * and either prints a terminal report or writes JSON to stdout.
 *
 * When `--strict` is set, the process exits with code 1 if any check fails.
 */
export async function runScan(dir: string, options: ScanOptions) {
  const absoluteDir = path.resolve(process.cwd(), dir);

  const spinner = ora(`Scanning: ${absoluteDir}`).start();

  try {
    const categories: CategoryResult[] = [];

    const shouldRun = (name: string) =>
      !options.only || options.only.toLowerCase() === name;

    if (shouldRun('security')) {
      spinner.text = 'Checking security...';
      categories.push({
        name: 'Security',
        checks: await runSecurityChecks(absoluteDir),
      });
    }

    if (shouldRun('auth')) {
      spinner.text = 'Checking authentication...';
      categories.push({
        name: 'Authentication',
        checks: await runAuthChecks(absoluteDir),
      });
    }

    if (shouldRun('payments')) {
      spinner.text = 'Checking payments...';
      categories.push({
        name: 'Payments',
        checks: await runPaymentChecks(absoluteDir),
      });
    }

    if (shouldRun('database')) {
      spinner.text = 'Checking database...';
      categories.push({
        name: 'Database',
        checks: await runDatabaseChecks(absoluteDir),
      });
    }

    if (shouldRun('api')) {
      spinner.text = 'Checking API & Validation...';
      categories.push({
        name: 'API & Validation',
        checks: await runApiChecks(absoluteDir),
      });
    }

    if (shouldRun('web')) {
      spinner.text = 'Checking web security...';
      categories.push({
        name: 'Web Security',
        checks: await runWebChecks(absoluteDir),
      });
    }

    if (shouldRun('graphql')) {
      spinner.text = 'Checking GraphQL...';
      categories.push({
        name: 'GraphQL',
        checks: await runGraphqlChecks(absoluteDir),
      });
    }

    if (shouldRun('realtime')) {
      spinner.text = 'Checking real-time connections...';
      categories.push({
        name: 'Real-Time',
        checks: await runRealtimeChecks(absoluteDir),
      });
    }

    if (shouldRun('vulnerabilities')) {
      spinner.text = 'Checking for web vulnerabilities...';
      categories.push({
        name: 'Vulnerabilities',
        checks: await runVulnerabilityChecks(absoluteDir),
      });
    }

    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(categories, null, 2));
    } else {
      renderReport(absoluteDir, categories);
    }

    const hasFail = categories
      .flatMap((c) => c.checks)
      .some((c) => c.status === 'fail');

    if (options.strict && hasFail) {
      process.exit(1);
    }
  } catch (err) {
    spinner.fail('Scan failed');
    console.error(err);
    process.exit(1);
  }
}
