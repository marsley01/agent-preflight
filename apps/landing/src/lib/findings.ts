import type { CheckResult, ScanReport } from '@shared/types';
import { getRuleById } from './rules-data';

export interface PlainFinding {
  id: string;
  status: 'fail' | 'warn';
  ruleId: string;
  title: string;
  what: string;
  why: string;
  fix: string;
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

export function verdictFromScore(percentage: number): Verdict {
  if (percentage >= 90) {
    return {
      tone: 'pass',
      title: "You're good to ship",
      headline: "Everything important checks out.",
      line: "Nothing blocking found. Deploying now is a safe call.",
    };
  }
  if (percentage >= 75) {
    return {
      tone: 'warn',
      title: 'Almost there',
      headline: 'A couple of small things to tidy up.',
      line: "Nothing critical — but fix the warnings below for a cleaner launch.",
    };
  }
  if (percentage >= 50) {
    return {
      tone: 'warn',
      title: 'Worth fixing first',
      headline: 'Some real issues to address before you deploy.',
      line: "These won't fix themselves. Tackle the red items below, then rescan.",
    };
  }
  return {
    tone: 'fail',
    title: "Don't ship yet",
    headline: 'Critical problems found.',
    line: 'Fix the red items below before going live — your future self will thank you.',
  };
}

function plainMessage(check: CheckResult): string {
  const def = getRuleById(check.checkId);
  const base = def?.description || check.message;
  if (check.status === 'fail') {
    return `This app is missing ${base.replace(/^[Ee]nsures /, '').replace(/\.$/, '')}.`;
  }
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function buildFixPrompt(finding: Omit<PlainFinding, 'fixPrompt'>): string {
  const lines = [
    'Please fix this issue in my code:',
    `Issue: ${finding.title} (${finding.ruleId})`,
  ];
  if (finding.location) lines.push(`Where: ${finding.location}`);
  lines.push(`What it is: ${finding.what}`);
  if (finding.why) lines.push(`Why it matters: ${finding.why}`);
  if (finding.fix) lines.push(`How to fix it: ${finding.fix}`);
  if (finding.snippet) {
    lines.push('Current code:');
    lines.push('```');
    lines.push(finding.snippet);
    lines.push('```');
  }
  lines.push('Apply the fix and follow the suggested approach, keeping the rest of the code working the same.');
  return lines.join('\n');
}

/** Flatten a scan report into human-readable findings with a ready-to-paste fix prompt each. */
export function toPlainFindings(report: ScanReport): PlainFinding[] {
  const findings: PlainFinding[] = [];

  for (const category of report.categories) {
    for (const check of category.checks) {
      if (check.status !== 'fail' && check.status !== 'warn') continue;

      const def = getRuleById(check.checkId);
      const title = def?.title || check.checkId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const what = plainMessage(check);
      const why = def?.whyItMatters || check.impact || '';
      const fix = check.suggestedFix || def?.suggestedFix || '';
      const location = check.file
        ? `${check.file}${check.line ? `:${check.line}` : ''}`
        : '';
      const snippet = check.snippet || '';

      const finding: PlainFinding = {
        id: `${category.categoryId}-${check.checkId}-${location || 'root'}`,
        status: check.status === 'fail' ? 'fail' : 'warn',
        ruleId: check.checkId,
        title,
        what,
        why,
        fix,
        location,
        snippet,
        fixPrompt: '',
      };
      finding.fixPrompt = buildFixPrompt(finding);

      findings.push(finding);
    }
  }

  return findings;
}