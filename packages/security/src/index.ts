// ─── Types ───────────────────────────────────────────────────────────────────
export {
  SecurityLevel,
  AuthMethod,
  PermissionEffect,
  ResourceType,
} from './types.js';
export type {
  AccessDecision,
  PolicyEvaluationResult,
  ValidationResult,
} from './types.js';

// ─── RBAC ────────────────────────────────────────────────────────────────────
export { RBACManager, BUILT_IN_ROLES } from './rbac.js';
export type { Role } from './rbac.js';

// ─── ABAC ────────────────────────────────────────────────────────────────────
export { ABACEngine } from './abac.js';
export type {
  ABACPolicy,
  AttributeCondition,
  AttributeOperator,
  EvaluationContext,
} from './abac.js';

// ─── Policy Engine ───────────────────────────────────────────────────────────
export { PolicyEngine } from './policy.js';
export type {
  PolicyDocument,
  PolicyDocumentType,
  PolicyEvaluationParams,
  AuditTrailEntry,
} from './policy.js';

// ─── Threat Detection ────────────────────────────────────────────────────────
export { InjectionDetector } from './detection.js';
export type {
  DetectionResult,
  InjectionDetectorConfig,
} from './detection.js';

// ─── Sanitizer ───────────────────────────────────────────────────────────────
export { InputSanitizer } from './sanitizer.js';
export type { SanitizerRule, SanitizerConfig } from './sanitizer.js';

// ─── Audit ───────────────────────────────────────────────────────────────────
export {
  AuditLogger,
  ConsoleAuditBackend,
  InMemoryAuditBackend,
} from './audit.js';
export type {
  AuditEntry,
  AuditBackend,
  AuditFilter,
  RetentionPolicy,
} from './audit.js';

// ─── Sandbox ─────────────────────────────────────────────────────────────────
export { SandboxManager } from './sandbox.js';
export type {
  SandboxConfig,
  ResourceLimits,
  NetworkRule,
  FilesystemRule,
  SandboxCheckResult,
  ExecutionMode,
} from './sandbox.js';

// ─── Rate Limiting ───────────────────────────────────────────────────────────
export { RateLimiter, InMemoryRateLimitStore } from './ratelimit.js';
export type {
  RateLimiterConfig,
  RateLimitResult,
  RateLimitStore,
  RateLimitAlgorithm,
} from './ratelimit.js';

// ─── Authentication ──────────────────────────────────────────────────────────
export { Authenticator } from './auth.js';
export type {
  TokenPayload,
  Session,
  AuthResult,
  MfaChallenge,
  ApiKeyEntry,
  AuthenticatorConfig,
} from './auth.js';

// ─── Encryption ──────────────────────────────────────────────────────────────
export { EncryptionService } from './encryption.js';
export type {
  EncryptedData,
  KeyEntry,
  DataKey,
  EncryptionConfig,
} from './encryption.js';
