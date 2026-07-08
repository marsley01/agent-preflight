import type { ErrorCode, ErrorDetail } from "@agent-preflight/types";

export class RuntimeError extends Error {
  public readonly code: ErrorCode;
  public readonly details: unknown;
  public declare cause?: Error;

  constructor(code: ErrorCode, message: string, options?: { details?: unknown; cause?: Error }) {
    super(message);
    this.name = "RuntimeError";
    this.code = code;
    this.details = options?.details;
    if (options?.cause) this.cause = options.cause;
  }

  toErrorDetail(): ErrorDetail {
    const detail: ErrorDetail = {
      code: this.code,
      message: this.message,
    };
    if (this.details !== undefined) detail.details = this.details;
    if (this.stack) detail.stack = this.stack;
    if (this.cause instanceof RuntimeError) detail.cause = this.cause.toErrorDetail();
    return detail;
  }
}

export class AgentLifecycleError extends RuntimeError {
  constructor(message: string, options?: { details?: unknown; cause?: Error }) {
    super("AGENT_LIFECYCLE_ERROR", message, options);
    this.name = "AgentLifecycleError";
  }
}

export class AgentNotFoundError extends RuntimeError {
  constructor(agentId: string) {
    super("AGENT_NOT_FOUND", `Agent not found: ${agentId}`, { details: { agentId } });
    this.name = "AgentNotFoundError";
  }
}

export class AgentAlreadyExistsError extends RuntimeError {
  constructor(agentId: string) {
    super("AGENT_ALREADY_EXISTS", `Agent already exists: ${agentId}`, { details: { agentId } });
    this.name = "AgentAlreadyExistsError";
  }
}

export class ContainerError extends RuntimeError {
  constructor(message: string, options?: { details?: unknown; cause?: Error }) {
    super("CONTAINER_ERROR", message, options);
    this.name = "ContainerError";
  }
}

export class ContainerFullError extends ContainerError {
  constructor(maxInstances: number) {
    super(`Container at capacity: ${maxInstances} instances`, { details: { maxInstances } });
    this.name = "ContainerFullError";
  }
}

export class ExecutorError extends RuntimeError {
  constructor(message: string, options?: { details?: unknown; cause?: Error }) {
    super("EXECUTOR_ERROR", message, options);
    this.name = "ExecutorError";
  }
}

export class TaskTimeoutError extends ExecutorError {
  constructor(taskId: string, timeout: number) {
    super(`Task ${taskId} timed out after ${timeout}ms`, { details: { taskId, timeout } });
    this.name = "TaskTimeoutError";
  }
}

export class TaskRetryExhaustedError extends ExecutorError {
  constructor(taskId: string, retries: number, cause?: Error) {
    const opts: { details?: unknown; cause?: Error } = { details: { taskId, retries } };
    if (cause) opts.cause = cause;
    super(`Task ${taskId} exhausted ${retries} retries`, opts);
    this.name = "TaskRetryExhaustedError";
  }
}

export class ManagerError extends RuntimeError {
  constructor(message: string, options?: { details?: unknown; cause?: Error }) {
    super("MANAGER_ERROR", message, options);
    this.name = "ManagerError";
  }
}

export class ManagerNotInitializedError extends ManagerError {
  constructor() {
    super("RuntimeManager has not been initialized");
    this.name = "ManagerNotInitializedError";
  }
}

export const ErrorCodes = {
  AGENT_LIFECYCLE_ERROR: "AGENT_LIFECYCLE_ERROR",
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  AGENT_ALREADY_EXISTS: "AGENT_ALREADY_EXISTS",
  CONTAINER_ERROR: "CONTAINER_ERROR",
  CONTAINER_FULL: "CONTAINER_FULL",
  EXECUTOR_ERROR: "EXECUTOR_ERROR",
  TASK_TIMEOUT: "TASK_TIMEOUT",
  TASK_RETRY_EXHAUSTED: "TASK_RETRY_EXHAUSTED",
  MANAGER_ERROR: "MANAGER_ERROR",
  MANAGER_NOT_INITIALIZED: "MANAGER_NOT_INITIALIZED",
} as const;
