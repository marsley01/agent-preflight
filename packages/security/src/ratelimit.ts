/**
 * Supported rate limiting algorithms.
 */
export type RateLimitAlgorithm = 'token_bucket' | 'sliding_window';

/**
 * A key-value store interface for distributed rate limiting.
 * Can be backed by Redis, Memcached, or any similar store.
 */
export interface RateLimitStore {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, ttlSeconds: number): Promise<void> | void;
  increment(key: string, ttlSeconds: number): Promise<number> | number;
  delete(key: string): Promise<void> | void;
}

/**
 * In-memory implementation of the rate limit store.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly store: Map<string, { value: string; expiresAt: number }> =
    new Map();

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  increment(key: string, ttlSeconds: number): number {
    const existing = this.get(key);
    if (existing === null) {
      this.set(key, '1', ttlSeconds);
      return 1;
    }

    const current = parseInt(existing, 10);
    if (isNaN(current)) {
      this.set(key, '1', ttlSeconds);
      return 1;
    }

    const next = current + 1;
    this.set(key, String(next), ttlSeconds);
    return next;
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

/**
 * Configuration for a rate limiter instance.
 */
export interface RateLimiterConfig {
  /** Rate limiting algorithm to use */
  algorithm: RateLimitAlgorithm;
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Key prefix for distributed stores */
  keyPrefix: string;
  /** Optional external store for distributed rate limiting */
  store?: RateLimitStore;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  algorithm: 'sliding_window',
  maxRequests: 100,
  windowSeconds: 60,
  keyPrefix: 'ratelimit',
};

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Total limit for the window */
  limit: number;
  /** Unix timestamp when the window resets */
  resetAt: number;
  /** Current usage count */
  current: number;
}

/**
 * Rate limiter with support for token bucket and sliding window algorithms.
 *
 * Supports per-agent, per-user, per-IP, and per-endpoint rate limiting
 * with configurable limits and distributed backends.
 */
export class RateLimiter {
  private readonly config: RateLimiterConfig;
  private readonly store: RateLimitStore;

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = this.config.store ?? new InMemoryRateLimitStore();
  }

  /**
   * Checks whether a request should be allowed for the given key.
   *
   * @param key - The rate limit key (e.g., "user:123", "ip:1.2.3.4", "agent:abc")
   * @returns Rate limit result with current usage and reset time
   */
  async check(key: string): Promise<RateLimitResult> {
    switch (this.config.algorithm) {
      case 'token_bucket':
        return this.checkTokenBucket(key);
      case 'sliding_window':
        return this.checkSlidingWindow(key);
      default: {
        const _exhaustive: never = this.config.algorithm;
        throw new Error(`Unknown algorithm: ${_exhaustive}`);
      }
    }
  }

  /**
   * Synchronous check for non-async stores.
   *
   * @param key - The rate limit key
   * @returns Rate limit result
   */
  checkSync(key: string): RateLimitResult {
    switch (this.config.algorithm) {
      case 'token_bucket':
        return this.checkTokenBucketSync(key);
      case 'sliding_window':
        return this.checkSlidingWindowSync(key);
      default: {
        const _exhaustive: never = this.config.algorithm;
        throw new Error(`Unknown algorithm: ${_exhaustive}`);
      }
    }
  }

  /**
   * Resets the rate limit counter for a given key.
   *
   * @param key - The rate limit key to reset
   */
  async reset(key: string): Promise<void> {
    const storeKey = `${this.config.keyPrefix}:${key}`;
    await this.store.delete(storeKey);
  }

  /**
   * Generates rate limit headers for HTTP responses.
   *
   * @param result - The rate limit result
   * @returns An object with rate limit header key-value pairs
   */
  getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
    return {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
    };
  }

  /**
   * Creates a rate limit key for a specific scope.
   *
   * @param scope - The scope category (agent, user, ip, endpoint)
   * @param identifier - The identifier within that scope
   * @returns A composite rate limit key
   */
  static createKey(scope: 'agent' | 'user' | 'ip' | 'endpoint', identifier: string): string {
    return `${scope}:${identifier}`;
  }

  private async checkTokenBucket(key: string): Promise<RateLimitResult> {
    const storeKey = `${this.config.keyPrefix}:${key}:bucket`;
    const now = Date.now();
    const windowMs = this.config.windowSeconds * 1000;

    const raw = await this.store.get(storeKey);
    let tokens: number;
    let lastRefill: number;

    if (raw === null) {
      tokens = this.config.maxRequests;
      lastRefill = now;
    } else {
      try {
        const parsed = JSON.parse(raw) as { tokens: number; lastRefill: number };
        tokens = parsed.tokens;
        lastRefill = parsed.lastRefill;
      } catch {
        tokens = this.config.maxRequests;
        lastRefill = now;
      }

      // Refill tokens based on elapsed time
      const elapsed = now - lastRefill;
      const refillRate = this.config.maxRequests / windowMs;
      tokens = Math.min(this.config.maxRequests, tokens + elapsed * refillRate);
    }

    if (tokens >= 1) {
      tokens -= 1;
      await this.store.set(
        storeKey,
        JSON.stringify({ tokens, lastRefill: now }),
        this.config.windowSeconds * 2,
      );

      return {
        allowed: true,
        remaining: Math.floor(tokens),
        limit: this.config.maxRequests,
        resetAt: now + windowMs,
        current: this.config.maxRequests - Math.floor(tokens),
      };
    }

    await this.store.set(
      storeKey,
      JSON.stringify({ tokens, lastRefill }),
      this.config.windowSeconds * 2,
    );

    return {
      allowed: false,
      remaining: 0,
      limit: this.config.maxRequests,
      resetAt: lastRefill + windowMs,
      current: this.config.maxRequests,
    };
  }

  private async checkSlidingWindow(key: string): Promise<RateLimitResult> {
    const storeKey = `${this.config.keyPrefix}:${key}:window`;
    const windowMs = this.config.windowSeconds * 1000;
    const now = Date.now();

    const count = await this.store.increment(storeKey, this.config.windowSeconds * 2);

    if (count <= this.config.maxRequests) {
      return {
        allowed: true,
        remaining: this.config.maxRequests - count,
        limit: this.config.maxRequests,
        resetAt: now + windowMs,
        current: count,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      limit: this.config.maxRequests,
      resetAt: now + windowMs,
      current: count,
    };
  }

  private checkTokenBucketSync(key: string): RateLimitResult {
    const storeKey = `${this.config.keyPrefix}:${key}:bucket`;
    const now = Date.now();
    const windowMs = this.config.windowSeconds * 1000;

    const raw = this.store.get(storeKey);
    let tokens: number;
    let lastRefill: number;

    if (raw === null) {
      tokens = this.config.maxRequests;
      lastRefill = now;
    } else {
      try {
        const parsed = JSON.parse(raw as string) as {
          tokens: number;
          lastRefill: number;
        };
        tokens = parsed.tokens;
        lastRefill = parsed.lastRefill;
      } catch {
        tokens = this.config.maxRequests;
        lastRefill = now;
      }

      const elapsed = now - lastRefill;
      const refillRate = this.config.maxRequests / windowMs;
      tokens = Math.min(this.config.maxRequests, tokens + elapsed * refillRate);
    }

    if (tokens >= 1) {
      tokens -= 1;
      this.store.set(
        storeKey,
        JSON.stringify({ tokens, lastRefill: now }),
        this.config.windowSeconds * 2,
      );

      return {
        allowed: true,
        remaining: Math.floor(tokens),
        limit: this.config.maxRequests,
        resetAt: now + windowMs,
        current: this.config.maxRequests - Math.floor(tokens),
      };
    }

    this.store.set(
      storeKey,
      JSON.stringify({ tokens, lastRefill }),
      this.config.windowSeconds * 2,
    );

    return {
      allowed: false,
      remaining: 0,
      limit: this.config.maxRequests,
      resetAt: lastRefill + windowMs,
      current: this.config.maxRequests,
    };
  }

  private checkSlidingWindowSync(key: string): RateLimitResult {
    const storeKey = `${this.config.keyPrefix}:${key}:window`;
    const windowMs = this.config.windowSeconds * 1000;
    const now = Date.now();

    const count = this.store.increment(storeKey, this.config.windowSeconds * 2);

    if (typeof count === 'number' && count <= this.config.maxRequests) {
      return {
        allowed: true,
        remaining: this.config.maxRequests - count,
        limit: this.config.maxRequests,
        resetAt: now + windowMs,
        current: count,
      };
    }

    const current = typeof count === 'number' ? count : this.config.maxRequests + 1;

    return {
      allowed: false,
      remaining: 0,
      limit: this.config.maxRequests,
      resetAt: now + windowMs,
      current,
    };
  }
}
