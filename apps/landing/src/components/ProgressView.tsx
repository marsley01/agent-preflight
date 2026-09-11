import React, { useMemo } from 'react';
import { useScanStore, computeSinceLastScan } from '../store/scan-store';
import { HistoryLineChart, scoreColor } from './Charts';

interface ProgressViewProps {
  onShowToast: (msg: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ onShowToast, onNavigateTab }) => {
  const { history, isScanning, triggerScan } = useScanStore();
  const deltas = useMemo(() => computeSinceLastScan(history), [history]);

  const handleRescan = async () => {
    const report = await triggerScan();
    if (report?.status === 'error') {
      onShowToast(`Scan failed: ${report.error}`);
    } else if (report?.status === 'complete') {
      onShowToast(`Scan complete: ${report.score.percentage}% readiness`);
    }
  };

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => a.timestamp - b.timestamp),
    [history]
  );

  return (
    <div className="flex flex-col w-full max-w-[1600px] mx-auto px-gutter-desktop py-space-xl space-y-space-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Your progress</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-1">
            How your production readiness changes across scans.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRescan}
          disabled={isScanning}
          className="px-space-md py-2 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-space-xs disabled:opacity-40"
        >
          <span className={`material-symbols-outlined text-[16px] ${isScanning ? 'animate-spin' : ''}`}>
            refresh
          </span>
          {isScanning ? 'Scanning...' : 'Rescan'}
        </button>
      </div>

      {/* Empty state */}
      {history.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface-container-high bg-surface-container-low p-space-xl text-center space-y-space-md">
          <span className="material-symbols-outlined text-[48px] text-outline-variant">timeline</span>
          <div className="space-y-space-sm">
            <p className="font-headline-sm text-headline-sm text-on-surface">No scan history yet</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md mx-auto">
              Run your first scan on the <button type="button" onClick={() => onNavigateTab('scan')} className="text-primary underline">Scan</button> tab — this page will show a chart of your readiness score over time.
            </p>
          </div>
        </div>
      )}

      {/* Line chart */}
      {history.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between mb-space-md">
            <h2 className="font-headline-md text-headline-md text-on-surface">Readiness over time</h2>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{history.length} scans total</span>
          </div>
          <HistoryLineChart history={sortedHistory} />
        </div>
      )}

      {/* Since your last scan deltas */}
      {deltas && (
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high space-y-space-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">Since your last scan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
            <DeltaCard
              icon="add_circle"
              label="New issues"
              count={deltas.newIssues.length}
              tone={deltas.newIssues.length > 0 ? 'fail' : 'pass'}
              sub={deltas.newIssues.length === 0 ? 'Nothing new' : 'Issues introduced since last scan'}
            />
            <DeltaCard
              icon="check_circle"
              label="Fixed issues"
              count={deltas.fixedIssues.length}
              tone="pass"
              sub={deltas.fixedIssues.length === 0 ? 'Nothing fixed yet' : 'Issues you resolved since last scan'}
            />
            <DeltaCard
              icon="trending_up"
              label="Score change"
              count={deltas.scoreDelta}
              tone={deltas.scoreDelta >= 0 ? 'pass' : 'fail'}
              isDelta
              sub={deltas.previousScore != null ? `From ${deltas.previousScore}% → ${deltas.previousScore + deltas.scoreDelta}%` : ''}
            />
          </div>
        </div>
      )}

      {/* Scan history table */}
      {history.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container-high space-y-space-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">Scan history</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-surface-container-high font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  <th className="py-space-sm px-space-md">Date</th>
                  <th className="py-space-sm px-space-md">Repository</th>
                  <th className="py-space-sm px-space-md text-right">Score</th>
                  <th className="py-space-sm px-space-md text-right">Pass</th>
                  <th className="py-space-sm px-space-md text-right">Fail</th>
                  <th className="py-space-sm px-space-md text-right">Warn</th>
                  <th className="py-space-sm px-space-md text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {[...history].reverse().map((h) => (
                  <tr key={h.id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-space-sm px-space-md font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">
                      {new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' '}
                      {new Date(h.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-space-sm px-space-md text-on-surface font-medium">{h.repoName}</td>
                    <td className="py-space-sm px-space-md text-right font-headline-sm text-headline-sm" style={{ color: scoreColor(h.score) }}>
                      {h.score}%
                    </td>
                    <td className="py-space-sm px-space-md text-right text-[#16a34a]">{h.passed}</td>
                    <td className="py-space-sm px-space-md text-right text-error">{h.failed}</td>
                    <td className="py-space-sm px-space-md text-right text-[#d97706]">{h.warned}</td>
                    <td className="py-space-sm px-space-md text-right font-label-sm text-label-sm text-on-surface-variant">
                      {(h.duration / 1000).toFixed(1)}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

function DeltaCard({
  icon,
  label,
  count,
  tone,
  isDelta = false,
  sub,
}: {
  icon: string;
  label: string;
  count: number;
  tone: 'pass' | 'fail';
  isDelta?: boolean;
  sub?: string;
}) {
  const color = tone === 'pass' ? 'text-[#16a34a]' : 'text-error';
  const display = isDelta ? (count > 0 ? `+${count}` : `${count}`) : `${count}`;
  return (
    <div className="rounded-xl border border-surface-container-high p-space-md space-y-space-sm">
      <div className="flex items-center gap-space-xs">
        <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
        <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
      </div>
      <div className={`font-headline-md text-headline-md ${color}`}>{display}{isDelta ? 'pts' : ''}</div>
      {sub && <div className="font-body-sm text-body-sm text-on-surface-variant">{sub}</div>}
    </div>
  );
}