import type { SecurityLevel } from './types.js';

/**
 * The result of a detection scan.
 */
export interface DetectionResult {
  /** Whether a threat was detected */
  detected: boolean;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Human-readable description of what was found */
  details: string[];
  /** The names of triggered patterns */
  triggeredPatterns: string[];
  /** Risk severity level */
  severity: SecurityLevel;
  /** Locations in the input where matches were found (character indices) */
  matchLocations: Array<{ start: number; end: number }>;
}

/**
 * Configuration for the injection detector.
 */
export interface InjectionDetectorConfig {
  /** Sensitivity level (0.0 = least sensitive, 1.0 = most sensitive) */
  sensitivity: number;
  /** Whether to enable heuristic (non-pattern) detection */
  enableHeuristics: boolean;
  /** Whether to scan for prompt injection attempts */
  enablePromptInjection: boolean;
  /** Whether to scan for secret leaks */
  enableSecretDetection: boolean;
  /** Whether to scan for code injection attempts */
  enableCodeInjection: boolean;
  /** Additional custom patterns to check */
  customPatterns: Array<{ name: string; pattern: RegExp; severity: SecurityLevel }>;
}

const DEFAULT_CONFIG: InjectionDetectorConfig = {
  sensitivity: 0.7,
  enableHeuristics: true,
  enablePromptInjection: true,
  enableSecretDetection: true,
  enableCodeInjection: true,
  customPatterns: [],
};

/**
 * Known prompt injection patterns.
 */
const PROMPT_INJECTION_PATTERNS: Array<{
  pattern: RegExp;
  severity: SecurityLevel;
  description: string;
}> = [
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|directives|commands|prompts|messages)/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'Attempt to ignore previous instructions',
  },
  {
    pattern: /you\s+are\s+(now|not)\s+(a\s+)?(free|unrestricted|unbounded|ungoverned)/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'Role-play or identity manipulation attempt',
  },
  {
    pattern: /system\s+(prompt|message|instruction)(\s*[:=])/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'System prompt extraction attempt',
  },
  {
    pattern: /print\s+(your|the)\s+(prompt|instructions|system)/i,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'Direct prompt exfiltration attempt',
  },
  {
    pattern: /repeat\s+(after\s+me|the\s+(above|following|text))/i,
    severity: 'MEDIUM' as SecurityLevel,
    description: 'Prompt repetition attack',
  },
  {
    pattern: /do\s+(not|n't)\s+(follow|obey|adhere|comply)\s+(with\s+)?(your|the)\s+(instructions|rules|guidelines)/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'Instruction override attempt',
  },
  {
    pattern: /<script[\s>]/i,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'HTML script tag injection',
  },
  {
    pattern: /javascript\s*:/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'JavaScript protocol injection',
  },
  {
    pattern: /onerror\s*=|onload\s*=|onclick\s*=|onmouseover\s*=/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'Event handler injection',
  },
];

/**
 * Patterns for detecting leaked secrets and credentials.
 */
const SECRET_PATTERNS: Array<{
  pattern: RegExp;
  severity: SecurityLevel;
  description: string;
}> = [
  {
    pattern: /(?:api[-_]?key|apikey|api_key)\s*[:=]\s*['"][^'"]+['"]/i,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'API key leak',
  },
  {
    pattern: /(?:sk-[a-zA-Z0-9]{20,}|pk-[a-zA-Z0-9]{20,})/,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'Stripe API key format detected',
  },
  {
    pattern: /(?:ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9_]{36,}/,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'GitHub token detected',
  },
  {
    pattern: /AKIA[0-9A-Z]{16}/,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'AWS access key ID detected',
  },
  {
    pattern: /(?:-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----)/i,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'Private key block detected',
  },
  {
    pattern: /(?:eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})/,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'JWT token detected',
  },
  {
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'Password in plaintext',
  },
  {
    pattern: /(?:sk-[a-zA-Z0-9]{32,})/,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'OpenAI API key format detected',
  },
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    severity: 'LOW' as SecurityLevel,
    description: 'Email address detected',
  },
];

/**
 * Patterns for detecting code injection attempts.
 */
const CODE_INJECTION_PATTERNS: Array<{
  pattern: RegExp;
  severity: SecurityLevel;
  description: string;
}> = [
  {
    pattern: /\b(eval|exec)\s*\(/i,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'Dynamic code execution (eval/exec)',
  },
  {
    pattern: /\b(child_process|subprocess|execFile|spawn|fork)\s*[.(]/i,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'Subprocess execution attempt',
  },
  {
    pattern: /\b(fs\.|readFile|writeFile|unlink|rmdir)\s*\(/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'Filesystem operation attempt',
  },
  {
    pattern: /\b(process\.env|process\.exit|process\.kill)\b/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'Process manipulation attempt',
  },
  {
    pattern: /\b(__proto__|prototype\s*=|constructor\s*\.)\b/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'Prototype pollution attempt',
  },
  {
    pattern: /\b(require|import)\s*\(['"][^'"]*['"]\)/i,
    severity: 'MEDIUM' as SecurityLevel,
    description: 'Dynamic import/require detected',
  },
  {
    pattern: /\b(setTimeout|setInterval|setImmediate)\s*\(['"]/i,
    severity: 'MEDIUM' as SecurityLevel,
    description: 'Scheduled code execution with string argument',
  },
  {
    pattern: /\b(new\s+Function)\s*\(/i,
    severity: 'CRITICAL' as SecurityLevel,
    description: 'Function constructor injection',
  },
  {
    pattern: /`.*\$\{.*\}.*`/,
    severity: 'MEDIUM' as SecurityLevel,
    description: 'Template literal with interpolation',
  },
  {
    pattern: /\bshell\s*[:=]\s*true\b/i,
    severity: 'HIGH' as SecurityLevel,
    description: 'Shell execution enabled',
  },
];

/**
 * Heuristic patterns for anomaly detection.
 */
const HEURISTIC_PATTERNS: Array<{
  pattern: RegExp;
  severity: SecurityLevel;
  description: string;
}> = [
  {
    pattern: /.{1000,}/,
    severity: 'LOW' as SecurityLevel,
    description: 'Unusually long input',
  },
  {
    pattern: /([\x00-\x08\x0B\x0C\x0E-\x1F]){10,}/,
    severity: 'MEDIUM' as SecurityLevel,
    description: 'Excessive control characters',
  },
  {
    pattern: /(?:[%;$&|<>\\]){5,}/,
    severity: 'MEDIUM' as SecurityLevel,
    description: 'Suspicious special character sequence',
  },
  {
    pattern: /([^a-zA-Z0-9\s]){20,}/,
    severity: 'LOW' as SecurityLevel,
    description: 'High density of non-alphanumeric characters',
  },
];

/**
 * Detects prompt injection, secret leaks, and code injection attempts
 * using pattern matching and heuristic analysis.
 */
export class InjectionDetector {
  private readonly config: InjectionDetectorConfig;
  private readonly promptPatterns: typeof PROMPT_INJECTION_PATTERNS;
  private readonly secretPatterns: typeof SECRET_PATTERNS;
  private readonly codePatterns: typeof CODE_INJECTION_PATTERNS;
  private readonly heuristicPatterns: typeof HEURISTIC_PATTERNS;

  constructor(config?: Partial<InjectionDetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.promptPatterns = [...PROMPT_INJECTION_PATTERNS];
    this.secretPatterns = [...SECRET_PATTERNS];
    this.codePatterns = [...CODE_INJECTION_PATTERNS];
    this.heuristicPatterns = [...HEURISTIC_PATTERNS];
  }

  /**
   * Scans text for prompt injection attempts.
   *
   * @param text - The input text to scan
   * @returns Detection result with matched patterns and severity
   */
  detectPromptInjection(text: string): DetectionResult {
    if (!this.config.enablePromptInjection) {
      return this.emptyResult();
    }

    return this.scan(text, this.promptPatterns);
  }

  /**
   * Scans text for leaked secrets, tokens, and credentials.
   *
   * @param text - The input text to scan
   * @returns Detection result with matched secret patterns
   */
  detectSecretLeak(text: string): DetectionResult {
    if (!this.config.enableSecretDetection) {
      return this.emptyResult();
    }

    return this.scan(text, this.secretPatterns);
  }

  /**
   * Scans text for code injection attempts.
   *
   * @param text - The input text to scan
   * @returns Detection result with matched code injection patterns
   */
  detectCodeInjection(text: string): DetectionResult {
    if (!this.config.enableCodeInjection) {
      return this.emptyResult();
    }

    return this.scan(text, this.codePatterns);
  }

  /**
   * Runs all detection checks on the given text.
   *
   * @param text - The input text to scan
   * @returns Combined detection result
   */
  detectAll(text: string): DetectionResult {
    const promptResult = this.detectPromptInjection(text);
    const secretResult = this.detectSecretLeak(text);
    const codeResult = this.detectCodeInjection(text);

    let heuristicResult: DetectionResult = this.emptyResult();
    if (this.config.enableHeuristics) {
      heuristicResult = this.scan(text, this.heuristicPatterns);
    }

    const allResults = [promptResult, secretResult, codeResult, heuristicResult];

    const detected = allResults.some((r) => r.detected);
    const details = allResults.flatMap((r) => r.details);
    const triggeredPatterns = allResults.flatMap((r) => r.triggeredPatterns);
    const matchLocations = allResults.flatMap((r) => r.matchLocations);
    const maxConfidence = Math.max(...allResults.map((r) => r.confidence));

    const severities = allResults
      .filter((r) => r.detected)
      .map((r) => r.severity);
    const severityRank: Record<string, number> = {
      NONE: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };
    const highestSeverity = severities.sort(
      (a, b) => (severityRank[b] ?? 0) - (severityRank[a] ?? 0),
    )[0] ?? 'NONE';

    return {
      detected,
      confidence: maxConfidence,
      details: [...new Set(details)],
      triggeredPatterns: [...new Set(triggeredPatterns)],
      severity: highestSeverity as SecurityLevel,
      matchLocations,
    };
  }

  /**
   * Adds a custom detection pattern.
   *
   * @param name - A name for the pattern
   * @param pattern - A RegExp to match
   * @param severity - The severity level if matched
   */
  addCustomPattern(
    name: string,
    pattern: RegExp,
    severity: SecurityLevel,
  ): void {
    this.config.customPatterns.push({ name, pattern, severity });
  }

  private scan(
    text: string,
    patterns: Array<{
      pattern: RegExp;
      severity: SecurityLevel;
      description: string;
    }>,
  ): DetectionResult {
    const details: string[] = [];
    const triggeredPatterns: string[] = [];
    const matchLocations: Array<{ start: number; end: number }> = [];
    let matchCount = 0;

    for (const { pattern, severity, description } of patterns) {
      const matches = text.matchAll(pattern);

      for (const match of matches) {
        if (match.index !== undefined) {
          matchCount++;
          details.push(`${description} (severity: ${severity})`);
          triggeredPatterns.push(description);
          matchLocations.push({
            start: match.index,
            end: match.index + match[0].length,
          });
        }
      }
    }

    // Check custom patterns
    for (const custom of this.config.customPatterns) {
      const matches = text.matchAll(custom.pattern);

      for (const match of matches) {
        if (match.index !== undefined) {
          matchCount++;
          details.push(
            `Custom pattern "${custom.name}": ${custom.severity}`,
          );
          triggeredPatterns.push(custom.name);
          matchLocations.push({
            start: match.index,
            end: match.index + match[0].length,
          });
        }
      }
    }

    const confidence =
      matchCount > 0
        ? Math.min(1.0, this.config.sensitivity * (1 - Math.pow(0.5, matchCount)))
        : 0;

    const severityRank: Record<string, number> = {
      NONE: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    const detectedSeverities = patterns
      .filter((p) => p.pattern.test(text))
      .map((p) => p.severity);

    const highestSeverity = detectedSeverities.sort(
      (a, b) => (severityRank[b] ?? 0) - (severityRank[a] ?? 0),
    )[0] ?? 'NONE';

    return {
      detected: matchCount > 0,
      confidence,
      details,
      triggeredPatterns,
      severity: highestSeverity as SecurityLevel,
      matchLocations,
    };
  }

  private emptyResult(): DetectionResult {
    return {
      detected: false,
      confidence: 0,
      details: [],
      triggeredPatterns: [],
      severity: 'NONE' as SecurityLevel,
      matchLocations: [],
    };
  }
}
