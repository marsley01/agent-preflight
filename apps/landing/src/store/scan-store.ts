import { create } from 'zustand';
import type {
  ScanReport,
  ScanProgress,
  InspectorState,
  CategoryId,
  CheckResult,
  CheckDefinition,
  AppSettings,
} from '@shared/types';
import { getCheckById } from '@shared/checks/index';

interface ScanStore {
  // Scan state
  report: ScanReport | null;
  isScanning: boolean;
  progress: ScanProgress | null;
  error: string | null;

  // Inspector
  inspector: InspectorState;

  // History
  history: ScanReport[];

  // Settings
  settings: AppSettings;

  // GitHub input
  repoInput: string;
  githubToken: string;

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
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const useScanStore = create<ScanStore>((set, get) => ({
  report: null,
  isScanning: false,
  progress: null,
  error: null,

  inspector: { isOpen: false, check: null, categoryId: null, definition: null },

  history: [],
  settings: { githubToken: '', theme: 'dark', scanOnOpen: false },
  repoInput: '',
  githubToken: typeof window !== 'undefined' ? sessionStorage.getItem('gh_token') || '' : '',

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

  updateSettings: (partial) => {
    set((state) => ({ settings: { ...state.settings, ...partial } }));
  },
}));
