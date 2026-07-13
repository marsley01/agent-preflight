import { useState, useCallback } from 'react';
import { Play, GitPullRequest, Loader2, Zap, Command, Eye, EyeOff } from 'lucide-react';
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
    githubToken, setGithubToken,
    setIsScanning, setProgress, setReport, setError, addToHistory,
    addTerminalLog, clearTerminalLogs,
    isScanning,
  } = useScanStore();

  const [showToken, setShowToken] = useState(false);

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
      const report = await scanGitHubRepo(
        url,
        undefined,
        (progress) => {
          setProgress(progress);
          addTerminalLog(`${timestamp()} [INFO] Stage ${progress.stageIndex + 1}/${progress.totalStages}: ${progress.stage}`);
        },
        githubToken || undefined,
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      addTerminalLog(`${timestamp()} [INFO] Scan completed in ${elapsed}s`);
      addTerminalLog(`${timestamp()} [PASS] ${report.passedChecks} checks passed`);
      addTerminalLog(`${timestamp()} [FAIL] ${report.failedChecks} checks failed`);
      addTerminalLog(`${timestamp()} [WARN] ${report.warningChecks} warnings`);

      if (report.score.percentage >= 75) {
        addTerminalLog(`${timestamp()} [PASS] Production readiness score: ${report.score.percentage}% — Ready to deploy`);
      } else if (report.score.percentage >= 50) {
        addTerminalLog(`${timestamp()} [WARN] Production readiness score: ${report.score.percentage}% — Needs work`);
      } else {
        addTerminalLog(`${timestamp()} [ERROR] Production readiness score: ${report.score.percentage}% — Blocking`);
      }

      setReport(report);
      if (report.status === 'complete') {
        addToHistory(report);
      }
      if (report.status === 'error') {
        setError(report.error || 'Scan failed');
        addTerminalLog(`${timestamp()} [ERROR] ${report.error}`);
      }
    } catch (err: any) {
      addTerminalLog(`${timestamp()} [ERROR] ${err.message || 'Something went wrong'}`);
      setError(err.message || 'Something went wrong');
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, [repoInput, githubToken, isScanning, setIsScanning, setProgress, setReport, setError, addToHistory, addTerminalLog, clearTerminalLogs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleScan();
  };

  return (
    <header
      className="h-12 flex items-center px-3 border-b flex-shrink-0 gap-2"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 w-[180px] flex-shrink-0">
        <div className="w-6 h-6 flex items-center justify-center" style={{ background: 'var(--accent-blue)', borderRadius: '4px' }}>
          <Zap size={14} className="text-white" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          preflight
        </span>
      </div>

      {/* Command palette indicator */}
      <div
        className="flex items-center gap-1 px-2 py-1 text-[11px] flex-shrink-0"
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '4px',
          color: 'var(--text-tertiary)',
        }}
      >
        <Command size={11} />
        <span>K</span>
        <span className="mx-0.5">—</span>
        <span>Command palette</span>
      </div>

      {/* Scan inputs — consolidated row */}
      <div className="flex-1 flex items-center gap-2 justify-center max-w-[700px] mx-auto">
        <div className="relative flex-1">
          <GitPullRequest size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://github.com/user/repo"
            className="input-field pl-8 text-[12px]"
            style={{ height: '30px', borderRadius: '4px' }}
            disabled={isScanning}
          />
        </div>
        <div className="relative flex-shrink-0" style={{ width: '200px' }}>
          <input
            type={showToken ? 'text' : 'password'}
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="Token (optional)"
            className="input-field text-[12px]"
            style={{ height: '30px', borderRadius: '4px', paddingRight: '30px' }}
            disabled={isScanning}
          />
          <button
            onClick={() => setShowToken(!showToken)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning || !repoInput.trim()}
          className="btn-primary text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ height: '30px', borderRadius: '4px', padding: '0 14px' }}
        >
          {isScanning ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Play size={13} />
          )}
          <span>{isScanning ? 'Scanning' : 'Scan'}</span>
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 w-[180px] justify-end flex-shrink-0">
        <span className="text-[10px] mr-1" style={{ color: 'var(--text-muted)' }}>
          Public repos only
        </span>
        <ThemeToggle />
        <a
          href="https://github.com/anomalyco/agent-preflight"
          target="_blank"
          rel="noreferrer"
          className="btn-ghost p-1.5"
          style={{ borderRadius: '4px' }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </a>
      </div>
    </header>
  );
}
