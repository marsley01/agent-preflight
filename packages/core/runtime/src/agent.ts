import { v4 as uuidv4 } from "uuid";
import type {
  AgentId, Timestamp, Duration, AgentMetadata, HealthStatus,
} from "@agent-preflight/types";
import type { AgentContext, AgentProcess, ResourceUsage } from "./types.js";
import { AgentLifecycleError } from "./errors.js";

export type LifecycleState = "STOPPED" | "STARTING" | "RUNNING" | "PAUSING" | "PAUSED" | "STOPPING" | "ERROR";

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  STOPPED:  ["STARTING"],
  STARTING: ["RUNNING", "ERROR"],
  RUNNING:  ["PAUSING", "STOPPING", "ERROR"],
  PAUSING:  ["PAUSED", "ERROR"],
  PAUSED:   ["STARTING", "STOPPING"],
  STOPPING: ["STOPPED", "ERROR"],
  ERROR:    ["STOPPING", "STARTING"],
};

export interface AgentLifecycleOptions {
  agentTimeout?: Duration;
  gracefulShutdownTimeout?: Duration;
  healthCheckInterval?: Duration;
}

function withCause(details: Record<string, unknown>, err: unknown): { details?: unknown; cause?: Error } {
  const result: { details?: unknown; cause?: Error } = { details };
  if (err instanceof Error) result.cause = err;
  return result;
}

export class AgentLifecycle {
  public readonly id: string;
  public readonly agentId: AgentId;
  public readonly process: AgentProcess;

  private _context: AgentContext;
  private _options: Required<AgentLifecycleOptions>;
  private _state: LifecycleState = "STOPPED";
  private _startTime: Timestamp = "";
  private _healthStatus: HealthStatus | null = null;
  private _healthInterval: ReturnType<typeof setInterval> | null = null;
  private _resourceUsage: ResourceUsage = {
    cpu: 0, memory: 0,
    network: { bytesIn: 0, bytesOut: 0 },
    tokens: { input: 0, output: 0 },
  };

  get context(): AgentContext {
    return this._context;
  }

  constructor(
    agentId: AgentId,
    context: AgentContext,
    metadata: AgentMetadata,
    options: AgentLifecycleOptions = {},
  ) {
    this.id = uuidv4();
    this.agentId = agentId;
    this._context = context;
    this._options = {
      agentTimeout: options.agentTimeout ?? 30_000,
      gracefulShutdownTimeout: options.gracefulShutdownTimeout ?? 10_000,
      healthCheckInterval: options.healthCheckInterval ?? 15_000,
    };
    this.process = {
      id: this.id,
      agentId,
      status: "IDLE",
      pid: null,
      startTime: new Date().toISOString(),
      metadata,
      resources: this._resourceUsage,
    };
  }

  get state(): LifecycleState {
    return this._state;
  }

  get healthStatus(): HealthStatus | null {
    return this._healthStatus;
  }

  get uptime(): Duration {
    if (this._state === "STOPPED" || this._state === "ERROR") return 0;
    return Date.now() - new Date(this._startTime).getTime();
  }

  private transition(target: LifecycleState): void {
    const allowed = VALID_TRANSITIONS[this._state];
    if (!allowed.includes(target)) {
      throw new AgentLifecycleError(
        `Invalid state transition: ${this._state} -> ${target}`,
      );
    }
    this._state = target;
  }

  async start(): Promise<void> {
    this.transition("STARTING");
    this._startTime = new Date().toISOString();
    this.process.pid = process.pid;
    this.process.startTime = this._startTime;

    try {
      this._context.logger.info(`Agent ${this.agentId} starting`);
      this.process.status = "IDLE";
      this._startHealthMonitoring();
      this.transition("RUNNING");
    } catch (err) {
      this._state = "ERROR";
      this.process.status = "ERROR";
      throw new AgentLifecycleError("Failed to start agent", withCause({ agentId: this.agentId }, err));
    }
  }

  async stop(): Promise<void> {
    this.transition("STOPPING");
    this._context.logger.info(`Agent ${this.agentId} stopping`);

    try {
      await this._gracefulShutdown();
      this._stopHealthMonitoring();
      this.process.status = "TERMINATED";
      this.process.pid = null;
      this._cleanupResources();
      this.transition("STOPPED");
    } catch (err) {
      this._state = "ERROR";
      throw new AgentLifecycleError("Failed to stop agent", withCause({ agentId: this.agentId }, err));
    }
  }

  async pause(): Promise<void> {
    this.transition("PAUSING");
    this._context.logger.info(`Agent ${this.agentId} pausing`);

    try {
      this._stopHealthMonitoring();
      this.process.status = "PAUSED";
      this.transition("PAUSED");
    } catch (err) {
      this._state = "ERROR";
      throw new AgentLifecycleError("Failed to pause agent", withCause({ agentId: this.agentId }, err));
    }
  }

  async resume(): Promise<void> {
    this.transition("STARTING");
    this._context.logger.info(`Agent ${this.agentId} resuming`);

    try {
      this.process.status = "IDLE";
      this._startHealthMonitoring();
      this.transition("RUNNING");
    } catch (err) {
      this._state = "ERROR";
      throw new AgentLifecycleError("Failed to resume agent", withCause({ agentId: this.agentId }, err));
    }
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  updateResourceUsage(usage: Partial<ResourceUsage>): void {
    if (usage.cpu !== undefined) this._resourceUsage.cpu = usage.cpu;
    if (usage.memory !== undefined) this._resourceUsage.memory = usage.memory;
    if (usage.network) {
      this._resourceUsage.network.bytesIn += usage.network.bytesIn ?? 0;
      this._resourceUsage.network.bytesOut += usage.network.bytesOut ?? 0;
    }
    if (usage.tokens) {
      this._resourceUsage.tokens.input += usage.tokens.input ?? 0;
      this._resourceUsage.tokens.output += usage.tokens.output ?? 0;
    }
  }

  async performHealthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const healthy: HealthStatus = {
        component: `agent:${this.agentId}`,
        status: "HEALTHY",
        lastChecked: new Date().toISOString(),
        latency: Date.now() - start,
      };
      this._healthStatus = healthy;
      return healthy;
    } catch {
      const unhealthy: HealthStatus = {
        component: `agent:${this.agentId}`,
        status: "UNHEALTHY",
        message: "Health check failed",
        lastChecked: new Date().toISOString(),
        latency: Date.now() - start,
      };
      this._healthStatus = unhealthy;
      return unhealthy;
    }
  }

  private _startHealthMonitoring(): void {
    if (this._healthInterval) return;
    this._healthInterval = setInterval(
      () => { void this.performHealthCheck(); },
      this._options.healthCheckInterval,
    );
    this._healthInterval.unref();
  }

  private _stopHealthMonitoring(): void {
    if (this._healthInterval) {
      clearInterval(this._healthInterval);
      this._healthInterval = null;
    }
  }

  private async _gracefulShutdown(): Promise<void> {
    const timeout = this._options.gracefulShutdownTimeout;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._context.logger.warn(`Agent ${this.agentId} graceful shutdown timed out`);
        resolve();
      }, timeout);

      try {
        this._context.logger.info(`Agent ${this.agentId} shutdown complete`);
        clearTimeout(timer);
        resolve();
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });
  }

  private _cleanupResources(): void {
    this._resourceUsage = {
      cpu: 0, memory: 0,
      network: { bytesIn: 0, bytesOut: 0 },
      tokens: { input: 0, output: 0 },
    };
    this._healthStatus = null;
  }
}
