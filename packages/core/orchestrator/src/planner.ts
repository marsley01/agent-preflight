import { v4 as uuid } from "uuid";
import type {
  AgentId,
  Duration,
  TaskInput,
  Timestamp,
} from "@agent-preflight/types";
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowStepType,
  TaskDecomposition,
  PlanValidation,
  AgentAssignment,
  OrchestrationConfig,
  RetryPolicy,
  WorkflowStepErrorHandling,
} from "./types.js";
import { PlanningError, InvalidPlanError, CycleDetectedError } from "./errors.js";

export interface PlannerOptions {
  config: OrchestrationConfig;
  availableAgents: Map<AgentId, { capabilities: string[]; cost: number; avgLatency: Duration; maxConcurrency: number; currentLoad: number }>;
}

export class Planner {
  private readonly config: OrchestrationConfig;
  private readonly agents: PlannerOptions["availableAgents"];

  constructor(options: PlannerOptions) {
    this.config = options.config;
    this.agents = options.availableAgents;
  }

  decomposeTask(taskDescription: string, context?: Record<string, unknown>): TaskDecomposition {
    const id = (label: string) => `${label.toLowerCase().replace(/\s+/g, "_")}_${uuid().slice(0, 8)}`;

    const lines = taskDescription
      .split(/[.!?\n]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 10);

    const subtasks = lines.slice(0, this.config.maxAgentsPerWorkflow * 2).map((line, i) => ({
      id: id(`task_${i}`),
      description: line,
      requiredCapabilities: this.inferCapabilities(line),
      estimatedComplexity: Math.min(10, Math.ceil(line.split(" ").length / 5)),
      dependencies: [] as string[],
    }));

    for (let i = 1; i < subtasks.length; i++) {
      if (subtasks[i] && subtasks[i - 1]) {
        subtasks[i].dependencies.push(subtasks[i - 1].id);
      }
    }

    const parallelGroups = this.detectParallelGroups(subtasks);
    const suggestedOrder = subtasks.map((s) => s.id);

    return {
      originalTask: taskDescription,
      subtasks,
      suggestedOrder,
      parallelGroups,
    };
  }

  createWorkflow(
    decomposition: TaskDecomposition,
    options?: {
      name?: string;
      description?: string;
      timeout?: Duration;
      tags?: string[];
    },
  ): WorkflowDefinition {
    const steps: WorkflowStep[] = decomposition.subtasks.map((sub, i) => {
      const defaultErrorHandling: WorkflowStepErrorHandling = {
        maxRetries: this.config.retryPolicy.maxRetries,
        retryDelay: this.config.retryPolicy.baseDelay,
        fallbackStrategy: this.config.fallbackStrategy,
        timeout: options?.timeout ?? this.config.defaultTimeout,
        onError: "RETRY",
      };

      const step: WorkflowStep = {
        id: sub.id,
        name: sub.description.slice(0, 80),
        type: "TASK",
        dependsOn: sub.dependencies,
        timeout: options?.timeout ?? this.config.defaultTimeout,
        priority: "MEDIUM",
        input: {
          prompt: sub.description,
          parameters: {
            estimatedComplexity: sub.estimatedComplexity,
            requiredCapabilities: sub.requiredCapabilities,
          },
        },
        errorHandling: defaultErrorHandling,
      };

      return step;
    });

    const deps: Record<string, string[]> = {};
    for (const step of steps) {
      deps[step.id] = step.dependsOn;
    }

    const id = `wf_${uuid().slice(0, 12)}`;
    return {
      id,
      name: options?.name ?? `Workflow ${id}`,
      version: "0.1.0" as `${number}.${number}.${number}`,
      description: options?.description ?? decomposition.originalTask,
      steps,
      dependencies: deps,
      timeout: options?.timeout ?? this.config.defaultTimeout,
      tags: options?.tags ?? [],
      errorHandling: {
        globalFallback: this.config.fallbackStrategy,
        stepErrorDefaults: {
          maxRetries: this.config.retryPolicy.maxRetries,
          retryDelay: this.config.retryPolicy.baseDelay,
          fallbackStrategy: this.config.fallbackStrategy,
          timeout: this.config.defaultTimeout,
          onError: "RETRY",
        },
      },
    };
  }

  optimizeWorkflow(definition: WorkflowDefinition): WorkflowDefinition {
    const optimized = this.detectParallelism(definition);
    this.reorderForEfficiency(optimized);
    return optimized;
  }

  assignAgents(
    definition: WorkflowDefinition,
  ): AgentAssignment[] {
    const assignments: AgentAssignment[] = [];

    for (const step of definition.steps) {
      const requiredCaps = step.input?.parameters?.requiredCapabilities as string[] | undefined;
      const available = Array.from(this.agents.entries());

      if (available.length === 0) {
        throw new PlanningError(`No agents available to assign step "${step.id}"`);
      }

      const candidateAgentId = this.selectBestAgent(available, step, requiredCaps);

      assignments.push({
        stepId: step.id,
        agentId: candidateAgentId,
        confidence: 0.85,
        reasoning: `Selected agent ${candidateAgentId} based on capability match and load`,
        estimatedCost: this.agents.get(candidateAgentId)?.cost ?? 0,
        estimatedDuration: this.agents.get(candidateAgentId)?.avgLatency ?? 5000,
      });
    }

    return assignments;
  }

  validatePlan(definition: WorkflowDefinition): PlanValidation {
    const issues: PlanValidation["issues"] = [];

    const stepIds = new Set(definition.steps.map((s) => s.id));
    if (stepIds.size !== definition.steps.length) {
      issues.push({
        severity: "ERROR",
        message: "Duplicate step IDs detected",
      });
    }

    for (const step of definition.steps) {
      if (step.timeout > definition.timeout) {
        issues.push({
          severity: "WARNING",
          message: `Step "${step.id}" timeout exceeds workflow timeout`,
          stepId: step.id,
          suggestion: "Reduce step timeout or increase workflow timeout",
        });
      }

      if (step.type === "LOOP" && step.loopConfig) {
        if (step.loopConfig.maxIterations > 100) {
          issues.push({
            severity: "WARNING",
            message: `Loop step "${step.id}" has high iteration count`,
            stepId: step.id,
            suggestion: "Consider reducing max iterations or adding break condition",
          });
        }
      }

      for (const depId of step.dependsOn) {
        if (!stepIds.has(depId)) {
          issues.push({
            severity: "ERROR",
            message: `Step "${step.id}" depends on non-existent step "${depId}"`,
            stepId: step.id,
            suggestion: `Add step "${depId}" or remove the dependency`,
          });
        }
      }
    }

    try {
      this.checkForCycles(definition);
    } catch (e) {
      if (e instanceof CycleDetectedError) {
        issues.push({
          severity: "ERROR",
          message: e.message,
          suggestion: "Remove circular dependencies",
        });
      }
    }

    const noDependencySteps = definition.steps.filter((s) => s.dependsOn.length === 0);
    if (noDependencySteps.length === 0) {
      issues.push({
        severity: "ERROR",
        message: "No root steps (all steps have dependencies)",
        suggestion: "Add at least one entry point step",
      });
    }

    const estimatedDuration = this.estimateDuration(definition);
    const riskScore = issues.filter((i) => i.severity === "ERROR").length * 25;

    return {
      valid: issues.filter((i) => i.severity === "ERROR").length === 0,
      issues,
      estimatedDuration,
      riskScore: Math.min(100, riskScore),
    };
  }

  replan(
    originalDefinition: WorkflowDefinition,
    failedStepId: string,
    assignments: AgentAssignment[],
  ): { definition: WorkflowDefinition; assignments: AgentAssignment[] } {
    const failedStep = originalDefinition.steps.find((s) => s.id === failedStepId);
    if (!failedStep) {
      throw new PlanningError(`Step "${failedStepId}" not found in workflow`);
    }

    const updatedDefinition: WorkflowDefinition = {
      ...originalDefinition,
      steps: originalDefinition.steps.map((step) => {
        if (step.id === failedStepId) {
          return {
            ...step,
            errorHandling: {
              ...step.errorHandling!,
              maxRetries: Math.max(0, (step.errorHandling?.maxRetries ?? 1) - 1),
              onError: this.config.fallbackStrategy === "ALTERNATIVE_AGENT" ? "FALLBACK" : "RETRY",
            },
          };
        }
        return step;
      }),
    };

    const updatedAssignments = assignments.map((a) => {
      if (a.stepId === failedStepId) {
        const available = Array.from(this.agents.entries())
          .filter(([id]) => id !== assignments.find((x) => x.stepId === failedStepId)?.agentId);

        if (available.length > 0) {
          const altAgentId = available[Math.floor(Math.random() * available.length)][0];
          return {
            ...a,
            agentId: altAgentId,
            confidence: 0.6,
            reasoning: `Reassigned after failure of original agent`,
          };
        }
      }
      return a;
    });

    return { definition: updatedDefinition, assignments: updatedAssignments };
  }

  // ----- private -----

  private inferCapabilities(text: string): string[] {
    const caps: string[] = [];
    const lower = text.toLowerCase();

    if (/code|program|function|implement|script|build|develop/i.test(lower)) caps.push("CODING");
    if (/analyz|review|check|audit|inspect/i.test(lower)) caps.push("ANALYSIS");
    if (/test|assert|verify|validate/i.test(lower)) caps.push("TESTING");
    if (/search|find|lookup|retrieve|query/i.test(lower)) caps.push("SEARCH");
    if (/write|draft|compose|generate|create|document/i.test(lower)) caps.push("GENERATION");
    if (/reason|think|explain|evaluate|compare/i.test(lower)) caps.push("REASONING");
    if (/transform|convert|translate|migrate|refactor/i.test(lower)) caps.push("TRANSFORMATION");

    if (caps.length === 0) caps.push("GENERAL");
    return caps;
  }

  private detectParallelGroups(
    subtasks: TaskDecomposition["subtasks"],
  ): string[][] {
    const groups: string[][] = [];
    const used = new Set<string>();

    for (let i = 0; i < subtasks.length; i++) {
      if (used.has(subtasks[i]!.id)) continue;

      const group = [subtasks[i]!.id];
      used.add(subtasks[i]!.id);

      for (let j = i + 1; j < subtasks.length; j++) {
        const subB = subtasks[j]!;
        if (used.has(subB.id)) continue;

        const sharedDeps = subB.dependencies.filter((d) =>
          subtasks[i]!.dependencies.includes(d),
        );
        const noCrossDep =
          !subB.dependencies.includes(subtasks[i]!.id) &&
          !subtasks[i]!.dependencies.includes(subB.id);

        if (noCrossDep && sharedDeps.length > 0) {
          group.push(subB.id);
          used.add(subB.id);
        }
      }

      if (group.length > 1) groups.push(group);
    }

    return groups;
  }

  private detectParallelism(definition: WorkflowDefinition): WorkflowDefinition {
    const levels = this.buildLevelMap(definition);
    const modified = { ...definition, steps: [...definition.steps] };

    for (const [, levelSteps] of levels) {
      if (levelSteps.length > 1) {
        const changedTypes = modified.steps.map((step) => {
          if (levelSteps.includes(step.id) && step.type === "TASK") {
            return { ...step, type: "TASK" as WorkflowStepType };
          }
          return step;
        });
        modified.steps = changedTypes;
      }
    }

    return modified;
  }

  private reorderForEfficiency(definition: WorkflowDefinition): void {
    definition.steps.sort((a, b) => {
      const aDeps = a.dependsOn.length;
      const bDeps = b.dependsOn.length;
      if (aDeps !== bDeps) return aDeps - bDeps;

      const aPriority = a.priority === "CRITICAL" ? 0 : a.priority === "HIGH" ? 1 : a.priority === "MEDIUM" ? 2 : 3;
      const bPriority = b.priority === "CRITICAL" ? 0 : b.priority === "HIGH" ? 1 : b.priority === "MEDIUM" ? 2 : 3;
      return aPriority - bPriority;
    });
  }

  private selectBestAgent(
    available: [AgentId, { capabilities: string[]; cost: number; avgLatency: Duration; maxConcurrency: number; currentLoad: number }][],
    step: WorkflowStep,
    requiredCaps: string[] | undefined,
  ): AgentId {
    const scored = available.map(([id, info]) => {
      let score = 0;

      if (requiredCaps) {
        const matchCount = requiredCaps.filter((c) =>
          info.capabilities.includes(c),
        ).length;
        score += (matchCount / requiredCaps.length) * 50;
      }

      const loadFactor = 1 - info.currentLoad / info.maxConcurrency;
      score += loadFactor * 25;

      const latencyScore = Math.max(0, 1 - info.avgLatency / this.config.defaultTimeout);
      score += latencyScore * 15;

      const costScore = Math.max(0, 1 - info.cost / 100);
      score += costScore * 10;

      return { id, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]!.id;
  }

  private buildLevelMap(
    definition: WorkflowDefinition,
  ): Map<number, string[]> {
    const levels = new Map<number, string[]>();
    const visited = new Set<string>();

    const visit = (stepId: string, depth: number): void => {
      if (visited.has(stepId)) return;
      visited.add(stepId);

      const existing = levels.get(depth) ?? [];
      existing.push(stepId);
      levels.set(depth, existing);

      for (const step of definition.steps) {
        if (step.dependsOn.includes(stepId)) {
          visit(step.id, depth + 1);
        }
      }
    };

    const roots = definition.steps.filter((s) => s.dependsOn.length === 0);
    for (const root of roots) {
      visit(root.id, 0);
    }

    return levels;
  }

  private checkForCycles(definition: WorkflowDefinition): void {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const parent = new Map<string, string>();

    const dfs = (stepId: string): void => {
      visited.add(stepId);
      recStack.add(stepId);

      const step = definition.steps.find((s) => s.id === stepId);
      if (step) {
        for (const dep of step.dependsOn) {
          if (!visited.has(dep)) {
            parent.set(dep, stepId);
            dfs(dep);
          } else if (recStack.has(dep)) {
            const cycle: string[] = [dep];
            let current = stepId;
            while (current !== dep) {
              cycle.push(current);
              current = parent.get(current) ?? "";
            }
            cycle.push(dep);
            cycle.reverse();
            throw new CycleDetectedError(cycle);
          }
        }
      }

      recStack.delete(stepId);
    };

    for (const step of definition.steps) {
      if (!visited.has(step.id)) {
        dfs(step.id);
      }
    }
  }

  private estimateDuration(definition: WorkflowDefinition): Duration {
    const levels = this.buildLevelMap(definition);
    let total = 0;

    for (const [, steps] of levels) {
      const maxStepDuration = Math.max(
        ...steps.map((id) => {
          const step = definition.steps.find((s) => s.id === id);
          return step?.timeout ?? this.config.defaultTimeout;
        }),
      );
      total += maxStepDuration;
    }

    return total;
  }
}
