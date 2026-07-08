import {
  type MetricPoint,
  type DistributionValue,
  type HistogramBucket,
  type ExporterConfig,
  AggregationTemporality,
  type MetricType,
} from "./types.js";

export interface MeterProvider {
  createCounter(name: string, options?: MetricOptions): Counter;
  createGauge(name: string, options?: MetricOptions): Gauge;
  createHistogram(name: string, options?: MetricOptions): Histogram;
}

export interface MetricOptions {
  description?: string | undefined;
  unit?: string | undefined;
  attributes?: Record<string, string> | undefined;
}

export interface Counter {
  add(value: number, attributes?: Record<string, string>): void;
  reset(): void;
}

export interface Gauge {
  record(value: number, attributes?: Record<string, string>): void;
}

export interface Histogram {
  record(value: number, attributes?: Record<string, string>): void;
}

interface Instrument {
  name: string;
  type: MetricType;
  options: MetricOptions;
  collect(): MetricPoint[];
}

class CounterInstrument implements Instrument {
  readonly name: string;
  readonly type: MetricType = "COUNTER";
  readonly options: MetricOptions;
  private value = 0;
  private defaultAttributes: Record<string, string>;

  constructor(name: string, options: MetricOptions = {}) {
    this.name = name;
    this.options = options;
    this.defaultAttributes = options.attributes ?? {};
  }

  add(value: number, attributes?: Record<string, string>): void {
    this.value += value;
    void attributes;
  }

  reset(): void {
    this.value = 0;
  }

  collect(): MetricPoint[] {
    const point: MetricPoint = {
      name: this.name,
      value: this.value,
      timestamp: new Date().toISOString(),
      attributes: { ...this.defaultAttributes },
    };
    this.value = 0;
    return [point];
  }
}

class GaugeInstrument implements Instrument {
  readonly name: string;
  readonly type: MetricType = "GAUGE";
  readonly options: MetricOptions;
  private currentValue = 0;
  private defaultAttributes: Record<string, string>;

  constructor(name: string, options: MetricOptions = {}) {
    this.name = name;
    this.options = options;
    this.defaultAttributes = options.attributes ?? {};
  }

  record(value: number, _attributes?: Record<string, string>): void {
    this.currentValue = value;
  }

  collect(): MetricPoint[] {
    const point: MetricPoint = {
      name: this.name,
      value: this.currentValue,
      timestamp: new Date().toISOString(),
      attributes: { ...this.defaultAttributes },
    };
    return [point];
  }
}

class HistogramInstrument implements Instrument {
  readonly name: string;
  readonly type: MetricType = "HISTOGRAM";
  readonly options: MetricOptions;
  private values: number[] = [];
  private defaultAttributes: Record<string, string>;

  constructor(name: string, options: MetricOptions = {}) {
    this.name = name;
    this.options = options;
    this.defaultAttributes = options.attributes ?? {};
  }

  record(value: number, _attributes?: Record<string, string>): void {
    this.values.push(value);
  }

  collect(): MetricPoint[] {
    if (this.values.length === 0) {
      return [];
    }
    const sorted = [...this.values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const distribution: DistributionValue = {
      count: sorted.length,
      sum,
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
    };
    const point: MetricPoint = {
      name: this.name,
      value: distribution,
      timestamp: new Date().toISOString(),
      attributes: { ...this.defaultAttributes },
    };
    this.values = [];
    return [point];
  }
}

export class MetricsRegistry implements MeterProvider {
  private instruments: Map<string, Instrument> = new Map();
  private exporters: MetricExporter[] = [];
  private collectionIntervalId: ReturnType<typeof setInterval> | null = null;
  private aggregationTemporality: AggregationTemporality;

  constructor(temporality: AggregationTemporality = AggregationTemporality.DELTA) {
    this.aggregationTemporality = temporality;
  }

  createCounter(name: string, options?: MetricOptions): Counter {
    const existing = this.instruments.get(name);
    if (existing) return existing as unknown as Counter;

    const instrument = new CounterInstrument(name, options);
    this.instruments.set(name, instrument);
    return instrument;
  }

  createGauge(name: string, options?: MetricOptions): Gauge {
    const existing = this.instruments.get(name);
    if (existing) return existing as unknown as Gauge;

    const instrument = new GaugeInstrument(name, options);
    this.instruments.set(name, instrument);
    return instrument;
  }

  createHistogram(name: string, options?: MetricOptions): Histogram {
    const existing = this.instruments.get(name);
    if (existing) return existing as unknown as Histogram;

    const instrument = new HistogramInstrument(name, options);
    this.instruments.set(name, instrument);
    return instrument;
  }

  addExporter(exporter: MetricExporter): void {
    this.exporters.push(exporter);
  }

  startCollection(intervalMs: number = 15000): void {
    if (this.collectionIntervalId) return;
    this.collectionIntervalId = setInterval(() => {
      void this.collectAndExport();
    }, intervalMs);
  }

  stopCollection(): void {
    if (this.collectionIntervalId) {
      clearInterval(this.collectionIntervalId);
      this.collectionIntervalId = null;
    }
  }

  async collectAndExport(): Promise<void> {
    const points: MetricPoint[] = [];
    for (const instrument of this.instruments.values()) {
      const collected = instrument.collect();
      points.push(...collected);
    }
    if (points.length === 0) return;
    for (const exporter of this.exporters) {
      await exporter.export(points, this.aggregationTemporality);
    }
  }

  getInstrument(name: string): Instrument | undefined {
    return this.instruments.get(name);
  }

  async shutdown(): Promise<void> {
    this.stopCollection();
    await Promise.all(this.exporters.map((e) => e.shutdown()));
    this.instruments.clear();
    this.exporters = [];
  }
}

export interface MetricExporter {
  export(points: MetricPoint[], temporality: AggregationTemporality): Promise<void>;
  shutdown(): Promise<void>;
}

class ConsoleMetricExporter implements MetricExporter {
  async export(points: MetricPoint[], _temporality: AggregationTemporality): Promise<void> {
    for (const point of points) {
      console.log(JSON.stringify(point));
    }
  }

  async shutdown(): Promise<void> {
  }
}

class OTLPMetricExporter implements MetricExporter {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;

  constructor(config: ExporterConfig) {
    this.endpoint = config.endpoint ?? "http://localhost:4318/v1/metrics";
    this.headers = config.headers ?? {};
  }

  async export(points: MetricPoint[], _temporality: AggregationTemporality): Promise<void> {
    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify(this.toOTLPProto(points)),
      });
    } catch {
    }
  }

  async shutdown(): Promise<void> {
  }

  private toOTLPProto(points: MetricPoint[]): unknown {
    return {
      resourceMetrics: [
        {
          resource: { attributes: [] },
          scopeMetrics: [
            {
              scope: { name: "@agent-preflight/observability" },
              metrics: points.map((p) => ({
                name: p.name,
                gauge: typeof p.value === "number" ? {
                  dataPoints: [
                    {
                      asDouble: p.value,
                      timeUnixNano: new Date(p.timestamp).getTime() * 1_000_000,
                      attributes: Object.entries(p.attributes).map(([k, v]) => ({
                        key: k,
                        value: { stringValue: v },
                      })),
                    },
                  ],
                } : undefined,
              })),
            },
          ],
        },
      ],
    };
  }
}

export function createMetricExporter(config: ExporterConfig): MetricExporter {
  switch (config.type) {
    case "CONSOLE":
      return new ConsoleMetricExporter();
    case "OTLP":
      return new OTLPMetricExporter(config);
    default:
      return new ConsoleMetricExporter();
  }
}

export function getHistogramBuckets(values: number[], boundaries: number[]): HistogramBucket[] {
  const sorted = [...values].sort((a, b) => a - b);
  const buckets: HistogramBucket[] = [];
  let idx = 0;

  for (const bound of boundaries) {
    let count = 0;
    while (idx < sorted.length && sorted[idx]! <= bound) {
      count++;
      idx++;
    }
    buckets.push({ bounds: bound, count });
  }

  buckets.push({ bounds: Infinity, count: sorted.length - idx });
  return buckets;
}
