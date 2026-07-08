import type { LogLevel } from "@agent-preflight/types";
import type { LogEntry, ExporterConfig } from "./types.js";

const SEVERITY_MAP: Record<LogLevel, number> = {
  TRACE: 1,
  DEBUG: 5,
  INFO: 9,
  WARN: 13,
  ERROR: 17,
  FATAL: 21,
};

export interface LogTransport {
  log(entry: LogEntry): Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

class ConsoleTransport implements LogTransport {
  private format: "text" | "json";

  constructor(format: "text" | "json" = "json") {
    this.format = format;
  }

  async log(entry: LogEntry): Promise<void> {
    if (this.format === "json") {
      console.log(JSON.stringify(entry));
    } else {
      const msg = `[${entry.timestamp}] [${entry.level}] [${entry.loggerName}] ${entry.message}`;
      if (entry.level === "ERROR" || entry.level === "FATAL") {
        console.error(msg);
      } else if (entry.level === "WARN") {
        console.warn(msg);
      } else {
        console.log(msg);
      }
    }
  }

  async flush(): Promise<void> {
  }

  async shutdown(): Promise<void> {
  }
}

class FileTransport implements LogTransport {
  private entries: LogEntry[] = [];
  private filePath: string;
  private flushIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(filePath: string, flushIntervalMs: number = 5000) {
    this.filePath = filePath;
    this.flushIntervalId = setInterval(() => {
      void this.flush();
    }, flushIntervalMs);
  }

  async log(entry: LogEntry): Promise<void> {
    this.entries.push(entry);
  }

  async flush(): Promise<void> {
    if (this.entries.length === 0) return;
    const batch = this.entries.splice(0);
    const lines = batch.map((e) => JSON.stringify(e)).join("\n");
    try {
      const fs = await import("fs");
      fs.appendFileSync(this.filePath, lines + "\n");
    } catch {
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
    }
    await this.flush();
  }
}

class OTLPLogTransport implements LogTransport {
  private endpoint: string;
  private headers: Record<string, string>;
  private buffer: LogEntry[] = [];

  constructor(config: { endpoint?: string | undefined; headers?: Record<string, string> | undefined }) {
    this.endpoint = config.endpoint ?? "http://localhost:4318/v1/logs";
    this.headers = config.headers ?? {};
  }

  async log(entry: LogEntry): Promise<void> {
    this.buffer.push(entry);
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0);
    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify(this.toOTLPProto(batch)),
      });
    } catch {
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }

  private toOTLPProto(entries: LogEntry[]): unknown {
    return {
      resourceLogs: [
        {
          resource: { attributes: [] },
          scopeLogs: [
            {
              scope: { name: "@agent-preflight/observability" },
              logRecords: entries.map((e) => ({
                timeUnixNano: new Date(e.timestamp).getTime() * 1_000_000,
                severityNumber: e.severityNumber,
                severityText: e.level,
                body: { stringValue: e.message },
                attributes: e.attributes
                  ? Object.entries(e.attributes).map(([k, v]) => ({
                      key: k,
                      value: { stringValue: String(v) },
                    }))
                  : [],
                traceId: e.traceId ?? "",
                spanId: e.spanId ?? "",
              })),
            },
          ],
        },
      ],
    };
  }
}

export class ObservabilityLogger {
  private name: string;
  private transports: LogTransport[] = [];
  private minLevel: LogLevel;
  private correlationId: string | undefined;
  private defaultAttributes: Record<string, unknown> = {};

  constructor(
    name: string,
    options?: Partial<{
      level: LogLevel;
      transports: LogTransport[];
      correlationId: string;
      defaultAttributes: Record<string, unknown>;
    }>,
  ) {
    this.name = name;
    this.minLevel = options?.level ?? "DEBUG";
    this.correlationId = options?.correlationId;
    this.defaultAttributes = options?.defaultAttributes ?? {};

    if (options?.transports) {
      this.transports.push(...options.transports);
    }
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  private shouldLog(level: LogLevel): boolean {
    return (SEVERITY_MAP[level] ?? 0) >= (SEVERITY_MAP[this.minLevel] ?? 0);
  }

  private async emit(entry: LogEntry): Promise<void> {
    if (!this.shouldLog(entry.level)) return;
    await Promise.all(this.transports.map((t) => t.log(entry)));
  }

  trace(message: string, attributes?: Record<string, unknown>): void {
    void this.emit(this.createEntry("TRACE", message, attributes));
  }

  debug(message: string, attributes?: Record<string, unknown>): void {
    void this.emit(this.createEntry("DEBUG", message, attributes));
  }

  info(message: string, attributes?: Record<string, unknown>): void {
    void this.emit(this.createEntry("INFO", message, attributes));
  }

  warn(message: string, attributes?: Record<string, unknown>): void {
    void this.emit(this.createEntry("WARN", message, attributes));
  }

  error(message: string, error?: Error, attributes?: Record<string, unknown>): void {
    void this.emit(this.createEntry("ERROR", message, { ...attributes, error: error?.message }));
  }

  fatal(message: string, error?: Error, attributes?: Record<string, unknown>): void {
    void this.emit(this.createEntry("FATAL", message, { ...attributes, error: error?.message }));
  }

  child(name: string, attributes?: Record<string, unknown>): ObservabilityLogger {
    const child = new ObservabilityLogger(`${this.name}.${name}`, {
      level: this.minLevel,
      transports: this.transports,
      defaultAttributes: { ...this.defaultAttributes, ...attributes },
    });
    return child;
  }

  async flush(): Promise<void> {
    await Promise.all(this.transports.map((t) => t.flush()));
  }

  async shutdown(): Promise<void> {
    await this.flush();
    await Promise.all(this.transports.map((t) => t.shutdown()));
  }

  private createEntry(
    level: LogLevel,
    message: string,
    attributes?: Record<string, unknown>,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      severityNumber: SEVERITY_MAP[level] ?? 0,
      message,
      loggerName: this.name,
      correlationId: this.correlationId,
      attributes: {
        ...this.defaultAttributes,
        ...attributes,
      },
    };
  }
}

export function createLogger(
  name: string,
  config?: Partial<{
    level: LogLevel;
    format: "text" | "json";
    transports: ExporterConfig[];
    correlationId: string;
  }>,
): ObservabilityLogger {
  const transports: LogTransport[] = [];

  if (config?.transports) {
    for (const t of config.transports) {
      transports.push(createTransportFromConfig(t));
    }
  }

  if (transports.length === 0) {
    transports.push(new ConsoleTransport(config?.format ?? "json"));
  }

  return new ObservabilityLogger(name, {
    level: config?.level,
    transports,
  });
}

function createTransportFromConfig(config: ExporterConfig): LogTransport {
  switch (config.type) {
    case "CONSOLE":
      return new ConsoleTransport();
    case "FILE":
      return new FileTransport(config.endpoint ?? "./logs/agent-preflight.log");
    case "OTLP":
      return new OTLPLogTransport({ endpoint: config.endpoint, headers: config.headers });
    default:
      return new ConsoleTransport();
  }
}

export { ConsoleTransport, FileTransport, OTLPLogTransport };
