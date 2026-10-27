import React, { Suspense, lazy, useMemo } from 'react';
import { useScanStore, computeSinceLastScan } from '../store/scan-store';
import { scoreTone, TONE_TEXT, useSortedByTime } from './Charts';
import { Icon, type IconName } from './Icon';

const HistoryChart = lazy(() => import('./HistoryChart'));

interface ProgressViewProps {
  onShowToast: (msg: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ onShowToast, onNavigateTab }) => {
  const { history, isScanning, triggerScan, clearHistory, lastReport } = useScanStore();
  const deltas = useMemo(() => computeSinceLastScan(history), [history]);
  const sortedHistory = useSortedByTime(history);
  const lastRepo = lastReport?.repoName ?? history[history.length - 1]?.repoName;

  const handleRescan = async () => {
    const report = await triggerScan(lastRepo ? `github.com/${lastRepo}` : undefined);
    if (report?.status === 'complete') onShowToast(`Scan complete: ${report.score.percentage}% ready`);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-8 sm:px-6 md:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline-lg text-on-surface">Progress</h1>
          <p className="mt-2 font-body-lg text-on-surface-variant">How your readiness score changes from scan to scan.</p>
        </div>
        {history.length > 0 && (
          <div className="flex gap-2">
            <button type="button" onClick={handleRescan} disabled={isScanning || !lastRepo} className="btn-primary">
              <Icon name="refresh" size={15} className={isScanning ? 'animate-spin' : ''} />
              {isScanning ? 'Scanning' : `Rescan ${lastRepo ?? ''}`}
            </button>
            <button
              type="button"
              onClick={() => {
                clearHistory();
                onShowToast('Scan history cleared');
              }}
              className="btn-secondary"
            >
              Clear history
            </button>
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-surface-container-high px-6 py-14 text-center">
          <Icon name="chart" size={32} className="text-secondary" />
          <p className="font-headline-sm text-on-surface">No scans yet</p>
          <p className="max-w-sm font-body-sm text-on-surface-variant">
            Scan a repo and this page tracks its score over time, including what you fixed and what's new.
          </p>
          <button type="button" onClick={() => onNavigateTab('scan')} className="btn-primary mt-2">
            Scan a repo
          </button>
        </div>
      ) : (
        <>
          {deltas && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Delta icon="plus-circle" label="New issues" value={`${deltas.newIssues.length}`} tone={deltas.newIssues.length ? 'fail' : 'pass'} sub={deltas.newIssues.length ? 'Introduced since the previous scan' : 'Nothing new'} />
              <Delta icon="check-circle" label="Fixed" value={`${deltas.fixedIssues.length}`} tone="pass" sub={deltas.fixedIssues.length ? 'Resolved since the previous scan' : 'Nothing fixed yet'} />
              <Delta
                icon="trend-up"
                label="Score change"
                value={`${deltas.scoreDelta > 0 ? '+' : ''}${deltas.scoreDelta} pts`}
                tone={deltas.scoreDelta >= 0 ? 'pass' : 'fail'}
                sub={deltas.previousScore != null ? `${deltas.previousScore}% to ${deltas.previousScore + deltas.scoreDelta}%` : ''}
              />
            </div>
          )}

          <section className="rounded-xl border border-surface-container-high bg-surface-container-lowest p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-headline-sm text-on-surface">Readiness over time</h2>
              <span className="font-label-sm text-secondary">{history.length} scans</span>
            </div>
            <Suspense fallback={<div className="skeleton h-64" />}>
              <HistoryChart history={sortedHistory} />
            </Suspense>
          </section>

          <section className="overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-lowest">
            <h2 className="px-5 pb-2 pt-5 font-headline-sm text-on-surface">History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-body-sm">
                <thead>
                  <tr className="border-b border-surface-container-high font-label-sm text-on-surface-variant">
                    <th className="px-5 py-2 font-medium">When</th>
                    <th className="px-5 py-2 font-medium">Repository</th>
                    <th className="px-5 py-2 text-right font-medium">Score</th>
                    <th className="px-5 py-2 text-right font-medium">Issues</th>
                    <th className="px-5 py-2 text-right font-medium">Warnings</th>
                    <th className="px-5 py-2 text-right font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((h) => (
                    <tr key={h.id} className="border-b border-surface-container last:border-0">
                      <td className="whitespace-nowrap px-5 py-2.5 text-on-surface-variant">
                        {new Date(h.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-2.5 font-code-inline text-on-surface">{h.repoName}</td>
                      <td className={`px-5 py-2.5 text-right font-medium tabular-nums ${TONE_TEXT[scoreTone(h.score)]}`}>{h.score}%</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-on-surface">{h.failed}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-on-surface-variant">{h.warned}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-secondary">{(h.duration / 1000).toFixed(1)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

function Delta({ icon, label, value, tone, sub }: { icon: IconName; label: string; value: string; tone: 'pass' | 'fail'; sub?: string }) {
  return (
    <div className="rounded-xl border border-surface-container-high bg-surface-container-lowest p-4">
      <div className="flex items-center gap-1.5 font-label-md text-on-surface-variant">
        <Icon name={icon} size={16} className={TONE_TEXT[tone]} />
        {label}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${TONE_TEXT[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 font-body-sm text-on-surface-variant">{sub}</div>}
    </div>
  );
}
