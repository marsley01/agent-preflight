import { useState, useCallback } from 'react';
import { Search, GitFork, Github, Terminal, Database, Cpu, Layers } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useScanStore } from '../../store/scan-store';
import { scanGitHubRepo } from '@shared/engine';

const techPills = [
  { name: 'Next.js 15.0', icon: Terminal },
  { name: 'Supabase', icon: Database },
  { name: 'Vercel AI SDK', icon: Cpu },
  { name: 'Prisma ORM', icon: Layers },
];

function timestamp(): string {
  const d = new Date();
  return `[${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}]`;
}

export function TopBar() {
  const {
    repoInput, setRepoInput,
    setIsScanning, setProgress, setReport, setError, addToHistory,
    addTerminalLog, clearTerminalLogs,
    isScanning, report,
  } = useScanStore();

  const handleScan = useCallback(async () => {
    const url = repoInput.trim();
    if (!url || isScanning) return;

    clearTerminalLogs();
    setIsScanning(true);
    setError(null);
    setReport(null);

    addTerminalLog(`${timestamp()} [INFO] Starting preflight scan: ${url}`);
    addTerminalLog(`${timestamp()} [INFO] Engine: github-api | Mode: full-audit`);

    const startTime = Date.now();

    try {
      const scanReport = await scanGitHubRepo(
        url,
        undefined,
        (progress) => {
          setProgress(progress);
          addTerminalLog(`${timestamp()} [INFO] Stage ${progress.stageIndex + 1}/${progress.totalStages}: ${progress.stage}`);
        },
        undefined,
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      addTerminalLog(`${timestamp()} [INFO] Scan completed in ${elapsed}s`);
      addTerminalLog(`${timestamp()} [PASS] ${scanReport.passedChecks} checks passed`);
      addTerminalLog(`${timestamp()} [FAIL] ${scanReport.failedChecks} checks failed`);
      addTerminalLog(`${timestamp()} [WARN] ${scanReport.warningChecks} warnings`);

      setReport(scanReport);
      if (scanReport.status === 'complete') addToHistory(scanReport);
      if (scanReport.status === 'error') {
        setError(scanReport.error || 'Scan failed');
        addTerminalLog(`${timestamp()} [ERROR] ${scanReport.error}`);
      }
    } catch (err: any) {
      addTerminalLog(`${timestamp()} [ERROR] ${err.message || 'Something went wrong'}`);
      setError(err.message || 'Something went wrong');
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, [repoInput, isScanning, setIsScanning, setProgress, setReport, setError, addToHistory, addTerminalLog, clearTerminalLogs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleScan();
  };

  return (
    <header
      className="sticky top-0 z-10 w-full border-b backdrop-blur-md px-6 py-3 flex flex-wrap items-center justify-between gap-3"
      style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Left: repo info + tech pills */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: 'var(--accent-cyan-bg)' }}>
            <GitFork size={16} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {report ? report.repoName : 'marsley01/agent-preflight'}
              </h2>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--accent-emerald)' }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--accent-emerald)' }} />
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              Branch: <span className="font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>main</span>
              {' '}·{' '}Last scanned: just now
            </p>
          </div>
        </div>

        {/* Tech stack pills */}
        <div className="hidden xl:flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          {techPills.map((t, i) => (
            <span key={t.name} className="flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
              <t.icon size={12} />
              {t.name}
            </span>
          ))}
        </div>
      </div>

      {/* Right: scan input + theme toggle */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste public GitHub URL..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs transition-all focus:outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            disabled={isScanning}
          />
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
