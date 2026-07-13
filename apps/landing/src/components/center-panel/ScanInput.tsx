import { useState, useCallback } from 'react';
import { Play, Upload, GitPullRequest, Loader2 } from 'lucide-react';
import { useScanStore } from '../../store/scan-store';
import { scanGitHubRepo } from '@shared/engine';

function timestamp(): string {
  const d = new Date();
  return `[${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}]`;
}

export function ScanInput() {
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
    <div className="panel p-4 space-y-3 animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <GitPullRequest size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://github.com/user/repo"
            className="input-field pl-9 pr-3 py-2.5 text-[13px]"
            disabled={isScanning}
          />
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning || !repoInput.trim()}
          className="btn-primary px-5 py-2.5 text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isScanning ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Play size={15} />
          )}
          {isScanning ? 'Scanning' : 'Scan'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <input
            type={showToken ? 'text' : 'password'}
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="GitHub token (optional — 5,000 req/hr)"
            className="input-field flex-1 text-[12px] py-1.5"
            disabled={isScanning}
          />
          <button
            onClick={() => setShowToken(!showToken)}
            className="btn-ghost text-[11px] px-2 py-1"
          >
            {showToken ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
        <Upload size={12} />
        <span>Public repos only. All scanning runs in your browser.</span>
        <span className="mx-1">·</span>
        <button className="transition-colors" style={{ color: 'var(--accent-blue)' }}>
          Use local CLI instead
        </button>
      </div>
    </div>
  );
}
