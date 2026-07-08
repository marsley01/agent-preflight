import type { Duration, Timestamp, LogLevel } from "@agent-preflight/types";

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string | undefined;
  traceFlags: number;
  traceState: string;
}

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

export enum SpanStatus {
  UNSET = "UNSET",
  OK = "OK",
  ERROR = "ERROR",
}

export enum SpanKind {
  INTERNAL = "INTERNAL",
  SERVER = "SERVER",
  CLIENT = "CLIENT",
  PRODUCER = "PRODUCER",
  CONSUMER = "CONSUMER",
}

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string | undefined;
  name: string;
  kind: SpanKind;
  status: SpanStatus;
  startTime: Timestamp;
  endTime?: Timestamp | undefined;
  duration?: Duration | undefined;
  attributes: SpanAttributes;
  events: SpanEvent[];
  links: SpanLink[];
  resource: Record<string, unknown>;
}

export interface SpanEvent {
  name: string;
  timestamp: Timestamp;
  attributes?: Record<string, unknown> | undefined;
}

export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes?: Record<string, unknown> | undefined;
}

export interface MetricPoint {
  name: string;
  value: number | DistributionValue;
  timestamp: Timestamp;
  attributes: Record<string, string>;
}

export interface DistributionValue {
  count: number;
  sum: number;
  min: number;
  max: number;
}

export interface HistogramBucket {
  bounds: number;
  count: number;
}

export enum AggregationTemporality {
  DELTA = "DELTA",
  CUMULATIVE = "CUMULATIVE",
}

export type MetricType = "COUNTER" | "GAUGE" | "HISTOGRAM";

export interface ExporterConfig {
  type: "CONSOLE" | "OTLP" | "PROMETHEUS" | "DATADOG" | "FILE" | "CUSTOM";
  endpoint?: string | undefined;
  headers?: Record<string, string> | undefined;
  compression?: "gzip" | "none" | undefined;
  batchSize?: number | undefined;
  batchInterval?: Duration | undefined;
}

export interface LogEntry {
  timestamp: Timestamp;
  level: LogLevel;
  severityNumber: number;
  message: string;
  loggerName: string;
  correlationId?: string | undefined;
  traceId?: string | undefined;
  spanId?: string | undefined;
  attributes?: Record<string, unknown> | undefined;
  error?: Error | undefined;
}

export interface HealthCheckResult {
  component: string;
  status: "pass" | "warn" | "fail";
  message?: string | undefined;
  lastChecked: Timestamp;
  latency: Duration;
  details?: Record<string, unknown> | undefined;
}

export type HealthCheckType = "startup" | "liveness" | "readiness";

export interface HealthCheckConfig {
  type: HealthCheckType;
  timeout: Duration;
  interval?: Duration | undefined;
}

export enum SamplingDecision {
  ACCEPT = "ACCEPT",
  DROP = "DROP",
}

export interface SamplingDecisionContext {
  traceId: string;
  spanName: string;
  attributes: SpanAttributes;
  parentSampled?: boolean | undefined;
}

export type SamplingFunction = (context: SamplingDecisionContext) => SamplingDecision;

export interface AlertThreshold {
  metric: string;
  operator: "gt" | "lt" | "gte" | "lte" | "eq";
  value: number;
  window: Duration;
  cooldown: Duration;
}
