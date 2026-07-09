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

const scannerProgressLabels: Record<string, string> = {
  security: "Security scan",
  "ai-safety": "AI safety scan",
  "code-quality": "Code quality scan",
  performance: "Performance scan",
  deployment: "Deployment scan",
};

function ShareBadgeButton() {
  const [copied, setCopied] = useState(false);
  const markdown = `![Agent Preflight](${typeof window !== "undefined" ? window.location.origin : ""}/badge/current)`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button onClick={copy} className="text-xs text-[var(--color-muted)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 hover:text-white hover:border-[var(--color-border-hover)] transition-colors">
      {copied ? "Copied!" : "Share Badge"}
    </button>
  );
}

const scannerLabels: Record<string, string> = {
  security: "Security",
  "ai-safety": "AI Safety",
  "code-quality": "Code Quality",
  performance: "Performance",
  deployment: "Deployment",
};

function ScannerSection({ result }: { result: ScannerResult }) {
  const [open, setOpen] = useState(false);
  const label = scannerLabels[result.category] || result.scanner;

  const severityColor = (sev: string) =>
    sev === "critical" ? "var(--color-danger)" :
    sev === "high" ? "var(--color-warning)" :
    sev === "medium" ? "var(--color-accent)" :
    "var(--color-success)";

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{label}</span>
          {result.findings.length > 0 ? (
            <span className="text-xs text-[var(--color-muted)]">
              {result.findings.filter(f => f.severity === "critical").length > 0 &&
                <span className="severity-critical mr-1">{result.findings.filter(f => f.severity === "critical").length} critical</span>}
              {result.findings.filter(f => f.severity === "high").length > 0 &&
                <span className="severity-high mr-1">{result.findings.filter(f => f.severity === "high").length} high</span>}
              {result.findings.filter(f => f.severity === "medium").length > 0 &&
                <span className="severity-medium mr-1">{result.findings.filter(f => f.severity === "medium").length} medium</span>}
              {result.findings.filter(f => f.severity === "low").length > 0 &&
                <span className="severity-low">{result.findings.filter(f => f.severity === "low").length} low</span>}
            </span>
          ) : (
            <span className="text-xs text-[var(--color-success)]">No issues</span>
          )}
        </div>
        <span className={`text-xs text-[var(--color-muted)] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)]">
          {result.findings.length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-muted)]">No findings in this category.</p>
          ) : (
            result.findings.map((f) => (
              <div key={f.id} className="flex items-start gap-3 px-4 py-3 text-sm border-b border-[var(--color-border)] last:border-0">
                <span
                  className="font-medium min-w-[60px] text-xs uppercase"
                  style={{ color: severityColor(f.severity) }}
                >
                  {f.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-white">{f.title}</div>
                  <div className="text-[var(--color-muted)] text-xs mt-0.5 truncate">{f.file || f.impact}</div>
                </div>
              </div>
            ))
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
  const [projectPath, setProjectPath] = useState(".");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadSavedReport();
    if (saved) setReport(saved);
    try {
      const savedPath = localStorage.getItem("agent-preflight-project-path");
      if (savedPath) setProjectPath(savedPath);
    } catch {}
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setReport(null);

    try {
      for (const s of scanners) {
        setCurrentScanner(s.id);
        await new Promise((r) => setTimeout(r, 150));
      }

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: projectPath === "." ? process.cwd() : projectPath }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.details || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setReport(data);
      saveReport(data);
      setCurrentScanner(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      setCurrentScanner(null);
    } finally {
      setScanning(false);
    }
  }, [projectPath]);

  const scoreColor = report
    ? report.overallScore >= 80 ? "var(--color-success)" :
      report.overallScore >= 60 ? "var(--color-warning)" :
      "var(--color-danger)"
    : "var(--color-border)";

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Production readiness overview
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="relative">
            <input
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="Project path (e.g. .)"
              className="w-48 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-muted)]"
            />
          </div>
          <button
            onClick={runScan}
            disabled={scanning}
            className="btn-primary disabled:opacity-50 flex items-center gap-2"
          >
            {scanning ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning...
              </>
            ) : (
              "Run Scan"
            )}
          </button>
        </div>
      </div>

      {scanning && currentScanner && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-block w-4 h-4 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
            <span className="text-sm text-white">{scannerProgressLabels[currentScanner] || currentScanner}</span>
          </div>
          <div className="flex gap-2">
            {scanners.map((s) => (
              <div
                key={s.id}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  scanners.indexOf(s) < scanners.findIndex((x) => x.id === currentScanner)
                    ? "bg-[var(--color-accent)]"
                    : scanners.indexOf(s) === scanners.findIndex((x) => x.id === currentScanner)
                    ? "bg-[var(--color-accent)]/50"
                    : "bg-[var(--color-border)]"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="card p-4 mb-6 border-[var(--color-danger)]/30">
          <div className="flex items-center gap-3">
            <span className="text-[var(--color-danger)] font-medium">Scan failed:</span>
            <span className="text-sm text-[var(--color-muted)]">{error}</span>
          </div>
        </div>
      )}

      {report ? (
        <>
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
                <div className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-1">
                  {report.projectPath}
                </div>
                <div className="text-xl font-semibold text-white mb-1">{report.projectName}</div>
                <div className="flex items-center gap-4 text-xs text-[var(--color-muted)]">
                  <span>{report.totalFindings} findings</span>
                  <span>·</span>
                  <span>{report.durationMs}ms</span>
                  <span>·</span>
                  <span>{new Date(report.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <ShareBadgeButton />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {report.categories.map((cat) => {
              const color =
                cat.severity === "critical" ? "var(--color-danger)" :
                cat.severity === "high" ? "var(--color-warning)" :
                cat.severity === "medium" ? "var(--color-accent)" :
                "var(--color-success)";
              return (
                <div key={cat.category} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--color-muted)]">{cat.label}</span>
                    <span className="text-lg font-bold" style={{ color }}>{cat.score}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {cat.criticalCount > 0 && <span className="severity-critical text-xs">{cat.criticalCount} critical</span>}
                    {cat.highCount > 0 && <span className="severity-high text-xs">{cat.highCount} high</span>}
                    {cat.mediumCount > 0 && <span className="severity-medium text-xs">{cat.mediumCount} medium</span>}
                    {cat.lowCount > 0 && <span className="severity-low text-xs">{cat.lowCount} low</span>}
                    {cat.findingCount === 0 && <span className="text-xs text-[var(--color-success)]">No issues</span>}
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
        </>
      ) : !scanning && !error ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">🛡</div>
          <h2 className="text-lg font-medium text-white mb-2">Ready to scan</h2>
          <p className="text-sm text-[var(--color-muted)] mb-4 max-w-md mx-auto">
            Set the project path above and click "Run Scan" to analyze a project for security, AI safety, code quality, performance, and deployment readiness.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-[var(--color-muted)]">
            <span>Security</span>
            <span>·</span>
            <span>AI Safety</span>
            <span>·</span>
            <span>Code Quality</span>
            <span>·</span>
            <span>Performance</span>
            <span>·</span>
            <span>Deployment</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
