import { LeftPanel } from './components/left-panel/LeftPanel';
import { CenterPanel } from './components/center-panel/CenterPanel';
import { RightPanel } from './components/right-panel/RightPanel';
import { TopBar } from './components/shared/TopBar';
import { CommandPalette } from './components/shared/CommandPalette';
import { ReportExport } from './components/shared/ReportExport';
import { useScanStore } from './store/scan-store';

export default function App() {
  const inspector = useScanStore((s) => s.inspector);
  const report = useScanStore((s) => s.report);

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />
        <main className="flex-1 flex overflow-hidden min-w-0">
          <CenterPanel />
        </main>
        {inspector.isOpen && (
          <aside className="w-[420px] border-l border-base-800 overflow-y-auto flex-shrink-0 animate-slideInRight">
            <RightPanel />
          </aside>
        )}
        {!inspector.isOpen && report && report.status === 'complete' && (
          <aside className="w-[320px] border-l border-base-800 overflow-y-auto flex-shrink-0 p-4">
            <ReportExport report={report} />
          </aside>
        )}
      </div>
      <CommandPalette />
    </div>
  );
}
