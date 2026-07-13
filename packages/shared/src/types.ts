export type CheckStatus = 'pass' | 'fail' | 'warn' | 'info';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type CategoryId =
  | 'security'
  | 'ai-safety'
  | 'runtime'
  | 'infrastructure'
  | 'observability'
  | 'performance'
  | 'accessibility'
  | 'compliance';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
  description: string;
  icon: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'security', label: 'Security', description: 'Authentication, authorization, secrets, encryption, and common web vulnerabilities', icon: 'shield' },
  { id: 'ai-safety', label: 'AI Safety', description: 'Prompt injection, jailbreak resistance, PII masking, output moderation, RAG validation', icon: 'cpu' },
  { id: 'runtime', label: 'Runtime', description: 'Retry logic, timeouts, abort controllers, circuit breakers, streaming fallback', icon: 'zap' },
  { id: 'infrastructure', label: 'Infrastructure', description: 'Docker, health checks, CDN, caching, env vars, rollback, autoscaling', icon: 'server' },
  { id: 'observability', label: 'Observability', description: 'OpenTelemetry, tracing, structured logs, audit logs, cost tracking, replay', icon: 'activity' },
  { id: 'performance', label: 'Performance', description: 'Bundle size, tree shaking, lazy loading, CLS, LCP, INP, caching', icon: 'gauge' },
  { id: 'accessibility', label: 'Accessibility', description: 'Keyboard navigation, ARIA, contrast, screen readers, focus management', icon: 'accessibility' },
  { id: 'compliance', label: 'Compliance', description: 'GDPR, SOC2, HIPAA, CCPA, data retention, privacy, export', icon: 'scale' },
];

export interface CheckDefinition {
  id: string;
  title: string;
  description: string;
  risk: RiskLevel;
  category: CategoryId;
  weight: number;
  whyItMatters: string;
  exampleExploit?: string;
  suggestedFix: string;
  documentationUrl?: string;
}

export interface CheckResult {
  checkId: string;
  status: CheckStatus;
  message: string;
  file?: string;
  line?: number;
  snippet?: string;
  impact?: string;
  suggestedFix?: string;
  exampleCode?: string;
  patch?: string;
  aiFixPrompt?: string;
}

export interface CategoryResult {
  categoryId: CategoryId;
  categoryLabel: string;
  checks: CheckResult[];
  score: number;
  maxScore: number;
  passed: number;
  failed: number;
  warned: number;
  total: number;
}

export interface ScoreCategory {
  id: CategoryId;
  label: string;
  score: number;
  maxScore: number;
  percentage: number;
  riskCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    passed: number;
  };
}

export interface ProductionScore {
  overall: number;
  maxOverall: number;
  percentage: number;
  categories: ScoreCategory[];
}

export type ScanStage =
  | 'repository-discovery'
  | 'loading-dependencies'
  | 'inspecting-configuration'
  | 'analyzing-runtime'
  | 'scanning-security'
  | 'evaluating-ai-safety'
  | 'checking-deployment'
  | 'generating-report';

export const SCAN_STAGES: ScanStage[] = [
  'repository-discovery',
  'loading-dependencies',
  'inspecting-configuration',
  'analyzing-runtime',
  'scanning-security',
  'evaluating-ai-safety',
  'checking-deployment',
  'generating-report',
];

export const SCAN_STAGE_LABELS: Record<ScanStage, string> = {
  'repository-discovery': 'Discovering repository',
  'loading-dependencies': 'Loading dependencies',
  'inspecting-configuration': 'Inspecting configuration',
  'analyzing-runtime': 'Analyzing runtime',
  'scanning-security': 'Scanning security',
  'evaluating-ai-safety': 'Evaluating AI safety',
  'checking-deployment': 'Checking deployment',
  'generating-report': 'Generating report',
};

export interface ScanProgress {
  stage: ScanStage;
  stageIndex: number;
  totalStages: number;
  categoryProgress: { categoryId: CategoryId; completed: number; total: number }[];
}

export interface ScanReport {
  id: string;
  repoName: string;
  repoUrl?: string;
  branch?: string;
  timestamp: number;
  duration: number;
  status: 'complete' | 'error' | 'cancelled';
  error?: string;
  score: ProductionScore;
  categories: CategoryResult[];
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
}

export interface InspectorState {
  isOpen: boolean;
  check: CheckResult | null;
  categoryId: CategoryId | null;
  definition: CheckDefinition | null;
}

export interface PatchFile {
  filePath: string;
  original: string;
  suggested: string;
  diff: string;
}

export interface AppSettings {
  githubToken: string;
  theme: 'dark';
  scanOnOpen: boolean;
}
