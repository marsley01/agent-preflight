import { v4 as uuid } from "uuid";
import type {
  AgentId,
  Duration,
  TaskId,
  TaskInput,
  TaskOutput,
  TaskStatus,
  TaskPriority,
  TaskContext,
  TaskResult,
  Timestamp,
  ErrorDetail,
} from "@agent-preflight/types";
import type {
  DelegationRequest,
  DelegationResult,
  ConflictResolution,
} from "./types.js";
import { CoordinationError } from "./errors.js";

export interface CoordinatorOptions {
  protocol: "DIRECT" | "MESH" | "BROKERED";
  heartbeatInterval: Duration;
  healthCheckInterval: Duration;
  failureDetectionTimeout: Duration;
  autoReconnect: boolean;
  maxRetries: number;
}

interface PendingDelegation {
  request: DelegationRequest;
  status: "PENDING" | "IN_FLIGHT" | "COMPLETED" | "FAILED" | "TIMEOUT";
  result?: DelegationResult | undefined;
  startedAt: Timestamp;
  completedAt?: Timestamp | undefined;
  retryCount: number;
}

export class Coordinator {
  private readonly options: CoordinatorOptions;
  private delegations: Map<string, PendingDelegation> = new Map();
  private agentHealth: Map<AgentId, { healthy: boolean; lastSeen: Timestamp; failureCount: number }> = new Map();
  private pendingResults: Map<string, DelegationResult[]> = new Map();

  constructor(options: CoordinatorOptions) {
    this.options = options;
  }

  async delegateTask(request: DelegationRequest): Promise<DelegationResult> {
    const delegationId = `del_${uuid().slice(0, 12)}`;

    const pending: PendingDelegation = {
      request,
      status: "PENDING",
      startedAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.delegations.set(delegationId, pending);

    try {
      pending.status = "IN_FLIGHT";
      this.updateAgentHealth(request.targetAgentId, true);

      const result = await this.sendDelegation(request);

      pending.status = "COMPLETED";
      pending.result = result;
      pending.completedAt = new Date().toISOString();

      this.collectResult(result);
      return result;
    } catch (error) {
      pending.status = "FAILED";
      pending.completedAt = new Date().toISOString();

      const isRetryable = this.isRetryableError(error);

      if (isRetryable && pending.retryCount < this.options.maxRetries) {
        pending.retryCount++;
        const backoff = Math.min(
          30000,
          this.options.heartbeatInterval * Math.pow(2, pending.retryCount),
        );
        await this.delay(backoff);
        return this.delegateTask(request);
      }

      this.handleAgentFailure(request.targetAgentId);

      const errorDetail: ErrorDetail = {
        code: "DELEGATION_FAILED",
        message: error instanceof Error ? error.message : "Delegation failed",
        details: { delegationId, retryCount: pending.retryCount },
      };

      return {
        taskId: request.taskId,
        agentId: request.targetAgentId,
        status: "FAILED",
        error: errorDetail,
        duration: 0,
      };
    }
  }

  async collectResults(
    taskIds: TaskId[],
    timeout: Duration = 30000,
  ): Promise<Map<TaskId, DelegationResult>> {
    const results = new Map<TaskId, DelegationResult>();
    const deadline = Date.now() + timeout;

    for (const taskId of taskIds) {
      const collected = this.pendingResults.get(taskId);
      if (collected && collected.length > 0) {
        results.set(taskId, collected[collected.length - 1]!);
        this.pendingResults.delete(taskId);
      }
    }

    const remaining = taskIds.filter((id) => !results.has(id));
    const pollInterval = 100;

    while (remaining.length > 0 && Date.now() < deadline) {
      for (let i = remaining.length - 1; i >= 0; i--) {
        const id = remaining[i]!;
        const collected = this.pendingResults.get(id);
        if (collected && collected.length > 0) {
          results.set(id, collected[collected.length - 1]!);
          this.pendingResults.delete(id);
          remaining.splice(i, 1);
        }
      }
      if (remaining.length > 0) {
        await this.delay(pollInterval);
      }
    }

    return results;
  }

  resolveConflicts(
    results: Map<TaskId, DelegationResult[]>,
  ): ConflictResolution {
    const conflicts: ConflictResolution["conflicts"] = [];

    for (const [stepId, agentResults] of results) {
      if (agentResults.length <= 1) continue;

      const differingOutputs = new Map<AgentId, unknown>();
      for (const r of agentResults) {
        differingOutputs.set(r.agentId, r.output?.data);
      }

      const uniqueOutputs = new Set(
        agentResults.map((r) => JSON.stringify(r.output?.data)),
      );

      if (uniqueOutputs.size > 1) {
        const outputCounts = new Map<string, number>();
        for (const r of agentResults) {
          const key = JSON.stringify(r.output?.data);
          outputCounts.set(key, (outputCounts.get(key) ?? 0) + 1);
        }

        let resolvedOutput: unknown;
        let resolutionStrategy: ConflictResolution["conflicts"][number]["resolutionStrategy"] = "MAJORITY";

        const maxCount = Math.max(...outputCounts.values());
        const majority = maxCount > agentResults.length / 2;

        if (majority) {
          const majorityKey = Array.from(outputCounts.entries()).find(
            ([, count]) => count === maxCount,
          )![0];
          resolvedOutput = JSON.parse(majorityKey);
          resolutionStrategy = "MAJORITY";
        } else {
          const latestResult = agentResults.reduce((latest, r) =>
            (r.duration ?? 0) > (latest.duration ?? 0) ? r : latest,
          );
          resolvedOutput = latestResult.output?.data;
          resolutionStrategy = "LATEST";
        }

        const confidence = maxCount / agentResults.length;

        conflicts.push({
          stepId,
          agents: agentResults.map((r) => r.agentId),
          differingOutputs,
          resolvedOutput,
          resolutionStrategy,
          confidence,
        });
      }
    }

    return { conflicts };
  }

  synthesizeResults(
    results: DelegationResult[],
    strategy: "CONCATENATE" | "MERGE" | "VOTE" | "PRIORITY" = "CONCATENATE",
  ): TaskOutput {
    const textParts: string[] = [];
    const dataParts: unknown[] = [];

    for (const result of results) {
      if (result.output?.text) textParts.push(result.output.text);
      if (result.output?.data != null) dataParts.push(result.output.data);
    }

    let synthesizedText: string | undefined;
    let synthesizedData: unknown | undefined;

    switch (strategy) {
      case "CONCATENATE":
        synthesizedText = textParts.join("\n\n---\n\n");
        synthesizedData = dataParts;
        break;

      case "MERGE": {
        const merged: Record<string, unknown> = {};
        for (const data of dataParts) {
          if (typeof data === "object" && data !== null) {
            Object.assign(merged, data as Record<string, unknown>);
          }
        }
        synthesizedData = merged;
        synthesizedText = textParts.join("\n");
        break;
      }

      case "VOTE": {
        const textCounts = new Map<string, number>();
        for (const text of textParts) {
          textCounts.set(text, (textCounts.get(text) ?? 0) + 1);
        }
        const maxVotes = Math.max(...textCounts.values());
        const winner = Array.from(textCounts.entries()).find(
          ([, count]) => count === maxVotes,
        )![0];
        synthesizedText = winner;
        break;
      }

      case "PRIORITY":
        synthesizedText = textParts[0];
        synthesizedData = dataParts[0];
        break;
    }

    return {
      text: synthesizedText,
      data: synthesizedData,
    };
  }

  manageDependencies(
    dependencies: Map<TaskId, TaskId[]>,
    completed: Set<TaskId>,
  ): { ready: TaskId[]; blocked: TaskId[] } {
    const ready: TaskId[] = [];
    const blocked: TaskId[] = [];

    for (const [taskId, deps] of dependencies) {
      const allMet = deps.every((dep) => completed.has(dep));
      if (allMet) {
        ready.push(taskId);
      } else {
        blocked.push(taskId);
      }
    }

    return { ready, blocked };
  }

  handleAgentFailure(agentId: AgentId): void {
    const health = this.agentHealth.get(agentId);
    if (health) {
      health.healthy = false;
      health.failureCount++;
    } else {
      this.agentHealth.set(agentId, {
        healthy: false,
        lastSeen: new Date().toISOString(),
        failureCount: 1,
      });
    }

    const affectedDelegations = Array.from(this.delegations.entries()).filter(
      ([, d]) =>
        d.request.targetAgentId === agentId && d.status === "IN_FLIGHT",
    );

    for (const [id] of affectedDelegations) {
      const delegation = this.delegations.get(id)!;
      delegation.status = "FAILED";
      delegation.completedAt = new Date().toISOString();
    }
  }

  getAgentHealth(agentId: AgentId): { healthy: boolean; lastSeen: Timestamp; failureCount: number } | null {
    return this.agentHealth.get(agentId) ?? null;
  }

  getActiveDelegations(): number {
    return Array.from(this.delegations.values()).filter(
      (d) => d.status === "IN_FLIGHT" || d.status === "PENDING",
    ).length;
  }

  // ----- private -----

  private async sendDelegation(
    request: DelegationRequest,
  ): Promise<DelegationResult> {
    const startTime = Date.now();

    const simulatedLatency = 50 + Math.random() * 200;
    await this.delay(simulatedLatency);

    return {
      taskId: request.taskId,
      agentId: request.targetAgentId,
      status: "COMPLETED",
      output: {
        text: `Delegated task ${request.taskId} executed by ${request.targetAgentId}`,
        data: { delegated: true, correlationId: request.correlationId },
      },
      duration: Date.now() - startTime,
      metrics: {
        processingTime: simulatedLatency,
        tokensUsed: Math.floor(Math.random() * 1000),
      },
    };
  }

  private collectResult(result: DelegationResult): void {
    const existing = this.pendingResults.get(result.taskId) ?? [];
    existing.push(result);
    this.pendingResults.set(result.taskId, existing);
  }

  private updateAgentHealth(agentId: AgentId, healthy: boolean): void {
    const existing = this.agentHealth.get(agentId);
    if (existing) {
      existing.healthy = healthy;
      existing.lastSeen = new Date().toISOString();
      if (healthy) existing.failureCount = 0;
    } else {
      this.agentHealth.set(agentId, {
        healthy,
        lastSeen: new Date().toISOString(),
        failureCount: 0,
      });
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof CoordinationError) return true;
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes("timeout") ||
        msg.includes("unavailable") ||
        msg.includes("retry") ||
        msg.includes("rate limit") ||
        msg.includes("too many requests")
      );
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
