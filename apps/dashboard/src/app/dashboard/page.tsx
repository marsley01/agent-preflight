"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScanReport, ScannerResult } from "@agent-preflight/scanner";

const STORAGE_KEY = "agent-preflight-last-scan";
const HISTORY_KEY = "agent-preflight-scan-history";

function loadSavedReport(): ScanReport | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveReport(report: ScanReport) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
    const raw = localStorage.getItem(HISTORY_KEY);
    const history: ScanReport[] = raw ? JSON.parse(raw) : [];
    history.unshift(report);
    if (history.length > 50) history.length = 50;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

const scannerLabels: Record<string, string> = {
  security: "Security",
  "ai-safety": "AI Safety",
  "code-quality": "Code Quality",
  performance: "Performance",
  deployment: "Deployment",
};

const scannerIcons: Record<string, string> = {
  security: "🔒",
  "ai-safety": "🤖",
  "code-quality": "📐",
  performance: "⚡",
  deployment: "🚀",
};

const scannerDescs: Record<string, string> = {
  security: "Secrets, injections, CSP, dependencies",
  "ai-safety": "Prompt injection, guardrails, unsafe output",
  "code-quality": "Unused deps, large files, TODOs, console.log",
  performance: "Large deps, image opt, code splitting",
  deployment: "Build scripts, Docker, CI/CD, env files",
};

function FindingRow({ finding }: { finding: ScannerResult["findings"][0] }) {
  const [open, setOpen] = useState(false);

  const severityColor =
    finding.severity === "critical" ? "var(--color-danger)" :
    finding.severity === "high" ? "var(--color-warning)" :
    finding.severity === "medium" ? "var(--color-accent)" :
    "var(--color-success)";

  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.01] transition-colors"
      >
        <span
          className="font-medium min-w-[56px] text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded leading-5 text-center"
          style={{ background: `${severityColor}15`, color: severityColor }}
        >
          {finding.severity}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white">{finding.title}</div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5 truncate">{finding.file || finding.impact}</div>
        </div>
        <span className={`text-[10px] text-[var(--color-muted)] mt-1 transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pl-[75px] space-y-2">
          <p className="text-xs text-[var(--color-muted)] leading-relaxed">{finding.description}</p>
          <div className="flex flex-wrap gap-2">
            {finding.file && (
              <span className="text-[11px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-muted)]">
                {finding.file}{finding.line ? `:${finding.line}` : ""}
              </span>
            )}
            {finding.impact && (
              <span className="text-[11px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-muted)]">
                {finding.impact}
              </span>
            )}
          </div>
          {finding.suggestion && (
            <div className="text-xs text-[var(--color-accent)] leading-relaxed bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/10 rounded-lg p-2.5">
              <span className="font-medium">Fix: </span>{finding.suggestion}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScannerSection({ result }: { result: ScannerResult }) {
  const [open, setOpen] = useState(true);
  const label = scannerLabels[result.category] || result.scanner;
  const icon = scannerIcons[result.category] || "📋";

  const critical = result.findings.filter(f => f.severity === "critical").length;
  const high = result.findings.filter(f => f.severity === "high").length;
  const medium = result.findings.filter(f => f.severity === "medium").length;
  const low = result.findings.filter(f => f.severity === "low").length;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.01] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-base">{icon}</span>
          <div>
            <span className="text-sm font-medium text-white">{label}</span>
            <span className="text-[11px] text-[var(--color-muted)] ml-2">{result.durationMs}ms</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {result.findings.length === 0 ? (
            <span className="text-[11px] text-[var(--color-success)]">✓ Clean</span>
          ) : (
            <div className="flex gap-2 text-[11px]">
              {critical > 0 && <span className="severity-critical">{critical} critical</span>}
              {high > 0 && <span className="severity-high">{high} high</span>}
              {medium > 0 && <span className="severity-medium">{medium} med</span>}
              {low > 0 && <span className="severity-low">{low} low</span>}
            </div>
          )}
          <span className={`text-[10px] text-[var(--color-muted)] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)]">
          {result.findings.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[var(--color-muted)] text-center">No issues found in this category.</p>
          ) : (
            result.findings.map((f) => <FindingRow key={f.id} finding={f} />)
          )}
        </div>
      )}
    </div>
  );
}

const scanners = [
  { id: "security", label: "Security" },
  { id: "ai-safety", label: "AI Safety" },
  { id: "code-quality", label: "Code Quality" },
  { id: "performance", label: "Performance" },
  { id: "deployment", label: "Deployment" },
];

export default function DashboardPage() {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [currentScanner, setCurrentScanner] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ name: string; path: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [scanPhase, setScanPhase] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadSavedReport();
    if (saved) setReport(saved);
    try {
      const savedPath = localStorage.getItem("agent-preflight-project-path");
      if (savedPath) setProjectPath(savedPath);
      else setProjectPath(".");
    } catch {
      setProjectPath(".");
    }

    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (data.projects) setSuggestions(data.projects);
      })
      .catch(() => {});
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setReport(null);

    try {
      setScanPhase("Analyzing project structure...");
      for (const s of scanners) {
        setCurrentScanner(s.id);
        setScanPhase(`Running ${scannerLabels[s.id]} scan — ${scannerDescs[s.id]}`);
        await new Promise((r) => setTimeout(r, 200));
      }

      setScanPhase("Compiling results...");
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: projectPath || "." }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setReport(data);
      saveReport(data);
      setScanPhase(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setScanPhase(null);
    } finally {
      setScanning(false);
      setCurrentScanner(null);
    }
  }, [projectPath]);

  const scoreColor = report
    ? report.overallScore >= 80 ? "var(--color-success)" :
      report.overallScore >= 60 ? "var(--color-warning)" :
      "var(--color-danger)"
    : "var(--color-border)";

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preflight-${report.projectName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentIdx = currentScanner ? scanners.findIndex((s) => s.id === currentScanner) : -1;

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Point at any project and scan it for production readiness
        </p>
      </div>

      <div className="card p-5 mb-8">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <label className="text-xs text-[var(--color-muted)] font-medium block mb-1.5">Project to scan</label>
            <input
              type="text"
              value={projectPath}
              onChange={(e) => { setProjectPath(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="e.g. . or ../../my-project"
              className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-muted)]"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.path}
                    onMouseDown={() => { setProjectPath(s.path); setShowSuggestions(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <span className="text-[var(--color-muted)]">📁</span>
                    {s.name}
                    <span className="text-[10px] text-[var(--color-muted)] ml-auto truncate max-w-[200px]">{s.path}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={runScan}
            disabled={scanning || !projectPath}
            className="btn-primary disabled:opacity-50 flex items-center gap-2 h-[38px]"
          >
            {scanning ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning
              </>
            ) : (
              <>
                <span>Scan</span>
              </>
            )}
          </button>
          {report && (
            <button
              onClick={downloadReport}
              className="h-[38px] px-3 text-xs text-[var(--color-muted)] border border-[var(--color-border)] rounded-lg hover:text-white hover:border-[var(--color-border-hover)] transition-colors flex items-center gap-1.5"
              title="Download JSON report"
            >
              ↓ Export
            </button>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Nearby:</span>
            {suggestions.slice(0, 6).map((s) => (
              <button
                key={s.path}
                onClick={() => setProjectPath(s.path)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:text-white hover:border-[var(--color-border-hover)] transition-colors"
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {scanning && (
        <div className="card p-6 mb-6 animate-in fade-in">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-block w-5 h-5 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
            <div>
              <span className="text-sm font-medium text-white">
                {currentScanner ? scannerLabels[currentScanner] || "Scanning" : "Starting..."}
              </span>
              <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{scanPhase}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {scanners.map((s, i) => (
              <div key={s.id} className="flex-1">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    i < currentIdx
                      ? "bg-[var(--color-accent)]"
                      : i === currentIdx
                      ? "bg-[var(--color-accent)]/60 animate-pulse"
                      : "bg-[var(--color-border)]"
                  }`}
                />
                <div className={`text-[10px] mt-1 text-center ${i <= currentIdx ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"}`}>
                  {scannerIcons[s.id]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="card p-4 mb-6 border-l-2 border-[var(--color-danger)] animate-in fade-in">
          <div className="flex items-start gap-3">
            <span className="text-[var(--color-danger)] text-sm mt-0.5">✕</span>
            <div>
              <div className="text-sm font-medium text-white">Scan failed</div>
              <div className="text-xs text-[var(--color-muted)] mt-1">{error}</div>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-[var(--color-muted)] hover:text-white text-xs">Dismiss</button>
          </div>
        </div>
      )}

      {report && !scanning && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-border)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="3"
                    strokeDasharray="97.4"
                    strokeDashoffset={97.4 - (97.4 * report.overallScore) / 100}
                    strokeLinecap="round"
                    className="score-ring"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white">
                  {report.overallScore}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[var(--color-muted)] font-mono truncate mb-1">
                  {report.projectPath}
                </div>
                <div className="text-xl font-semibold text-white mb-1">{report.projectName}</div>
                <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
                  <span>{report.totalFindings} findings</span>
                  <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                  <span>{report.durationMs}ms</span>
                  <span className="w-1 h-1 rounded-full bg-[var(--color-border)]" />
                  <span>{new Date(report.timestamp).toLocaleString()}</span>
                </div>
                {report.summary && (
                  <p className="text-xs text-[var(--color-muted)] mt-2 leading-relaxed max-w-lg">{report.summary}</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
            {report.categories.map((cat) => {
              const color =
                cat.severity === "critical" ? "var(--color-danger)" :
                cat.severity === "high" ? "var(--color-warning)" :
                cat.severity === "medium" ? "var(--color-accent)" :
                "var(--color-success)";
              return (
                <div key={cat.category} className="card p-3 text-center">
                  <div className="text-lg font-bold" style={{ color }}>{cat.score}</div>
                  <div className="text-[11px] text-[var(--color-muted)] mt-0.5">{cat.label}</div>
                  <div className="text-[10px] text-[var(--color-muted)] mt-1">
                    {cat.findingCount > 0 ? (
                      <span>{cat.criticalCount > 0 ? `${cat.criticalCount}C ` : ""}{cat.highCount > 0 ? `${cat.highCount}H ` : ""}{cat.mediumCount > 0 ? `${cat.mediumCount}M ` : ""}{cat.lowCount > 0 ? `${cat.lowCount}L` : ""}</span>
                    ) : (
                      <span className="text-[var(--color-success)]">✓ Clean</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-medium text-white mb-2">Scanner Details</h2>
            {report.scannerResults.map((result) => (
              <ScannerSection key={result.category} result={result} />
            ))}
          </div>
        </div>
      )}

      {!report && !scanning && !error && (
        <div className="card p-16 text-center animate-in fade-in">
          <div className="text-5xl mb-6 opacity-30">🛡</div>
          <h2 className="text-xl font-medium text-white mb-3">Ready to scan</h2>
          <p className="text-sm text-[var(--color-muted)] mb-6 max-w-lg mx-auto leading-relaxed">
            Enter a project path above and click <strong className="text-white/80">Scan</strong>. 
            The dashboard will analyze your project for security, AI safety, code quality, performance, and deployment readiness.
          </p>
          <div className="flex items-center justify-center gap-8 text-xs text-[var(--color-muted)]">
            {scanners.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <span className="text-base">{scannerIcons[s.id]}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
