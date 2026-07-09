"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ScanReport } from "@agent-preflight/scanner";

const HISTORY_KEY = "agent-preflight-scan-history";

function loadHistory(): ScanReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
}

function scoreColor(score: number) {
  if (score >= 80) return "var(--color-success)";
  if (score >= 60) return "var(--color-warning)";
  return "var(--color-danger)";
}

export default function ScansPage() {
  const [history, setHistory] = useState<ScanReport[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleClear = () => {
    clearHistory();
    setHistory([]);
  };

  const sorted = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-2">Scans</h1>
          <p className="text-sm text-[var(--color-muted)]">Scan history and results</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-[var(--color-muted)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 hover:text-white hover:border-[var(--color-border-hover)] transition-colors"
          >
            Clear History
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-lg font-medium text-white mb-2">No scans yet</h2>
          <p className="text-sm text-[var(--color-muted)] mb-6">
            Run a scan from the dashboard and it will appear here.
          </p>
          <Link
            href="/dashboard"
            className="btn-primary inline-block"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((scan) => {
            const date = new Date(scan.timestamp);
            const isToday = new Date().toDateString() === date.toDateString();
            const dateStr = isToday
              ? `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            return (
              <Link
                key={scan.id}
                href="/dashboard"
                className="card p-4 flex items-center gap-4 hover:border-[var(--color-border-hover)] transition-colors block"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ color: scoreColor(scan.overallScore), background: "var(--color-bg)" }}
                >
                  {scan.overallScore}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{scan.projectName}</div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5 truncate">{scan.projectPath}</div>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] mt-1">
                    <span>{scan.totalFindings} findings</span>
                    <span>·</span>
                    <span>{scan.durationMs}ms</span>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-muted)] flex-shrink-0 hidden sm:block">
                  {dateStr}
                </div>
                <span className="text-xs text-[var(--color-muted)]">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
