import type { ErrorDetail } from "@agent-preflight/types";

export class OrchestrationError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly cause?: Error;

  constructor(
    code: string,
    message: string,
    options?: { details?: unknown; cause?: Error },
  ) {
    super(message);
    this.name = "OrchestrationError";
    this.code = code;
    this.details = options?.details;
    this.cause = options?.cause;

    if (options?.cause && options.cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }

  toErrorDetail(): ErrorDetail {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}

export class PlanningError extends OrchestrationError {
  constructor(
    message: string,
    options?: { details?: unknown; cause?: Error },
  ) {
    super("PLANNING_ERROR", message, options);
    this.name = "PlanningError";
  }
}

export class SchedulingError extends OrchestrationError {
  constructor(
    message: string,
    options?: { details?: unknown; cause?: Error },
  ) {
    super("SCHEDULING_ERROR", message, options);
    this.name = "SchedulingError";
  }
}

export class ExecutionError extends OrchestrationError {
  constructor(
    message: string,
    options?: { details?: unknown; cause?: Error },
  ) {
    super("EXECUTION_ERROR", message, options);
    this.name = "ExecutionError";
  }
}

export class CoordinationError extends OrchestrationError {
  constructor(
    message: string,
    options?: { details?: unknown; cause?: Error },
  ) {
    super("COORDINATION_ERROR", message, options);
    this.name = "CoordinationError";
  }
}

export class AgentSelectionError extends OrchestrationError {
  constructor(
    message: string,
    options?: { details?: unknown; cause?: Error },
  ) {
    super("AGENT_SELECTION_ERROR", message, options);
    this.name = "AgentSelectionError";
  }
}

export class WorkflowError extends OrchestrationError {
  public readonly workflowId: string;
  public readonly stepId?: string;

  constructor(
    workflowId: string,
    message: string,
    options?: { stepId?: string; details?: unknown; cause?: Error },
  ) {
    super("WORKFLOW_ERROR", message, options);
    this.name = "WorkflowError";
    this.workflowId = workflowId;
    this.stepId = options?.stepId;
  }
}

export class CycleDetectedError extends OrchestrationError {
  public readonly cycle: string[];

  constructor(cycle: string[], message?: string) {
    super(
      "CYCLE_DETECTED",
      message ?? `Cycle detected in dependency graph: ${cycle.join(" -> ")}`,
      { details: { cycle } },
    );
    this.name = "CycleDetectedError";
    this.cycle = cycle;
  }
}

export class InvalidPlanError extends OrchestrationError {
  public readonly issues: string[];

  constructor(issues: string[], message?: string) {
    super("INVALID_PLAN", message ?? `Invalid plan: ${issues.join("; ")}`, {
      details: { issues },
    });
    this.name = "InvalidPlanError";
    this.issues = issues;
  }
}

export class AgentUnavailableError extends OrchestrationError {
  public readonly agentId: string;

  constructor(
    agentId: string,
    message?: string,
    options?: { details?: unknown; cause?: Error },
  ) {
    super(
      "AGENT_UNAVAILABLE",
      message ?? `Agent ${agentId} is unavailable`,
      options,
    );
    this.name = "AgentUnavailableError";
    this.agentId = agentId;
  }
}

export class WorkflowTimeoutError extends OrchestrationError {
  public readonly workflowId: string;
  public readonly timeout: number;

  constructor(workflowId: string, timeout: number) {
    super(
      "WORKFLOW_TIMEOUT",
      `Workflow ${workflowId} exceeded timeout of ${timeout}ms`,
      { details: { workflowId, timeout } },
    );
    this.name = "WorkflowTimeoutError";
    this.workflowId = workflowId;
    this.timeout = timeout;
  }
}
