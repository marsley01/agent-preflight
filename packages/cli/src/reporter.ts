import chalk from 'chalk';
import type { CategoryResult, CheckResult } from './scan';

function icon(status: CheckResult['status']) {
  if (status === 'pass') return chalk.green('\u2705');
  if (status === 'fail') return chalk.red('\u274C');
  return chalk.yellow('\u26A0\uFE0F');
}

function score(categories: CategoryResult[]) {
  const all = categories.flatMap((c) => c.checks);
  const passed = all.filter((c) => c.status === 'pass').length;
  return { passed, total: all.length };
}

export function renderReport(dir: string, categories: CategoryResult[]) {
  console.log('');
  console.log(chalk.bold('\u{1F6EB} Agent Preflight \u2014 Pre-Deploy Scan'));
  console.log(chalk.dim(`Scanning: ${dir}`));
  console.log('');

  for (const category of categories) {
    console.log(chalk.bold(`  ${category.name}`));
    for (const check of category.checks) {
      const location =
        check.file
          ? chalk.dim(` (${check.file}${check.line ? `:${check.line}` : ''})`)
          : '';
      console.log(`  ${icon(check.status)}  ${check.message}${location}`);
    }
    console.log('');
  }

  const { passed, total } = score(categories);
  const ratio = `${passed}/${total}`;
  const fails = categories.flatMap((c) => c.checks).filter((c) => c.status === 'fail');

  if (fails.length === 0) {
    console.log(chalk.green(`Score: ${ratio} \u2014 All clear. Ready to deploy. \u{1F680}`));
  } else {
    console.log(
      chalk.red(`Score: ${ratio} \u2014 Fix ${fails.length} critical issue${fails.length > 1 ? 's' : ''} before deploying.`)
    );
  }

  console.log('');
}
