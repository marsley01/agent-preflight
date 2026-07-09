"use client";

import { useState } from "react";
import type { ScanReport } from "@agent-preflight/scanner";

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
    <div className="relative ml-auto">
      <button onClick={copy} className="text-xs text-[var(--color-muted)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 hover:text-white hover:border-[var(--color-border-hover)] transition-colors">
        {copied ? "Copied!" : "Share Badge"}
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [scanning, setScanning] = useState(false);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error("Scan failed", err);
    } finally {
      setScanning(false);
    }
  };

  const ScoreCard = ({ label, score, severity, count }: { label: string; score: number; severity: string; count: number }) => {
    const color =
      severity === "critical" ? "var(--color-danger)" :
      severity === "high" ? "var(--color-warning)" :
      severity === "medium" ? "var(--color-accent)" :
      "var(--color-success)";

    return (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[var(--color-muted)]">{label}</span>
          <span className="text-lg font-bold" style={{ color }}>{score}</span>
        </div>
        <div className="flex gap-3 text-xs text-[var(--color-muted)]">
          <span className="severity-critical">{count > 0 ? `${count} findings` : "No issues"}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Production readiness overview
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="btn-primary disabled:opacity-50"
        >
          {scanning ? "Scanning..." : "Run Scan"}
        </button>
      </div>

      {report ? (
        <>
          <div className="flex items-center gap-4 mb-6">
            <div className="card p-5 flex items-center gap-4">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-border)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5"
                    fill="none"
                    stroke={
                      report.overallScore >= 80 ? "var(--color-success)" :
                      report.overallScore >= 60 ? "var(--color-warning)" :
                      "var(--color-danger)"
                    }
                    strokeWidth="3"
                    strokeDasharray="97.4"
                    strokeDashoffset={97.4 - (97.4 * report.overallScore) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                  {report.overallScore}
                </span>
              </div>
              <div>
                <div className="text-sm text-[var(--color-muted)]">Overall Score</div>
                <div className="text-xl font-semibold text-white">{report.projectName}</div>
                <div className="text-xs text-[var(--color-muted)] mt-1">
                  {report.totalFindings} findings · {report.durationMs}ms
                </div>
              </div>
              <ShareBadgeButton />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {report.categories.map((cat) => (
              <ScoreCard
                key={cat.category}
                label={cat.label}
                score={cat.score}
                severity={cat.severity}
                count={cat.findingCount}
              />
            ))}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-medium text-white mb-4">Recent Findings</h2>
            <div className="space-y-2">
              {report.scannerResults.flatMap((r) => r.findings.slice(0, 5)).map((f) => (
                <div key={f.id} className="flex items-start gap-3 py-2 text-sm border-b border-[var(--color-border)] last:border-0">
                  <span className={`severity-${f.severity} font-medium min-w-[60px]`}>
                    {f.severity.toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <div className="text-white">{f.title}</div>
                    <div className="text-[var(--color-muted)] text-xs mt-0.5">{f.file || f.impact}</div>
                  </div>
                </div>
              ))}
              {report.totalFindings === 0 && (
                <p className="text-sm text-[var(--color-muted)]">No issues found. Your project looks clean!</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">🛡</div>
          <h2 className="text-lg font-medium text-white mb-2">Ready to scan</h2>
          <p className="text-sm text-[var(--color-muted)] mb-6">
            Run a production readiness scan to analyze your project for security, performance, and deployment issues.
          </p>
          <button onClick={runScan} disabled={scanning} className="btn-primary disabled:opacity-50">
            {scanning ? "Scanning..." : "Start Scan"}
          </button>
        </div>
      )}
    </div>
  );
}
