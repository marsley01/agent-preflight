import { useEffect } from 'react';
import { LeftPanel } from './components/left-panel/LeftPanel';
import { CenterPanel } from './components/center-panel/CenterPanel';
import { RightPanel } from './components/right-panel/RightPanel';
import { TopBar } from './components/shared/TopBar';
import { CommandPalette } from './components/shared/CommandPalette';
import { useThemeStore } from './store/theme-store';
import { useScanStore } from './store/scan-store';

export default function App() {
  const theme = useThemeStore((s) => s.theme);
  const { inspector, selectedThreat } = useScanStore();
  const hasInspector = inspector.isOpen || selectedThreat !== null;

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
        {hasInspector && (
          <aside
            className="w-[400px] border-l overflow-y-auto flex-shrink-0"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card-alt)' }}
          >
            <RightPanel />
          </aside>
        )}
      </div>
      <CommandPalette />
    </div>
  );
}
