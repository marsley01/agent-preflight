import { useScanStore } from '../../store/scan-store';
import { ScanInput } from './ScanInput';
import { ScanProgress } from './ScanProgress';
import { ScoreOverview } from './ScoreOverview';
import { CategorySection } from './CategorySection';
import { ChecklistSummary } from './ChecklistSummary';

export function CenterPanel() {
  const report = useScanStore((s) => s.report);
  const isScanning = useScanStore((s) => s.isScanning);
  const error = useScanStore((s) => s.error);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-8 py-6 space-y-6">
          {/* Scan Input - always visible */}
          <ScanInput />

          {/* Error State */}
          {error && !isScanning && (
            <div className="panel p-4 border-red-500/30 bg-red-500/5 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <div>
                  <div className="text-[13px] font-semibold text-red-400 mb-1">Scan Failed</div>
                  <div className="text-[13px] text-base-400">{error}</div>
                </div>
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
