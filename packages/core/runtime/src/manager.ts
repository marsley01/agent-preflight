import type {
  AgentId, AgentMetadata, Task, TaskResult, HealthCheck, HealthStatus, Timestamp,
} from "@agent-preflight/types";
import type { RuntimeConfig, RuntimeStats } from "./types.js";
import { AgentContainer, type ContainerOptions } from "./container.js";
import { TaskExecutor, type ExecutorOptions } from "./executor.js";
import { ManagerError, ManagerNotInitializedError } from "./errors.js";

export interface RuntimeManagerOptions {
  container?: Partial<ContainerOptions>;
  executor?: Partial<ExecutorOptions>;
}

interface QueuedTask {
  task: Task;
  resolve: (result: TaskResult) => void;
  reject: (error: Error) => void;
  queuedAt: Timestamp;
}

export class RuntimeManager {
  private _config: RuntimeConfig | null = null;
  private _container: AgentContainer | null = null;
  private _executor: TaskExecutor | null = null;
  private _initialized = false;
  private _startTime: Timestamp | null = null;
  private _taskQueue: QueuedTask[] = [];
  private _activeTasks = 0;
  private _completedTasks = 0;
  private _failedTasks = 0;
  private _totalLatency = 0;
  private _healthInterval: ReturnType<typeof setInterval> | null = null;

  get initialized(): boolean {
    return this._initialized;
  }

  get config(): RuntimeConfig {
    if (!this._config) throw new ManagerNotInitializedError();
    return this._config;
  }

  async initialize(config: RuntimeConfig, options?: RuntimeManagerOptions): Promise<void> {
    if (this._initialized) {
      throw new ManagerError("RuntimeManager is already initialized");
    }

    this._config = { ...config };
    this._container = new AgentContainer({
      maxInstances: config.maxConcurrency,
      defaultAgentTimeout: config.agentTimeout,
      ...options?.container,
    });
    this._executor = new TaskExecutor(options?.executor);
    this._initialized = true;
    this._startTime = new Date().toISOString();

    this._startHealthChecks();
  }

  async shutdown(): Promise<void> {
    if (!this._initialized) return;

    if (this._healthInterval) {
      clearInterval(this._healthInterval);
      this._healthInterval = null;
    }

    if (this._container) {
      await this._container.shutdown();
    }

    this._taskQueue = [];
    this._initialized = false;
    this._startTime = null;
  }

  async registerAgent(
    agentId: AgentId,
    metadata: AgentMetadata,
    context: Parameters<AgentContainer["register"]>[1],
  ): Promise<void> {
    this._ensureInitialized();
    if (!this._container) throw new ManagerNotInitializedError();
    await this._container.register(agentId, context, metadata);
  }

  async deregisterAgent(agentId: AgentId): Promise<void> {
    this._ensureInitialized();
    if (!this._container) throw new ManagerNotInitializedError();
    await this._container.deregister(agentId);
  }

  getAgent(agentId: AgentId) {
    this._ensureInitialized();
    if (!this._container) throw new ManagerNotInitializedError();
    return this._container.get(agentId);
  }

  listAgents() {
    this._ensureInitialized();
    if (!this._container) throw new ManagerNotInitializedError();
    return this._container.list();
  }

  async submitTask(task: Task): Promise<TaskResult> {
    this._ensureInitialized();
    if (!this._executor || !this._container) throw new ManagerNotInitializedError();

    const agent = this._findAgentForTask(task);
    if (!agent) {
      return this._enqueueTask(task);
    }

    this._activeTasks++;
    try {
      const context = agent.context;
      const result = await this._executor.execute(task, context, async (t) => {
        return { text: `Executed task ${t.id}`, metrics: {} };
      });

      if (result.status === "COMPLETED") {
        this._completedTasks++;
        this._totalLatency += result.duration;
      } else {
        this._failedTasks++;
      }

      return result;
    } catch (err) {
      this._failedTasks++;
      return {
        taskId: task.id,
        status: "FAILED",
        error: { code: "EXECUTION_ERROR", message: err instanceof Error ? err.message : String(err) },
        duration: 0,
      };
    } finally {
      this._activeTasks--;
      this._processQueue();
    }
  }

  getStats(): RuntimeStats {
    const uptime = this._startTime
      ? Date.now() - new Date(this._startTime).getTime()
      : 0;
    const completed = this._completedTasks || 1;
    return {
      activeAgents: this._container?.stats.runningInstances ?? 0,
      completedTasks: this._completedTasks,
      failedTasks: this._failedTasks,
      avgLatency: this._totalLatency / completed,
      uptime,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  async healthCheck(): Promise<HealthCheck> {
    this._ensureInitialized();
    const start = Date.now();
    const checks: HealthStatus[] = [];

    checks.push({
      component: "runtime.manager",
      status: "HEALTHY",
      lastChecked: new Date().toISOString(),
      latency: 0,
    });

    if (this._container) {
      const containerHealth: HealthStatus = {
        component: "runtime.container",
        status: "HEALTHY",
        lastChecked: new Date().toISOString(),
        latency: 0,
        details: { ...this._container.stats },
      };
      checks.push(containerHealth);
    }

    const overall = checks.every((c) => c.status === "HEALTHY")
      ? "HEALTHY"
      : "DEGRADED";

    return {
      overall,
      checks,
      timestamp: new Date().toISOString(),
      duration: Date.now() - start,
    };
  }

  get taskQueueDepth(): number {
    return this._taskQueue.length;
  }

  get activeTaskCount(): number {
    return this._activeTasks;
  }

  private _ensureInitialized(): void {
    if (!this._initialized) {
      throw new ManagerNotInitializedError();
    }
  }

  private _findAgentForTask(task: Task) {
    if (!this._container) return null;
    const agents = this._container.list({ state: "RUNNING" });
    if (agents.length === 0) return null;

    if (task.assignedAgent) {
      return this._container.get(task.assignedAgent);
    }

    return agents.reduce((best, current) => {
      const bestLoad = best.process.resources.cpu + best.process.resources.memory;
      const currentLoad = current.process.resources.cpu + current.process.resources.memory;
      return currentLoad < bestLoad ? current : best;
    });
  }

  private _enqueueTask(task: Task): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      this._taskQueue.push({ task, resolve, reject, queuedAt: new Date().toISOString() });
    });
  }

  private _processQueue(): void {
    if (this._taskQueue.length === 0 || !this._executor || !this._container) return;

    const next = this._taskQueue.shift();
    if (next) {
      this.submitTask(next.task).then(next.resolve).catch(next.reject);
    }
  }

  private _startHealthChecks(): void {
    const interval = this._config?.healthCheckInterval ?? 30_000;
    this._healthInterval = setInterval(() => {
      void this.healthCheck();
    }, interval);
    this._healthInterval.unref();
  }
}
