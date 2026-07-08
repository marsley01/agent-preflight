import type { ACPAgentId, ACPMessage, ACPObservabilityConfig } from './types.js';
import type { ACPError, ACPErrorCode } from './errors.js';

export interface MetricValue {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'ok' | 'error';
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, unknown>;
}

export interface HealthStatus {
  agentId: ACPAgentId;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeMs: number;
  lastHeartbeat: number;
  messageCount: number;
  errorCount: number;
  activeStreams: number;
  pendingRoutes: number;
  memoryUsageMb: number;
  details: Record<string, unknown>;
}

export class MetricsCollector {
  private readonly metrics: Map<string, MetricValue[]> = new Map();
  private readonly counters: Map<string, number> = new Map();
  private readonly latencies: Map<string, number[]> = new Map();
  private readonly maxHistoryPerMetric: number;

  constructor(maxHistoryPerMetric: number = 1000) {
    this.maxHistoryPerMetric = maxHistoryPerMetric;
  }

  public incrementCounter(name: string, tags: Record<string, string> = {}): void {
    const key = this.buildKey(name, tags);
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);

    this.recordMetric({
      name,
      value: 1,
      tags,
      timestamp: Date.now(),
    });
  }

  public recordLatency(name: string, durationMs: number, tags: Record<string, string> = {}): void {
    const key = this.buildKey(name, tags);
    const existing = this.latencies.get(key) ?? [];
    existing.push(durationMs);
    this.latencies.set(key, existing);

    this.recordMetric({
      name: `${name}_latency`,
      value: durationMs,
      tags,
      timestamp: Date.now(),
    });
  }

  public recordError(code: ACPErrorCode, tags: Record<string, string> = {}): void {
    this.incrementCounter('errors', { ...tags, errorCode: code });
  }

  public recordMetric(metric: MetricValue): void {
    const key = this.buildKey(metric.name, metric.tags);
    const existing = this.metrics.get(key) ?? [];
    existing.push(metric);

    if (existing.length > this.maxHistoryPerMetric) {
      existing.shift();
    }

    this.metrics.set(key, existing);
  }

  public getCounter(name: string, tags: Record<string, string> = {}): number {
    return this.counters.get(this.buildKey(name, tags)) ?? 0;
  }

  public getLatencyStats(name: string, tags: Record<string, string> = {}): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const key = this.buildKey(name, tags);
    const values = this.latencies.get(key) ?? [];

    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)]!,
      p95: sorted[Math.floor(sorted.length * 0.95)]!,
      p99: sorted[Math.floor(sorted.length * 0.99)]!,
    };
  }

  public getMetricHistory(name: string, tags: Record<string, string> = {}): MetricValue[] {
    return this.metrics.get(this.buildKey(name, tags)) ?? [];
  }

  public getAllCounters(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.counters) {
      result[key] = value;
    }
    return result;
  }

  public reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.latencies.clear();
  }

  private buildKey(name: string, tags: Record<string, string>): string {
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return tagString ? `${name}{${tagString}}` : name;
  }
}

export class Tracer {
  private readonly spans: Map<string, TraceSpan> = new Map();
  private readonly spanChildren: Map<string, string[]> = new Map();
  private readonly config: ACPObservabilityConfig['tracing'];
  private readonly sampledTraces: Set<string> = new Set();

  constructor(config?: ACPObservabilityConfig['tracing']) {
    this.config = config;
  }

  public startSpan(
    name: string,
    options?: {
      traceId?: string;
      parentSpanId?: string;
      attributes?: Record<string, unknown>;
    },
  ): TraceSpan {
    if (!this.config?.enabled) {
      return {
        spanId: 'noop',
        traceId: 'noop',
        name,
        startTime: Date.now(),
        status: 'ok',
        attributes: {},
        events: [],
      };
    }

    const shouldSample = this.shouldSample(options?.traceId);
    if (!shouldSample) {
      return {
        spanId: 'not-sampled',
        traceId: options?.traceId ?? 'not-sampled',
        name,
        startTime: Date.now(),
        status: 'ok',
        attributes: {},
        events: [],
      };
    }

    const traceId = options?.traceId ?? this.generateId();
    this.sampledTraces.add(traceId);

    const span: TraceSpan = {
      spanId: this.generateId(),
      traceId,
      parentSpanId: options?.parentSpanId,
      name,
      startTime: Date.now(),
      status: 'ok',
      attributes: options?.attributes ?? {},
      events: [],
    };

    this.spans.set(span.spanId, span);

    if (span.parentSpanId) {
      const siblings = this.spanChildren.get(span.parentSpanId) ?? [];
      siblings.push(span.spanId);
      this.spanChildren.set(span.parentSpanId, siblings);
    }

    return span;
  }

  public endSpan(span: TraceSpan, status: 'ok' | 'error' = 'ok'): void {
    if (span.spanId === 'noop' || span.spanId === 'not-sampled') return;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = status;

    this.spans.set(span.spanId, span);
  }

  public addSpanEvent(span: TraceSpan, name: string, attributes: Record<string, unknown> = {}): void {
    if (span.spanId === 'noop' || span.spanId === 'not-sampled') return;

    const event: SpanEvent = {
      name,
      timestamp: Date.now(),
      attributes,
    };

    span.events.push(event);
  }

  public getSpan(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId);
  }

  public getTrace(traceId: string): TraceSpan[] {
    return [...this.spans.values()].filter((s) => s.traceId === traceId);
  }

  public getSpanChildren(spanId: string): TraceSpan[] {
    const childIds = this.spanChildren.get(spanId) ?? [];
    return childIds.map((id) => this.spans.get(id)).filter(Boolean) as TraceSpan[];
  }

  public injectTraceContext(span: TraceSpan, message: ACPMessage): void {
    if (span.spanId === 'noop' || span.spanId === 'not-sampled') return;

    if (!message.header.metadata) {
      (message.header as Record<string, unknown>).metadata = {};
    }

    const metadata = message.header.metadata as Record<string, unknown>;
    metadata.traceId = span.traceId;
    metadata.spanId = span.spanId;
  }

  public extractTraceContext(message: ACPMessage): {
    traceId?: string;
    parentSpanId?: string;
  } {
    const metadata = message.header.metadata as Record<string, unknown> | undefined;
    if (!metadata) return {};

    return {
      traceId: metadata.traceId as string | undefined,
      parentSpanId: metadata.spanId as string | undefined,
    };
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `${timestamp}-${random}`;
  }

  private shouldSample(traceId?: string): boolean {
    if (!traceId) return Math.random() < (this.config?.samplingRate ?? 1);
    return this.sampledTraces.has(traceId) || Math.random() < (this.config?.samplingRate ?? 1);
  }
}

export class HealthChecker {
  private readonly agentId: ACPAgentId;
  private startTime: number = Date.now();
  private lastHeartbeat: number = Date.now();
  private errorCount: number = 0;
  private messageCount: number = 0;
  private activeStreams: number = 0;
  private pendingRoutes: number = 0;
  private details: Record<string, unknown> = {};

  constructor(agentId: ACPAgentId) {
    this.agentId = agentId;
  }

  public recordHeartbeat(): void {
    this.lastHeartbeat = Date.now();
  }

  public recordMessage(): void {
    this.messageCount++;
  }

  public recordError(): void {
    this.errorCount++;
  }

  public setActiveStreams(count: number): void {
    this.activeStreams = count;
  }

  public setPendingRoutes(count: number): void {
    this.pendingRoutes = count;
  }

  public setDetail(key: string, value: unknown): void {
    this.details[key] = value;
  }

  public getStatus(): HealthStatus {
    const uptimeMs = Date.now() - this.startTime;

    let status: HealthStatus['status'] = 'healthy';

    if (this.errorCount > 100 || Date.now() - this.lastHeartbeat > 60_000) {
      status = 'degraded';
    }

    if (this.errorCount > 1000 || Date.now() - this.lastHeartbeat > 300_000) {
      status = 'unhealthy';
    }

    return {
      agentId: this.agentId,
      status,
      uptimeMs,
      lastHeartbeat: this.lastHeartbeat,
      messageCount: this.messageCount,
      errorCount: this.errorCount,
      activeStreams: this.activeStreams,
      pendingRoutes: this.pendingRoutes,
      memoryUsageMb: Math.round(process.memoryUsage?.()?.heapUsed
        ? process.memoryUsage().heapUsed / 1024 / 1024
        : 0),
      details: { ...this.details },
    };
  }

  public reset(): void {
    this.startTime = Date.now();
    this.lastHeartbeat = Date.now();
    this.errorCount = 0;
    this.messageCount = 0;
    this.activeStreams = 0;
    this.pendingRoutes = 0;
    this.details = {};
  }
}
