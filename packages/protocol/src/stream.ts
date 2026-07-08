import type { ACPMessage } from './types.js';
import { ACPErrorCode, StreamError } from './errors.js';

export enum StreamState {
  INITIALIZED = 'INITIALIZED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR',
}

export interface StreamChunk<T = unknown> {
  streamId: string;
  sequence: number;
  data: T;
  isFinal: boolean;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface StreamSubscription {
  streamId: string;
  onChunk: (chunk: StreamChunk) => void;
  onComplete: (streamId: string) => void;
  onError: (error: StreamError) => void;
  onCancel: (streamId: string) => void;
}

export interface StreamInfo {
  streamId: string;
  state: StreamState;
  createdAt: number;
  updatedAt: number;
  source: string;
  target: string;
  totalChunks: number;
  receivedChunks: number;
  metadata?: Record<string, unknown>;
}

type ChunkHandler = (chunk: StreamChunk) => void;
type StreamEventHandler = (streamId: string) => void;
type StreamErrorHandler = (error: StreamError) => void;

export class StreamManager {
  private readonly streams: Map<string, StreamInfo> = new Map();
  private readonly chunks: Map<string, StreamChunk[]> = new Map();
  private readonly subscriptions: Map<string, Set<StreamSubscription>> = new Map();
  private readonly chunkHandlers: Map<string, Set<ChunkHandler>> = new Map();
  private readonly completeHandlers: Map<string, Set<StreamEventHandler>> = new Map();
  private readonly cancelHandlers: Map<string, Set<StreamEventHandler>> = new Map();
  private readonly errorHandlers: Map<string, Set<StreamErrorHandler>> = new Map();

  public createStream(
    streamId: string,
    source: string,
    target: string,
    metadata?: Record<string, unknown>,
  ): StreamInfo {
    if (this.streams.has(streamId)) {
      throw new StreamError({
        code: ACPErrorCode.STREAM_ALREADY_EXISTS,
        message: `Stream '${streamId}' already exists`,
      });
    }

    const now = Date.now();
    const info: StreamInfo = {
      streamId,
      state: StreamState.INITIALIZED,
      createdAt: now,
      updatedAt: now,
      source,
      target,
      totalChunks: 0,
      receivedChunks: 0,
      metadata,
    };

    this.streams.set(streamId, info);
    this.chunks.set(streamId, []);
    this.chunkHandlers.set(streamId, new Set());
    this.completeHandlers.set(streamId, new Set());
    this.cancelHandlers.set(streamId, new Set());
    this.errorHandlers.set(streamId, new Set());

    return info;
  }

  public getStream(streamId: string): StreamInfo | undefined {
    return this.streams.get(streamId);
  }

  public getAllStreams(): StreamInfo[] {
    return [...this.streams.values()];
  }

  public getStreamsByState(state: StreamState): StreamInfo[] {
    return [...this.streams.values()].filter((s) => s.state === state);
  }

  public updateState(streamId: string, newState: StreamState): void {
    const info = this.streams.get(streamId);
    if (!info) {
      throw new StreamError({
        code: ACPErrorCode.STREAM_NOT_FOUND,
        message: `Stream '${streamId}' not found`,
      });
    }

    info.state = newState;
    info.updatedAt = Date.now();
  }

  public appendChunk(chunk: StreamChunk): void {
    const streamChunks = this.chunks.get(chunk.streamId);
    if (!streamChunks) {
      throw new StreamError({
        code: ACPErrorCode.STREAM_NOT_FOUND,
        message: `Stream '${chunk.streamId}' not found for chunk append`,
      });
    }

    const info = this.streams.get(chunk.streamId);
    if (!info) {
      throw new StreamError({
        code: ACPErrorCode.STREAM_NOT_FOUND,
        message: `Stream info not found for '${chunk.streamId}'`,
      });
    }

    streamChunks.push(chunk);
    info.totalChunks = Math.max(info.totalChunks, chunk.sequence + 1);
    info.receivedChunks++;
    info.updatedAt = Date.now();

    if (chunk.isFinal) {
      info.state = StreamState.COMPLETED;
    } else {
      info.state = StreamState.ACTIVE;
    }

    this.notifyChunk(chunk);
  }

  public getChunks(streamId: string): StreamChunk[] {
    return this.chunks.get(streamId) ?? [];
  }

  public cancelStream(streamId: string): void {
    const info = this.streams.get(streamId);
    if (!info) return;

    info.state = StreamState.CANCELLED;
    info.updatedAt = Date.now();

    this.notifyCancel(streamId);
    this.cleanupStream(streamId);
  }

  public completeStream(streamId: string): void {
    const info = this.streams.get(streamId);
    if (!info) return;

    info.state = StreamState.COMPLETED;
    info.updatedAt = Date.now();

    this.notifyComplete(streamId);
  }

  public subscribe(subscription: StreamSubscription): () => void {
    const streamId = subscription.streamId;

    if (!this.subscriptions.has(streamId)) {
      this.subscriptions.set(streamId, new Set());
    }

    this.subscriptions.get(streamId)!.add(subscription);

    if (subscription.onChunk) {
      this.addChunkHandler(streamId, subscription.onChunk);
    }
    if (subscription.onComplete) {
      this.addCompleteHandler(streamId, subscription.onComplete);
    }
    if (subscription.onError) {
      this.addErrorHandler(streamId, subscription.onError);
    }
    if (subscription.onCancel) {
      this.addCancelHandler(streamId, subscription.onCancel);
    }

    return () => {
      this.subscriptions.get(streamId)?.delete(subscription);
      this.chunkHandlers.get(streamId)?.delete(subscription.onChunk);
      this.completeHandlers.get(streamId)?.delete(subscription.onComplete);
      this.errorHandlers.get(streamId)?.delete(subscription.onError);
      this.cancelHandlers.get(streamId)?.delete(subscription.onCancel);
    };
  }

  private addChunkHandler(streamId: string, handler: ChunkHandler): void {
    const handlers = this.chunkHandlers.get(streamId);
    if (handlers) {
      handlers.add(handler);
    }
  }

  private addCompleteHandler(streamId: string, handler: StreamEventHandler): void {
    const handlers = this.completeHandlers.get(streamId);
    if (handlers) {
      handlers.add(handler);
    }
  }

  private addErrorHandler(streamId: string, handler: StreamErrorHandler): void {
    const handlers = this.errorHandlers.get(streamId);
    if (handlers) {
      handlers.add(handler);
    }
  }

  private addCancelHandler(streamId: string, handler: StreamEventHandler): void {
    const handlers = this.cancelHandlers.get(streamId);
    if (handlers) {
      handlers.add(handler);
    }
  }

  private notifyChunk(chunk: StreamChunk): void {
    const handlers = this.chunkHandlers.get(chunk.streamId);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(chunk);
        } catch {
          // Silently ignore handler errors
        }
      }
    }
  }

  private notifyComplete(streamId: string): void {
    const handlers = this.completeHandlers.get(streamId);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(streamId);
        } catch {
          // Silently ignore
        }
      }
    }
  }

  private notifyCancel(streamId: string): void {
    const handlers = this.cancelHandlers.get(streamId);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(streamId);
        } catch {
          // Silently ignore
        }
      }
    }
  }

  public notifyError(streamId: string, error: StreamError): void {
    const info = this.streams.get(streamId);
    if (info) {
      info.state = StreamState.ERROR;
      info.updatedAt = Date.now();
    }

    const handlers = this.errorHandlers.get(streamId);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(error);
        } catch {
          // Silently ignore
        }
      }
    }
  }

  public cleanupStream(streamId: string): void {
    this.streams.delete(streamId);
    this.chunks.delete(streamId);
    this.subscriptions.delete(streamId);
    this.chunkHandlers.delete(streamId);
    this.completeHandlers.delete(streamId);
    this.cancelHandlers.delete(streamId);
    this.errorHandlers.delete(streamId);
  }

  public cleanupStaleStreams(maxAgeMs: number = 300_000): void {
    const now = Date.now();
    for (const [streamId, info] of this.streams) {
      if (now - info.updatedAt > maxAgeMs) {
        this.cancelStream(streamId);
      }
    }
  }
}

export function handleStream<T>(
  streamManager: StreamManager,
  message: ACPMessage<T>,
): void {
  const messageType = message.header.messageType;

  switch (messageType) {
    case 'acp:stream:init': {
      const payload = message.payload as { streamId: string; metadata?: Record<string, unknown> };
      streamManager.createStream(
        payload.streamId,
        message.header.source,
        message.header.target ?? 'broadcast',
        payload.metadata,
      );
      break;
    }

    case 'acp:stream:chunk': {
      const chunk = message.payload as StreamChunk;
      streamManager.appendChunk(chunk);
      break;
    }

    case 'acp:stream:complete': {
      const payload = message.payload as { streamId: string };
      streamManager.completeStream(payload.streamId);
      break;
    }

    case 'acp:stream:cancel': {
      const payload = message.payload as { streamId: string };
      streamManager.cancelStream(payload.streamId);
      break;
    }

    case 'acp:stream:error': {
      const payload = message.payload as { streamId: string; code: string; message: string };
      streamManager.notifyError(
        payload.streamId,
        new StreamError({
          message: payload.message,
          code: (payload.code as ACPErrorCode) ?? ACPErrorCode.STREAM_CANCELLED,
        }),
      );
      break;
    }

    default:
      break;
  }
}
