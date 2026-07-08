import type { SecurityLevel } from './types.js';

/**
 * A sanitization rule that defines what to detect and how to handle it.
 */
export interface SanitizerRule {
  /** Unique rule name */
  name: string;
  /** Pattern to match */
  pattern: RegExp;
  /** Replacement string (empty string to strip) */
  replacement: string;
  /** Whether this rule applies to input sanitization */
  applyToInput: boolean;
  /** Whether this rule applies to output sanitization */
  applyToOutput: boolean;
  /** Security level associated with this rule */
  severity: SecurityLevel;
}

/**
 * Configuration for the input/output sanitizer.
 */
export interface SanitizerConfig {
  /** Whether to enable PII detection and redaction */
  enablePIIDetection: boolean;
  /** Whether to enable HTML sanitization on input */
  sanitizeHtml: boolean;
  /** Whether to remove control characters */
  removeControlChars: boolean;
  /** Maximum allowed input length */
  maxInputLength: number;
  /** Maximum allowed output length */
  maxOutputLength: number;
  /** Custom rules to apply */
  customRules: SanitizerRule[];
  /** Placeholder string for redacted secrets */
  redactionPlaceholder: string;
}

const DEFAULT_CONFIG: SanitizerConfig = {
  enablePIIDetection: true,
  sanitizeHtml: true,
  removeControlChars: true,
  maxInputLength: 100_000,
  maxOutputLength: 1_000_000,
  customRules: [],
  redactionPlaceholder: '[REDACTED]',
};

/**
 * Default PII patterns for detection and redaction.
 */
const PII_PATTERNS: SanitizerRule[] = [
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: '[REDACTED EMAIL]',
    applyToInput: false,
    applyToOutput: true,
    severity: 'MEDIUM' as SecurityLevel,
  },
  {
    name: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[REDACTED SSN]',
    applyToInput: false,
    applyToOutput: true,
    severity: 'CRITICAL' as SecurityLevel,
  },
  {
    name: 'phone_us',
    pattern: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[REDACTED PHONE]',
    applyToInput: false,
    applyToOutput: true,
    severity: 'MEDIUM' as SecurityLevel,
  },
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
    replacement: '[REDACTED CC]',
    applyToInput: false,
    applyToOutput: true,
    severity: 'CRITICAL' as SecurityLevel,
  },
  {
    name: 'ip_address',
    pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    replacement: '[REDACTED IP]',
    applyToInput: false,
    applyToOutput: true,
    severity: 'LOW' as SecurityLevel,
  },
];

/**
 * Default HTML patterns for input sanitization.
 */
const HTML_PATTERNS: SanitizerRule[] = [
  {
    name: 'script_tag',
    pattern: /<script[\s>][\s\S]*?<\/script\s*>/gi,
    replacement: '',
    applyToInput: true,
    applyToOutput: false,
    severity: 'HIGH' as SecurityLevel,
  },
  {
    name: 'event_handler',
    pattern: /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    replacement: '',
    applyToInput: true,
    applyToOutput: false,
    severity: 'HIGH' as SecurityLevel,
  },
  {
    name: 'javascript_uri',
    pattern: /javascript\s*:\s*[^\s"']+/gi,
    replacement: '',
    applyToInput: true,
    applyToOutput: false,
    severity: 'HIGH' as SecurityLevel,
  },
  {
    name: 'iframe',
    pattern: /<iframe[\s>][\s\S]*?<\/iframe\s*>/gi,
    replacement: '',
    applyToInput: true,
    applyToOutput: false,
    severity: 'MEDIUM' as SecurityLevel,
  },
  {
    name: 'object_tag',
    pattern: /<object[\s>][\s\S]*?<\/object\s*>/gi,
    replacement: '',
    applyToInput: true,
    applyToOutput: false,
    severity: 'MEDIUM' as SecurityLevel,
  },
  {
    name: 'embed_tag',
    pattern: /<embed[\s>][\s\S]*?<\/embed\s*>/gi,
    replacement: '',
    applyToInput: true,
    applyToOutput: false,
    severity: 'MEDIUM' as SecurityLevel,
  },
  {
    name: 'style_tag',
    pattern: /<style[\s>][\s\S]*?<\/style\s*>/gi,
    replacement: '',
    applyToInput: true,
    applyToOutput: false,
    severity: 'LOW' as SecurityLevel,
  },
];

/**
 * Known secret patterns for redaction.
 */
const SECRET_PATTERNS: SanitizerRule[] = [
  {
    name: 'api_key_generic',
    pattern: /(?:api[-_]?key|apikey|api_key)\s*[:=]\s*['"][^'"]+['"]/gi,
    replacement: '$1: [REDACTED API KEY]',
    applyToInput: true,
    applyToOutput: true,
    severity: 'CRITICAL' as SecurityLevel,
  },
  {
    name: 'aws_key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED AWS KEY]',
    applyToInput: true,
    applyToOutput: true,
    severity: 'CRITICAL' as SecurityLevel,
  },
  {
    name: 'jwt_token',
    pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
    replacement: '[REDACTED JWT]',
    applyToInput: true,
    applyToOutput: true,
    severity: 'CRITICAL' as SecurityLevel,
  },
  {
    name: 'github_token',
    pattern: /\b(?:ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9_]{36,}\b/g,
    replacement: '[REDACTED GITHUB TOKEN]',
    applyToInput: true,
    applyToOutput: true,
    severity: 'CRITICAL' as SecurityLevel,
  },
  {
    name: 'private_key',
    pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
    replacement: '[REDACTED PRIVATE KEY]',
    applyToInput: true,
    applyToOutput: true,
    severity: 'CRITICAL' as SecurityLevel,
  },
  {
    name: 'openai_key',
    pattern: /\bsk-[a-zA-Z0-9]{32,}\b/g,
    replacement: '[REDACTED API KEY]',
    applyToInput: true,
    applyToOutput: true,
    severity: 'CRITICAL' as SecurityLevel,
  },
];

/**
 * Sanitizes inputs and outputs by stripping dangerous content, redacting
 * secrets and PII, and enforcing length limits.
 */
export class InputSanitizer {
  private readonly config: SanitizerConfig;
  private readonly piiRules: SanitizerRule[] = PII_PATTERNS.map((r) => ({
    ...r,
  }));
  private readonly htmlRules: SanitizerRule[] = HTML_PATTERNS.map((r) => ({
    ...r,
  }));
  private readonly secretRules: SanitizerRule[] = SECRET_PATTERNS.map((r) => ({
    ...r,
  }));

  constructor(config?: Partial<SanitizerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Sanitizes user input before processing.
   * Strips dangerous HTML, control characters, and secrets.
   * Enforces maximum input length.
   *
   * @param input - The raw input string
   * @returns Sanitized input
   */
  sanitizeInput(input: string): string {
    if (input.length > this.config.maxInputLength) {
      input = input.slice(0, this.config.maxInputLength);
    }

    let result = input;

    if (this.config.sanitizeHtml) {
      result = this.applyRules(result, this.htmlRules);
    }

    if (this.config.removeControlChars) {
      result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    result = this.applyRules(result, this.secretRules);

    result = this.applyRules(result, this.config.customRules.filter(
      (r) => r.applyToInput,
    ));

    return result;
  }

  /**
   * Sanitizes model output before returning to the user.
   * Redacts PII, secrets, and enforces maximum output length.
   *
   * @param output - The raw output string
   * @returns Sanitized output
   */
  sanitizeOutput(output: string): string {
    let result = output;

    if (result.length > this.config.maxOutputLength) {
      result = result.slice(0, this.config.maxOutputLength);
    }

    if (this.config.enablePIIDetection) {
      result = this.applyRules(result, this.piiRules);
    }

    result = this.applyRules(result, this.secretRules);

    result = this.applyRules(result, this.config.customRules.filter(
      (r) => r.applyToOutput,
    ));

    return result;
  }

  /**
   * Redacts known secrets from text, replacing them with placeholders.
   *
   * @param text - The text to redact
   * @returns Text with secrets replaced
   */
  redactSecrets(text: string): string {
    return this.applyRules(text, this.secretRules);
  }

  /**
   * Adds a custom sanitization rule.
   *
   * @param rule - The rule definition
   */
  addRule(rule: SanitizerRule): void {
    this.config.customRules.push(rule);
  }

  /**
   * Replaces PII patterns in text with placeholders without modifying other content.
   *
   * @param text - The text to redact PII from
   * @returns Text with PII redacted
   */
  redactPII(text: string): string {
    return this.applyRules(text, this.piiRules);
  }

  private applyRules(text: string, rules: SanitizerRule[]): string {
    let result = text;

    for (const rule of rules) {
      result = result.replace(rule.pattern, rule.replacement);
    }

    return result;
  }
}
