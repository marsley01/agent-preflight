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
import { renderReport } from './reporter';

export interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  message: string;
  file?: string;
  line?: number;
}

export interface CategoryResult {
  name: string;
  checks: CheckResult[];
}

export interface ScanOptions {
  json?: boolean;
  strict?: boolean;
  only?: string;
}

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
