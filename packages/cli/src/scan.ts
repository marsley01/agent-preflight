import fs from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import { ProjectContext } from './context.js';
import { CATEGORIES } from './checks/index.js';
import { renderReport, renderMarkdown, renderSarif } from './reporter.js';
import { type CategoryResult, type CheckResult, type Severity, SEVERITY_ORDER } from './types.js';

export * from './types.js';
export { ProjectContext } from './context.js';
export { CATEGORIES } from './checks/index.js';

export type OutputFormat = 'pretty' | 'json' | 'markdown' | 'sarif';

/** CLI options accepted by the scan command. */
export interface ScanOptions {
  /** Shorthand for `--format json` */
  json?: boolean;
  format?: OutputFormat;
  /** Write the report to a file instead of stdout */
  output?: string;
  /** Exit with code 1 if any check fails */
  strict?: boolean;
  /** Exit with code 1 if any finding is at or above this severity */
  failOn?: Severity;
  /** Comma-separated category ids to run */
  only?: string;
  /** Skip network lookups (dependency advisories) */
  offline?: boolean;
  /** Show passing checks in the terminal report */
  verbose?: boolean;
}

export interface ScanSummary {
  /** 0–100, deducted per distinct failing rule by severity */
  score: number;
  passed: number;
  failed: number;
  warned: number;
  total: number;
  bySeverity: Record<Severity, number>;
}

export interface ScanReport {
  tool: { name: string; version: string };
  root: string;
  durationMs: number;
  summary: ScanSummary;
  categories: CategoryResult[];
}

const PENALTY: Record<Severity, number> = { critical: 25, high: 10, medium: 4, low: 1, info: 0 };

export function toolVersion(): string {
  try {
    const pkgPath = new URL('../package.json', import.meta.url);
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version;
  } catch {
    return '0.0.0';
  }
}

export function summarize(categories: CategoryResult[]): ScanSummary {
  const all = categories.flatMap((c) => c.checks).filter((c) => c.status !== 'info');
  const findings = all.filter((c) => c.status === 'fail' || c.status === 'warn');
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach((f) => bySeverity[f.severity]++);

  // Penalize each rule once at its worst severity so one noisy rule can't zero the score.
  const worst = new Map<string, number>();
  for (const f of findings) {
    const p = PENALTY[f.severity] * (f.status === 'warn' ? 0.5 : 1);
    worst.set(f.id, Math.max(worst.get(f.id) ?? 0, p));
  }
  const penalty = [...worst.values()].reduce((a, b) => a + b, 0);

  return {
    score: Math.max(0, Math.round(100 - penalty)),
    passed: all.filter((c) => c.status === 'pass').length,
    failed: all.filter((c) => c.status === 'fail').length,
    warned: all.filter((c) => c.status === 'warn').length,
    total: all.length,
    bySeverity,
  };
}

/** Findings at or above `threshold` severity. */
export function findingsAtOrAbove(report: ScanReport, threshold: Severity): CheckResult[] {
  const min = SEVERITY_ORDER.indexOf(threshold);
  return report.categories
    .flatMap((c) => c.checks)
    .filter((c) => (c.status === 'fail' || c.status === 'warn') && SEVERITY_ORDER.indexOf(c.severity) >= min);
}

/**
 * Programmatic API: scan a directory and return the report without printing anything.
 */
export async function scan(
  dir: string,
  options: Pick<ScanOptions, 'only' | 'offline'> = {},
  onCategory?: (name: string) => void,
): Promise<ScanReport> {
  const started = Date.now();
  const root = path.resolve(dir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Not a directory: ${root}`);
  }

  const only = options.only?.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const unknown = only?.filter((id) => !CATEGORIES.some((c) => c.id === id));
  if (unknown?.length) {
    throw new Error(`Unknown category: ${unknown.join(', ')}. Valid: ${CATEGORIES.map((c) => c.id).join(', ')}`);
  }

  const ctx = ProjectContext.load(root);
  const categories: CategoryResult[] = [];
  for (const cat of CATEGORIES) {
    if (only && !only.includes(cat.id)) continue;
    onCategory?.(cat.name);
    const checks = await cat.run(ctx, { offline: options.offline });
    categories.push({ id: cat.id, name: cat.name, checks });
  }

  return {
    tool: { name: 'agent-preflight', version: toolVersion() },
    root,
    durationMs: Date.now() - started,
    summary: summarize(categories),
    categories,
  };
}

/** Category names as 0.1.x printed them, for categories that were renamed since. */
const LEGACY_CATEGORY_NAMES: Record<string, string> = {
  security: 'Security',
  database: 'Database',
  vulnerabilities: 'Vulnerabilities',
};

export interface LegacyCategory {
  name: string;
  checks: Array<Omit<CheckResult, 'status'> & { status: 'pass' | 'fail' | 'warn' }>;
}

/**
 * The `--json` shape from 0.1.x: a bare array of `{ name, checks: [{ status, message, file?, line? }] }`
 * where status is only ever pass/fail/warn. New fields (id, severity, fix, snippet) are added, never
 * renamed, and "not applicable" results map to `warn` exactly as 0.1.x reported skipped categories.
 */
export function toLegacyJson(report: ScanReport): LegacyCategory[] {
  return report.categories.map((c) => ({
    name: LEGACY_CATEGORY_NAMES[c.id] ?? c.name,
    checks: c.checks.map(({ status, message, file, line, ...rest }) => ({
      status: status === 'info' ? 'warn' : status,
      message,
      ...(file !== undefined ? { file } : {}),
      ...(line !== undefined ? { line } : {}),
      ...rest,
    })),
  }));
}

/**
 * CLI entry: run the scan, print or write the report, and set the exit code.
 *
 * Exit codes: 0 = ok, 1 = findings exceeded `--strict` / `--fail-on`, 2 = scan error.
 */
export async function runScan(dir: string, options: ScanOptions) {
  // `--json` keeps the 0.1.x output shape so existing CI scripts don't break; `--format json` is the full report.
  const format: OutputFormat | 'legacy-json' = options.json ? 'legacy-json' : options.format ?? 'pretty';
  const interactive = format === 'pretty' && !options.output && process.stderr.isTTY;
  const spinner = ora({ text: `Scanning ${path.resolve(dir)}`, isSilent: !interactive, stream: process.stderr }).start();

  let report: ScanReport;
  try {
    report = await scan(dir, options, (name) => { spinner.text = `Checking ${name}...`; });
    spinner.stop();
  } catch (err: any) {
    spinner.fail('Scan failed');
    console.error(err?.message ?? err);
    process.exitCode = 2;
    return;
  }

  let out: string;
  if (format === 'legacy-json') out = JSON.stringify(toLegacyJson(report), null, 2);
  else if (format === 'json') out = JSON.stringify(report, null, 2);
  else if (format === 'sarif') out = JSON.stringify(renderSarif(report), null, 2);
  else if (format === 'markdown') out = renderMarkdown(report);
  else out = renderReport(report, { verbose: options.verbose });

  if (options.output) {
    fs.writeFileSync(options.output, out);
    console.error(`Report written to ${options.output} (score ${report.summary.score}/100)`);
  } else {
    process.stdout.write(out.endsWith('\n') ? out : `${out}\n`);
  }

  const blocking = options.failOn
    ? findingsAtOrAbove(report, options.failOn)
    : options.strict
      ? report.categories.flatMap((c) => c.checks).filter((c) => c.status === 'fail')
      : [];
  if (blocking.length > 0) process.exitCode = 1;
}
