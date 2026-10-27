import React, { useId, useMemo, useState } from 'react';
import { CATEGORIES } from '@shared/types';
import type { CategoryId, RiskLevel } from '@shared/types';
import { useScanStore } from '../store/scan-store';
import {
  githubBlobUrl,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  toPlainFindings,
  verdictFor,
  type PlainFinding,
} from '../lib/findings';
import { ScoreBar, ScoreRing } from './Charts';
import { Icon } from './Icon';

interface OverviewViewProps {
  onNavigateTab: (tab: string) => void;
  onShowToast: (msg: string) => void;
}

const EXAMPLE_REPOS = ['vercel/ai-chatbot', 'vercel/commerce', 't3-oss/create-t3-app'];

type StatusFilter = 'all' | 'fail' | 'warn';

export const SEVERITY_BADGE: Record<RiskLevel, string> = {
  critical: 'bg-status-fail text-on-error',
  high: 'bg-status-failMuted text-status-fail',
  medium: 'bg-status-warnMuted text-status-warn',
  low: 'bg-surface-container text-on-surface-variant',
  info: 'bg-surface-container text-on-surface-variant',
};

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigateTab, onShowToast }) => {
  const { repoUrl, setRepoUrl, isScanning, scanProgress, scanStage, scanError, lastReport, usingAuthToken, triggerScan, downloadSARIFReport } =
    useScanStore();

  const findings = useMemo(() => (lastReport ? toPlainFindings(lastReport) : []), [lastReport]);

  const runScan = async (target?: string) => {
    if (target) setRepoUrl(target);
    const report = await triggerScan(target);
    if (report?.status === 'complete') onShowToast(`Scan complete: ${report.score.percentage}% ready`);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-4 py-8 sm:px-6 md:py-12">
      <ScanForm
        repoUrl={repoUrl}
        setRepoUrl={setRepoUrl}
        isScanning={isScanning}
        scanError={scanError}
        usingAuthToken={usingAuthToken}
        onScan={runScan}
        onNavigateTab={onNavigateTab}
      />

      {isScanning && <ScanningState label={scanProgress} stage={scanStage} />}

      {!isScanning && lastReport && (
        <Results
          key={lastReport.id}
          report={lastReport}
          findings={findings}
          onRescan={() => runScan()}
          onDownloadSarif={downloadSARIFReport}
          onShowToast={onShowToast}
        />
      )}

      {!isScanning && !lastReport && <WhatWeCheck />}

      <CliCallout onNavigateTab={onNavigateTab} onShowToast={onShowToast} />
    </div>
  );
};

/* ------------------------------------------------------------------ */

function ScanForm({
  repoUrl,
  setRepoUrl,
  isScanning,
  scanError,
  usingAuthToken,
  onScan,
  onNavigateTab,
}: {
  repoUrl: string;
  setRepoUrl: (v: string) => void;
  isScanning: boolean;
  scanError: string | null;
  usingAuthToken: boolean;
  onScan: (target?: string) => void;
  onNavigateTab: (tab: string) => void;
}) {
  const inputId = useId();
  const rateLimited = scanError ? /rate limit/i.test(scanError) : false;

  return (
    <section className="max-w-3xl">
      <h1 className="font-headline-lg text-on-surface">Find what's broken before you ship</h1>
      <p className="mt-3 max-w-[60ch] font-body-lg text-on-surface-variant">
        Paste a public GitHub repo. Preflight checks security, AI safety, runtime and more, then hands you the fixes.
      </p>

      <form
        className="mt-7"
        onSubmit={(e) => {
          e.preventDefault();
          onScan();
        }}
      >
        <label htmlFor={inputId} className="font-label-md text-on-surface">
          Repository
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Icon name="github" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              id={inputId}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="owner/repo or https://github.com/owner/repo"
              aria-invalid={!!scanError}
              aria-describedby={scanError ? `${inputId}-error` : undefined}
              className="h-12 w-full rounded-xl border border-surface-container-high bg-surface-container-lowest pl-11 pr-4 font-body-md text-on-surface shadow-sm transition-colors placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 aria-[invalid=true]:border-status-fail"
            />
          </div>
          <button
            type="submit"
            disabled={isScanning || !repoUrl.trim()}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-headline-sm text-on-primary shadow-sm transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name={isScanning ? 'refresh' : 'play'} size={16} weight="fill" className={isScanning ? 'animate-spin' : ''} />
            {isScanning ? 'Scanning' : 'Scan repo'}
          </button>
        </div>

        {scanError ? (
          <div id={`${inputId}-error`} role="alert" className="mt-3 flex gap-2 rounded-lg bg-status-failMuted px-3 py-2.5 font-body-sm text-on-surface">
            <Icon name="warning-circle" size={16} className="mt-0.5 text-status-fail" />
            <div>
              <span className="font-medium">{scanError}.</span>{' '}
              {rateLimited ? (
                <>
                  GitHub allows 60 anonymous requests an hour. Add a read-only token to raise the limit,{' '}
                  <button type="button" onClick={() => onNavigateTab('learn')} className="underline underline-offset-2">
                    see how
                  </button>
                  .
                </>
              ) : (
                'Check the link is a public GitHub repository and try again.'
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2 font-body-sm text-on-surface-variant">
            <span>Try</span>
            {EXAMPLE_REPOS.map((repo) => (
              <button
                key={repo}
                type="button"
                disabled={isScanning}
                onClick={() => onScan(`github.com/${repo}`)}
                className="rounded-full border border-surface-container-high bg-surface-container-lowest px-2.5 py-0.5 font-code-inline text-on-surface-variant transition-colors hover:border-outline hover:text-on-surface disabled:opacity-40"
              >
                {repo}
              </button>
            ))}
            {usingAuthToken && (
              <span className="ml-auto inline-flex items-center gap-1 text-status-pass">
                <Icon name="shield" size={14} /> Using your GitHub token
              </span>
            )}
          </div>
        )}
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ScanningState({ label, stage }: { label: string; stage: { index: number; total: number } | null }) {
  const pct = stage ? Math.round(((stage.index + 1) / stage.total) * 100) : 5;
  return (
    <section aria-live="polite" aria-busy="true" className="flex flex-col gap-6">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between font-label-md">
          <span className="text-on-surface">{label || 'Starting your scan'}</span>
          {stage && (
            <span className="tabular-nums text-secondary">
              Step {stage.index + 1} of {stage.total}
            </span>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="skeleton h-64" />
        <div className="flex flex-col gap-3">
          <div className="skeleton h-16" />
          <div className="skeleton h-16" />
          <div className="skeleton h-16" />
          <div className="skeleton h-16 opacity-60" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Results({
  report,
  findings,
  onRescan,
  onDownloadSarif,
  onShowToast,
}: {
  report: NonNullable<ReturnType<typeof useScanStore.getState>['lastReport']>;
  findings: PlainFinding[];
  onRescan: () => void;
  onDownloadSarif: () => void;
  onShowToast: (msg: string) => void;
}) {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [query, setQuery] = useState('');

  const bySeverity = useMemo(() => {
    const counts: Record<RiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    findings.forEach((f) => counts[f.severity]++);
    return counts;
  }, [findings]);
  const verdict = verdictFor(report.score.percentage, bySeverity);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return findings.filter(
      (f) =>
        (status === 'all' || f.status === status) &&
        (!category || f.categoryId === category) &&
        (!q || [f.title, f.what, f.location, f.ruleId].some((s) => s.toLowerCase().includes(q))),
    );
  }, [findings, status, category, query]);

  const copyAll = () => {
    const blocking = findings.filter((f) => f.status === 'fail');
    const list = blocking.length ? blocking : findings;
    const text = [
      `Please fix these ${list.length} issues found by Preflight in ${report.repoName}, most severe first:`,
      ...list.map((f, i) => `\n${i + 1}. ${f.title} [${f.severity}]${f.location ? ` in ${f.location}` : ''}\n   Found: ${f.what}${f.fix ? `\n   Fix: ${f.fix}` : ''}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    onShowToast(`Copied ${list.length} fixes as one prompt`);
  };

  const groups = SEVERITY_ORDER.map((sev) => ({ sev, items: visible.filter((f) => f.severity === sev) })).filter((g) => g.items.length);

  return (
    <section className="fade-in flex flex-col gap-6" aria-label="Scan results">
      {/* Summary */}
      <div className="grid gap-6 rounded-xl border border-surface-container-high bg-surface-container-lowest p-5 sm:p-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex justify-center">
          <ScoreRing percentage={report.score.percentage} verdict={verdict} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <a
              href={report.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-code-inline text-on-surface-variant hover:text-on-surface"
            >
              <Icon name="github" size={14} />
              {report.repoName}
              <Icon name="external" size={12} />
            </a>
            <h2 className="mt-1 font-headline-md text-on-surface">{verdict.headline}</h2>
            <p className="mt-1 font-body-md text-on-surface-variant">{verdict.line}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
            {(['critical', 'high', 'medium', 'low'] as RiskLevel[]).map((sev) => (
              <div key={sev}>
                <dt className="font-label-sm text-on-surface-variant">{SEVERITY_LABEL[sev]}</dt>
                <dd
                  className={`text-2xl font-semibold tabular-nums ${
                    bySeverity[sev] === 0 ? 'text-secondary' : sev === 'critical' || sev === 'high' ? 'text-status-fail' : sev === 'medium' ? 'text-status-warn' : 'text-on-surface'
                  }`}
                >
                  {bySeverity[sev]}
                </dd>
              </div>
            ))}
            <div>
              <dt className="font-label-sm text-on-surface-variant">Passed</dt>
              <dd className="text-2xl font-semibold tabular-nums text-status-pass">
                {report.passedChecks}
                <span className="text-sm font-normal text-secondary">/{report.totalChecks}</span>
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            {findings.length > 0 && (
              <button type="button" onClick={copyAll} className="btn-primary">
                <Icon name="copy" size={15} /> Copy all fixes
              </button>
            )}
            <button type="button" onClick={onRescan} className="btn-secondary">
              <Icon name="refresh" size={15} /> Rescan
            </button>
            <button type="button" onClick={onDownloadSarif} className="btn-secondary">
              <Icon name="download" size={15} /> SARIF
            </button>
            <span className="ml-auto font-label-sm text-secondary">
              {report.totalChecks} checks in {(report.duration / 1000).toFixed(1)}s
            </span>
          </div>
        </div>
      </div>

      {findings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-surface-container-high bg-surface-container-lowest px-6 py-12 text-center">
          <Icon name="check-circle" size={36} weight="fill" className="text-status-pass" />
          <p className="font-headline-sm text-on-surface">No issues found</p>
          <p className="max-w-md font-body-sm text-on-surface-variant">
            Every check passed. Run the CLI in CI to keep it that way: it also checks git history, lockfiles and dependency CVEs.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
          {/* Categories */}
          <aside className="rounded-xl border border-surface-container-high bg-surface-container-lowest p-2 lg:sticky lg:top-20">
            <h3 className="px-3 pb-1 pt-2 font-label-sm text-on-surface-variant">Categories</h3>
            <ul>
              {report.categories.map((cat) => {
                const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 100;
                const issues = cat.failed + cat.warned;
                const active = category === cat.categoryId;
                return (
                  <li key={cat.categoryId}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCategory(active ? null : cat.categoryId)}
                      className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${active ? 'bg-surface-container' : 'hover:bg-surface-container-low'}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-label-md text-on-surface">{cat.categoryLabel}</span>
                        <span className="font-label-sm tabular-nums text-on-surface-variant">
                          {issues > 0 ? `${issues} to review` : 'All clear'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <ScoreBar percentage={pct} />
                        <span className="w-9 text-right font-label-sm tabular-nums text-on-surface-variant">{pct}%</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Findings */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div role="group" aria-label="Filter by status" className="inline-flex rounded-lg bg-surface-container-low p-0.5">
                {(
                  [
                    ['all', 'All', findings.length],
                    ['fail', 'Issues', findings.filter((f) => f.status === 'fail').length],
                    ['warn', 'Warnings', findings.filter((f) => f.status === 'warn').length],
                  ] as const
                ).map(([id, label, count]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={status === id}
                    onClick={() => setStatus(id)}
                    className={`rounded-md px-3 py-1.5 font-label-md transition-colors ${
                      status === id ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {label} <span className="tabular-nums text-secondary">{count}</span>
                  </button>
                ))}
              </div>
              <div className="relative sm:ml-auto sm:w-64">
                <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter findings"
                  aria-label="Filter findings"
                  className="h-9 w-full rounded-lg border border-surface-container-high bg-surface-container-lowest pl-9 pr-3 font-body-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {category && (
              <div className="flex items-center gap-2 font-body-sm text-on-surface-variant">
                Showing
                <button
                  type="button"
                  onClick={() => setCategory(null)}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-on-surface"
                >
                  {CATEGORIES.find((c) => c.id === category)?.label}
                  <Icon name="x" size={12} label="Clear category filter" />
                </button>
              </div>
            )}

            {groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-surface-container-high px-6 py-10 text-center font-body-sm text-on-surface-variant">
                No findings match these filters.
              </div>
            ) : (
              groups.map(({ sev, items }) => (
                <div key={sev} className="flex flex-col gap-2">
                  <h3 className="flex items-center gap-2 font-label-md text-on-surface">
                    {SEVERITY_LABEL[sev]}
                    <span className="tabular-nums text-secondary">{items.length}</span>
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {items.map((f) => (
                      <FindingRow key={f.id} finding={f} repoUrl={report.repoUrl} onShowToast={onShowToast} />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function FindingRow({ finding: f, repoUrl, onShowToast }: { finding: PlainFinding; repoUrl?: string; onShowToast: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const bodyId = useId();
  const href = githubBlobUrl(repoUrl, f);

  const copy = () => {
    navigator.clipboard.writeText(f.fixPrompt);
    setCopied(true);
    onShowToast('Fix prompt copied. Paste it into Cursor or Claude.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <li className="rounded-xl border border-surface-container-high bg-surface-container-lowest transition-colors hover:border-surface-container-highest">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-label-sm ${SEVERITY_BADGE[f.severity]}`}>
          {SEVERITY_LABEL[f.severity]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-label-md text-on-surface">{f.title}</span>
          <span className="mt-0.5 block truncate font-body-sm text-on-surface-variant">
            {f.location ? <span className="font-code-inline">{f.location}</span> : f.what}
          </span>
        </span>
        <span className="hidden shrink-0 font-label-sm text-secondary sm:inline">{f.categoryLabel}</span>
        <Icon name="caret-down" size={16} className={`mt-0.5 text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div id={bodyId} className="flex flex-col gap-3 border-t border-surface-container-high px-4 py-4 font-body-sm">
          {f.location && <p className="text-on-surface">{f.what}</p>}
          {f.why && (
            <p className="text-on-surface-variant">
              <span className="font-medium text-on-surface">Why it matters. </span>
              {f.why}
            </p>
          )}
          {f.fix && (
            <p className="text-on-surface-variant">
              <span className="font-medium text-on-surface">Fix. </span>
              {f.fix}
            </p>
          )}
          {f.snippet && (
            <pre className="overflow-x-auto rounded-lg bg-surface-container-low px-3 py-2.5 font-code-inline text-on-surface">
              {f.line && <span className="mr-3 select-none text-secondary">{f.line}</span>}
              {f.snippet}
            </pre>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" onClick={copy} className="btn-primary">
              <Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Copied' : 'Copy fix prompt'}
            </button>
            {href && (
              <a href={href} target="_blank" rel="noreferrer" className="btn-secondary">
                <Icon name="file" size={15} /> Open on GitHub
              </a>
            )}
            <span className="ml-auto font-code-inline text-secondary">{f.ruleId}</span>
          </div>
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */

function WhatWeCheck() {
  return (
    <section aria-labelledby="what-we-check" className="flex flex-col gap-4">
      <h2 id="what-we-check" className="font-headline-md text-on-surface">
        What a scan covers
      </h2>
      <div className="grid gap-px overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-high md:grid-cols-3">
        {CATEGORIES.map((c) => (
          <div key={c.id} className="bg-surface-container-lowest p-5">
            <p className="font-headline-sm text-on-surface">{c.label}</p>
            <p className="mt-1 font-body-sm text-on-surface-variant">{c.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CliCallout({ onNavigateTab, onShowToast }: { onNavigateTab: (t: string) => void; onShowToast: (m: string) => void }) {
  const cmd = 'npx @preflight-agent/cli scan';
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-inverse-surface p-5 text-inverse-on-surface sm:flex-row sm:items-center sm:p-6">
      <div className="flex-1">
        <p className="font-headline-sm">Scan locally and in CI</p>
        <p className="mt-1 max-w-[60ch] font-body-sm opacity-75">
          The CLI also catches committed .env files, dependency CVEs and SQL injection, and blocks risky pull requests.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-2 sm:items-end">
        <div className="flex min-w-0 max-w-full items-center gap-2 rounded-lg bg-white/10 py-1.5 pl-3 pr-1.5 font-code-inline">
          <span className="select-none opacity-50">$</span>
          <code className="min-w-0 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">{cmd}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(cmd);
              onShowToast('Command copied');
            }}
            className="rounded-md p-1.5 transition-colors hover:bg-white/15"
            aria-label="Copy command"
          >
            <Icon name="copy" size={15} />
          </button>
        </div>
        <button type="button" onClick={() => onNavigateTab('learn')} className="inline-flex items-center gap-1 font-label-sm opacity-75 hover:opacity-100">
          CI setup guide <Icon name="caret-right" size={12} />
        </button>
      </div>
    </section>
  );
}
