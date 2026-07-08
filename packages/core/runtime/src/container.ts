import type { AgentId, AgentMetadata } from "@agent-preflight/types";
import { AgentLifecycle, type LifecycleState } from "./agent.js";
import type { AgentContext, AgentProcess } from "./types.js";
import { ContainerError, ContainerFullError, AgentNotFoundError, AgentAlreadyExistsError } from "./errors.js";

export interface ContainerOptions {
  maxInstances: number;
  defaultAgentTimeout?: number;
  enableHotReload?: boolean;
  hotReloadInterval?: number;
}

export interface ContainerStats {
  totalInstances: number;
  runningInstances: number;
  pausedInstances: number;
  erroredInstances: number;
  stoppedInstances: number;
  availableSlots: number;
}

export class AgentContainer {
  private _instances: Map<string, AgentLifecycle> = new Map();
  private _options: Required<ContainerOptions>;
  private _hotReloadTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: ContainerOptions) {
    this._options = {
      maxInstances: options.maxInstances,
      defaultAgentTimeout: options.defaultAgentTimeout ?? 30_000,
      enableHotReload: options.enableHotReload ?? false,
      hotReloadInterval: options.hotReloadInterval ?? 30_000,
    };

    if (this._options.enableHotReload) {
      this._startHotReload();
    }
  }

  get stats(): ContainerStats {
    let running = 0, paused = 0, errored = 0, stopped = 0;
    for (const instance of this._instances.values()) {
      switch (instance.state) {
        case "RUNNING": case "STARTING": running++; break;
        case "PAUSED": case "PAUSING": paused++; break;
        case "ERROR": errored++; break;
        case "STOPPED": case "STOPPING": stopped++; break;
      }
    }
    return {
      totalInstances: this._instances.size,
      runningInstances: running,
      pausedInstances: paused,
      erroredInstances: errored,
      stoppedInstances: stopped,
      availableSlots: this._options.maxInstances - this._instances.size,
    };
  }

  async register(
    agentId: AgentId,
    context: AgentContext,
    metadata: AgentMetadata,
  ): Promise<AgentLifecycle> {
    if (this._instances.has(agentId)) {
      throw new AgentAlreadyExistsError(agentId);
    }
    if (this._instances.size >= this._options.maxInstances) {
      throw new ContainerFullError(this._options.maxInstances);
    }

    const instance = new AgentLifecycle(agentId, context, metadata, {
      agentTimeout: this._options.defaultAgentTimeout,
    });

    this._instances.set(agentId, instance);
    return instance;
  }

  async deregister(agentId: AgentId): Promise<void> {
    const instance = this._instances.get(agentId);
    if (!instance) throw new AgentNotFoundError(agentId);

    if (instance.state === "RUNNING" || instance.state === "PAUSED") {
      await instance.stop();
    }
    this._instances.delete(agentId);
  }

  get(agentId: AgentId): AgentLifecycle {
    const instance = this._instances.get(agentId);
    if (!instance) throw new AgentNotFoundError(agentId);
    return instance;
  }

  list(filter?: { state?: LifecycleState }): AgentLifecycle[] {
    const all = Array.from(this._instances.values());
    if (filter?.state) {
      return all.filter((i) => i.state === filter.state);
    }
    return all;
  }

  find(predicate: (instance: AgentLifecycle) => boolean): AgentLifecycle[] {
    return Array.from(this._instances.values()).filter(predicate);
  }

  getProcesses(): AgentProcess[] {
    return Array.from(this._instances.values()).map((i) => i.process);
  }

  async startAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const instance of this._instances.values()) {
      if (instance.state === "STOPPED") {
        promises.push(instance.start());
      }
    }
    await Promise.allSettled(promises);
  }

  async stopAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const instance of this._instances.values()) {
      if (instance.state === "RUNNING" || instance.state === "PAUSED") {
        promises.push(instance.stop());
      }
    }
    await Promise.allSettled(promises);
  }

  async pauseAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const instance of this._instances.values()) {
      if (instance.state === "RUNNING") {
        promises.push(instance.pause());
      }
    }
    await Promise.allSettled(promises);
  }

  async resumeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const instance of this._instances.values()) {
      if (instance.state === "PAUSED") {
        promises.push(instance.resume());
      }
    }
    await Promise.allSettled(promises);
  }

  async shutdown(): Promise<void> {
    if (this._hotReloadTimer) {
      clearInterval(this._hotReloadTimer);
      this._hotReloadTimer = null;
    }
    await this.stopAll();
    this._instances.clear();
  }

  private _startHotReload(): void {
    this._hotReloadTimer = setInterval(async () => {
      for (const instance of this._instances.values()) {
        if (instance.state === "ERROR") {
          try {
            await instance.restart();
          } catch (err) {
            const opts: { details?: unknown; cause?: Error } = { details: { agentId: instance.agentId } };
            if (err instanceof Error) opts.cause = err;
            throw new ContainerError("Hot reload failed", opts);
          }
        }
      }
    }, this._options.hotReloadInterval);
    this._hotReloadTimer.unref();
  }
}
