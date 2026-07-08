import type { ACPErrorCode } from './errors.js';
import { ACPError, TransportError } from './errors.js';
import type { ACPMessage, ACPVersion } from './types.js';

export interface TransportConfig {
  agentId: string;
  version: ACPVersion;
  timeoutMs: number;
  maxRetries: number;
  maxQueueSize: number;
  heartbeatIntervalMs: number;
  reconnectDelayMs: number;
  endpoints?: Record<string, string>;
}

export interface TransportProvider {
  readonly isConnected: boolean;

  connect(config: TransportConfig): Promise<void>;
  disconnect(): Promise<void>;
  send<T>(message: ACPMessage<T>): Promise<void>;
  receive<T>(timeoutMs?: number): Promise<ACPMessage<T> | null>;

  onMessage<T>(handler: (message: ACPMessage<T>) => void): () => void;
  onError(handler: (error: TransportError) => void): () => void;
  onClose(handler: (code: number, reason: string) => void): () => void;
}

interface QueuedMessage {
  message: ACPMessage;
  priority: number;
  enqueuedAt: number;
  retryCount: number;
}

export class MessageQueue {
  private readonly queues: Map<number, QueuedMessage[]>;
  private readonly maxSize: number;
  private size: number = 0;

  constructor(maxSize: number = 1000) {
    this.queues = new Map();
    this.maxSize = maxSize;
  }

  public enqueue(message: ACPMessage, priority: number = 0): void {
    if (this.size >= this.maxSize) {
      throw new ACPError({
        code: 'MESSAGE_QUEUE_FULL' as ACPErrorCode,
        message: `Message queue is full (max: ${this.maxSize})`,
        recoverable: true,
        retryable: true,
      });
    }

    const entry: QueuedMessage = {
      message,
      priority,
      enqueuedAt: Date.now(),
      retryCount: 0,
    };

    const queue = this.queues.get(priority) ?? [];
    queue.push(entry);
    this.queues.set(priority, queue);
    this.size++;
  }

  public dequeue(): ACPMessage | null {
    const priorities = [...this.queues.keys()].sort((a, b) => b - a);

    for (const priority of priorities) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        const entry = queue.shift()!;
        if (queue.length === 0) {
          this.queues.delete(priority);
        }
        this.size--;
        return entry.message;
      }
    }

    return null;
  }

  public peek(): ACPMessage | null {
    const priorities = [...this.queues.keys()].sort((a, b) => b - a);

    for (const priority of priorities) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue[0]!.message;
      }
    }

    return null;
  }

  public get length(): number {
    return this.size;
  }

  public clear(): void {
    this.queues.clear();
    this.size = 0;
  }

  public getStats(): Record<string, unknown> {
    return {
      totalSize: this.size,
      maxSize: this.maxSize,
      priorityLevels: this.queues.size,
      queueDistribution: Object.fromEntries(
        [...this.queues.entries()].map(([priority, messages]) => [
          priority,
          messages.length,
        ]),
      ),
    };
  }
}

type MessageHandler<T = unknown> = (message: ACPMessage<T>) => void;
type ErrorHandler = (error: TransportError) => void;
type CloseHandler = (code: number, reason: string) => void;

export class InMemoryTransport implements TransportProvider {
  private _isConnected: boolean = false;
  private readonly messageHandlers: Set<MessageHandler> = new Set();
  private readonly errorHandlers: Set<ErrorHandler> = new Set();
  private readonly closeHandlers: Set<CloseHandler> = new Set();
  private readonly messageQueue: MessageQueue;
  private remoteTransport?: InMemoryTransport;
  private config?: TransportConfig;

  constructor(maxQueueSize: number = 1000) {
    this.messageQueue = new MessageQueue(maxQueueSize);
  }

  public get isConnected(): boolean {
    return this._isConnected;
  }

  public link(other: InMemoryTransport): void {
    this.remoteTransport = other;
    other.remoteTransport = this;
  }

  public async connect(config: TransportConfig): Promise<void> {
    this.config = config;
    this._isConnected = true;
  }

  public async disconnect(): Promise<void> {
    this._isConnected = false;
    this.messageQueue.clear();
    this.notifyClose(1000, 'Normal closure');
  }

  public async send<T>(message: ACPMessage<T>): Promise<void> {
    if (!this._isConnected) {
      throw new TransportError({
        message: 'Transport is not connected',
        code: 'TRANSPORT_DISCONNECTED' as ACPErrorCode,
      });
    }

    if (!this.remoteTransport) {
      throw new TransportError({
        message: 'No remote transport linked',
        code: 'TARGET_UNREACHABLE' as ACPErrorCode,
      });
    }

    const priority = message.header.priority ?? 0;
    this.messageQueue.enqueue(message as unknown as ACPMessage, priority);

    if (this.remoteTransport._isConnected) {
      try {
        this.remoteTransport.deliver(message);
      } catch (error) {
        this.notifyError(
          new TransportError({
            message: 'Failed to deliver message to remote transport',
            cause: error,
          }),
        );
      }
    }
  }

  public async receive<T>(timeoutMs?: number): Promise<ACPMessage<T> | null> {
    const deadline = timeoutMs ? Date.now() + timeoutMs : Infinity;

    while (Date.now() < deadline) {
      const message = this.messageQueue.dequeue();
      if (message) {
        return message as ACPMessage<T>;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return null;
  }

  public onMessage<T>(handler: MessageHandler<T>): () => void {
    this.messageHandlers.add(handler as MessageHandler);
    return () => {
      this.messageHandlers.delete(handler as MessageHandler);
    };
  }

  public onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  public onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  private deliver<T>(message: ACPMessage<T>): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        this.notifyError(
          new TransportError({
            message: 'Message handler threw an error',
            cause: error,
          }),
        );
      }
    }
  }

  private notifyError(error: TransportError): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch {
        // Silently ignore handler errors during error notification
      }
    }
  }

  private notifyClose(code: number, reason: string): void {
    for (const handler of this.closeHandlers) {
      try {
        handler(code, reason);
      } catch {
        // Silently ignore handler errors during close notification
      }
    }
  }
}

export class WebSocketTransport implements TransportProvider {
  private _isConnected: boolean = false;
  private ws: WebSocket | null = null;
  private readonly messageHandlers: Set<MessageHandler> = new Set();
  private readonly errorHandlers: Set<ErrorHandler> = new Set();
  private readonly closeHandlers: Set<CloseHandler> = new Set();
  private readonly messageQueue: MessageQueue;
  private config?: TransportConfig;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(maxQueueSize: number = 1000) {
    this.messageQueue = new MessageQueue(maxQueueSize);
  }

  public get isConnected(): boolean {
    return this._isConnected;
  }

  public async connect(config: TransportConfig): Promise<void> {
    this.config = config;
    const endpoint = config.endpoints?.websocket;
    if (!endpoint) {
      throw new TransportError({
        message: 'No WebSocket endpoint configured',
        code: 'TRANSPORT_UNAVAILABLE' as ACPErrorCode,
      });
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(endpoint);

        this.ws.onopen = () => {
          this._isConnected = true;
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data as string) as ACPMessage;
            for (const handler of this.messageHandlers) {
              handler(message);
            }
          } catch (error) {
            this.notifyError(
              new TransportError({
                message: 'Failed to parse WebSocket message',
                cause: error,
              }),
            );
          }
        };

        this.ws.onerror = (event: Event) => {
          this.notifyError(
            new TransportError({
              message: 'WebSocket error occurred',
              details: { eventType: event.type },
            }),
          );
          reject(new TransportError({
            message: 'WebSocket connection failed',
          }));
        };

        this.ws.onclose = (event: CloseEvent) => {
          this._isConnected = false;
          this.notifyClose(event.code, event.reason);
          this.scheduleReconnect();
        };
      } catch (error) {
        reject(new TransportError({
          message: 'Failed to create WebSocket connection',
          cause: error,
        }));
      }
    });
  }

  public async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this._isConnected = false;
    this.messageQueue.clear();

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
  }

  public async send<T>(message: ACPMessage<T>): Promise<void> {
    if (!this._isConnected || !this.ws) {
      throw new TransportError({
        message: 'WebSocket is not connected',
        code: 'TRANSPORT_DISCONNECTED' as ACPErrorCode,
      });
    }

    try {
      const data = JSON.stringify(message);
      this.ws.send(data);
    } catch (error) {
      throw new TransportError({
        message: 'Failed to send message via WebSocket',
        cause: error,
      });
    }
  }

  public async receive<T>(timeoutMs?: number): Promise<ACPMessage<T> | null> {
    const deadline = timeoutMs ? Date.now() + timeoutMs : Infinity;

    while (Date.now() < deadline) {
      const message = this.messageQueue.dequeue();
      if (message) {
        return message as ACPMessage<T>;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return null;
  }

  public onMessage<T>(handler: MessageHandler<T>): () => void {
    this.messageHandlers.add(handler as MessageHandler);
    return () => {
      this.messageHandlers.delete(handler as MessageHandler);
    };
  }

  public onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  public onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  private scheduleReconnect(): void {
    if (!this.config) return;

    const delayMs = this.config.reconnectDelayMs;
    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.config) {
          await this.connect(this.config);
        }
      } catch {
        this.scheduleReconnect();
      }
    }, delayMs);
  }

  private notifyError(error: TransportError): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch {
        // Silently ignore
      }
    }
  }

  private notifyClose(code: number, reason: string): void {
    for (const handler of this.closeHandlers) {
      try {
        handler(code, reason);
      } catch {
        // Silently ignore
      }
    }
  }
}

export class HTTPTransport implements TransportProvider {
  private _isConnected: boolean = false;
  private readonly messageHandlers: Set<MessageHandler> = new Set();
  private readonly errorHandlers: Set<ErrorHandler> = new Set();
  private readonly closeHandlers: Set<CloseHandler> = new Set();
  private readonly messageQueue: MessageQueue;
  private config?: TransportConfig;
  private pollingTimer?: ReturnType<typeof setInterval>;

  constructor(maxQueueSize: number = 1000) {
    this.messageQueue = new MessageQueue(maxQueueSize);
  }

  public get isConnected(): boolean {
    return this._isConnected;
  }

  public async connect(config: TransportConfig): Promise<void> {
    this.config = config;

    if (!config.endpoints?.http) {
      throw new TransportError({
        message: 'No HTTP endpoint configured',
        code: 'TRANSPORT_UNAVAILABLE' as ACPErrorCode,
      });
    }

    this._isConnected = true;

    if (config.endpoints?.http_poll) {
      this.startPolling(config.endpoints.http_poll, config.timeoutMs);
    }
  }

  public async disconnect(): Promise<void> {
    this._isConnected = false;
    this.messageQueue.clear();

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    this.notifyClose(1000, 'Client disconnecting');
  }

  public async send<T>(message: ACPMessage<T>): Promise<void> {
    if (!this._isConnected) {
      throw new TransportError({
        message: 'HTTP transport is not connected',
        code: 'TRANSPORT_DISCONNECTED' as ACPErrorCode,
      });
    }

    if (!this.config?.endpoints?.http) {
      throw new TransportError({
        message: 'No HTTP endpoint configured for sending',
        code: 'TRANSPORT_UNAVAILABLE' as ACPErrorCode,
      });
    }

    try {
      const response = await fetch(this.config.endpoints.http, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-ID': this.config.agentId,
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new TransportError({
          message: `HTTP request failed with status ${response.status}`,
          details: { status: response.status, statusText: response.statusText },
        });
      }

      const responseData = await response.json() as ACPMessage<T>;
      for (const handler of this.messageHandlers) {
        handler(responseData);
      }
    } catch (error) {
      if (error instanceof TransportError) throw error;
      throw new TransportError({
        message: 'HTTP transport send failed',
        cause: error,
      });
    }
  }

  public async receive<T>(timeoutMs?: number): Promise<ACPMessage<T> | null> {
    const deadline = timeoutMs ? Date.now() + timeoutMs : Infinity;

    while (Date.now() < deadline) {
      const message = this.messageQueue.dequeue();
      if (message) {
        return message as ACPMessage<T>;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return null;
  }

  public onMessage<T>(handler: MessageHandler<T>): () => void {
    this.messageHandlers.add(handler as MessageHandler);
    return () => {
      this.messageHandlers.delete(handler as MessageHandler);
    };
  }

  public onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  public onClose(handler: CloseHandler): () => void {
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  private startPolling(endpoint: string, intervalMs: number): void {
    this.pollingTimer = setInterval(async () => {
      if (!this._isConnected) return;

      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'X-Agent-ID': this.config?.agentId ?? '',
          },
        });

        if (response.ok) {
          const messages = await response.json() as ACPMessage[];
          for (const message of messages) {
            for (const handler of this.messageHandlers) {
              handler(message);
            }
          }
        }
      } catch (error) {
        this.notifyError(
          new TransportError({
            message: 'HTTP polling failed',
            cause: error,
          }),
        );
      }
    }, intervalMs);
  }

  private notifyError(error: TransportError): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch {
        // Silently ignore
      }
    }
  }

  private notifyClose(code: number, reason: string): void {
    for (const handler of this.closeHandlers) {
      try {
        handler(code, reason);
      } catch {
        // Silently ignore
      }
    }
  }
}
