import type {
  Task, TaskId, TaskResult, Duration, TaskOutput, ErrorDetail,
} from "@agent-preflight/types";
import type { AgentContext } from "./types.js";
import { TaskTimeoutError, TaskRetryExhaustedError } from "./errors.js";

export interface ExecutorOptions {
  maxRetries: number;
  baseDelay: Duration;
  maxDelay: Duration;
  backoffFactor: number;
  enableResourceTracking: boolean;
}

export interface ExecutionMetrics {
  taskId: TaskId;
  attempts: number;
  totalDuration: Duration;
  lastDuration: Duration;
  tokenUsage: { input: number; output: number };
  memoryPeak: number;
  cpuAvg: number;
  errorHistory: ErrorDetail[];
}

export class TaskExecutor {
  private _options: Required<ExecutorOptions>;

  constructor(options?: Partial<ExecutorOptions>) {
    this._options = {
      maxRetries: options?.maxRetries ?? 3,
      baseDelay: options?.baseDelay ?? 1_000,
      maxDelay: options?.maxDelay ?? 30_000,
      backoffFactor: options?.backoffFactor ?? 2,
      enableResourceTracking: options?.enableResourceTracking ?? true,
    };
  }

  async execute(
    task: Task,
    context: AgentContext,
    handler: (task: Task, ctx: AgentContext) => Promise<TaskOutput>,
  ): Promise<TaskResult> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error | undefined;
    const metrics: ExecutionMetrics = {
      taskId: task.id,
      attempts: 0,
      totalDuration: 0,
      lastDuration: 0,
      tokenUsage: { input: 0, output: 0 },
      memoryPeak: 0,
      cpuAvg: 0,
      errorHistory: [],
    };

    const injectedContext = this._injectContext(context, task);

    while (attempts <= this._options.maxRetries) {
      const attemptStart = Date.now();
      attempts++;

      try {
        const result = await this._executeWithTimeout(task, injectedContext, handler);
        const duration = Date.now() - attemptStart;
        metrics.attempts = attempts;
        metrics.lastDuration = duration;
        metrics.totalDuration = Date.now() - startTime;

        if (this._options.enableResourceTracking) {
          this._trackResourceUsage(metrics);
        }

        const tokenUsage = result.metrics?.["tokenUsage"] as { input: number; output: number } | undefined;

        const taskResult: TaskResult = {
          taskId: task.id,
          status: "COMPLETED",
          output: result,
          duration,
        };
        if (tokenUsage) taskResult.tokenUsage = { ...tokenUsage, total: tokenUsage.input + tokenUsage.output };
        if (context.securityContext.agentId) taskResult.agentId = context.securityContext.agentId;
        return taskResult;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const duration = Date.now() - attemptStart;
        metrics.lastDuration = duration;
        metrics.totalDuration = Date.now() - startTime;
        const errDetail: ErrorDetail = { code: "EXECUTION_ERROR", message: lastError.message };
        if (lastError.stack) errDetail.stack = lastError.stack;
        metrics.errorHistory.push(errDetail);

        if (attempts > this._options.maxRetries) {
          const finalError = new TaskRetryExhaustedError(task.id, this._options.maxRetries, lastError);
          const failedResult: TaskResult = {
            taskId: task.id,
            status: "FAILED",
            error: finalError.toErrorDetail(),
            duration: Date.now() - startTime,
          };
          if (context.securityContext.agentId) failedResult.agentId = context.securityContext.agentId;
          return failedResult;
        }

        if (!this._isRetryable(lastError)) {
          const nonRetryableError: ErrorDetail = { code: "NON_RETRYABLE_ERROR", message: lastError.message };
          if (lastError.stack) nonRetryableError.stack = lastError.stack;
          const failedResult: TaskResult = {
            taskId: task.id,
            status: "FAILED",
            error: nonRetryableError,
            duration: Date.now() - startTime,
          };
          if (context.securityContext.agentId) failedResult.agentId = context.securityContext.agentId;
          return failedResult;
        }

        await this._backoff(attempts);
      }
    }

    return {
      taskId: task.id,
      status: "FAILED",
      error: lastError ? { code: "UNKNOWN", message: lastError.message } : { code: "UNKNOWN", message: "Execution failed" },
      duration: Date.now() - startTime,
    };
  }

  private async _executeWithTimeout(
    task: Task,
    context: AgentContext,
    handler: (task: Task, ctx: AgentContext) => Promise<TaskOutput>,
  ): Promise<TaskOutput> {
    const timeout = task.timeout || context.config.agentTimeout;

    const result = await Promise.race([
      handler(task, context),
      this._timeout(task.id, timeout),
    ]);

    return result;
  }

  private _timeout(taskId: TaskId, ms: Duration): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TaskTimeoutError(taskId, ms));
      }, ms);
    });
  }

  private _injectContext(context: AgentContext, task: Task): AgentContext {
    return {
      ...context,
      config: {
        ...context.config,
        agentTimeout: task.timeout || context.config.agentTimeout,
      },
    };
  }

  private _isRetryable(error: Error): boolean {
    const nonRetryableMessages = [
      "invalid input", "validation", "not found", "permission denied",
      "unauthorized", "forbidden", "bad request",
    ];
    const msg = error.message.toLowerCase();
    return !nonRetryableMessages.some((pattern) => msg.includes(pattern));
  }

  private async _backoff(attempt: number): Promise<void> {
    const delay = Math.min(
      this._options.baseDelay * Math.pow(this._options.backoffFactor, attempt - 1),
      this._options.maxDelay,
    );
    const jitter = delay * 0.1 * Math.random();
    await new Promise<void>((resolve) => setTimeout(() => resolve(), delay + jitter));
  }

  private _trackResourceUsage(metrics: ExecutionMetrics): void {
    const mem = process.memoryUsage();
    metrics.memoryPeak = Math.max(metrics.memoryPeak, mem.heapUsed);
    const cpu = process.cpuUsage();
    metrics.cpuAvg = (cpu.user + cpu.system) / 1000;
  }
}
