/**
 * Resource limits for sandboxed execution.
 */
export interface ResourceLimits {
  /** Maximum CPU time in milliseconds */
  cpuMs: number;
  /** Maximum memory allocation in bytes */
  memoryBytes: number;
  /** Maximum number of child processes */
  maxChildProcesses: number;
  /** Maximum file descriptors */
  maxFileDescriptors: number;
}

/**
 * Network access rule for sandboxed execution.
 */
export interface NetworkRule {
  /** Hostname or IP (supports wildcards like "*.example.com") */
  host: string;
  /** Port number (undefined means any port) */
  port?: number;
  /** Whether to allow or deny matching traffic */
  action: 'allow' | 'deny';
  /** Protocol filter */
  protocol?: 'tcp' | 'udp' | 'any';
}

/**
 * Filesystem access rule for sandboxed execution.
 */
export interface FilesystemRule {
  /** Path pattern (supports glob patterns) */
  path: string;
  /** Whether to allow or deny access */
  action: 'allow' | 'deny';
  /** Allowed operations */
  operations: Array<'read' | 'write' | 'execute' | 'delete'>;
}

/**
 * Execution mode for sandboxed code.
 */
export type ExecutionMode = 'isolated' | 'restricted' | 'none';

/**
 * Configuration for the sandbox manager.
 */
export interface SandboxConfig {
  /** Execution isolation mode */
  mode: ExecutionMode;
  /** Resource limits for sandboxed processes */
  limits: ResourceLimits;
  /** Network access rules */
  networkRules: NetworkRule[];
  /** Filesystem access rules */
  filesystemRules: FilesystemRule[];
  /** Maximum execution time in milliseconds */
  timeoutMs: number;
  /** Working directory for sandboxed processes */
  workDir?: string;
  /** Environment variables to expose (whitelist) */
  allowedEnvVars: string[];
  /** Whether to enable network access at all */
  networkEnabled: boolean;
  /** Whether to enable filesystem writes */
  filesystemWritesEnabled: boolean;
}

const DEFAULT_CONFIG: SandboxConfig = {
  mode: 'restricted',
  limits: {
    cpuMs: 10_000,
    memoryBytes: 512 * 1024 * 1024, // 512 MB
    maxChildProcesses: 0,
    maxFileDescriptors: 10,
  },
  networkRules: [],
  filesystemRules: [
    { path: '/tmp/*', action: 'allow', operations: ['read', 'write'] },
    { path: '/var/tmp/*', action: 'allow', operations: ['read', 'write'] },
  ],
  timeoutMs: 30_000,
  allowedEnvVars: ['PATH', 'HOME', 'TMPDIR', 'NODE_ENV'],
  networkEnabled: false,
  filesystemWritesEnabled: false,
};

/**
 * Result of a sandbox pre-execution check.
 */
export interface SandboxCheckResult {
  /** Whether execution is permitted */
  allowed: boolean;
  /** Reasons for denial or warnings */
  reasons: string[];
  /** Whether the sandbox is properly configured */
  configured: boolean;
}

/**
 * Manages execution isolation and resource governance for code sandboxing.
 *
 * Provides configuration-driven resource limits, network access control,
 * filesystem restrictions, and timeout enforcement.
 */
export class SandboxManager {
  private readonly config: SandboxConfig;
  private readonly activeExecutions: Map<string, AbortController> = new Map();

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as SandboxConfig;
  }

  /**
   * Returns the current sandbox configuration.
   */
  getConfig(): SandboxConfig {
    return { ...this.config };
  }

  /**
   * Updates the sandbox configuration.
   *
   * @param updates - Partial configuration to apply
   */
  updateConfig(updates: Partial<SandboxConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Performs a pre-execution sandbox check.
   * Validates that the execution request conforms to sandbox policies.
   *
   * @param executionParams - Parameters for the intended execution
   * @returns Check result with any violations
   */
  checkExecution(
    executionParams: {
      command?: string;
      memoryBytes?: number;
      expectedDurationMs?: number;
      needsNetwork?: boolean;
      needsFilesystemWrite?: boolean;
      requestedEnvVars?: string[];
    },
  ): SandboxCheckResult {
    const reasons: string[] = [];

    if (this.config.mode === 'none') {
      return {
        allowed: true,
        reasons: ['Sandbox is disabled'],
        configured: false,
      };
    }

    if (executionParams.memoryBytes && executionParams.memoryBytes > this.config.limits.memoryBytes) {
      reasons.push(
        `Requested memory (${executionParams.memoryBytes}) exceeds limit (${this.config.limits.memoryBytes})`,
      );
    }

    if (
      executionParams.expectedDurationMs &&
      executionParams.expectedDurationMs > this.config.timeoutMs
    ) {
      reasons.push(
        `Expected duration (${executionParams.expectedDurationMs}ms) exceeds timeout (${this.config.timeoutMs}ms)`,
      );
    }

    if (executionParams.needsNetwork && !this.config.networkEnabled) {
      reasons.push('Network access is disabled');
    }

    if (executionParams.needsFilesystemWrite && !this.config.filesystemWritesEnabled) {
      reasons.push('Filesystem writes are disabled');
    }

    if (executionParams.requestedEnvVars) {
      const disallowed = executionParams.requestedEnvVars.filter(
        (v) => !this.config.allowedEnvVars.includes(v),
      );
      if (disallowed.length > 0) {
        reasons.push(
          `Environment variables not allowed: ${disallowed.join(', ')}`,
        );
      }
    }

    if (this.config.limits.maxChildProcesses === 0 && executionParams.command) {
      reasons.push('Child processes are not allowed');
    }

    return {
      allowed: reasons.length === 0,
      reasons,
      configured: (this.config as SandboxConfig).mode !== 'none',
    };
  }

  /**
   * Checks whether network access to a given host:port is permitted.
   *
   * @param host - Target hostname or IP
   * @param port - Target port
   * @returns Whether the connection is allowed
   */
  checkNetworkAccess(host: string, port?: number): boolean {
    if (!this.config.networkEnabled) {
      return false;
    }

    for (const rule of this.config.networkRules) {
      if (this.matchesHost(rule.host, host)) {
        if (rule.port === undefined || rule.port === port) {
          return rule.action === 'allow';
        }
      }
    }

    // Default: deny if no rule matches
    return false;
  }

  /**
   * Checks whether a filesystem operation is permitted.
   *
   * @param path - The filesystem path
   * @param operation - The operation to perform
   * @returns Whether the operation is allowed
   */
  checkFilesystemAccess(
    path: string,
    operation: 'read' | 'write' | 'execute' | 'delete',
  ): boolean {
    if (
      (operation === 'write' || operation === 'delete') &&
      !this.config.filesystemWritesEnabled
    ) {
      return false;
    }

    for (const rule of this.config.filesystemRules) {
      if (this.matchesGlob(rule.path, path)) {
        if (rule.operations.includes(operation)) {
          return rule.action === 'allow';
        }
      }
    }

    // Default: deny
    return false;
  }

  /**
   * Registers an active execution for lifecycle tracking.
   *
   * @param executionId - Unique execution identifier
   * @returns An AbortController for canceling the execution
   */
  registerExecution(executionId: string): AbortController {
    const controller = new AbortController();
    this.activeExecutions.set(executionId, controller);

    // Auto-cleanup on timeout
    const timeout = setTimeout(() => {
      controller.abort();
      this.activeExecutions.delete(executionId);
    }, this.config.timeoutMs);

    // Clean up the timeout if execution completes
    const originalAbort = controller.abort.bind(controller);
    controller.abort = (reason?: string) => {
      clearTimeout(timeout);
      this.activeExecutions.delete(executionId);
      originalAbort(reason);
    };

    return controller;
  }

  /**
   * Cancels a running execution.
   *
   * @param executionId - The execution identifier to cancel
   */
  cancelExecution(executionId: string): void {
    const controller = this.activeExecutions.get(executionId);
    if (controller) {
      controller.abort('Cancelled by sandbox manager');
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Returns the count of currently active executions.
   */
  activeExecutionCount(): number {
    return this.activeExecutions.size;
  }

  private matchesHost(pattern: string, host: string): boolean {
    if (pattern === '*') {
      return true;
    }

    const regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');
    return new RegExp(`^${regexStr}$`, 'i').test(host);
  }

  private matchesGlob(pattern: string, target: string): boolean {
    const regexStr = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexStr}$`).test(target);
  }
}
