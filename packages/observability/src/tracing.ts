import { v4 as uuidv4 } from "uuid";
import type { Timestamp, Duration } from "@agent-preflight/types";
import {
  type SpanContext,
  type SpanAttributes,
  SpanStatus,
  SpanKind,
  type Span,
  type SpanEvent,
  type SpanLink,
  type ExporterConfig,
  type SamplingDecisionContext,
  type SamplingFunction,
} from "./types.js";

import { SamplingDecision } from "./types.js";

let _tracerInstance: Tracer | null = null;

export function getTracer(): Tracer {
  if (!_tracerInstance) {
    _tracerInstance = new Tracer();
  }
  return _tracerInstance;
}

export function setTracer(tracer: Tracer): void {
  _tracerInstance = tracer;
}

export interface SpanExporter {
  export(spans: Span[]): Promise<void>;
  shutdown(): Promise<void>;
}

class ConsoleSpanExporter implements SpanExporter {
  async export(spans: Span[]): Promise<void> {
    for (const span of spans) {
      console.log(JSON.stringify(span));
    }
  }

  async shutdown(): Promise<void> {
  }
}

class BatchSpanProcessor {
  private spans: Span[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly exporter: SpanExporter;
  private readonly batchSize: number;
  private readonly batchInterval: Duration;

  constructor(
    exporter: SpanExporter,
    batchSize: number = 64,
    batchInterval: Duration = 5000,
  ) {
    this.exporter = exporter;
    this.batchSize = batchSize;
    this.batchInterval = batchInterval;
  }

  start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      void this.flush();
    }, this.batchInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async addSpan(span: Span): Promise<void> {
    this.spans.push(span);
    if (this.spans.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.spans.length === 0) return;
    const batch = this.spans.splice(0);
    await this.exporter.export(batch);
  }

  async shutdown(): Promise<void> {
    this.stop();
    await this.flush();
    await this.exporter.shutdown();
  }
}

function getDefaultTimestamp(): Timestamp {
  return new Date().toISOString();
}

function generateSpanId(): string {
  return uuidv4().replace(/-/g, "").slice(0, 16);
}

function generateTraceId(): string {
  return uuidv4().replace(/-/g, "");
}

type TraceContextHeaders = {
  traceparent: string;
  tracestate: string;
  baggage?: string | undefined;
};

export class Tracer {
  private spans: Map<string, Span> = new Map();
  private activeSpanStack: Map<string, string[]> = new Map();
  private processor: BatchSpanProcessor;
  private sampler: SamplingFunction;
  private resource: Record<string, unknown>;

  constructor(
    exporter?: SpanExporter | undefined,
    config?: Partial<{
      batchSize: number;
      batchInterval: Duration;
      sampler: SamplingFunction;
      resource: Record<string, unknown>;
    }> | undefined,
  ) {
    const spanExporter = exporter ?? new ConsoleSpanExporter();
    this.processor = new BatchSpanProcessor(
      spanExporter,
      config?.batchSize ?? 64,
      config?.batchInterval ?? 5000,
    );
    this.sampler = config?.sampler ?? alwaysSample;
    this.resource = config?.resource ?? {};
    this.processor.start();
  }

  startSpan(
    name: string,
    options?: Partial<{
      kind: SpanKind;
      attributes: SpanAttributes;
      parentSpanId: string | null;
      links: SpanLink[];
      startTime: Timestamp;
    }> | undefined,
  ): Span {
    const traceId = generateTraceId();
    const spanId = generateSpanId();
    const parentSpanId = options?.parentSpanId ?? this.getCurrentSpanId();
    const kind = options?.kind ?? SpanKind.INTERNAL;
    const startTime = options?.startTime ?? getDefaultTimestamp();

    const samplingContext: SamplingDecisionContext = {
      traceId,
      spanName: name,
      attributes: options?.attributes ?? {},
      parentSampled: parentSpanId ? this.spans.get(parentSpanId) !== undefined : undefined,
    };

    if (this.sampler(samplingContext) === SamplingDecision.DROP) {
      const droppedSpan: Span = {
        spanId,
        traceId,
        parentSpanId: parentSpanId ?? undefined,
        name,
        kind,
        status: SpanStatus.UNSET,
        startTime,
        attributes: options?.attributes ?? {},
        events: [],
        links: options?.links ?? [],
        resource: this.resource,
      };
      return droppedSpan;
    }

    const span: Span = {
      spanId,
      traceId,
      parentSpanId: parentSpanId ?? undefined,
      name,
      kind,
      status: SpanStatus.UNSET,
      startTime,
      attributes: options?.attributes ?? {},
      events: [],
      links: options?.links ?? [],
      resource: { ...this.resource },
    };

    this.spans.set(spanId, span);
    this.pushActiveSpan(spanId);

    return span;
  }

  endSpan(spanId: string, endTime?: Timestamp | undefined): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    const resolvedEndTime = endTime ?? getDefaultTimestamp();
    span.endTime = resolvedEndTime;
    span.duration = new Date(resolvedEndTime).getTime() - new Date(span.startTime).getTime();

    this.popActiveSpan(spanId);

    void this.processor.addSpan(span);
    this.spans.delete(spanId);
  }

  setAttribute(spanId: string, key: string, value: string | number | boolean): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.attributes[key] = value;
  }

  setStatus(spanId: string, status: SpanStatus): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.status = status;
  }

  addEvent(spanId: string, name: string, attributes?: Record<string, unknown> | undefined): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    const event: SpanEvent = {
      name,
      timestamp: getDefaultTimestamp(),
      attributes,
    };
    span.events.push(event);
  }

  getCurrentSpanId(): string | undefined {
    return undefined;
  }

  getCurrentSpan(): Span | undefined {
    const spanId = this.getCurrentSpanId();
    return spanId ? this.spans.get(spanId) : undefined;
  }

  injectContext(spanId: string): TraceContextHeaders {
    const span = this.spans.get(spanId);
    if (!span) {
      return {
        traceparent: "",
        tracestate: "",
      };
    }
    const version = "00";
    const traceFlags = "01";
    const traceparent = `${version}-${span.traceId}-${span.spanId}-${traceFlags}`;
    return {
      traceparent,
      tracestate: "",
    };
  }

  extractContext(headers: TraceContextHeaders): SpanContext | null {
    const match = headers.traceparent.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);
    if (!match) return null;
    return {
      traceId: match[1]!,
      spanId: match[2]!,
      traceFlags: parseInt(match[3]!, 16),
      traceState: headers.tracestate ?? "",
    };
  }

  async shutdown(): Promise<void> {
    this.processor.stop();
    await this.processor.flush();
    await this.processor.shutdown();
  }

  private pushActiveSpan(spanId: string): void {
    const key = "default";
    const stack = this.activeSpanStack.get(key) ?? [];
    stack.push(spanId);
    this.activeSpanStack.set(key, stack);
  }

  private popActiveSpan(spanId: string): void {
    const key = "default";
    const stack = this.activeSpanStack.get(key);
    if (!stack) return;
    const idx = stack.lastIndexOf(spanId);
    if (idx !== -1) {
      stack.splice(idx, 1);
    }
    if (stack.length === 0) {
      this.activeSpanStack.delete(key);
    }
  }
}

export const alwaysSample: SamplingFunction = () => SamplingDecision.ACCEPT;

export const neverSample: SamplingFunction = () => SamplingDecision.DROP;

export function rateBasedSample(rate: number): SamplingFunction {
  return (context: SamplingDecisionContext) => {
    const hash = hashTraceId(context.traceId);
    return hash < rate ? SamplingDecision.ACCEPT : SamplingDecision.DROP;
  };
}

function hashTraceId(traceId: string): number {
  let hash = 0;
  for (let i = 0; i < traceId.length; i++) {
    const char = traceId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash % 100) / 100;
}

export function createSpanProcessor(config: ExporterConfig): BatchSpanProcessor {
  const exporter = createExporter(config);
  return new BatchSpanProcessor(
    exporter,
    config.batchSize ?? 64,
    config.batchInterval ?? 5000,
  );
}

function createExporter(config: ExporterConfig): SpanExporter {
  switch (config.type) {
    case "CONSOLE":
      return new ConsoleSpanExporter();
    case "OTLP":
      return new OTLPSpanExporter(config);
    default:
      return new ConsoleSpanExporter();
  }
}

class OTLPSpanExporter implements SpanExporter {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;

  constructor(config: ExporterConfig) {
    this.endpoint = config.endpoint ?? "http://localhost:4318/v1/traces";
    this.headers = config.headers ?? {};
  }

  async export(_spans: Span[]): Promise<void> {
    try {
      const body = JSON.stringify(this.toOTLPProto(_spans));
      await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body,
      });
    } catch {
    }
  }

  async shutdown(): Promise<void> {
  }

  private toOTLPProto(spans: Span[]): unknown {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [],
          },
          scopeSpans: [
            {
              scope: { name: "@agent-preflight/observability" },
              spans: spans.map((s) => ({
                traceId: s.traceId,
                spanId: s.spanId,
                parentSpanId: s.parentSpanId ?? "",
                name: s.name,
                kind: SpanKind[s.kind],
                startTimeUnixNano: new Date(s.startTime).getTime() * 1_000_000,
                endTimeUnixNano: s.endTime ? new Date(s.endTime).getTime() * 1_000_000 : 0,
                attributes: Object.entries(s.attributes).map(([k, v]) => ({
                  key: k,
                  value: { stringValue: String(v) },
                })),
                status: {
                  code: s.status === SpanStatus.ERROR ? 2 : s.status === SpanStatus.OK ? 1 : 0,
                },
              })),
            },
          ],
        },
      ],
    };
  }
}

export { BatchSpanProcessor };
export type { TraceContextHeaders };
