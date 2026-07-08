import { v4 as uuidv4 } from 'uuid';

import type { ABACPolicy } from './abac.js';
import { ABACEngine } from './abac.js';
import type { RBACManager } from './rbac.js';
import type {
  AccessDecision,
  PolicyEvaluationResult,
  ValidationResult,
} from './types.js';

/**
 * The type of policy document.
 */
export type PolicyDocumentType = 'rbac' | 'abac';

/**
 * A versioned policy document for management and storage.
 */
export interface PolicyDocument {
  /** Unique document identifier */
  id: string;
  /** Semantic version string */
  version: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** The type of policy */
  type: PolicyDocumentType;
  /** The policy data (ABAC or RBAC definition) */
  policy: Record<string, unknown>;
  /** Whether this policy is active */
  enabled: boolean;
  /** Tags for categorization */
  tags: string[];
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last modification */
  updatedAt: string;
  /** Identifier of the user who created this document */
  createdBy?: string;
}

/**
 * Parameters for policy evaluation.
 */
export interface PolicyEvaluationParams {
  /** User or agent identifier */
  principalId: string;
  /** Resource identifier */
  resource: string;
  /** Action being performed */
  action: string;
  /** Additional context attributes */
  context?: Record<string, unknown>;
  /** Subject attributes for ABAC evaluation */
  subjectAttributes?: Record<string, unknown>;
  /** Resource attributes for ABAC evaluation */
  resourceAttributes?: Record<string, unknown>;
}

/**
 * An entry in the evaluation audit trail.
 */
export interface AuditTrailEntry {
  /** Unique entry identifier */
  id: string;
  /** ISO timestamp of the evaluation */
  timestamp: string;
  /** The principal that requested access */
  principalId: string;
  /** Target resource */
  resource: string;
  /** Requested action */
  action: string;
  /** The access decision */
  decision: AccessDecision;
  /** Policies that were checked */
  policiesChecked: string[];
  /** Reasoning for the decision */
  reasoning: string[];
  /** Whether this was a dry-run evaluation */
  dryRun: boolean;
}

/**
 * Combined policy engine that integrates RBAC and ABAC.
 *
 * Provides policy lifecycle management (CRUD, validation), policy evaluation
 * with audit trail capture, and dry-run mode for testing.
 */
export class PolicyEngine {
  private readonly documents: Map<string, PolicyDocument> = new Map();
  private readonly auditTrail: AuditTrailEntry[] = [];
  private dryRunMode = false;

  /**
   * @param rbac - The RBAC manager instance
   * @param abac - The ABAC engine instance
   */
  constructor(
    private readonly rbac: RBACManager,
    private readonly abac: ABACEngine,
  ) {}

  /**
   * Enables or disables dry-run mode. In dry-run mode, evaluations are
   * performed but no policies are enforced — the result is purely informational.
   */
  setDryRun(enabled: boolean): void {
    this.dryRunMode = enabled;
  }

  /**
   * Returns whether dry-run mode is currently active.
   */
  isDryRun(): boolean {
    return this.dryRunMode;
  }

  /**
   * Creates a new policy document.
   *
   * @param doc - The policy document (id is auto-generated if omitted)
   * @returns The stored policy document
   */
  createPolicy(
    doc: Omit<PolicyDocument, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    },
  ): PolicyDocument {
    const now = new Date().toISOString();
    const document: PolicyDocument = {
      ...doc,
      id: doc.id ?? uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    const validation = this.validatePolicy(document);
    if (!validation.valid) {
      throw new Error(
        `Policy validation failed: ${validation.errors.join('; ')}`,
      );
    }

    this.documents.set(document.id, document);

    if (document.type === 'abac') {
      const abacPolicy = document.policy as unknown as Omit<ABACPolicy, 'id'> & {
        id?: string;
      };
      this.abac.definePolicy({ ...abacPolicy, id: document.id });
    }

    return document;
  }

  /**
   * Updates an existing policy document.
   *
   * @param id - The document identifier
   * @param updates - The fields to update
   * @returns The updated policy document
   * @throws If the document does not exist or validation fails
   */
  updatePolicy(
    id: string,
    updates: Partial<Omit<PolicyDocument, 'id' | 'createdAt' | 'updatedAt'>>,
  ): PolicyDocument {
    const existing = this.documents.get(id);
    if (!existing) {
      throw new Error(`Policy document "${id}" not found`);
    }

    const updated: PolicyDocument = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const validation = this.validatePolicy(updated);
    if (!validation.valid) {
      throw new Error(
        `Policy validation failed: ${validation.errors.join('; ')}`,
      );
    }

    this.documents.set(id, updated);
    return updated;
  }

  /**
   * Deletes a policy document.
   *
   * @param id - The document identifier
   */
  deletePolicy(id: string): void {
    this.documents.delete(id);
  }

  /**
   * Lists all policy documents.
   */
  listPolicies(): PolicyDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Retrieves a policy document by identifier.
   *
   * @param id - The document identifier
   */
  getPolicy(id: string): PolicyDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Validates a policy document structure and content.
   *
   * @param doc - The policy document to validate
   * @returns Validation result with errors and warnings
   */
  validatePolicy(doc: PolicyDocument): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!doc.name || doc.name.trim().length === 0) {
      errors.push('Policy name is required');
    }

    if (!doc.version) {
      errors.push('Policy version is required');
    } else if (!/^\d+\.\d+\.\d+$/.test(doc.version)) {
      warnings.push('Version should follow semver format (x.y.z)');
    }

    if (!doc.type || !['rbac', 'abac'].includes(doc.type)) {
      errors.push('Policy type must be "rbac" or "abac"');
    }

    if (!doc.policy || typeof doc.policy !== 'object') {
      errors.push('Policy data must be a non-null object');
    } else if (Object.keys(doc.policy).length === 0) {
      warnings.push('Policy data is empty');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Evaluates a request against both RBAC and ABAC policies.
   *
   * RBAC is checked first (role-based), then ABAC is checked if RBAC allows.
   * In dry-run mode, the full evaluation is performed but the result is tagged.
   *
   * @param params - The evaluation parameters
   * @returns Policy evaluation result with audit trail
   */
  evaluate(params: PolicyEvaluationParams): PolicyEvaluationResult & {
    auditEntry: AuditTrailEntry;
  } {
    const { principalId, resource, action, context, subjectAttributes, resourceAttributes } =
      params;

    const rbacResult = this.rbac.checkPermission(principalId, resource, action);
    const reasoning: string[] = [...rbacResult.reasoning];
    const appliedRules: string[] = [...rbacResult.appliedRules];
    const matchedPolicies: string[] = [...rbacResult.matchedPolicies];

    let decision: AccessDecision = rbacResult.decision;

    if (decision === 'granted') {
      const abacDecision = this.abac.evaluate({
        subject: subjectAttributes ?? {},
        resource: resourceAttributes ?? {},
        action,
        context: context ?? {},
      });

      for (const reason of abacDecision.reasoning) {
        reasoning.push(reason);
      }
      for (const policyId of abacDecision.matchedPolicies) {
        matchedPolicies.push(policyId);
      }

      if (abacDecision.decision === 'denied') {
        decision = 'denied';
        reasoning.push('ABAC policy denied the request');
      }
    }

    const auditEntry: AuditTrailEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      principalId,
      resource,
      action,
      decision,
      policiesChecked: matchedPolicies,
      reasoning,
      dryRun: this.dryRunMode,
    };

    this.auditTrail.push(auditEntry);

    const result: PolicyEvaluationResult = {
      decision,
      matchedPolicies,
      appliedRules,
      reasoning,
      timestamp: new Date(),
    };

    return { ...result, auditEntry };
  }

  /**
   * Retrieves the audit trail with optional filtering.
   *
   * @param filter - Optional filter criteria
   * @returns Filtered audit trail entries
   */
  getAuditTrail(
    filter?: {
      principalId?: string;
      resource?: string;
      decision?: AccessDecision;
      since?: string;
      until?: string;
    },
  ): AuditTrailEntry[] {
    let entries = [...this.auditTrail];

    if (filter) {
      if (filter.principalId) {
        entries = entries.filter((e) => e.principalId === filter.principalId);
      }
      if (filter.resource) {
        entries = entries.filter((e) => e.resource === filter.resource);
      }
      if (filter.decision) {
        entries = entries.filter((e) => e.decision === filter.decision);
      }
      if (filter.since) {
        entries = entries.filter((e) => e.timestamp >= filter.since!);
      }
      if (filter.until) {
        entries = entries.filter((e) => e.timestamp <= filter.until!);
      }
    }

    return entries;
  }

  /**
   * Clears the in-memory audit trail.
   */
  clearAuditTrail(): void {
    this.auditTrail.length = 0;
  }
}
