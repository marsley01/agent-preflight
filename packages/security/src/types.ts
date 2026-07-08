/**
 * Security level definitions for classifying sensitivity of operations and data.
 */
export enum SecurityLevel {
  NONE = 'NONE',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Supported authentication methods for the system.
 */
export enum AuthMethod {
  API_KEY = 'API_KEY',
  JWT = 'JWT',
  OAUTH = 'OAUTH',
  MUTUAL_TLS = 'MUTUAL_TLS',
  CERTIFICATE = 'CERTIFICATE',
  NONE = 'NONE',
}

/**
 * The effect of a permission or policy rule.
 */
export enum PermissionEffect {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

/**
 * Resource types recognized by the authorization system.
 */
export enum ResourceType {
  AGENT = 'AGENT',
  TASK = 'TASK',
  MEMORY = 'MEMORY',
  MODEL = 'MODEL',
  PLUGIN = 'PLUGIN',
  API = 'API',
  CONFIG = 'CONFIG',
  LOG = 'LOG',
}

/**
 * The result of an access control decision.
 */
export type AccessDecision = 'granted' | 'denied' | 'requires_approval';

/**
 * Detailed result of a policy evaluation including reasoning and matched rules.
 */
export interface PolicyEvaluationResult {
  /** The final access decision */
  decision: AccessDecision;
  /** Identifiers of policies that matched during evaluation */
  matchedPolicies: string[];
  /** Identifiers of specific rules that were applied */
  appliedRules: string[];
  /** Human-readable reasoning for the decision */
  reasoning: string[];
  /** When the evaluation occurred */
  timestamp: Date;
  /** The effective security level required */
  requiredLevel?: SecurityLevel;
  /** The security level of the requesting subject */
  subjectLevel?: SecurityLevel;
}

/**
 * Result of validating a policy document or configuration.
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error messages for validation failures */
  errors: string[];
  /** Warning messages for non-critical issues */
  warnings: string[];
}
