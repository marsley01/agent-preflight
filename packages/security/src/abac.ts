import { v4 as uuidv4 } from 'uuid';

import type { AccessDecision, PermissionEffect } from './types.js';

/**
 * Supported operators for attribute conditions.
 */
export type AttributeOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'matches'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'before'
  | 'after'
  | 'in'
  | 'notIn'
  | 'exists'
  | 'notExists';

/**
 * A condition that matches a single attribute.
 */
export interface AttributeCondition {
  /** The attribute path (e.g., "subject.role", "resource.owner") */
  field: string;
  /** The comparison operator */
  operator: AttributeOperator;
  /** The value to compare against */
  value: unknown;
}

/**
 * An ABAC policy that grants or denies access based on attribute conditions.
 */
export interface ABACPolicy {
  /** Unique policy identifier */
  id: string;
  /** Human-readable policy name */
  name: string;
  /** Optional description of the policy */
  description?: string;
  /** Whether this policy allows or denies */
  effect: PermissionEffect;
  /** Conditions organized by target category */
  conditions: {
    /** Conditions on the subject making the request */
    subject?: AttributeCondition[];
    /** Conditions on the resource being accessed */
    resource?: AttributeCondition[];
    /** Actions this policy applies to (e.g., ["read", "write"]) */
    action?: string[];
    /** Context conditions (time, location, device, etc.) */
    context?: AttributeCondition[];
  };
  /** Priority for evaluation (higher = evaluated first) */
  priority: number;
  /** Whether this policy is currently active */
  enabled: boolean;
}

/**
 * Attributes describing the subject, resource, action, and context for evaluation.
 */
export interface EvaluationContext {
  subject: Record<string, unknown>;
  resource: Record<string, unknown>;
  action: string;
  context: Record<string, unknown>;
}

/**
 * Attributes-based access control engine.
 *
 * Evaluates access requests against attribute-based policies using a
 * DENY-overrides combination strategy. Supports string, numeric, boolean,
 * and date-based conditions.
 */
export class ABACEngine {
  private readonly policies: Map<string, ABACPolicy> = new Map();

  /**
   * Defines a new ABAC policy.
   *
   * @param policy - The policy definition (id is optional; auto-generated if omitted)
   * @returns The registered policy with its assigned id
   */
  definePolicy(
    policy: Omit<ABACPolicy, 'id'> & { id?: string },
  ): ABACPolicy {
    const id = policy.id ?? uuidv4();

    if (this.policies.has(id)) {
      throw new Error(`ABAC policy "${id}" already exists`);
    }

    const registered: ABACPolicy = {
      ...policy,
      id,
      conditions: {
        subject: policy.conditions.subject ?? [],
        resource: policy.conditions.resource ?? [],
        action: policy.conditions.action ?? [],
        context: policy.conditions.context ?? [],
      },
    };

    this.policies.set(id, registered);
    return registered;
  }

  /**
   * Removes a policy by its identifier.
   *
   * @param policyId - The policy identifier
   */
  removePolicy(policyId: string): void {
    this.policies.delete(policyId);
  }

  /**
   * Evaluates a request against all enabled policies.
   *
   * Uses a DENY-overrides strategy: if any matching policy denies, the result
   * is denied. If no policy matches, access is denied by default.
   *
   * @param ctx - The evaluation context with subject, resource, action, and context attributes
   * @returns The access decision
   */
  evaluate(ctx: EvaluationContext): {
    decision: AccessDecision;
    matchedPolicies: string[];
    reasoning: string[];
  } {
    const sortedPolicies = Array.from(this.policies.values())
      .filter((p) => p.enabled)
      .sort((a, b) => b.priority - a.priority);

    const matchedPolicies: string[] = [];
    const reasoning: string[] = [];

    for (const policy of sortedPolicies) {
      if (!this.matchesAction(policy, ctx.action)) {
        continue;
      }

      const subjectMatch = this.evaluateConditions(
        policy.conditions.subject ?? [],
        ctx.subject,
      );
      const resourceMatch = this.evaluateConditions(
        policy.conditions.resource ?? [],
        ctx.resource,
      );
      const contextMatch = this.evaluateConditions(
        policy.conditions.context ?? [],
        ctx.context,
      );

      if (!subjectMatch.match || !resourceMatch.match || !contextMatch.match) {
        continue;
      }

      matchedPolicies.push(policy.id);

      const details = [
        ...subjectMatch.reasoning,
        ...resourceMatch.reasoning,
        ...contextMatch.reasoning,
      ];
      const detailStr = details.join(', ');

      if (policy.effect === 'DENY') {
        reasoning.push(
          `Policy "${policy.name}" (${policy.id}) denies access: ${detailStr}`,
        );
        return {
          decision: 'denied' satisfies AccessDecision,
          matchedPolicies,
          reasoning,
        };
      }

      reasoning.push(
        `Policy "${policy.name}" (${policy.id}) allows access: ${detailStr}`,
      );
    }

    if (matchedPolicies.length > 0) {
      return {
        decision: 'granted' satisfies AccessDecision,
        matchedPolicies,
        reasoning,
      };
    }

    reasoning.push('No policies matched the request');
    return {
      decision: 'denied' satisfies AccessDecision,
      matchedPolicies: [],
      reasoning,
    };
  }

  /**
   * Lists all registered policies.
   */
  listPolicies(): ABACPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Retrieves a policy by identifier.
   */
  getPolicy(policyId: string): ABACPolicy | undefined {
    return this.policies.get(policyId);
  }

  private matchesAction(policy: ABACPolicy, action: string): boolean {
    const actions = policy.conditions.action;
    if (!actions || actions.length === 0) {
      return true;
    }
    return actions.includes('*') || actions.includes(action);
  }

  private evaluateConditions(
    conditions: AttributeCondition[],
    attributes: Record<string, unknown>,
  ): { match: boolean; reasoning: string[] } {
    const reasoning: string[] = [];

    if (conditions.length === 0) {
      return { match: true, reasoning: [] };
    }

    for (const condition of conditions) {
      const attributeValue = this.resolveAttribute(condition.field, attributes);
      const result = this.evaluateCondition(condition, attributeValue);
      reasoning.push(result.reasoning);

      if (!result.match) {
        return { match: false, reasoning };
      }
    }

    return { match: true, reasoning };
  }

  private resolveAttribute(
    field: string,
    attributes: Record<string, unknown>,
  ): unknown {
    const parts = field.split('.');
    let current: unknown = attributes;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== 'object'
      ) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private evaluateCondition(
    condition: AttributeCondition,
    actualValue: unknown,
  ): { match: boolean; reasoning: string } {
    const { field, operator, value } = condition;

    switch (operator) {
      case 'exists':
        return {
          match: actualValue !== undefined && actualValue !== null,
          reasoning: actualValue !== undefined && actualValue !== null
            ? `"${field}" exists`
            : `"${field}" does not exist`,
        };
      case 'notExists':
        return {
          match: actualValue === undefined || actualValue === null,
          reasoning: actualValue === undefined || actualValue === null
            ? `"${field}" does not exist`
            : `"${field}" exists`,
        };
      case 'equals':
        return {
          match: actualValue === value,
          reasoning: `"${field}" ${actualValue === value ? 'equals' : 'does not equal'} expected value`,
        };
      case 'notEquals':
        return {
          match: actualValue !== value,
          reasoning: `"${field}" ${actualValue !== value ? 'does not equal' : 'equals'} excluded value`,
        };
      case 'contains': {
        if (typeof actualValue === 'string' && typeof value === 'string') {
          const matches = actualValue.includes(value);
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" contains "${value}"`
              : `"${field}" does not contain "${value}"`,
          };
        }
        return { match: false, reasoning: `"${field}" contains check failed (type mismatch)` };
      }
      case 'startsWith': {
        if (typeof actualValue === 'string' && typeof value === 'string') {
          const matches = actualValue.startsWith(value);
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" starts with "${value}"`
              : `"${field}" does not start with "${value}"`,
          };
        }
        return { match: false, reasoning: `"${field}" startsWith check failed (type mismatch)` };
      }
      case 'endsWith': {
        if (typeof actualValue === 'string' && typeof value === 'string') {
          const matches = actualValue.endsWith(value);
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" ends with "${value}"`
              : `"${field}" does not end with "${value}"`,
          };
        }
        return { match: false, reasoning: `"${field}" endsWith check failed (type mismatch)` };
      }
      case 'matches': {
        if (typeof actualValue === 'string' && typeof value === 'string') {
          try {
            const matches = new RegExp(value).test(actualValue);
            return {
              match: matches,
              reasoning: matches
                ? `"${field}" matches pattern "${value}"`
                : `"${field}" does not match pattern "${value}"`,
            };
          } catch {
            return { match: false, reasoning: `"${field}" regex pattern "${value}" is invalid` };
          }
        }
        return { match: false, reasoning: `"${field}" regex check failed (type mismatch)` };
      }
      case 'greaterThan': {
        const numActual = Number(actualValue);
        const numValue = Number(value);
        if (!isNaN(numActual) && !isNaN(numValue)) {
          const matches = numActual > numValue;
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" (${numActual}) is greater than ${numValue}`
              : `"${field}" (${numActual}) is not greater than ${numValue}`,
          };
        }
        return { match: false, reasoning: `"${field}" numeric comparison failed` };
      }
      case 'lessThan': {
        const numActual = Number(actualValue);
        const numValue = Number(value);
        if (!isNaN(numActual) && !isNaN(numValue)) {
          const matches = numActual < numValue;
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" (${numActual}) is less than ${numValue}`
              : `"${field}" (${numActual}) is not less than ${numValue}`,
          };
        }
        return { match: false, reasoning: `"${field}" numeric comparison failed` };
      }
      case 'greaterThanOrEqual': {
        const numActual = Number(actualValue);
        const numValue = Number(value);
        if (!isNaN(numActual) && !isNaN(numValue)) {
          const matches = numActual >= numValue;
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" (${numActual}) is >= ${numValue}`
              : `"${field}" (${numActual}) is not >= ${numValue}`,
          };
        }
        return { match: false, reasoning: `"${field}" numeric comparison failed` };
      }
      case 'lessThanOrEqual': {
        const numActual = Number(actualValue);
        const numValue = Number(value);
        if (!isNaN(numActual) && !isNaN(numValue)) {
          const matches = numActual <= numValue;
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" (${numActual}) is <= ${numValue}`
              : `"${field}" (${numActual}) is not <= ${numValue}`,
          };
        }
        return { match: false, reasoning: `"${field}" numeric comparison failed` };
      }
      case 'in': {
        if (Array.isArray(value)) {
          const matches = value.includes(actualValue);
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" is in allowed set`
              : `"${field}" is not in allowed set`,
          };
        }
        return { match: false, reasoning: `"${field}" in check failed (value is not an array)` };
      }
      case 'notIn': {
        if (Array.isArray(value)) {
          const matches = !value.includes(actualValue);
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" is not in excluded set`
              : `"${field}" is in excluded set`,
          };
        }
        return { match: false, reasoning: `"${field}" notIn check failed (value is not an array)` };
      }
      case 'before': {
        const actualDate = new Date(actualValue as string | number | Date);
        const compareDate = new Date(value as string | number | Date);
        if (!isNaN(actualDate.getTime()) && !isNaN(compareDate.getTime())) {
          const matches = actualDate < compareDate;
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" (${actualDate.toISOString()}) is before ${compareDate.toISOString()}`
              : `"${field}" (${actualDate.toISOString()}) is not before ${compareDate.toISOString()}`,
          };
        }
        return { match: false, reasoning: `"${field}" date comparison failed` };
      }
      case 'after': {
        const actualDate = new Date(actualValue as string | number | Date);
        const compareDate = new Date(value as string | number | Date);
        if (!isNaN(actualDate.getTime()) && !isNaN(compareDate.getTime())) {
          const matches = actualDate > compareDate;
          return {
            match: matches,
            reasoning: matches
              ? `"${field}" (${actualDate.toISOString()}) is after ${compareDate.toISOString()}`
              : `"${field}" (${actualDate.toISOString()}) is not after ${compareDate.toISOString()}`,
          };
        }
        return { match: false, reasoning: `"${field}" date comparison failed` };
      }
      default: {
        const _exhaustive: never = operator;
        return { match: false, reasoning: `Unknown operator "${_exhaustive}"` };
      }
    }
  }
}
