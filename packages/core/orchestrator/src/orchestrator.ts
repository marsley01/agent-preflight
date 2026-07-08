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
  TaskPriority,
  Timestamp,
  AgentInfo,
  ErrorDetail,
  AgentCapabilities,
} from "@agent-preflight/types";
import type {
  OrchestrationConfig,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowExecution,
  WorkflowExecutionStatus,
  OrchestrationStrategy,
  FallbackStrategy,
  AgentAssignment,
  ScheduledTask,
  PlanValidation,
  AgentSelectionCriteria,
  WorkflowTimelineEvent,
  DelegationRequest,
  DelegationResult,
} from "./types.js";
import {
  OrchestrationError,
  ExecutionError,
  WorkflowTimeoutError,
  WorkflowError,
} from "./errors.js";
import { Planner } from "./planner.js";
import { Scheduler } from "./scheduler.js";
import { Coordinator } from "./coordinator.js";
import { WorkflowEngine } from "./workflow.js";
import { AgentSelector } from "./selector.js";
import { ExecutionGraph } from "./graph.js";

export interface OrchestratorOptions {
  config: OrchestrationConfig;
  agents: Map<
    AgentId,
    {
      name: string;
      capabilities: string[];
      status: "IDLE" | "BUSY" | "ERROR" | "TERMINATED" | "PAUSED";
      cost: number;
      avgLatency: Duration;
      maxConcurrency: number;
      currentLoad: number;
      successRate: number;
      modelFamilies: string[];
      supportsStreaming: boolean;
      supportsFunctionCalling: boolean;
    }
  >;
  delegateTask?: (request: DelegationRequest) => Promise<DelegationResult>;
  onEvent?: (event: WorkflowTimelineEvent) => void;
}

export class Orchestrator {
  private readonly config: OrchestrationConfig;
  private readonly agents: OrchestratorOptions["agents"];
  private readonly planner: Planner;
  private readonly scheduler: Scheduler;
  private readonly coordinator: Coordinator;
  private readonly workflowEngine: WorkflowEngine;
  private readonly agentSelector: AgentSelector;
  private readonly activeWorkflows: Map<string, WorkflowExecution> = new Map();
  private readonly workflowDefinitions: Map<string, WorkflowDefinition> = new Map();
  private readonly delegateTaskFn?: OrchestratorOptions["delegateTask"];
  private readonly onEvent?: OrchestratorOptions["onEvent"];

  constructor(options: OrchestratorOptions) {
    this.config = options.config;
    this.agents = options.agents;
    this.delegateTaskFn = options.delegateTask;
    this.onEvent = options.onEvent;

    this.planner = new Planner({
      config: this.config,
      availableAgents: new Map(
        Array.from(this.agents.entries()).map(([id, info]) => [
          id,
          {
            capabilities: info.capabilities,
            cost: info.cost,
            avgLatency: info.avgLatency,
            maxConcurrency: info.maxConcurrency,
            currentLoad: info.currentLoad,
          },
        ]),
      ),
    });

    this.scheduler = new Scheduler({ config: this.config });

    this.coordinator = new Coordinator({
      protocol: "DIRECT",
      heartbeatInterval: 5000,
      healthCheckInterval: 15000,
      failureDetectionTimeout: 30000,
      autoReconnect: true,
      maxRetries: this.config.retryPolicy.maxRetries,
    });

    this.agentSelector = new AgentSelector({
      strategy: "WEIGHTED",
      weights: {
        capability: 0.35,
        cost: 0.15,
        latency: 0.15,
        load: 0.2,
        reliability: 0.15,
      },
    });

    this.workflowEngine = new WorkflowEngine({
      config: this.config,
      onStepExecute: async (step, execution) => {
        return this.executeStep(step, execution);
      },
      onCheckpoint: async (checkpoint) => {
        if (this.onEvent) {
          this.onEvent({
            id: uuid(),
            timestamp: new Date().toISOString(),
            type: "CHECKPOINT_CREATED",
            message: `Checkpoint ${checkpoint.id} created`,
          });
        }
      },
      onRestore: async (checkpointId) => {
        return null;
      },
      onApprove: async (stepId, executionId) => {
        const execution = this.activeWorkflows.get(executionId);
        if (!execution) return false;

        const step = this.workflowDefinitions
          .get(execution.definitionId)
          ?.steps.find((s) => s.id === stepId);

        if (!step?.approvalConfig) return false;

        this.emitEvent({
          type: "APPROVAL_REQUESTED",
          stepId,
          message: `Approval requested for step "${step?.name}" in workflow "${executionId}"`,
        });

        const timeout = step.approvalConfig.timeout;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
          const executionCheck = this.activeWorkflows.get(executionId);
          if (!executionCheck) return false;
          if (executionCheck.status !== "WAITING_APPROVAL") return true;
          await this.delay(500);
        }

        this.emitEvent({
          type: "APPROVAL_DENIED",
          stepId,
          message: `Approval timed out for step "${step?.name}"`,
        });

        return false;
      },
    });
  }

  async executeWorkflow(
    definition: WorkflowDefinition,
    context?: TaskContext,
  ): Promise<WorkflowExecution> {
    this.workflowDefinitions.set(definition.id, definition);

    const planValidation = this.planner.validatePlan(definition);
    if (!planValidation.valid) {
      throw new WorkflowError(
        definition.id,
        "Workflow plan validation failed",
        {
          details: {
            issues: planValidation.issues,
          },
        },
      );
    }

    const optimized = this.planner.optimizeWorkflow(definition);
    const assignments = this.planner.assignAgents(optimized);

    for (const assignment of assignments) {
      const step = optimized.steps.find((s) => s.id === assignment.stepId);
      if (step) {
        step.agentId = assignment.agentId;
      }
    }

    const scheduledTasks: Omit<ScheduledTask, "id" | "status" | "createdAt">[] =
      optimized.steps.map((step) => ({
        workflowId: optimized.id,
        stepId: step.id,
        agentId: step.agentId ?? assignments.find((a) => a.stepId === step.id)?.agentId ?? "",
        priority: step.priority,
        input: step.input ?? { prompt: step.name },
        timeout: step.timeout,
        dependencies: step.dependsOn.map((dep) => dep),
        metadata: { stepType: step.type },
      }));

    try {
      this.scheduler.schedule(scheduledTasks);
    } catch (error) {
      throw new WorkflowError(
        definition.id,
        "Failed to schedule workflow tasks",
        { cause: error instanceof Error ? error : undefined },
      );
    }

    const execution = this.workflowEngine.createWorkflow(optimized, context);
    this.activeWorkflows.set(execution.id, execution);

    process.nextTick(() => {
      this.runWorkflow(execution, optimized).catch((err) => {
        execution.status = "FAILED";
        execution.errors.set("_orchestrator", {
          code: "ORCHESTRATION_FAILED",
          message: err instanceof Error ? err.message : "Orchestration failed",
        });
      });
    });

    return execution;
  }

  async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
  ): Promise<TaskResult> {
    const startTime = Date.now();

    if (step.agentId) {
      const agent = this.agents.get(step.agentId);
      if (!agent || agent.status === "TERMINATED" || agent.status === "ERROR") {
        const fallbackResult = await this.handleAgentFailure(step, execution);
        if (fallbackResult) return fallbackResult;
        throw new ExecutionError(
          `Agent "${step.agentId}" is not available for step "${step.id}"`,
        );
      }
    }

    if (execution.status === "PAUSED" || execution.status === "CANCELLED") {
      return {
        taskId: step.id,
        status: "CANCELLED",
        output: { text: "Execution paused or cancelled" },
        duration: 0,
      };
    }

    const timeoutHandler = setTimeout(() => {
      throw new WorkflowError(
        execution.id,
        `Step "${step.id}" timed out after ${step.timeout}ms`,
        { stepId: step.id },
      );
    }, step.timeout);

    try {
      if (step.agentId && this.delegateTaskFn) {
        const delegateRequest: DelegationRequest = {
          taskId: step.id,
          targetAgentId: step.agentId,
          input: step.input ?? { prompt: step.name },
          timeout: step.timeout,
          priority: step.priority,
          context: execution.context,
          correlationId: uuid(),
        };

        const delegationResult = await this.delegateTaskFn(delegateRequest);

        return {
          taskId: step.id,
          status: delegationResult.status,
          output: delegationResult.output,
          error: delegationResult.error,
          duration: delegationResult.duration,
          agentId: step.agentId,
        };
      }

      const simulatedDuration = Math.min(step.timeout, 50 + Math.random() * 200);
      await this.delay(simulatedDuration);

      return {
        taskId: step.id,
        status: "COMPLETED",
        output: {
          text: `Step "${step.name}" executed by ${step.agentId ?? "default"}`,
          data: {
            stepType: step.type,
            agentId: step.agentId,
          },
        },
        duration: Date.now() - startTime,
        agentId: step.agentId,
      };
    } finally {
      clearTimeout(timeoutHandler);
    }
  }

  async handleError(
    step: WorkflowStep,
    execution: WorkflowExecution,
    error: Error,
  ): Promise<TaskResult | null> {
    const strategy =
      step.errorHandling?.fallbackStrategy ??
      this.config.fallbackStrategy;

    const errorDetail: ErrorDetail = {
      code: "STEP_ERROR",
      message: error.message,
      stack: error.stack,
    };

    execution.errors.set(step.id, errorDetail);

    this.emitEvent({
      type: "STEP_FAILED",
      stepId: step.id,
      message: `Step "${step.name}" failed: ${error.message}`,
      data: errorDetail,
    });

    switch (strategy) {
      case "RETRY": {
        const maxRetries = step.errorHandling?.maxRetries ?? this.config.retryPolicy.maxRetries;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            this.emitEvent({
              type: "STEP_RETRY",
              stepId: step.id,
              message: `Retry ${attempt}/${maxRetries} for step "${step.name}"`,
            });

            const backoff = this.config.retryPolicy.baseDelay *
              Math.pow(this.config.retryPolicy.backoffFactor, attempt - 1);
            await this.delay(Math.min(backoff, this.config.retryPolicy.maxDelay));

            const result = await this.executeStep(step, execution);
            return result;
          } catch (retryError) {
            if (attempt === maxRetries) {
              return this.handleError(step, execution, retryError as Error);
            }
          }
        }
        return null;
      }

      case "ALTERNATIVE_AGENT": {
        const criteria: AgentSelectionCriteria = {
          requiredCapabilities: step.input?.parameters?.requiredCapabilities as string[] ?? [],
          excludeAgentIds: step.agentId ? [step.agentId] : undefined,
        };

        const agentRuntimeInfos = Array.from(this.agents.entries()).map(
          ([id, info]) => ({
            agentId: id,
            name: info.name,
            capabilities: info.capabilities,
            status: info.status,
            currentLoad: info.currentLoad,
            maxConcurrency: info.maxConcurrency,
            avgLatency: info.avgLatency,
            costPerTask: info.cost,
            successRate: info.successRate,
            lastSeen: new Date().toISOString(),
            modelFamilies: info.modelFamilies,
            supportsStreaming: info.supportsStreaming,
            supportsFunctionCalling: info.supportsFunctionCalling,
          }),
        );

        try {
          const selected = this.agentSelector.selectAgent(
            agentRuntimeInfos,
            criteria,
          );
          step.agentId = selected.agentId;
          return this.executeStep(step, execution);
        } catch {
          return this.handleError(step, execution, error);
        }
      }

      case "SIMPLIFIED": {
        const simplifiedStep: WorkflowStep = {
          ...step,
          input: {
            prompt: `[SIMPLIFIED] ${step.name}`,
            parameters: { simplified: true },
          },
        };
        return this.executeStep(simplifiedStep, execution);
      }

      case "HUMAN": {
        execution.status = "WAITING_APPROVAL";
        this.emitEvent({
          type: "HUMAN_INTERVENTION",
          stepId: step.id,
          message: `Human intervention required for step "${step.name}"`,
          data: errorDetail,
        });
        return null;
      }

      case "FAIL":
      default:
        throw error;
    }
  }

  async monitorProgress(
    executionId: string,
  ): Promise<WorkflowExecution | null> {
    const execution = this.activeWorkflows.get(executionId);
    if (!execution) return null;

    return {
      ...execution,
      results: execution.results,
      errors: execution.errors,
    };
  }

  async handleCancellation(executionId: string, reason?: string): Promise<void> {
    const execution = this.activeWorkflows.get(executionId);
    if (!execution) return;

    execution.status = "CANCELLED";
    execution.completedAt = new Date().toISOString();
    execution.updatedAt = execution.completedAt;

    this.emitEvent({
      type: "WORKFLOW_CANCELLED",
      message: reason ?? "Workflow cancelled by orchestrator",
    });

    const runningTaskIds = execution.currentStepIds;
    for (const taskId of runningTaskIds) {
      this.scheduler.cancel(taskId);
    }
  }

  getActiveWorkflows(): WorkflowExecution[] {
    return Array.from(this.activeWorkflows.values()).filter(
      (w) =>
        w.status === "RUNNING" ||
        w.status === "PAUSED" ||
        w.status === "WAITING_APPROVAL",
    );
  }

  getWorkflow(executionId: string): WorkflowExecution | null {
    return this.activeWorkflows.get(executionId) ?? null;
  }

  getAgentStatus(): Map<AgentId, { status: string; currentLoad: number; maxConcurrency: number }> {
    const status = new Map<
      AgentId,
      { status: string; currentLoad: number; maxConcurrency: number }
    >();

    for (const [id, info] of this.agents) {
      status.set(id, {
        status: info.status,
        currentLoad: info.currentLoad,
        maxConcurrency: info.maxConcurrency,
      });
    }

    return status;
  }

  updateAgentLoad(agentId: AgentId, delta: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.currentLoad = Math.max(0, agent.currentLoad + delta);
    }
  }

  setOrchestrationStrategy(strategy: OrchestrationStrategy): void {
    this.config.scheduling.strategy = strategy;
  }

  setAgentSelectorStrategy(strategy: import("./types.js").AgentSelectorStrategy): void {
    this.agentSelector.setStrategy(strategy);
  }

  // ----- private -----

  private async runWorkflow(
    execution: WorkflowExecution,
    definition: WorkflowDefinition,
  ): Promise<void> {
    try {
      await this.workflowEngine.executeWorkflow(
        execution.id,
        definition,
        execution.context,
      );

      this.emitEvent({
        type: "WORKFLOW_COMPLETED",
        message: `Workflow "${definition.name}" completed with status ${execution.status}`,
      });
    } catch (error) {
      execution.status = "FAILED";

      this.emitEvent({
        type: "WORKFLOW_FAILED",
        message: `Workflow "${definition.name}" failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        data: error,
      });
    } finally {
      this.updateAgentLoadsFromExecution(execution, definition);
    }
  }

  private async handleAgentFailure(
    step: WorkflowStep,
    execution: WorkflowExecution,
  ): Promise<TaskResult | null> {
    const replanResult = this.planner.replan(
      this.workflowDefinitions.get(execution.definitionId)!,
      step.id,
      [],
    );

    const newAssignment = replanResult.assignments.find(
      (a) => a.stepId === step.id,
    );

    if (newAssignment && newAssignment.agentId !== step.agentId) {
      step.agentId = newAssignment.agentId;

      this.emitEvent({
        type: "AGENT_ASSIGNED",
        stepId: step.id,
        agentId: newAssignment.agentId,
        message: `Step "${step.name}" reassigned to agent "${newAssignment.agentId}"`,
      });

      return this.executeStep(step, execution);
    }

    return null;
  }

  private updateAgentLoadsFromExecution(
    execution: WorkflowExecution,
    definition: WorkflowDefinition,
  ): void {
    for (const step of definition.steps) {
      if (step.agentId) {
        this.updateAgentLoad(step.agentId, -1);
      }
    }
  }

  private emitEvent(event: Omit<WorkflowTimelineEvent, "id" | "timestamp">): void {
    if (this.onEvent) {
      this.onEvent({
        id: `evt_${uuid().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        ...event,
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
