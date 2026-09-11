import { create } from 'zustand';
import { scanGitHubRepo } from '@shared/engine';
import type { ScanReport, CheckResult } from '@shared/types';
import { SCAN_STAGE_LABELS } from '@shared/types';

export interface DetectionItem {
  id: string;
  severity: 'high' | 'warning' | 'info';
  ruleId: string;
  location: string;
  action: string;
  codeSnippet?: string;
  age: string;
}

export interface ScanHistoryEntry {
  id: string;
  repoName: string;
  timestamp: number;
  duration: number;
  score: number;
  passed: number;
  failed: number;
  warned: number;
  total: number;
  issueIds: string[];
}

export interface SinceLastScan {
  newIssues: string[];
  fixedIssues: string[];
  scoreDelta: number;
  totalDelta: number;
  previousScore: number | null;
}

const HISTORY_KEY = 'preflight-scan-history';
const HISTORY_MAX = 30;

function loadHistory(): ScanHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history: ScanHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // storage may be unavailable (private mode); ignore
  }
}

/** Compare the two most recent scans to show "since your last scan". */
export function computeSinceLastScan(history: ScanHistoryEntry[]): SinceLastScan | null {
  if (history.length < 2) return null;
  const prev = history[history.length - 2];
  const curr = history[history.length - 1];

  const prevIds = new Set(prev.issueIds);
  const currIds = new Set(curr.issueIds);

  return {
    newIssues: curr.issueIds.filter((id) => !prevIds.has(id)),
    fixedIssues: Array.from(prevIds).filter((id) => !currIds.has(id)),
    scoreDelta: curr.score - prev.score,
    totalDelta: curr.total - prev.total,
    previousScore: prev.score,
  };
}

interface ScanState {
  repoUrl: string;
  isScanning: boolean;
  scanProgress: string;
  scanError: string | null;
  lastReport: ScanReport | null;
  lastScanTime: number | null;
  scansCompletedCount: number;
  detections: DetectionItem[];
  severityFilter: 'all' | 'high' | 'warning';
  history: ScanHistoryEntry[];
  usingAuthToken: boolean;

  // Actions
  setRepoUrl: (url: string) => void;
  setSeverityFilter: (filter: 'all' | 'high' | 'warning') => void;
  triggerScan: (targetRepo?: string) => Promise<ScanReport | null>;
  downloadSARIFReport: () => void;
  clearHistory: () => void;
}

function normalizeRepoUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function reportToDetections(report: ScanReport): DetectionItem[] {
  const items: DetectionItem[] = [];
  for (const category of report.categories) {
    for (const check of category.checks) {
      if (check.status === 'fail' || check.status === 'warn') {
        const action = check.suggestedFix
          ? `${check.message} — ${check.suggestedFix}`
          : check.message;
        items.push({
          id: `${category.categoryId}-${check.checkId}-${items.length}`,
          severity: check.status === 'fail' ? 'high' : 'warning',
          ruleId: check.checkId,
          location: check.file
            ? `${check.file}${check.line ? `:${check.line}` : ''}`
            : category.categoryId,
          action,
          codeSnippet: check.snippet,
          age: 'This scan'
        });
      }
    }
  }
  return items;
}

function reportToHistoryEntry(report: ScanReport): ScanHistoryEntry {
  const issueIds: string[] = [];
  for (const category of report.categories) {
    for (const check of category.checks) {
      if (check.status === 'fail' || check.status === 'warn') {
        issueIds.push(check.checkId);
      }
    }
  }
  return {
    id: report.id,
    repoName: report.repoName,
    timestamp: report.timestamp,
    duration: report.duration,
    score: report.score.percentage,
    passed: report.passedChecks,
    failed: report.failedChecks,
    warned: report.warningChecks,
    total: report.totalChecks,
    issueIds,
  };
}

function getGitHubToken(): string | undefined {
  const fromEnv = (import.meta.env as Record<string, string | undefined>).VITE_GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    return localStorage.getItem('github_token') || undefined;
  } catch {
    return undefined;
  }
}

export const useScanStore = create<ScanState>((set, get) => ({
  repoUrl: 'github.com/vercel/next.js',
  isScanning: false,
  scanProgress: '',
  scanError: null,
  lastReport: null,
  lastScanTime: null,
  scansCompletedCount: 0,
  detections: [],
  severityFilter: 'all',
  history: loadHistory(),
  usingAuthToken: !!getGitHubToken(),

  setRepoUrl: (url) => set({ repoUrl: url }),
  setSeverityFilter: (filter) => set({ severityFilter: filter }),

  triggerScan: async (targetRepo) => {
    if (get().isScanning) return null;

    const target = normalizeRepoUrl(targetRepo || get().repoUrl);
    if (!target) {
      set({ scanError: 'Enter a repository link to scan.' });
      return null;
    }

    set({ isScanning: true, scanError: null, scanProgress: 'Starting your scan...' });

    const token = getGitHubToken();

    const report = await scanGitHubRepo(
      target,
      undefined,
      (progress) => {
        const label = SCAN_STAGE_LABELS[progress.stage] || 'Scanning';
        set({ scanProgress: `${label}...` });
      },
      token
    );

    if (report.status === 'error') {
      set({
        isScanning: false,
        scanProgress: '',
        scanError: report.error || 'Scan failed',
        lastScanTime: report.duration
      });
      return report;
    }

    const entry = reportToHistoryEntry(report);
    const history = [...get().history, entry].slice(-HISTORY_MAX);
    saveHistory(history);

    set(() => ({
      isScanning: false,
      scanProgress: '',
      scanError: null,
      lastReport: report,
      lastScanTime: report.duration,
      scansCompletedCount: get().scansCompletedCount + 1,
      detections: reportToDetections(report),
      history,
    }));

    return report;
  },

  clearHistory: () => {
    saveHistory([]);
    set({ history: [], lastReport: null, detections: [], scanError: null });
  },

  downloadSARIFReport: () => {
    const resultItems: Array<{ ruleId: string; level: string; message: string; file?: string; line?: number }> = [];
    const report = get().lastReport;
    if (report) {
      for (const category of report.categories) {
        for (const check of category.checks) {
          if (check.status === 'fail' || check.status === 'warn') {
            const line = check.line ?? (check.file ? undefined : undefined);
            resultItems.push({
              ruleId: check.checkId,
              level: check.status === 'fail' ? 'error' : 'warning',
              message: check.message,
              file: check.file,
              line: line
            });
          }
        }
      }
    }

    const sarif = {
      $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "Preflight Scanner",
              version: "0.1.0",
              informationUri: "https://github.com/anomalyco/agent-preflight"
            }
          },
          results: resultItems.map((r) => ({
            ruleId: r.ruleId,
            level: r.level,
            message: { text: r.message },
            locations: r.file
              ? [
                  {
                    physicalLocation: {
                      artifactLocation: { uri: r.file },
                      ...(r.line ? { region: { startLine: r.line } } : {})
                    }
                  }
                ]
              : []
          }))
        }
      ]
    };

    const blob = new Blob([JSON.stringify(sarif, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'preflight-scan-results.sarif';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}));

export type { CheckResult };