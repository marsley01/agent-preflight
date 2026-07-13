import { create } from 'zustand';
import type {
  ScanReport,
  ScanProgress,
  InspectorState,
  CategoryId,
  CheckResult,
  CheckDefinition,
} from '@shared/types';
import { getCheckById } from '@shared/checks/index';

interface ThreatItem {
  package: string;
  vulnerability_type: string;
  cve_id: string;
  severity: string;
  description: string;
  fix_snippet: string;
  source: string;
  published: string;
}

interface ScanStore {
  // Scan state
  report: ScanReport | null;
  isScanning: boolean;
  progress: ScanProgress | null;
  error: string | null;

  // Terminal logs
  terminalLogs: string[];
  addTerminalLog: (line: string) => void;
  clearTerminalLogs: () => void;

  // Inspector
  inspector: InspectorState;

  // History
  history: ScanReport[];

  // GitHub input
  repoInput: string;
  githubToken: string;

  // Live intelligence
  threats: ThreatItem[];
  setThreats: (t: ThreatItem[]) => void;
  threatLoading: boolean;
  setThreatLoading: (l: boolean) => void;

  // Actions
  setReport: (report: ScanReport | null) => void;
  setIsScanning: (scanning: boolean) => void;
  setProgress: (progress: ScanProgress | null) => void;
  setError: (error: string | null) => void;
  openInspector: (check: CheckResult, categoryId: CategoryId) => void;
  closeInspector: () => void;
  addToHistory: (report: ScanReport) => void;
  setRepoInput: (input: string) => void;
  setGithubToken: (token: string) => void;
}

export const useScanStore = create<ScanStore>((set, get) => ({
  report: null,
  isScanning: false,
  progress: null,
  error: null,

  terminalLogs: [],
  addTerminalLog: (line) =>
    set((state) => ({ terminalLogs: [...state.terminalLogs, line].slice(-200) })),
  clearTerminalLogs: () => set({ terminalLogs: [] }),

  inspector: { isOpen: false, check: null, categoryId: null, definition: null },

  history: [],
  repoInput: '',
  githubToken: typeof window !== 'undefined' ? sessionStorage.getItem('gh_token') || '' : '',

  threats: [],
  setThreats: (threats) => set({ threats }),
  threatLoading: false,
  setThreatLoading: (threatLoading) => set({ threatLoading }),

  setReport: (report) => set({ report }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),

  openInspector: (check, categoryId) => {
    const def = getCheckById(check.checkId);
    set({ inspector: { isOpen: true, check, categoryId, definition: def || null } });
  },

  closeInspector: () => {
    set({ inspector: { isOpen: false, check: null, categoryId: null, definition: null } });
  },

  addToHistory: (report) => {
    set((state) => ({
      history: [report, ...state.history].slice(0, 50),
    }));
  },

  setRepoInput: (repoInput) => set({ repoInput }),
  setGithubToken: (token) => {
    sessionStorage.setItem('gh_token', token);
    set({ githubToken: token });
  },
}));
