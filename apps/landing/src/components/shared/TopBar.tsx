import { useState, useCallback } from 'react';
import { Search, GitFork, Github } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useScanStore } from '../../store/scan-store';
import { scanGitHubRepo } from '@shared/engine';

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
      className="sticky top-0 z-10 w-full border-b backdrop-blur-md px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4"
      style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Left: repo info */}
      <div className="flex items-center gap-3 self-start sm:self-auto">
        <div className="p-2 rounded-lg" style={{ background: 'var(--accent-cyan-bg)' }}>
          <GitFork size={16} style={{ color: 'var(--accent-cyan)' }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {report ? report.repoName : 'marsley01/Edyfra'}
            </h2>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--accent-emerald)' }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--accent-emerald)' }} />
            </span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            Branch: <span className="font-mono px-1.5 py-0.5 rounded" style={{ color: 'var(--text-secondary)', background: 'var(--bg-hover)' }}>main</span>
            {' '}·{' '}Last scanned: {report ? 'just now' : '2 minutes ago'}
          </p>
        </div>
      </div>

      {/* Right: scan input */}
      <div className="relative w-full sm:w-96">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste public GitHub URL (e.g., owner/repo)..."
          className="w-full pl-10 pr-24 py-2.5 rounded-xl text-xs transition-all focus:outline-none"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-cyan)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
          disabled={isScanning}
        />
        <button
          onClick={handleScan}
          disabled={isScanning || !repoInput.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 text-[10px] font-bold tracking-wide uppercase text-white rounded-lg transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(to right, var(--accent-cyan), var(--accent-violet))',
          }}
        >
          {isScanning ? 'Scanning...' : 'Scan Repo'}
        </button>
      </div>

      {/* Theme toggle */}
      <div className="flex-shrink-0">
        <ThemeToggle />
      </div>
    </header>
  );
}
