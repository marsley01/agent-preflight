import type { Timestamp, Duration } from "@agent-preflight/types";
import {
  type AnalyticsEvent,
  type AggregatedMetric,
  AggregationFunction,
  type Dimension,
  type ReportFilter,
  type TimeRange,
  type TimeBucket,
  type BucketSize,
} from "./types.js";

function getBucketSizeMs(size: BucketSize): number {
  switch (size) {
    case "1m": return 60_000;
    case "5m": return 300_000;
    case "15m": return 900_000;
    case "1h": return 3_600_000;
    case "1d": return 86_400_000;
  }
}

function getBucketKey(timestamp: Timestamp, bucketSize: BucketSize): string {
  const ms = new Date(timestamp).getTime();
  const sizeMs = getBucketSizeMs(bucketSize);
  const bucketStart = Math.floor(ms / sizeMs) * sizeMs;
  return new Date(bucketStart).toISOString();
}

interface CacheEntry {
  key: string;
  data: AggregatedMetric[];
  expiresAt: number;
}

export class MetricsAggregator {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL: Duration;

  constructor(defaultTTL: Duration = 60_000) {
    this.defaultTTL = defaultTTL;
  }

  aggregate(
    events: AnalyticsEvent[],
    metricField: string,
    fn: AggregationFunction,
    timeRange: TimeRange,
    options?: Partial<{
      bucketSize: BucketSize;
      dimensions: Dimension[];
      filters: ReportFilter[];
    }> | undefined,
  ): AggregatedMetric[] {
    let filtered = this.applyFilters(events, options?.filters ?? []);

    const timeFiltered = this.filterByTimeRange(filtered, timeRange);
    filtered = timeFiltered;

    if (options?.bucketSize) {
      return this.aggregateByBucket(filtered, metricField, fn, options.bucketSize, options.dimensions ?? []);
    }

    return this.computeAggregation(filtered, metricField, fn, options?.dimensions ?? []);
  }

  sum(events: AnalyticsEvent[], field: string, timeRange: TimeRange): AggregatedMetric[] {
    return this.aggregate(events, field, AggregationFunction.SUM, timeRange);
  }

  avg(events: AnalyticsEvent[], field: string, timeRange: TimeRange): AggregatedMetric[] {
    return this.aggregate(events, field, AggregationFunction.AVG, timeRange);
  }

  count(events: AnalyticsEvent[], timeRange: TimeRange): AggregatedMetric[] {
    return this.aggregate(events, "count", AggregationFunction.COUNT, timeRange);
  }

  min(events: AnalyticsEvent[], field: string, timeRange: TimeRange): AggregatedMetric[] {
    return this.aggregate(events, field, AggregationFunction.MIN, timeRange);
  }

  max(events: AnalyticsEvent[], field: string, timeRange: TimeRange): AggregatedMetric[] {
    return this.aggregate(events, field, AggregationFunction.MAX, timeRange);
  }

  percentile(events: AnalyticsEvent[], field: string, p: number, timeRange: TimeRange): AggregatedMetric[] {
    const fn = p <= 50 ? AggregationFunction.PERCENTILE_50
      : p <= 95 ? AggregationFunction.PERCENTILE_95
      : AggregationFunction.PERCENTILE_99;
    return this.aggregate(events, field, fn, timeRange);
  }

  timeBuckets(
    events: AnalyticsEvent[],
    metricField: string,
    fn: AggregationFunction,
    bucketSize: BucketSize,
    timeRange: TimeRange,
  ): TimeBucket[] {
    const filtered = this.filterByTimeRange(events, timeRange);
    const buckets = new Map<string, AnalyticsEvent[]>();

    for (const event of filtered) {
      const key = getBucketKey(event.timestamp, bucketSize);
      const existing = buckets.get(key) ?? [];
      existing.push(event);
      buckets.set(key, existing);
    }

    const result: TimeBucket[] = [];
    for (const [key, bucketEvents] of buckets) {
      const bucketStart = key;
      const bucketEnd = new Date(new Date(key).getTime() + getBucketSizeMs(bucketSize)).toISOString();
      const metrics = this.computeAggregation(bucketEvents, metricField, fn, []);

      result.push({
        start: bucketStart,
        end: bucketEnd,
        metrics,
      });
    }

    return result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  getCached(key: string): AggregatedMetric[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  setCache(key: string, data: AggregatedMetric[], ttl?: Duration): void {
    this.cache.set(key, {
      key,
      data,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    });
  }

  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  private applyFilters(events: AnalyticsEvent[], filters: ReportFilter[]): AnalyticsEvent[] {
    if (filters.length === 0) return events;
    return events.filter((event) => {
      return filters.every((f) => {
        const value = this.getFieldValue(event, f.field);
        switch (f.operator) {
          case "eq": return value === f.value;
          case "neq": return value !== f.value;
          case "gt": return typeof value === "number" && value > (f.value as number);
          case "gte": return typeof value === "number" && value >= (f.value as number);
          case "lt": return typeof value === "number" && value < (f.value as number);
          case "lte": return typeof value === "number" && value <= (f.value as number);
          case "in": return Array.isArray(f.value) && f.value.includes(value);
          case "contains": return typeof value === "string" && typeof f.value === "string" && value.includes(f.value);
          case "exists": return value !== undefined && value !== null;
          default: return true;
        }
      });
    });
  }

  private filterByTimeRange(events: AnalyticsEvent[], timeRange: TimeRange): AnalyticsEvent[] {
    const start = timeRange.start ? new Date(timeRange.start).getTime() : 0;
    const end = timeRange.end ? new Date(timeRange.end).getTime() : Date.now();

    return events.filter((event) => {
      const eventTime = new Date(event.timestamp).getTime();
      return eventTime >= start && eventTime <= end;
    });
  }

  private aggregateByBucket(
    events: AnalyticsEvent[],
    metricField: string,
    fn: AggregationFunction,
    bucketSize: BucketSize,
    dimensions: Dimension[],
  ): AggregatedMetric[] {
    const buckets = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      const key = getBucketKey(event.timestamp, bucketSize);
      const existing = buckets.get(key) ?? [];
      existing.push(event);
      buckets.set(key, existing);
    }

    const result: AggregatedMetric[] = [];
    for (const [, bucketEvents] of buckets) {
      const metrics = this.computeAggregation(bucketEvents, metricField, fn, dimensions);
      result.push(...metrics);
    }

    return result;
  }

  private computeAggregation(
    events: AnalyticsEvent[],
    metricField: string,
    fn: AggregationFunction,
    dimensions: Dimension[],
  ): AggregatedMetric[] {
    if (events.length === 0) {
      return [{
        name: metricField,
        function: fn,
        value: 0,
        timestamp: new Date().toISOString(),
      }];
    }

    const groups = this.groupByDimensions(events, dimensions);

    return groups.map((group) => {
      const values = group.events.map((e) => {
        const raw = this.getFieldValue(e, metricField);
        return typeof raw === "number" ? raw : 0;
      });

      const dims: Record<string, string> = {};
      for (const [key, val] of Object.entries(group.key)) {
        dims[key] = String(val);
      }

      return {
        name: metricField,
        function: fn,
        value: this.computeValue(values, fn),
        dimensions: dims,
        timestamp: new Date().toISOString(),
      };
    });
  }

  private computeValue(values: number[], fn: AggregationFunction): number {
    if (values.length === 0) return 0;

    switch (fn) {
      case AggregationFunction.SUM:
        return values.reduce((a, b) => a + b, 0);
      case AggregationFunction.AVG:
        return values.reduce((a, b) => a + b, 0) / values.length;
      case AggregationFunction.MIN:
        return Math.min(...values);
      case AggregationFunction.MAX:
        return Math.max(...values);
      case AggregationFunction.COUNT:
        return values.length;
      case AggregationFunction.PERCENTILE_50:
        return this.calculatePercentile(values, 50);
      case AggregationFunction.PERCENTILE_95:
        return this.calculatePercentile(values, 95);
      case AggregationFunction.PERCENTILE_99:
        return this.calculatePercentile(values, 99);
    }
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const sorted = [...sortedValues].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]!;
  }

  private groupByDimensions(
    events: AnalyticsEvent[],
    dimensions: Dimension[],
  ): Array<{ key: Record<string, string>; events: AnalyticsEvent[] }> {
    if (dimensions.length === 0) {
      return [{ key: {}, events }];
    }

    const groups = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      const groupKey = dimensions.map((d) => {
        const value = this.getFieldValue(event, d.name);
        return `${d.name}=${String(value ?? "")}`;
      }).join("|");

      const existing = groups.get(groupKey) ?? [];
      existing.push(event);
      groups.set(groupKey, existing);
    }

    return Array.from(groups.entries()).map(([key, groupEvents]) => {
      const parts = key.split("|");
      const dimKey: Record<string, string> = {};
      for (let i = 0; i < dimensions.length; i++) {
        const dim = dimensions[i]!;
        dimKey[dim.name] = parts[i]?.split("=")[1] ?? "";
      }
      return { key: dimKey, events: groupEvents };
    });
  }

  private getFieldValue(event: AnalyticsEvent, field: string): unknown {
    if (field === "count") return 1;
    return (event as unknown as Record<string, unknown>)[field] ?? event.properties[field] ?? undefined;
  }
}
