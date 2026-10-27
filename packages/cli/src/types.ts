import type { ProjectContext } from './context.js';

/**
 * - `pass`: the check ran and found nothing wrong
 * - `fail`: a definite problem that should block a deploy
 * - `warn`: a likely problem or missing safeguard
 * - `info`: not applicable / informational — excluded from the score
 */
export type CheckStatus = 'pass' | 'fail' | 'warn' | 'info';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export const SEVERITY_ORDER: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];

/** Result of a single check within a category. */
export interface CheckResult {
  /** Stable rule identifier, e.g. `secrets/aws-access-key`. Used for SARIF and suppression. */
  id: string;
  status: CheckStatus;
  severity: Severity;
  /** Human-readable description of the result */
  message: string;
  /** File path relative to the scanned directory (posix separators) */
  file?: string;
  /** 1-based line number within the file */
  line?: number;
  /** Offending code, with secrets redacted */
  snippet?: string;
  /** How to fix it */
  fix?: string;
}

/** A named category containing a set of check results. */
export interface CategoryResult {
  id: string;
  name: string;
  checks: CheckResult[];
}

export interface CheckOptions {
  /** Skip checks that need network access (dependency advisories). */
  offline?: boolean;
}

export interface Category {
  id: string;
  name: string;
  run: (ctx: ProjectContext, opts: CheckOptions) => CheckResult[] | Promise<CheckResult[]>;
}

type Extra = Pick<CheckResult, 'file' | 'line' | 'snippet' | 'fix'>;

export const pass = (id: string, message: string, extra: Extra = {}): CheckResult =>
  ({ id, status: 'pass', severity: 'info', message, ...extra });

export const fail = (id: string, severity: Severity, message: string, extra: Extra = {}): CheckResult =>
  ({ id, status: 'fail', severity, message, ...extra });

export const warn = (id: string, severity: Severity, message: string, extra: Extra = {}): CheckResult =>
  ({ id, status: 'warn', severity, message, ...extra });

export const info = (id: string, message: string, extra: Extra = {}): CheckResult =>
  ({ id, status: 'info', severity: 'info', message, ...extra });
