import { v4 as uuid } from "uuid";
import type {
  AgentId,
  Duration,
  TaskId,
  TaskInput,
  TaskOutput,
  TaskResult,
  TaskStatus,
  TaskContext,
  Timestamp,
  Percentage,
  ErrorDetail,
} from "@agent-preflight/types";
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowTimelineEvent,
  WorkflowCheckpoint,
  WorkflowStepType,
  WorkflowStepCondition,
  OrchestrationConfig,
} from "./types.js";
import {
  WorkflowError,
  WorkflowTimeoutError,
  InvalidPlanError,
} from "./errors.js";
import { ExecutionGraph } from "./graph.js";

export interface WorkflowEngineOptions {
  config: OrchestrationConfig;
  onStepExecute?: (step: WorkflowStep, execution: WorkflowExecution) => Promise<TaskResult>;
  onCheckpoint?: (checkpoint: WorkflowCheckpoint) => Promise<void>;
  onRestore?: (checkpointId: string) => Promise<WorkflowCheckpoint | null>;
  onApprove?: (stepId: string, executionId: string) => Promise<boolean>;
}

export class WorkflowEngine {
  private readonly config: OrchestrationConfig;
  private executions: Map<string, WorkflowExecution> = new Map();
  private paused: Set<string> = new Set();
  private cancelled: Set<string> = new Set();
  private checkpointInterval: ReturnType<typeof setInterval> | null = null;

  private onStepExecute: WorkflowEngineOptions["onStepExecute"];
  private onCheckpoint: WorkflowEngineOptions["onCheckpoint"];
  private onRestore: WorkflowEngineOptions["onRestore"];
  private onApprove: WorkflowEngineOptions["onApprove"];

  constructor(options: WorkflowEngineOptions) {
    this.config = options.config;
    this.onStepExecute = options.onStepExecute;
    this.onCheckpoint = options.onCheckpoint;
    this.onRestore = options.onRestore;
    this.onApprove = options.onApprove;
  }

  createWorkflow(definition: WorkflowDefinition, context?: TaskContext): WorkflowExecution {
    const now = new Date().toISOString();
    const execution: WorkflowExecution = {
      id: `exec_${uuid().slice(0, 12)}`,
      definitionId: definition.id,
      status: "PENDING",
      context: context ?? {
        traceId: uuid(),
        spanId: uuid(),
        workflowId: definition.id,
      },
      results: new Map(),
      errors: new Map(),
      timeline: [],
      currentStepIds: [],
      completedStepIds: [],
      failedStepIds: [],
      skippedStepIds: [],
      startedAt: now,
      updatedAt: now,
      progress: 0,
    };

    this.executions.set(execution.id, execution);
    return execution;
  }

  async executeWorkflow(
    workflowId: string,
    definition: WorkflowDefinition,
    context?: TaskContext,
  ): Promise<WorkflowExecution> {
    let execution = this.executions.get(workflowId);

    if (!execution) {
      execution = this.createWorkflow(definition, context);
    }

    if (this.cancelled.has(execution.id)) {
      throw new WorkflowError(workflowId, "Workflow has been cancelled");
    }

    execution.status = "RUNNING";
    execution.updatedAt = new Date().toISOString();
    this.addTimelineEvent(execution, {
      type: "WORKFLOW_STARTED",
      message: `Workflow "${definition.name}" started`,
    });

    const graph = new ExecutionGraph(definition);

    try {
      const cycleCheck = graph.detectCycles();
      if (cycleCheck.length > 0) {
        throw new WorkflowError(
          workflowId,
          `Workflow contains cycles: ${JSON.stringify(cycleCheck)}`,
        );
      }

      if (this.config.monitoring.checkpointEnabled) {
        this.startCheckpointing(execution, definition);
      }

      const sortedIds = graph.topologicalSort();
      const timeoutHandler = this.startTimeout(execution, definition.timeout);

      try {
        await this.executeSteps(execution, definition, sortedIds, graph);
      } finally {
        clearTimeout(timeoutHandler);
      }

      if (execution.failedStepIds.length > 0 && execution.completedStepIds.length === 0) {
        execution.status = "FAILED";
        this.addTimelineEvent(execution, {
          type: "WORKFLOW_FAILED",
          message: `Workflow "${definition.name}" failed`,
        });
      } else if (execution.failedStepIds.length > 0) {
        execution.status = "COMPLETED";
        execution.progress = 100;
        this.addTimelineEvent(execution, {
          type: "WORKFLOW_COMPLETED",
          message: `Workflow "${definition.name}" completed with ${execution.failedStepIds.length} failed steps`,
        });
      } else {
        execution.status = "COMPLETED";
        execution.progress = 100;
        this.addTimelineEvent(execution, {
          type: "WORKFLOW_COMPLETED",
          message: `Workflow "${definition.name}" completed successfully`,
        });
      }
    } catch (error) {
      execution.status = "FAILED";
      execution.progress = Math.min(100, execution.progress);
      this.addTimelineEvent(execution, {
        type: "WORKFLOW_FAILED",
        message: error instanceof Error ? error.message : "Unknown workflow error",
        data: error,
      });

      execution.errors.set("_workflow", {
        code: "WORKFLOW_EXECUTION_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    execution.completedAt = new Date().toISOString();
    execution.updatedAt = execution.completedAt;

    this.stopCheckpointing();
    return execution;
  }

  async pauseWorkflow(executionId: string): Promise<WorkflowExecution | null> {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    if (execution.status !== "RUNNING") return execution;

    execution.status = "PAUSED";
    execution.updatedAt = new Date().toISOString();
    this.paused.add(executionId);

    this.addTimelineEvent(execution, {
      type: "WORKFLOW_PAUSED",
      message: `Workflow ${executionId} paused`,
    });

    if (this.config.monitoring.checkpointEnabled) {
      await this.createCheckpoint(execution);
    }

    return execution;
  }

  async resumeWorkflow(
    executionId: string,
    checkpointId?: string,
  ): Promise<WorkflowExecution | null> {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    if (execution.status !== "PAUSED") return execution;

    if (checkpointId && this.onRestore) {
      const checkpoint = await this.onRestore(checkpointId);
      if (checkpoint) {
        this.restoreCheckpoint(execution, checkpoint);
      }
    }

    execution.status = "RUNNING";
    execution.updatedAt = new Date().toISOString();
    this.paused.delete(executionId);

    this.addTimelineEvent(execution, {
      type: "WORKFLOW_RESUMED",
      message: `Workflow ${executionId} resumed`,
    });

    return execution;
  }

  cancelWorkflow(executionId: string, reason?: string): WorkflowExecution | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    if (
      execution.status === "COMPLETED" ||
      execution.status === "FAILED" ||
      execution.status === "CANCELLED"
    ) {
      return execution;
    }

    execution.status = "CANCELLED";
    execution.updatedAt = new Date().toISOString();
    execution.completedAt = execution.updatedAt;
    this.cancelled.add(executionId);
    this.paused.delete(executionId);

    this.addTimelineEvent(execution, {
      type: "WORKFLOW_CANCELLED",
      message: reason ?? "Workflow cancelled",
    });

    return execution;
  }

  getExecution(executionId: string): WorkflowExecution | null {
    return this.executions.get(executionId) ?? null;
  }

  getExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values());
  }

  getExecutionByStatus(status: WorkflowExecutionStatus): WorkflowExecution[] {
    return this.getExecutions().filter((e) => e.status === status);
  }

  // ----- private -----

  private async executeSteps(
    execution: WorkflowExecution,
    definition: WorkflowDefinition,
    sortedIds: string[],
    graph: ExecutionGraph,
  ): Promise<void> {
    const stepMap = new Map(definition.steps.map((s) => [s.id, s]));

    for (const stepId of sortedIds) {
      if (this.cancelled.has(execution.id)) {
        this.addTimelineEvent(execution, {
          type: "WORKFLOW_CANCELLED",
          message: "Workflow cancelled during execution",
        });
        return;
      }

      if (this.paused.has(execution.id)) {
        return;
      }

      const step = stepMap.get(stepId);
      if (!step) {
        execution.errors.set(stepId, {
          code: "STEP_NOT_FOUND",
          message: `Step "${stepId}" not found in definition`,
        });
        continue;
      }

      const shouldSkip = this.evaluateConditions(step.conditions, execution);
      if (shouldSkip) {
        execution.skippedStepIds.push(stepId);
        execution.progress = this.calculateProgress(execution, definition);
        this.addTimelineEvent(execution, {
          type: "STEP_SKIPPED",
          stepId,
          message: `Step "${step.name}" skipped due to conditions`,
        });
        continue;
      }

      execution.currentStepIds = [stepId];
      execution.updatedAt = new Date().toISOString();

      try {
        let result: TaskResult;

        switch (step.type) {
          case "PARALLEL":
            result = await this.executeParallelStep(execution, step, definition, graph);
            break;
          case "CONDITION":
            result = await this.executeConditionStep(execution, step, definition);
            break;
          case "LOOP":
            result = await this.executeLoopStep(execution, step, definition);
            break;
          case "WAIT":
            result = await this.executeWaitStep(execution, step);
            break;
          case "DECISION":
            result = await this.executeDecisionStep(execution, step);
            break;
          case "SUBWORKFLOW":
            result = await this.executeSubworkflowStep(execution, step);
            break;
          case "TASK":
          default:
            result = await this.executeRegularStep(execution, step);
            break;
        }

        execution.results.set(stepId, result);
        execution.completedStepIds.push(stepId);
        execution.progress = this.calculateProgress(execution, definition);

        this.addTimelineEvent(execution, {
          type: "STEP_COMPLETED",
          stepId,
          agentId: step.agentId,
          message: `Step "${step.name}" completed`,
        });
      } catch (error) {
        execution.failedStepIds.push(stepId);
        execution.progress = this.calculateProgress(execution, definition);

        const errorDetail: ErrorDetail = {
          code: "STEP_FAILED",
          message: error instanceof Error ? error.message : "Step failed",
          details: { stepId, stepName: step.name },
          cause: error instanceof Error ? { code: "CAUSE", message: error.message } : undefined,
        };

        execution.errors.set(stepId, errorDetail);

        this.addTimelineEvent(execution, {
          type: "STEP_FAILED",
          stepId,
          message: `Step "${step.name}" failed: ${errorDetail.message}`,
          data: errorDetail,
        });

        const errorHandling = step.errorHandling ?? definition.errorHandling?.stepErrorDefaults;
        if (errorHandling) {
          switch (errorHandling.onError) {
            case "CONTINUE":
              continue;
            case "SKIP":
              execution.skippedStepIds.push(stepId);
              continue;
            case "FAIL":
              throw error;
            case "HUMAN_INTERVENTION": {
              execution.status = "WAITING_APPROVAL";
              this.addTimelineEvent(execution, {
                type: "HUMAN_INTERVENTION",
                stepId,
                message: `Waiting for human intervention on step "${step.name}"`,
              });
              return;
            }
            case "FALLBACK": {
              const fallbackStep = step.errorHandling?.fallbackStepId
                ? stepMap.get(step.errorHandling.fallbackStepId)
                : null;
              if (fallbackStep) {
                const fallbackResult = await this.executeRegularStep(execution, fallbackStep);
                execution.results.set(stepId, fallbackResult);
                execution.completedStepIds.push(stepId);
                execution.failedStepIds = execution.failedStepIds.filter((id) => id !== stepId);
              }
              continue;
            }
            case "RETRY": {
              const maxRetries = errorHandling.maxRetries;
              for (let attempt = 1; attempt <= maxRetries; attempt++) {
                this.addTimelineEvent(execution, {
                  type: "STEP_RETRY",
                  stepId,
                  message: `Retrying step "${step.name}" (attempt ${attempt}/${maxRetries})`,
                });
                await this.delay(errorHandling.retryDelay * Math.pow(2, attempt - 1));
                try {
                  const retryResult = await this.executeRegularStep(execution, step);
                  execution.results.set(stepId, retryResult);
                  execution.completedStepIds.push(stepId);
                  execution.failedStepIds = execution.failedStepIds.filter((id) => id !== stepId);
                  break;
                } catch {
                  if (attempt === maxRetries) throw error;
                }
              }
              break;
            }
          }
        }
      } finally {
        execution.currentStepIds = [];
        execution.updatedAt = new Date().toISOString();
      }
    }
  }

  private async executeRegularStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
  ): Promise<TaskResult> {
    this.addTimelineEvent(execution, {
      type: "STEP_STARTED",
      stepId: step.id,
      agentId: step.agentId,
      message: `Executing step "${step.name}"`,
    });

    if (step.approvalConfig?.required) {
      execution.status = "WAITING_APPROVAL";
      this.addTimelineEvent(execution, {
        type: "APPROVAL_REQUESTED",
        stepId: step.id,
        message: `Approval required for step "${step.name}"`,
      });

      if (this.onApprove) {
        const approved = await this.onApprove(step.id, execution.id);
        if (!approved) {
          this.addTimelineEvent(execution, {
            type: "APPROVAL_DENIED",
            stepId: step.id,
            message: `Approval denied for step "${step.name}"`,
          });
          throw new WorkflowError(
            execution.id,
            `Approval denied for step "${step.name}"`,
            { stepId: step.id },
          );
        }
        this.addTimelineEvent(execution, {
          type: "APPROVAL_GRANTED",
          stepId: step.id,
          message: `Approval granted for step "${step.name}"`,
        });
      }
    }

    if (this.onStepExecute) {
      const result = await this.onStepExecute(step, execution);
      return result;
    }

    const simulatedDuration = Math.min(step.timeout, 100 + Math.random() * 500);
    await this.delay(simulatedDuration);

    return {
      taskId: step.id,
      status: "COMPLETED",
      output: {
        text: `Step "${step.name}" executed successfully`,
        data: { stepId: step.id, simulated: true },
      },
      duration: simulatedDuration,
      agentId: step.agentId,
    };
  }

  private async executeParallelStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
    definition: WorkflowDefinition,
    graph: ExecutionGraph,
  ): Promise<TaskResult> {
    this.addTimelineEvent(execution, {
      type: "BRANCH_STARTED",
      stepId: step.id,
      message: `Executing parallel branches for step "${step.name}"`,
    });

    const parallelConfig = step.parallelConfig;
    if (!parallelConfig || parallelConfig.branchSteps.length === 0) {
      return {
        taskId: step.id,
        status: "COMPLETED",
        output: { text: "No parallel branches to execute" },
        duration: 0,
      };
    }

    const maxConcurrency = Math.min(
      parallelConfig.maxConcurrency,
      this.config.parallelization.maxParallelBranches,
    );
    const branches = parallelConfig.branchSteps;
    const results: TaskResult[] = [];
    const errors: Error[] = [];

    const executeBatch = async (batch: WorkflowStep[]): Promise<void> => {
      const batchResults = await Promise.allSettled(
        batch.map((branchStep) =>
          this.executeRegularStep(execution, branchStep),
        ),
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          errors.push(result.reason);
        }
      }
    };

    for (let i = 0; i < branches.length; i += maxConcurrency) {
      const batch = branches.slice(i, i + maxConcurrency);
      await executeBatch(batch);

      if (parallelConfig.joinCondition === "ANY" && results.length > 0) break;
      if (parallelConfig.joinCondition === "ALL" && errors.length > 0) break;
    }

    this.addTimelineEvent(execution, {
      type: "BRANCH_COMPLETED",
      stepId: step.id,
      message: `Parallel branches completed: ${results.length} succeeded, ${errors.length} failed`,
    });

    if (parallelConfig.joinCondition === "ALL" && errors.length > 0) {
      throw errors[0]!;
    }

    const combinedText = results
      .map((r) => r.output?.text ?? "")
      .filter(Boolean)
      .join("\n");

    return {
      taskId: step.id,
      status: errors.length > 0 && results.length === 0 ? "FAILED" : "COMPLETED",
      output: {
        text: combinedText || "Parallel execution completed",
        data: {
          branchCount: branches.length,
          succeededCount: results.length,
          failedCount: errors.length,
          branchResults: results.map((r) => r.output?.data),
        },
      },
      duration: Math.max(...results.map((r) => r.duration)),
    };
  }

  private async executeConditionStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
    definition: WorkflowDefinition,
  ): Promise<TaskResult> {
    const decisionConfig = step.decisionConfig;
    if (!decisionConfig) {
      return {
        taskId: step.id,
        status: "COMPLETED",
        output: { text: "No decision configuration" },
        duration: 0,
      };
    }

    for (const choice of decisionConfig.choices) {
      if (this.evaluateExpression(choice.condition, execution)) {
        const targetStep = definition.steps.find((s) => s.id === choice.stepId);
        if (targetStep) {
          return this.executeRegularStep(execution, targetStep);
        }
      }
    }

    const defaultStep = definition.steps.find(
      (s) => s.id === decisionConfig.defaultStepId,
    );
    if (defaultStep) {
      return this.executeRegularStep(execution, defaultStep);
    }

    return {
      taskId: step.id,
      status: "COMPLETED",
      output: { text: `Condition step "${step.name}" - no matching branch` },
      duration: 0,
    };
  }

  private async executeLoopStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
    definition: WorkflowDefinition,
  ): Promise<TaskResult> {
    const loopConfig = step.loopConfig;
    if (!loopConfig) {
      return {
        taskId: step.id,
        status: "COMPLETED",
        output: { text: "No loop configuration" },
        duration: 0,
      };
    }

    const iterations: TaskResult[] = [];
    let iterationCount = 0;

    while (iterationCount < loopConfig.maxIterations) {
      if (loopConfig.breakCondition && this.evaluateExpression(loopConfig.breakCondition, execution)) {
        break;
      }

      const loopStep: WorkflowStep = {
        ...step,
        id: `${step.id}_iter_${iterationCount}`,
        type: "TASK",
      };

      const result = await this.executeRegularStep(execution, loopStep);
      iterations.push(result);
      iterationCount++;

      if (loopConfig.breakCondition && this.evaluateExpression(loopConfig.breakCondition, execution)) {
        break;
      }
    }

    return {
      taskId: step.id,
      status: "COMPLETED",
      output: {
        text: `Loop "${step.name}" completed ${iterationCount} iterations`,
        data: {
          iterations: iterationCount,
          maxIterations: loopConfig.maxIterations,
          results: iterations.map((r) => r.output?.data),
        },
      },
      duration: iterations.reduce((sum, r) => sum + r.duration, 0),
    };
  }

  private async executeWaitStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
  ): Promise<TaskResult> {
    const waitDuration = Math.min(step.timeout, 1000);
    await this.delay(waitDuration);

    return {
      taskId: step.id,
      status: "COMPLETED",
      output: { text: `Wait step "${step.name}" completed after ${waitDuration}ms` },
      duration: waitDuration,
    };
  }

  private async executeDecisionStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
  ): Promise<TaskResult> {
    return this.executeRegularStep(execution, step);
  }

  private async executeSubworkflowStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
  ): Promise<TaskResult> {
    return {
      taskId: step.id,
      status: "COMPLETED",
      output: {
        text: `Subworkflow step "${step.name}" - execution delegated`,
        data: { subworkflowId: step.subworkflowConfig?.workflowId },
      },
      duration: 0,
    };
  }

  private evaluateConditions(
    conditions: WorkflowStepCondition | undefined,
    execution: WorkflowExecution,
  ): boolean {
    if (!conditions) return false;

    if (conditions.skipIf && this.evaluateExpression(conditions.skipIf, execution)) {
      return true;
    }

    if (conditions.runIf && !this.evaluateExpression(conditions.runIf, execution)) {
      return true;
    }

    return false;
  }

  private evaluateExpression(
    expression: string,
    execution: WorkflowExecution,
  ): boolean {
    const lower = expression.toLowerCase().trim();

    if (lower === "true") return true;
    if (lower === "false") return false;

    if (lower.includes("completed") && lower.includes("all")) {
      return execution.completedStepIds.length > 0;
    }

    if (lower.includes("failed")) {
      return execution.failedStepIds.length === 0;
    }

    if (lower.startsWith("step:")) {
      const parts = lower.split(":");
      if (parts.length >= 3) {
        const stepId = parts[1]!;
        const status = parts[2]!;
        const result = execution.results.get(stepId);
        if (status === "completed") return result?.status === "COMPLETED";
        if (status === "failed") return result?.status === "FAILED";
        if (status === "exists") return result !== undefined;
      }
    }

    return true;
  }

  private calculateProgress(
    execution: WorkflowExecution,
    definition: WorkflowDefinition,
  ): Percentage {
    if (definition.steps.length === 0) return 100;
    const completed = execution.completedStepIds.length +
      execution.skippedStepIds.length;
    return Math.round((completed / definition.steps.length) * 100);
  }

  private startCheckpointing(
    execution: WorkflowExecution,
    definition: WorkflowDefinition,
  ): void {
    const interval = this.config.monitoring.checkpointInterval;
    this.checkpointInterval = setInterval(async () => {
      if (execution.status === "RUNNING") {
        await this.createCheckpoint(execution);
      }
    }, interval);
  }

  private stopCheckpointing(): void {
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
      this.checkpointInterval = null;
    }
  }

  private async createCheckpoint(
    execution: WorkflowExecution,
  ): Promise<WorkflowCheckpoint> {
    const checkpoint: WorkflowCheckpoint = {
      id: `cp_${uuid().slice(0, 12)}`,
      executionId: execution.id,
      completedStepIds: [...execution.completedStepIds],
      runningStepIds: [...execution.currentStepIds],
      context: {},
      results: new Map(execution.results),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };

    execution.checkpoint = checkpoint;

    this.addTimelineEvent(execution, {
      type: "CHECKPOINT_CREATED",
      message: `Checkpoint ${checkpoint.id} created`,
    });

    if (this.onCheckpoint) {
      await this.onCheckpoint(checkpoint);
    }

    return checkpoint;
  }

  private restoreCheckpoint(
    execution: WorkflowExecution,
    checkpoint: WorkflowCheckpoint,
  ): void {
    execution.completedStepIds = [...checkpoint.completedStepIds];
    execution.results = new Map(checkpoint.results);

    this.addTimelineEvent(execution, {
      type: "CHECKPOINT_RESTORED",
      message: `Checkpoint ${checkpoint.id} restored`,
    });
  }

  private startTimeout(
    execution: WorkflowExecution,
    timeout: Duration,
  ): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      execution.status = "TIMEOUT";
      execution.completedAt = new Date().toISOString();

      this.addTimelineEvent(execution, {
        type: "ERROR",
        message: `Workflow ${execution.id} timed out after ${timeout}ms`,
      });

      execution.errors.set("_timeout", {
        code: "WORKFLOW_TIMEOUT",
        message: `Workflow exceeded timeout of ${timeout}ms`,
      });
    }, timeout);
  }

  private addTimelineEvent(
    execution: WorkflowExecution,
    event: Omit<WorkflowTimelineEvent, "id" | "timestamp">,
  ): void {
    const timelineEvent: WorkflowTimelineEvent = {
      id: `evt_${uuid().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    execution.timeline.push(timelineEvent);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
