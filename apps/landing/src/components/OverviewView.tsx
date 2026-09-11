import React, { useState, useMemo } from 'react';
import { useScanStore } from '../store/scan-store';
import { toPlainFindings, verdictFromScore } from '../lib/findings';
import type { PlainFinding } from '../lib/findings';
import { HealthGauge, CategoryDonut } from './Charts';

interface OverviewViewProps {
  onNavigateTab: (tab: string) => void;
  onShowToast: (msg: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigateTab, onShowToast }) => {
  const {
    repoUrl,
    setRepoUrl,
    isScanning,
    scanProgress,
    scanError,
    lastReport,
    detections,
    severityFilter,
    setSeverityFilter,
    triggerScan,
    downloadSARIFReport,
  } = useScanStore();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const findings = useMemo(
    () => (lastReport ? toPlainFindings(lastReport) : []),
    [lastReport]
  );

  const verdict = lastReport ? verdictFromScore(lastReport.score.percentage) : null;
  const scorePct = lastReport?.score.percentage ?? 0;

  const filteredFindings = useMemo(() => {
    if (severityFilter === 'high') return findings.filter((f) => f.status === 'fail');
    if (severityFilter === 'warning') return findings.filter((f) => f.status === 'warn');
    return findings;
  }, [findings, severityFilter]);

  const failCount = findings.filter((f) => f.status === 'fail').length;
  const warnCount = findings.filter((f) => f.status === 'warn').length;

  const handleCopyFix = (finding: PlainFinding) => {
    navigator.clipboard.writeText(finding.fixPrompt);
    setCopiedId(finding.id);
    onShowToast('Copied fix prompt — paste into Cursor or Claude');
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleTriggerScan = async () => {
    const report = await triggerScan();
    if (report?.status === 'error') {
      onShowToast(`Scan failed: ${report.error}`);
    } else if (report?.status === 'complete') {
      onShowToast(`Scan complete: ${report.score.percentage}% readiness`);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-[1600px] mx-auto px-gutter-desktop py-space-xl space-y-space-xl">

      {/* ---- Hero / Scan Box ---- */}
      <div className="rounded-2xl border border-surface-container-high bg-surface-container-lowest p-space-xl shadow-sm space-y-space-lg">
        <div className="max-w-3xl space-y-space-md">
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight leading-tight">
            Find what's broken before you ship
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
            Paste a GitHub repo link and Preflight runs eight categories of checks — security, AI safety,
            performance, compliance and more — so you can fix real problems before your users find them.
          </p>
        </div>

        {/* Primary scan form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTriggerScan();
          }}
          className="flex flex-col sm:flex-row items-stretch gap-space-sm"
        >
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline select-none font-body-md text-body-md">
              github.com/
            </span>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="org/repo"
              className="w-full h-12 pl-[110px] pr-space-md bg-surface-container-lowest text-on-surface font-body-md text-body-md rounded-xl border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isScanning || !repoUrl.trim()}
            className="h-12 px-space-xl rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-space-xs disabled:opacity-40"
          >
            <span className={`material-symbols-outlined text-[18px] ${isScanning ? 'animate-spin' : ''}`}>
              {isScanning ? 'refresh' : 'play_arrow'}
            </span>
            <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
          </button>
        </form>

        {isScanning && scanProgress && (
          <div className="flex items-center gap-space-sm font-body-sm text-body-sm text-on-surface-variant">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            {scanProgress}
          </div>
        )}

        {scanError && !isScanning && (
          <div className="font-body-sm text-body-sm text-error bg-error-container/40 rounded-lg px-space-md py-space-sm">
            {scanError} — set a GitHub token in localStorage('github_token') for higher rate limits.
          </div>
        )}

        {/* Last scanned indicator */}
        {lastReport && (
          <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[15px] text-tertiary">check_circle</span>
            Last scanned <strong className="text-on-surface">{lastReport.repoName}</strong>
          </div>
        )}
      </div>

      {/* ---- CLI: For Developers (collapsed) ---- */}
      <details className="group rounded-xl border border-surface-container-high bg-surface-container-lowest p-space-md shadow-sm">
        <summary className="flex items-center gap-space-sm cursor-pointer font-label-md text-label-md text-on-surface-variant select-none list-none [&::-webkit-details-marker]:hidden">
          <span className="material-symbols-outlined text-[16px] transition-transform group-open:rotate-90">chevron_right</span>
          For developers — run Preflight from your terminal
        </summary>
        <div className="mt-space-md space-y-space-sm pl-space-md border-l-2 border-surface-container-high">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Install the CLI and scan locally or in CI:
          </p>
          <div className="flex items-center justify-between bg-surface-container-low rounded-lg px-space-md py-space-sm font-code-inline text-code-inline text-on-surface">
            <code className="overflow-x-auto whitespace-nowrap pr-space-sm">
              <span className="text-outline select-none">$ </span>npm i -g agent-preflight && preflight scan
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText('npm i -g agent-preflight && preflight scan');
                onShowToast('Copied CLI command');
              }}
              className="shrink-0 flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high font-label-sm text-label-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              Copy
            </button>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Or add Preflight to your GitHub Actions workflow — see the <button type="button" onClick={() => onNavigateTab('learn')} className="text-primary underline">Learn</button> tab.
          </p>
        </div>
      </details>

      {/* ---- Empty state ---- */}
      {!lastReport && !isScanning && (
        <div className="rounded-xl border border-dashed border-surface-container-high bg-surface-container-low p-space-xl text-center space-y-space-sm">
          <span className="material-symbols-outlined text-[40px] text-outline-variant">search</span>
          <p className="font-headline-sm text-headline-sm text-on-surface">Run your first scan above</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            It takes a few seconds. You'll get a full report with ready-to-paste fix prompts.
          </p>
        </div>
      )}

      {/* ---- Results (visible after scan) ---- */}
      {lastReport && (
        <>
          {/* Top row: Gauge + Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
            {/* Gauge */}
            <div className="lg:col-span-4 bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high flex flex-col items-center justify-center space-y-space-sm">
              <HealthGauge percentage={scorePct} size={210} />
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center max-w-[220px]">
                {verdict?.line}
              </p>
            </div>

            {/* Summary stats */}
            <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high flex flex-col justify-between space-y-space-md">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md">
                <Stat label="Total checks" value={lastReport.totalChecks} sub={`${lastReport.categories.length} categories`} />
                <Stat label="Passed" value={lastReport.passedChecks} tone="pass" sub="no action needed" />
                <Stat label="Failed" value={lastReport.failedChecks} tone="fail" sub="fix these first" />
                <Stat label="Warnings" value={lastReport.warningChecks} tone="warn" sub="worth reviewing" />
              </div>

              {/* Severity filter */}
              <div className="flex flex-wrap items-center gap-space-xs pt-space-xs border-t border-surface-container-high">
                <span className="font-label-sm text-label-sm text-on-surface-variant mr-1">Show</span>
                {(['all', 'high', 'warning'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSeverityFilter(filter)}
                    className={`px-space-sm py-1 rounded-full text-xs font-medium transition-colors ${
                      severityFilter === filter
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'high' ? 'Issues' : 'Warnings'}
                    <span className="ml-1 opacity-70">
                      ({filter === 'all' ? findings.length : filter === 'high' ? failCount : warnCount})
                    </span>
                  </button>
                ))}

                <span className="flex-1"></span>
                <button
                  type="button"
                  onClick={handleTriggerScan}
                  disabled={isScanning}
                  className="px-space-md py-1 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container font-label-md text-label-md transition-colors flex items-center gap-space-xs disabled:opacity-40"
                >
                  <span className={`material-symbols-outlined text-[14px] ${isScanning ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  Rescan
                </button>
                <button
                  type="button"
                  onClick={downloadSARIFReport}
                  className="px-space-md py-1 rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container font-label-md text-label-md transition-colors flex items-center gap-space-xs"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  SARIF
                </button>
              </div>
            </div>
          </div>

          {/* ---- Category Donuts Grid ---- */}
          <div>
            <div className="flex items-center justify-between mb-space-md">
              <h2 className="font-headline-md text-headline-md text-on-surface">Category scores</h2>
              <button type="button" onClick={() => onNavigateTab('checks')} className="text-primary hover:underline font-label-sm text-label-sm">
                View all checks →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-md">
              {lastReport.categories.map((cat) => {
                const catPct = cat.total > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 100;
                const catFail = cat.failed;
                const catWarn = cat.warned;
                const catPass = cat.total - catFail - catWarn;
                return (
                  <div
                    key={cat.categoryId}
                    className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-surface-container-high flex flex-col items-center space-y-space-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onNavigateTab('checks')}
                  >
                    <div className="w-full">
                      <CategoryDonut
                        percentage={catPct}
                        counts={{ passed: catPass, warned: catWarn, failed: catFail }}
                      />
                    </div>
                    <div className="text-center space-y-1">
                      <div className="font-headline-sm text-headline-sm text-on-surface">{cat.categoryLabel}</div>
                      <div className="font-body-sm text-body-sm text-on-surface-variant">
                        {catPass} passed, {catWarn > 0 ? `${catWarn} warnings, ` : ''}{catFail} issues
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---- Findings List ---- */}
          {filteredFindings.length > 0 && (
            <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high space-y-space-md">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">What to fix</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {filteredFindings.length === findings.length
                      ? `${findings.length} findings from this scan`
                      : `${filteredFindings.length} of ${findings.length} findings shown`}
                  </p>
                </div>
              </div>

              <div className="space-y-space-md">
                {filteredFindings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    copied={copiedId === finding.id}
                    onCopyFix={handleCopyFix}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredFindings.length === 0 && findings.length > 0 && (
            <div className="rounded-xl border border-dashed border-surface-container-high bg-surface-container-low p-space-lg text-center">
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                No findings match the current filter.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: 'pass' | 'warn' | 'fail';
}) {
  const color = tone === 'pass' ? 'text-[#16a34a]' : tone === 'warn' ? 'text-[#d97706]' : tone === 'fail' ? 'text-error' : 'text-on-surface';
  return (
    <div className="space-y-1">
      <div className="font-body-sm text-body-sm text-on-surface-variant">{label}</div>
      <div className={`font-headline-md text-headline-md ${color}`}>{value}</div>
      {sub && <div className="font-body-sm text-body-sm text-on-surface-variant">{sub}</div>}
    </div>
  );
}

function FindingCard({
  finding,
  copied,
  onCopyFix,
}: {
  finding: PlainFinding;
  copied: boolean;
  onCopyFix: (f: PlainFinding) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-surface-container-high p-space-md space-y-space-sm hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-space-sm">
        <div className="flex items-start gap-space-sm min-w-0">
          <span
            className={`shrink-0 mt-1.5 w-2 h-2 rounded-full ${
              finding.status === 'fail' ? 'bg-error' : 'bg-[#d97706]'
            }`}
          ></span>
          <div className="min-w-0">
            <div className="font-headline-sm text-headline-sm text-on-surface">{finding.title}</div>
            <div className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-0.5">
              {finding.what}
            </div>
          </div>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container-low text-on-surface-variant">
          {finding.ruleId}
        </span>
      </div>

      {finding.why && (
        <p className="font-body-sm text-body-sm text-on-surface-variant ml-5">
          {finding.why}
        </p>
      )}

      {finding.location && (
        <div className="ml-5 font-code-inline text-code-inline text-on-surface-variant">
          {finding.location}
        </div>
      )}

      <div className="flex items-center gap-space-sm ml-5 pt-space-xs">
        <button
          type="button"
          onClick={() => onCopyFix(finding)}
          className="inline-flex items-center gap-space-xs px-space-md py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
          {copied ? 'Copied' : 'Copy fix prompt'}
        </button>
        {finding.snippet && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-space-xs px-space-sm py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">{expanded ? 'expand_less' : 'expand_more'}</span>
            {expanded ? 'Hide code' : 'Show code'}
          </button>
        )}
      </div>

      {expanded && finding.snippet && (
        <pre className="ml-5 p-space-md bg-surface-container-low rounded-lg overflow-x-auto font-code-inline text-code-inline text-on-surface leading-relaxed border border-surface-container-high">
          {finding.snippet}
        </pre>
      )}
    </div>
  );
}