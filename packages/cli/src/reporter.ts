import chalk from 'chalk';
import type { ScanReport } from './scan.js';
import type { CheckResult, Severity } from './types.js';

const STATUS_RANK = { fail: 0, warn: 1, pass: 2, info: 3 } as const;
const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function sortChecks(checks: CheckResult[]): CheckResult[] {
  return [...checks].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || SEV_RANK[a.severity] - SEV_RANK[b.severity]);
}

/** `file:line`, plus every other place an identical finding was found. */
function location(c: CheckResult): string {
  if (!c.file) return '';
  return [{ file: c.file, line: c.line }, ...(c.also ?? [])].map((l) => `${l.file}${l.line ? `:${l.line}` : ''}`).join(', ');
}

/** Same as location(), but long lists are cut to the first few for the default terminal view. */
function shortLocation(c: CheckResult, max = 3): string {
  if (!c.file) return '';
  const all = [{ file: c.file, line: c.line }, ...(c.also ?? [])].map((l) => `${l.file}${l.line ? `:${l.line}` : ''}`);
  return all.length > max ? `${all.slice(0, max).join(', ')} +${all.length - max} more` : all.join(', ');
}

/** A category whose only result is "not applicable" (no payment SDK, no GraphQL server, ...). */
function notApplicable(c: { checks: CheckResult[] }): boolean {
  return c.checks.length > 0 && c.checks.every((x) => x.status === 'info') && c.checks.some((x) => /\/not-applicable$/.test(x.id));
}

/**
 * Terminal-only: findings that are identical except for where they are (same rule, status,
 * severity and message) become one line listing every location. JSON and SARIF keep them separate.
 */
function mergeIdentical(checks: CheckResult[]): CheckResult[] {
  const merged = new Map<string, CheckResult>();
  for (const c of checks) {
    if (!c.file) {
      merged.set(`${merged.size}`, c);
      continue;
    }
    const key = [c.id, c.status, c.severity, c.message].join('\u0000');
    const prev = merged.get(key);
    if (!prev) merged.set(key, { ...c, also: [...(c.also ?? [])] });
    else prev.also!.push({ file: c.file, line: c.line }, ...(c.also ?? []));
  }
  return [...merged.values()];
}

/** Map a check status to its corresponding icon. */
function icon(status: CheckResult['status']) {
  if (status === 'pass') return chalk.green('\u2705');
  if (status === 'fail') return chalk.red('\u274C');
  if (status === 'warn') return chalk.yellow('\u26A0\uFE0F ');
  return chalk.dim('\u2013 ');
}

function sevTag(c: CheckResult): string {
  if (c.status === 'pass' || c.status === 'info') return '';
  const label = c.severity.toUpperCase().padEnd(8);
  const color = c.severity === 'critical' ? chalk.bgRed.white.bold
    : c.severity === 'high' ? chalk.red.bold
      : c.severity === 'medium' ? chalk.yellow
        : chalk.dim;
  return `${color(label)} `;
}

/**
 * Render the scan report for the terminal: each category with its checks
 * (worst first), fix hints for findings, then a summary score.
 */
export function renderReport(report: ScanReport, opts: { verbose?: boolean } = {}): string {
  const out: string[] = [''];
  out.push(chalk.bold(`\u{1F6EB} Agent Preflight v${report.tool.version} \u2014 Pre-Deploy Scan`));
  out.push(chalk.dim(`Scanning: ${report.root}`));
  if (report.stack) out.push(chalk.dim(`Detected: ${report.stack}`));
  out.push('');

  // Categories that don't apply to this project collapse into one line.
  const skipped = report.categories.filter(notApplicable);
  for (const category of report.categories.filter((c) => !notApplicable(c))) {
    out.push(chalk.bold(`  ${category.name}`));
    const checks = sortChecks(category.checks);
    const passes = checks.filter((c) => c.status === 'pass');
    for (const c of opts.verbose ? checks : mergeIdentical(checks.filter((c) => c.status !== 'pass'))) {
      const locs = opts.verbose ? location(c) : shortLocation(c);
      const loc = locs ? chalk.dim(` (${locs})`) : '';
      const msg = c.status === 'info' ? chalk.dim(c.message) : c.message;
      out.push(`  ${icon(c.status)}  ${sevTag(c)}${msg}${loc}`);
      if (opts.verbose && c.snippet) out.push(chalk.dim(`        ${c.snippet}`));
      if ((c.status === 'fail' || c.status === 'warn') && c.fix) out.push(chalk.cyan(`        \u21B3 ${c.fix}`));
    }
    if (!opts.verbose && passes.length > 0) {
      out.push(`  ${icon('pass')}  ${passes.length === 1 ? passes[0].message : chalk.dim(`${passes.length} checks passed`)}`);
    }
    out.push('');
  }
  if (skipped.length > 0) {
    out.push(chalk.dim(`  Skipped ${skipped.length} ${skipped.length === 1 ? 'category' : 'categories'} not used by this project (${skipped.map((c) => c.name).join(', ')})`));
    out.push('');
  }

  const s = report.summary;
  const counts = (['critical', 'high', 'medium', 'low'] as Severity[])
    .filter((sev) => s.bySeverity[sev] > 0)
    .map((sev) => `${s.bySeverity[sev]} ${sev}`)
    .join(', ');
  const line = `Score: ${s.score}/100 \u2014 ${s.passed}/${s.total} checks passed${counts ? ` \u00B7 ${counts}` : ''}`;
  const blockers = s.bySeverity.critical + s.bySeverity.high;

  if (s.failed === 0 && s.warned === 0) {
    out.push(chalk.green.bold(`${line}\nAll clear. Ready to deploy. \u{1F680}`));
  } else if (blockers > 0) {
    out.push(chalk.red.bold(`${line}\nFix ${blockers} critical/high issue${blockers > 1 ? 's' : ''} before deploying.`));
  } else {
    out.push(chalk.yellow.bold(`${line}\nNo blockers \u2014 review the warnings above.`));
  }
  out.push(chalk.dim(`Finished in ${(report.durationMs / 1000).toFixed(1)}s. Suppress a finding with a \`preflight-ignore\` comment; exclude paths in .preflightignore.`));
  out.push('');
  return out.join('\n');
}

const MD_ICON = { pass: '\u2705', fail: '\u274C', warn: '\u26A0\uFE0F', info: '\u2796' } as const;

/** Escape characters that would break a Markdown table cell or inline text. */
function md(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/\r?\n/g, ' ');
}

/** Markdown report, suitable for PR comments and job summaries. */
export function renderMarkdown(report: ScanReport): string {
  const s = report.summary;
  const out: string[] = ['## \u{1F6EB} Preflight Scan Results', ''];
  out.push(`**Score: ${s.score}/100** \u00B7 ${s.passed}/${s.total} checks passed \u00B7 ` +
    `${s.bySeverity.critical} critical \u00B7 ${s.bySeverity.high} high \u00B7 ${s.bySeverity.medium} medium \u00B7 ${s.bySeverity.low} low`);
  out.push('');

  const findings = report.categories.flatMap((c) =>
    sortChecks(c.checks).filter((x) => x.status === 'fail' || x.status === 'warn').map((x) => ({ cat: c.name, x })));

  if (findings.length === 0) {
    out.push('All clear \u2014 ready to deploy. \u{1F680}');
  } else {
    out.push('| | Severity | Category | Finding | Location |', '|---|---|---|---|---|');
    for (const { cat, x } of findings.slice(0, 100)) {
      const loc = location(x) ? `\`${md(location(x))}\`` : '';
      out.push(`| ${MD_ICON[x.status]} | ${x.severity} | ${cat} | ${md(x.message)}${x.fix ? `<br><sub>${md(x.fix)}</sub>` : ''} | ${loc} |`);
    }
    if (findings.length > 100) out.push('', `_\u2026and ${findings.length - 100} more. Run \`npx @preflight-agent/cli scan\` locally for the full list._`);
  }

  const passed = report.categories.flatMap((c) => c.checks.filter((x) => x.status === 'pass').map((x) => `- ${MD_ICON.pass} ${md(x.message)}`));
  if (passed.length) {
    out.push('', `<details><summary>${passed.length} passing checks</summary>`, '', ...passed, '', '</details>');
  }
  out.push('', `<sub>agent-preflight v${report.tool.version}</sub>`);
  return out.join('\n');
}

/** SARIF 2.1.0 for GitHub Code Scanning and other SAST dashboards. */
export function renderSarif(report: ScanReport) {
  const findings = report.categories.flatMap((c) => c.checks.filter((x) => x.status === 'fail' || x.status === 'warn'));
  const ruleIds = [...new Set(findings.map((f) => f.id))];
  const level = (sev: Severity) => (sev === 'critical' || sev === 'high' ? 'error' : sev === 'medium' ? 'warning' : 'note');
  const securitySeverity: Record<Severity, string> = { critical: '9.5', high: '8.0', medium: '5.5', low: '3.0', info: '0.0' };

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'agent-preflight',
          version: report.tool.version,
          informationUri: 'https://github.com/marsley01/agent-preflight',
          rules: ruleIds.map((id) => {
            const first = findings.find((f) => f.id === id)!;
            const worst = findings.filter((f) => f.id === id).sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])[0];
            return {
              id,
              shortDescription: { text: first.message.slice(0, 120) },
              help: { text: first.fix ?? first.message },
              properties: { tags: ['security'], 'security-severity': securitySeverity[worst.severity] },
            };
          }),
        },
      },
      results: findings.map((f) => ({
        ruleId: f.id,
        ruleIndex: ruleIds.indexOf(f.id),
        level: level(f.severity),
        message: { text: f.fix ? `${f.message}. Fix: ${f.fix}` : f.message },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: f.file ?? 'package.json' },
            ...(f.line ? { region: { startLine: f.line } } : {}),
          },
        }],
        ...(f.also?.length
          ? {
            relatedLocations: f.also.map((l, i) => ({
              id: i + 1,
              physicalLocation: { artifactLocation: { uri: l.file }, ...(l.line ? { region: { startLine: l.line } } : {}) },
            })),
          }
          : {}),
      })),
    }],
  };
}
