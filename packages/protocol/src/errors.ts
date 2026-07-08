export enum ACPErrorCode {
  // Handshake errors (1000-1099)
  HANDSHAKE_FAILED = 'HANDSHAKE_FAILED',
  VERSION_MISMATCH = 'VERSION_MISMATCH',
  CAPABILITY_MISMATCH = 'CAPABILITY_MISMATCH',
  HANDSHAKE_TIMEOUT = 'HANDSHAKE_TIMEOUT',

  // Transport errors (2000-2099)
  TRANSPORT_DISCONNECTED = 'TRANSPORT_DISCONNECTED',
  TRANSPORT_TIMEOUT = 'TRANSPORT_TIMEOUT',
  TRANSPORT_UNAVAILABLE = 'TRANSPORT_UNAVAILABLE',
  MESSAGE_QUEUE_FULL = 'MESSAGE_QUEUE_FULL',

  // Routing errors (3000-3099)
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  ROUTE_EXPIRED = 'ROUTE_EXPIRED',
  TARGET_UNREACHABLE = 'TARGET_UNREACHABLE',

  // Message errors (4000-4099)
  MESSAGE_INVALID = 'MESSAGE_INVALID',
  MESSAGE_TOO_LARGE = 'MESSAGE_TOO_LARGE',
  MESSAGE_SERIALIZATION_ERROR = 'MESSAGE_SERIALIZATION_ERROR',

  // Security errors (5000-5099)
  AUTH_FAILED = 'AUTH_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',

  // Stream errors (6000-6099)
  STREAM_NOT_FOUND = 'STREAM_NOT_FOUND',
  STREAM_ALREADY_EXISTS = 'STREAM_ALREADY_EXISTS',
  STREAM_CANCELLED = 'STREAM_CANCELLED',

  // General errors (9000-9099)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
  UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION',
}

export interface ACPErrorOptions {
  code: ACPErrorCode;
  message: string;
  cause?: unknown;
  recoverable?: boolean;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export class ACPError extends Error {
  public readonly code: ACPErrorCode;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(options: ACPErrorOptions) {
    super(options.message);
    this.name = 'ACPError';
    this.code = options.code;
    this.recoverable = options.recoverable ?? false;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.cause = options.cause;

    Object.setPrototypeOf(this, ACPError.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      retryable: this.retryable,
      details: this.details,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

export class HandshakeError extends ACPError {
  constructor(options: Omit<ACPErrorOptions, 'code'> & { code?: ACPErrorCode }) {
    super({
      ...options,
      code: options.code ?? ACPErrorCode.HANDSHAKE_FAILED,
    });
    this.name = 'HandshakeError';
    Object.setPrototypeOf(this, HandshakeError.prototype);
  }
}

export class TransportError extends ACPError {
  constructor(options: Omit<ACPErrorOptions, 'code'> & { code?: ACPErrorCode }) {
    super({
      ...options,
      code: options.code ?? ACPErrorCode.TRANSPORT_DISCONNECTED,
    });
    this.name = 'TransportError';
    Object.setPrototypeOf(this, TransportError.prototype);
  }
}

export class RoutingError extends ACPError {
  constructor(options: Omit<ACPErrorOptions, 'code'> & { code?: ACPErrorCode }) {
    super({
      ...options,
      code: options.code ?? ACPErrorCode.ROUTE_NOT_FOUND,
    });
    this.name = 'RoutingError';
    Object.setPrototypeOf(this, RoutingError.prototype);
  }
}

export class MessageError extends ACPError {
  constructor(options: Omit<ACPErrorOptions, 'code'> & { code?: ACPErrorCode }) {
    super({
      ...options,
      code: options.code ?? ACPErrorCode.MESSAGE_INVALID,
    });
    this.name = 'MessageError';
    Object.setPrototypeOf(this, MessageError.prototype);
  }
}

export class SecurityError extends ACPError {
  constructor(options: Omit<ACPErrorOptions, 'code'> & { code?: ACPErrorCode }) {
    super({
      ...options,
      code: options.code ?? ACPErrorCode.AUTH_FAILED,
    });
    this.name = 'SecurityError';
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}

export class StreamError extends ACPError {
  constructor(options: Omit<ACPErrorOptions, 'code'> & { code?: ACPErrorCode }) {
    super({
      ...options,
      code: options.code ?? ACPErrorCode.STREAM_NOT_FOUND,
    });
    this.name = 'StreamError';
    Object.setPrototypeOf(this, StreamError.prototype);
  }
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableCodes: ACPErrorCode[];
  onRetry?: (attempt: number, error: ACPError, delayMs: number) => void;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 10_000,
  backoffFactor: 2,
  retryableCodes: [
    ACPErrorCode.TRANSPORT_TIMEOUT,
    ACPErrorCode.TRANSPORT_DISCONNECTED,
    ACPErrorCode.TRANSPORT_UNAVAILABLE,
    ACPErrorCode.MESSAGE_QUEUE_FULL,
    ACPErrorCode.ROUTE_NOT_FOUND,
  ],
};

export function calculateBackoff(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const delay = config.baseDelayMs * Math.pow(config.backoffFactor, attempt);
  const jitter = Math.random() * 0.3 * delay;
  return Math.min(delay + jitter, config.maxDelayMs);
}

export function isRetryable(error: ACPError, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  return config.retryableCodes.includes(error.code);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const retryConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: ACPError | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof ACPError)) {
        throw error;
      }

      lastError = error;

      if (attempt >= retryConfig.maxRetries || !isRetryable(error, retryConfig)) {
        throw error;
      }

      const delayMs = calculateBackoff(attempt, retryConfig);
      retryConfig.onRetry?.(attempt + 1, error, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError ?? new ACPError({
    code: ACPErrorCode.INTERNAL_ERROR,
    message: 'Retry loop terminated unexpectedly',
  });
}
