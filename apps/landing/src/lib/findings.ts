import type { CategoryId, RiskLevel, ScanReport } from '@shared/types';
import { getRuleById } from './rules-data';

export interface PlainFinding {
  id: string;
  status: 'fail' | 'warn';
  /** Rule risk, used to sort and group findings */
  severity: RiskLevel;
  ruleId: string;
  categoryId: CategoryId;
  categoryLabel: string;
  title: string;
  /** What the scanner found, specific to this repo */
  what: string;
  why: string;
  fix: string;
  file?: string;
  line?: number;
  /** `file:line`, or empty for project-wide findings */
  location: string;
  snippet: string;
  fixPrompt: string;
}

export interface Verdict {
  tone: 'pass' | 'warn' | 'fail';
  title: string;
  headline: string;
  line: string;
}

export const SEVERITY_ORDER: RiskLevel[] = ['critical', 'high', 'medium', 'low', 'info'];

export const SEVERITY_LABEL: Record<RiskLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export function verdictFromScore(percentage: number): Verdict {
  if (percentage >= 90) {
    return {
      tone: 'pass',
      title: 'Ready to ship',
      headline: 'Everything important checks out.',
      line: 'Nothing blocking found. Deploying now is a safe call.',
    };
  }
  if (percentage >= 75) {
    return {
      tone: 'warn',
      title: 'Almost there',
      headline: 'A few small things to tidy up.',
      line: 'Nothing critical. Clear the warnings below for a cleaner launch.',
    };
  }
  if (percentage >= 50) {
    return {
      tone: 'warn',
      title: 'Fix first',
      headline: 'Some real issues to address before you deploy.',
      line: 'Start with the critical and high findings below, then rescan.',
    };
  }
  return {
    tone: 'fail',
    title: "Don't ship yet",
    headline: 'Critical problems found.',
    line: 'Fix the critical findings below before going live.',
  };
}

/**
 * Verdict that never contradicts the findings: a high percentage can't say "ready to ship"
 * while a critical or high-severity issue is still open.
 */
export function verdictFor(percentage: number, counts: Partial<Record<RiskLevel, number>>): Verdict {
  const critical = counts.critical ?? 0;
  const high = counts.high ?? 0;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (critical > 0) {
    return {
      tone: 'fail',
      title: "Don't ship yet",
      headline: `${plural(critical, 'critical issue')} to fix first.`,
      line: 'These are exploitable as-is. Fix them below, then rescan.',
    };
  }
  if (high > 0) {
    return {
      tone: 'warn',
      title: 'Fix first',
      headline: `Close. ${plural(high, 'high-severity issue')} left.`,
      line: 'Fix the high findings below before you deploy, then rescan.',
    };
  }
  return verdictFromScore(percentage);
}

function buildFixPrompt(f: Omit<PlainFinding, 'fixPrompt'>): string {
  const lines = ['Please fix this issue in my code:', `Issue: ${f.title} (${f.ruleId}, ${f.severity} severity)`];
  if (f.location) lines.push(`Where: ${f.location}`);
  lines.push(`What was found: ${f.what}`);
  if (f.why) lines.push(`Why it matters: ${f.why}`);
  if (f.fix) lines.push(`How to fix it: ${f.fix}`);
  if (f.snippet) lines.push('Current code:', '```', f.snippet, '```');
  lines.push('Apply the fix and keep the rest of the code working the same.');
  return lines.join('\n');
}

/** Flatten a scan report into findings with a ready-to-paste fix prompt each, worst first. */
export function toPlainFindings(report: ScanReport): PlainFinding[] {
  const findings: PlainFinding[] = [];

  for (const category of report.categories) {
    for (const check of category.checks) {
      if (check.status !== 'fail' && check.status !== 'warn') continue;

      const def = getRuleById(check.checkId);
      const location = check.file ? `${check.file}${check.line ? `:${check.line}` : ''}` : '';
      const base: Omit<PlainFinding, 'fixPrompt'> = {
        id: `${category.categoryId}-${check.checkId}-${location || 'root'}`,
        status: check.status,
        // A warning is never shown as more severe than "medium", whatever the rule's ceiling.
        severity: check.status === 'warn' && (def?.risk === 'critical' || def?.risk === 'high') ? 'medium' : def?.risk ?? 'medium',
        ruleId: check.checkId,
        categoryId: category.categoryId,
        categoryLabel: category.categoryLabel,
        title: def?.title || check.checkId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        what: check.message,
        why: def?.whyItMatters || check.impact || '',
        fix: check.suggestedFix || def?.suggestedFix || '',
        file: check.file,
        line: check.line,
        location,
        snippet: check.snippet || '',
      };
      findings.push({ ...base, fixPrompt: buildFixPrompt(base) });
    }
  }

  return findings.sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      (a.status === 'fail' ? 0 : 1) - (b.status === 'fail' ? 0 : 1),
  );
}

/** Link to the exact file and line on GitHub, when the report came from a GitHub repo. */
export function githubBlobUrl(repoUrl: string | undefined, f: Pick<PlainFinding, 'file' | 'line'>): string | null {
  if (!repoUrl || !f.file) return null;
  const path = f.file.split('/').map(encodeURIComponent).join('/');
  return `${repoUrl.replace(/\/$/, '')}/blob/HEAD/${path}${f.line ? `#L${f.line}` : ''}`;
}
