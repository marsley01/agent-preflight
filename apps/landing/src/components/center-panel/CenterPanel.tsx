import { useScanStore } from '../../store/scan-store';
import { ScanInput } from './ScanInput';
import { ScanProgress } from './ScanProgress';
import { ScoreOverview } from './ScoreOverview';
import { CategorySection } from './CategorySection';
import { ChecklistSummary } from './ChecklistSummary';
import { ScanTerminal } from './ScanTerminal';
import { LiveFeed } from '../shared/LiveFeed';

export function CenterPanel() {
  const report = useScanStore((s) => s.report);
  const isScanning = useScanStore((s) => s.isScanning);
  const error = useScanStore((s) => s.error);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[960px] mx-auto px-8 py-6 space-y-6">
          {/* Scan Input - always visible */}
          <ScanInput />

          {/* Error State */}
          {error && !isScanning && (
            <div
              className="panel p-4 animate-fadeIn"
              style={{ borderColor: 'var(--accent-rose-border)', background: 'var(--accent-rose-bg)' }}
            >
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--accent-rose)' }} />
                <div>
                  <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--accent-rose)' }}>Scan Failed</div>
                  <div className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Terminal logs — shown during scan or after */}
          <ScanTerminal />

          {/* Scan Progress */}
          {isScanning && <ScanProgress />}

          {/* Results */}
          {report && !isScanning && (
            <>
              <ScoreOverview />
              <ChecklistSummary />
              {report.categories.map((cat) => (
                <CategorySection key={cat.categoryId} category={cat} />
              ))}
            </>
          )}

          {/* Live Intelligence Feed */}
          <LiveFeed />
        </div>
      </div>
    </div>
  );
}
