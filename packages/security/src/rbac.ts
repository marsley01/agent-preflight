import type {
  AccessDecision,
  PolicyEvaluationResult,
  SecurityLevel,
} from './types.js';

/**
 * A role definition containing permissions and inheritance configuration.
 */
export interface Role {
  /** Unique role identifier */
  readonly id: string;
  /** Human-readable role name */
  readonly name: string;
  /** Optional description of the role's purpose */
  description?: string;
  /** Permission strings in "resource:action" format (supports wildcards) */
  permissions: string[];
  /** Role IDs this role inherits permissions from */
  inheritedRoles: string[];
  /** Associated security level */
  securityLevel?: SecurityLevel;
}

/**
 * Built-in role identifiers available in the system.
 */
export const BUILT_IN_ROLES = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  DEVELOPER: 'developer',
  AGENT: 'agent',
  VIEWER: 'viewer',
} as const satisfies Record<string, string>;

/**
 * Default permission sets for built-in roles.
 */
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  [BUILT_IN_ROLES.ADMIN]: ['*:*'],
  [BUILT_IN_ROLES.OPERATOR]: [
    'agent:*',
    'task:*',
    'memory:*',
    'model:read',
    'plugin:*',
    'api:*',
    'config:read',
    'log:*',
  ],
  [BUILT_IN_ROLES.DEVELOPER]: [
    'agent:*',
    'task:*',
    'memory:*',
    'model:read',
    'plugin:read',
    'config:read',
    'log:read',
  ],
  [BUILT_IN_ROLES.AGENT]: [
    'task:read',
    'task:write',
    'memory:read',
    'memory:write',
    'model:read',
  ],
  [BUILT_IN_ROLES.VIEWER]: [
    'agent:read',
    'task:read',
    'memory:read',
    'model:read',
    'plugin:read',
    'config:read',
    'log:read',
  ],
};

const DEFAULT_INHERITANCE: Record<string, string[]> = {
  [BUILT_IN_ROLES.ADMIN]: [],
  [BUILT_IN_ROLES.OPERATOR]: [],
  [BUILT_IN_ROLES.DEVELOPER]: [BUILT_IN_ROLES.VIEWER],
  [BUILT_IN_ROLES.AGENT]: [],
  [BUILT_IN_ROLES.VIEWER]: [],
};

/**
 * Manages role definitions, user-role assignments, and permission checking.
 *
 * Supports hierarchical roles with inheritance, wildcard permission matching,
 * and built-in roles (admin, operator, developer, agent, viewer).
 */
export class RBACManager {
  private readonly roles: Map<string, Role> = new Map();
  private readonly assignments: Map<string, string[]> = new Map();

  constructor() {
    this.initializeBuiltInRoles();
  }

  private initializeBuiltInRoles(): void {
    for (const [, id] of Object.entries(BUILT_IN_ROLES)) {
      const role: Role = {
        id,
        name: id,
        permissions: [...(DEFAULT_PERMISSIONS[id] ?? [])],
        inheritedRoles: [...(DEFAULT_INHERITANCE[id] ?? [])],
      };
      this.roles.set(id, role);
    }
  }

  /**
   * Adds a new role definition.
   *
   * @param name - Human-readable role name
   * @param permissions - Permission strings in "resource:action" format
   * @param inheritedRoles - Optional role IDs to inherit permissions from
   * @param description - Optional description
   * @returns The newly created Role
   * @throws If a role with the same name already exists
   */
  addRole(
    name: string,
    permissions: string[],
    inheritedRoles?: string[],
    description?: string,
  ): Role {
    const id = name.toLowerCase().replace(/\s+/g, '_');

    if (this.roles.has(id)) {
      throw new Error(`Role "${id}" already exists`);
    }

    const role: Role = {
      id,
      name,
      permissions: [...permissions],
      inheritedRoles: [...(inheritedRoles ?? [])],
      ...(description !== undefined ? { description } : {}),
    };

    this.roles.set(id, role);
    return role;
  }

  /**
   * Removes a role definition. Cannot remove built-in roles.
   *
   * @param roleId - The role identifier
   * @throws If the role is a built-in role or does not exist
   */
  removeRole(roleId: string): void {
    if (this.isBuiltInRole(roleId)) {
      throw new Error(`Cannot remove built-in role "${roleId}"`);
    }

    if (!this.roles.has(roleId)) {
      throw new Error(`Role "${roleId}" does not exist`);
    }

    this.roles.delete(roleId);

    // Clean up assignments for this role
    for (const [userId, userRoles] of this.assignments) {
      const filtered = userRoles.filter((r) => r !== roleId);
      if (filtered.length === 0) {
        this.assignments.delete(userId);
      } else {
        this.assignments.set(userId, filtered);
      }
    }
  }

  /**
   * Assigns a role to a user.
   *
   * @param userId - The user identifier
   * @param roleId - The role identifier to assign
   * @throws If the role does not exist
   */
  assignRole(userId: string, roleId: string): void {
    if (!this.roles.has(roleId)) {
      throw new Error(`Role "${roleId}" does not exist`);
    }

    const currentRoles = this.assignments.get(userId) ?? [];

    if (!currentRoles.includes(roleId)) {
      currentRoles.push(roleId);
      this.assignments.set(userId, currentRoles);
    }
  }

  /**
   * Revokes a role from a user.
   *
   * @param userId - The user identifier
   * @param roleId - The role identifier to revoke
   */
  revokeRole(userId: string, roleId: string): void {
    const currentRoles = this.assignments.get(userId);
    if (!currentRoles) {
      return;
    }

    const filtered = currentRoles.filter((r) => r !== roleId);
    if (filtered.length === 0) {
      this.assignments.delete(userId);
    } else {
      this.assignments.set(userId, filtered);
    }
  }

  /**
   * Checks whether a user has a specific permission, returning a detailed result.
   *
   * @param userId - The user identifier
   * @param resource - The resource to check
   * @param action - The action to check
   * @returns A PolicyEvaluationResult with decision and reasoning
   */
  checkPermission(
    userId: string,
    resource: string,
    action: string,
  ): PolicyEvaluationResult {
    const userRoles = this.assignments.get(userId) ?? [];
    const reasoning: string[] = [];
    const matchedPolicies: string[] = [];
    const appliedRules: string[] = [];
    const targetPermission = `${resource}:${action}`;

    if (userRoles.length === 0) {
      reasoning.push(`User "${userId}" has no roles assigned`);
      return {
        decision: 'denied' satisfies AccessDecision,
        matchedPolicies: [],
        appliedRules: [],
        reasoning,
        timestamp: new Date(),
      };
    }

    const resolvedPermissions = this.resolvePermissions(userRoles);

    for (const perm of resolvedPermissions) {
      if (this.matchPermission(perm, targetPermission)) {
        matchedPolicies.push(`role:${perm}`);
        appliedRules.push(perm);

        if (this.isDenyPermission(perm)) {
          reasoning.push(
            `Deny rule "${perm}" explicitly denies "${targetPermission}"`,
          );
          return {
            decision: 'denied' satisfies AccessDecision,
            matchedPolicies,
            appliedRules,
            reasoning,
            timestamp: new Date(),
          };
        }

        reasoning.push(
          `Permission "${perm}" matches "${targetPermission}" — granted`,
        );
        return {
          decision: 'granted' satisfies AccessDecision,
          matchedPolicies,
          appliedRules,
          reasoning,
          timestamp: new Date(),
        };
      }
    }

    reasoning.push(
      `No permission matches "${targetPermission}" for user "${userId}"`,
    );
    return {
      decision: 'denied' satisfies AccessDecision,
      matchedPolicies,
      appliedRules,
      reasoning,
      timestamp: new Date(),
    };
  }

  /**
   * Simple boolean check whether a user has a specific permission.
   *
   * @param userId - The user identifier
   * @param resource - The resource to check
   * @param action - The action to check
   * @returns true if the user has the permission
   */
  hasPermission(userId: string, resource: string, action: string): boolean {
    const result = this.checkPermission(userId, resource, action);
    return result.decision === 'granted';
  }

  /**
   * Returns all role IDs assigned to a user.
   *
   * @param userId - The user identifier
   * @returns Array of role IDs
   */
  getUserRoles(userId: string): string[] {
    return [...(this.assignments.get(userId) ?? [])];
  }

  /**
   * Returns the role definition for a given role ID.
   */
  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  /**
   * Lists all registered role definitions.
   */
  listRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  private isBuiltInRole(roleId: string): boolean {
    const builtInSet = new Set<string>(Object.values(BUILT_IN_ROLES));
    return builtInSet.has(roleId);
  }

  private resolvePermissions(roleIds: string[]): Set<string> {
    const resolved = new Set<string>();
    const visited = new Set<string>();

    const traverse = (currentRoleId: string): void => {
      if (visited.has(currentRoleId)) {
        return;
      }
      visited.add(currentRoleId);

      const role = this.roles.get(currentRoleId);
      if (!role) {
        return;
      }

      for (const perm of role.permissions) {
        resolved.add(perm);
      }

      for (const inheritedId of role.inheritedRoles) {
        traverse(inheritedId);
      }
    };

    for (const roleId of roleIds) {
      traverse(roleId);
    }

    return resolved;
  }

  private matchPermission(pattern: string, target: string): boolean {
    if (pattern === '*:*') {
      return true;
    }

    const parts = target.split(':');
    const patternParts = pattern.split(':');

    if (patternParts.length !== 2 || parts.length !== 2) {
      return false;
    }

    const patternResource = patternParts[0]!;
    const patternAction = patternParts[1]!;
    const targetResource = parts[0]!;
    const targetAction = parts[1]!;

    return (
      this.matchSegment(patternResource, targetResource) &&
      this.matchSegment(patternAction, targetAction)
    );
  }

  private matchSegment(pattern: string, target: string): boolean {
    if (pattern === '*') {
      return true;
    }

    const regexStr = '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
    return new RegExp(regexStr).test(target);
  }

  private isDenyPermission(permission: string): boolean {
    return permission.startsWith('!');
  }
}
