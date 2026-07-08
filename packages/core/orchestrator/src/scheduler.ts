import { v4 as uuid } from "uuid";
import type {
  AgentId,
  Duration,
  TaskId,
  TaskPriority,
  TaskInput,
  Timestamp,
  AgentInfo,
  TaskStatus,
} from "@agent-preflight/types";
import type {
  ScheduledTask,
  SchedulingStrategy,
  OrchestrationStrategy,
  OrchestrationConfig,
} from "./types.js";
import { SchedulingError } from "./errors.js";

export interface SchedulerOptions {
  config: OrchestrationConfig;
}

export class Scheduler {
  private readonly config: OrchestrationConfig;
  private queue: ScheduledTask[] = [];
  private running: Map<TaskId, ScheduledTask> = new Map();
  private completed: Map<TaskId, ScheduledTask> = new Map();
  private cancelled: Set<TaskId> = new Set();

  constructor(options: SchedulerOptions) {
    this.config = options.config;
  }

  schedule(
    tasks: Omit<ScheduledTask, "id" | "status" | "createdAt">[],
  ): ScheduledTask[] {
    const now = new Date().toISOString();
    const scheduled: ScheduledTask[] = tasks.map((t) => ({
      ...t,
      id: `t_${uuid().slice(0, 12)}`,
      status: "QUEUED" as const,
      createdAt: now,
    }));

    const prioritised = this.prioritize(scheduled);

    const availableSlots = this.config.scheduling.queueMaxSize - this.queue.length;
    if (availableSlots <= 0) {
      throw new SchedulingError("Scheduling queue is full");
    }

    const accepted = prioritised.slice(0, availableSlots);
    this.queue.push(...accepted);

    return accepted;
  }

  prioritize(tasks: ScheduledTask[]): ScheduledTask[] {
    const priorityRank: Record<TaskPriority, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };

    return [...tasks].sort((a, b) => {
      const pa = priorityRank[a.priority] ?? 2;
      const pb = priorityRank[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;

      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  distribute(
    tasks: ScheduledTask[],
    agents: AgentInfo[],
  ): Map<AgentId, ScheduledTask[]> {
    const distribution = new Map<AgentId, ScheduledTask[]>();
    for (const agent of agents) {
      distribution.set(agent.id, []);
    }

    if (agents.length === 0) {
      throw new SchedulingError("No agents available for distribution");
    }

    const sorted = this.prioritize(tasks);

    for (const task of sorted) {
      const targetAgent = agents.find((a) => a.id === task.agentId);
      if (targetAgent && targetAgent.status === "IDLE") {
        distribution.get(targetAgent.id)!.push(task);
      } else {
        const idleAgent = agents.find(
          (a) => a.status === "IDLE" || a.status === "IDLE",
        );
        if (idleAgent) {
          distribution.get(idleAgent.id)!.push(task);
        } else {
          const leastBusy = agents.reduce((best, agent) => {
            const bestLoad = distribution.get(best.id)?.length ?? 0;
            const agentLoad = distribution.get(agent.id)?.length ?? 0;
            return agentLoad < bestLoad ? agent : best;
          });
          distribution.get(leastBusy.id)!.push(task);
        }
      }
    }

    return distribution;
  }

  backfill(agents: AgentInfo[]): ScheduledTask[] {
    const backfilled: ScheduledTask[] = [];

    for (const agent of agents) {
      if (agent.status !== "IDLE") continue;

      const agentLoad = Array.from(this.running.values()).filter(
        (t) => t.agentId === agent.id,
      ).length;
      const maxPerAgent = this.config.maxAgentsPerWorkflow;

      if (agentLoad >= maxPerAgent) continue;

      const slots = maxPerAgent - agentLoad;
      const queuedForAgent = this.queue.filter(
        (t) => t.agentId === agent.id && t.status === "QUEUED",
      );

      const toAssign = queuedForAgent.slice(0, slots);
      for (const task of toAssign) {
        task.status = "ASSIGNED";
        task.startedAt = new Date().toISOString();
        this.running.set(task.id, task);
        backfilled.push(task);
      }

      this.queue = this.queue.filter((t) => !toAssign.includes(t));
    }

    return backfilled;
  }

  cancel(taskId: TaskId): ScheduledTask | null {
    const queued = this.queue.find((t) => t.id === taskId);
    if (queued) {
      queued.status = "CANCELLED";
      this.queue = this.queue.filter((t) => t.id !== taskId);
      this.cancelled.add(taskId);
      this.completed.set(taskId, queued);
      return queued;
    }

    const running = this.running.get(taskId);
    if (running) {
      running.status = "CANCELLED";
      this.running.delete(taskId);
      this.cancelled.add(taskId);
      this.completed.set(taskId, running);
      return running;
    }

    return null;
  }

  getNextTask(): ScheduledTask | null {
    const available = this.queue.filter(
      (t) => t.status === "QUEUED",
    );

    if (available.length === 0) return null;

    const prioritised = this.prioritize(available);
    const next = prioritised[0]!;
    next.status = "ASSIGNED";
    next.startedAt = new Date().toISOString();

    this.queue = this.queue.filter((t) => t.id !== next.id);
    this.running.set(next.id, next);

    return next;
  }

  completeTask(taskId: TaskId, result?: { status: TaskStatus }): ScheduledTask | null {
    const task = this.running.get(taskId);
    if (!task) return null;

    task.status = result?.status ?? "COMPLETED";
    task.completedAt = new Date().toISOString();
    this.running.delete(taskId);
    this.completed.set(taskId, task);

    return task;
  }

  failTask(taskId: TaskId, error?: Error): ScheduledTask | null {
    const task = this.running.get(taskId) ?? this.queue.find((t) => t.id === taskId);
    if (!task) return null;

    task.status = "FAILED";
    task.completedAt = new Date().toISOString();
    this.running.delete(taskId);
    this.queue = this.queue.filter((t) => t.id !== taskId);
    this.completed.set(taskId, task);

    return task;
  }

  getQueue(): ScheduledTask[] {
    return [...this.queue];
  }

  getRunning(): ScheduledTask[] {
    return Array.from(this.running.values());
  }

  getCompleted(): ScheduledTask[] {
    return Array.from(this.completed.values());
  }

  getQueueDepth(): number {
    return this.queue.length;
  }

  getRunningCount(): number {
    return this.running.size;
  }

  isFull(): boolean {
    return this.queue.length >= this.config.scheduling.queueMaxSize;
  }

  clear(): void {
    this.queue = [];
    this.running.clear();
    this.completed.clear();
    this.cancelled.clear();
  }
}
