import { v4 as uuidv4 } from "uuid";
import type { AgentId, LogLevel } from "@agent-preflight/types";
import type { AnalyticsEvent, AnalyticsEventType } from "./types.js";

export interface TrackerConfig {
  host?: string | undefined;
  environment?: string | undefined;
  version?: string | undefined;
  batchSize?: number | undefined;
  flushIntervalMs?: number | undefined;
  maxBufferSize?: number | undefined;
}

export interface EventHandler {
  (events: AnalyticsEvent[]): Promise<void>;
}

export class AnalyticsTracker {
  private buffer: AnalyticsEvent[] = [];
  private flushIntervalId: ReturnType<typeof setInterval> | null = null;
  private handlers: EventHandler[] = [];
  private cfg!: { host: string; environment: string; version: string; batchSize: number; flushIntervalMs: number; maxBufferSize: number };

  constructor(config?: TrackerConfig | undefined) {
    this.cfg = {
      host: config?.host ?? "localhost",
      environment: config?.environment ?? "development",
      version: config?.version ?? "0.1.0",
      batchSize: config?.batchSize ?? 50,
      flushIntervalMs: config?.flushIntervalMs ?? 10000,
      maxBufferSize: config?.maxBufferSize ?? 10000,
    };

    if (this.cfg!.flushIntervalMs > 0) {
      this.flushIntervalId = setInterval(() => {
        void this.flush();
      }, this.cfg!.flushIntervalMs);
    }
  }

  addHandler(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: EventHandler): void {
    const idx = this.handlers.indexOf(handler);
    if (idx !== -1) {
      this.handlers.splice(idx, 1);
    }
  }

  track(
    name: AnalyticsEventType,
    properties?: Record<string, unknown> | undefined,
    options?: Partial<{
      userId: string;
      sessionId: string;
      correlationId: string;
      agentId: AgentId;
      taskId: string;
      severity: LogLevel;
    }> | undefined,
  ): string {
    const id = uuidv4();

    const event: AnalyticsEvent = {
      id,
      name,
      properties: {
        ...properties,
        _environment: this.cfg.environment,
        _version: this.cfg.version,
        _host: this.cfg.host,
        _flushIntervalMs: this.cfg.flushIntervalMs,
        _timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      userId: options?.userId,
      sessionId: options?.sessionId,
      correlationId: options?.correlationId,
      agentId: options?.agentId,
      taskId: options?.taskId,
      severity: options?.severity,
    };

    this.buffer.push(event);

    if (this.buffer.length >= this.cfg!.batchSize) {
      void this.flush();
    }

    if (this.buffer.length > this.cfg!.maxBufferSize) {
      const overflow = this.buffer.splice(0, this.buffer.length - this.cfg!.maxBufferSize);
      console.warn(`Analytics buffer overflow: dropped ${overflow.length} events`);
    }

    return id;
  }

  agentStarted(agentId: AgentId, properties?: Record<string, unknown>): string {
    return this.track("agent_started", properties, { agentId });
  }

  agentCompleted(agentId: AgentId, properties?: Record<string, unknown>): string {
    return this.track("agent_completed", properties, { agentId });
  }

  agentFailed(agentId: AgentId, properties?: Record<string, unknown>): string {
    return this.track("agent_failed", properties, { agentId });
  }

  taskDelegated(taskId: string, properties?: Record<string, unknown>): string {
    return this.track("task_delegated", properties, { taskId });
  }

  taskCompleted(taskId: string, properties?: Record<string, unknown>): string {
    return this.track("task_completed", properties, { taskId });
  }

  toolCalled(properties?: Record<string, unknown>): string {
    return this.track("tool_called", properties);
  }

  modelRequest(properties?: Record<string, unknown>): string {
    return this.track("model_request", properties);
  }

  modelResponse(properties?: Record<string, unknown>): string {
    return this.track("model_response", properties);
  }

  memoryAccess(properties?: Record<string, unknown>): string {
    return this.track("memory_access", properties);
  }

  securityEvent(properties?: Record<string, unknown>): string {
    return this.track("security_event", properties, { severity: "WARN" });
  }

  errorOccurred(properties?: Record<string, unknown>): string {
    return this.track("error_occurred", properties, { severity: "ERROR" });
  }

  custom(name: string, properties?: Record<string, unknown>): string {
    return this.track("custom", { ...properties, customEventName: name });
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    await Promise.all(this.handlers.map((h) => h(batch)));
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  async shutdown(): Promise<void> {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
    await this.flush();
  }
}
