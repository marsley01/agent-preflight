import { useEffect } from 'react';
import { LeftPanel } from './components/left-panel/LeftPanel';
import { CenterPanel } from './components/center-panel/CenterPanel';
import { RightPanel } from './components/right-panel/RightPanel';
import { TopBar } from './components/shared/TopBar';
import { CommandPalette } from './components/shared/CommandPalette';
import { ReportExport } from './components/shared/ReportExport';
import { useScanStore } from './store/scan-store';
import { useThemeStore } from './store/theme-store';

export default function App() {
  const inspector = useScanStore((s) => s.inspector);
  const report = useScanStore((s) => s.report);
  const theme = useThemeStore((s) => s.theme);

  // Initialize theme attribute on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <TopBar />
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />
        <main className="flex-1 flex overflow-hidden min-w-0">
          <CenterPanel />
        </main>
        {inspector.isOpen && (
          <aside
            className="w-[420px] border-l overflow-y-auto flex-shrink-0 animate-slideInRight"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <RightPanel />
          </aside>
        )}
        {!inspector.isOpen && report && report.status === 'complete' && (
          <aside
            className="w-[320px] border-l overflow-y-auto flex-shrink-0 p-4"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <ReportExport report={report} />
          </aside>
        )}
      </div>
      <CommandPalette />
    </div>
  );
}
