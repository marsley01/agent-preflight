import type { ACPErrorCode } from './errors.js';
import { RoutingError } from './errors.js';
import { MessageQueue } from './transport.js';
import type { ACPAgentId, ACPMessage, ACPRoutingRule } from './types.js';

export interface RouteRule {
  ruleId: string;
  matchPattern: string;
  targetAgent: ACPAgentId;
  priority: number;
  ttl?: number;
  createdAt: number;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export interface RouteResult {
  matched: boolean;
  targetAgent?: ACPAgentId;
  rule?: RouteRule;
  latencyMs: number;
}

export interface RouterConfig {
  defaultTimeoutMs: number;
  maxRoutes: number;
  enablePriorityQueuing: boolean;
  enableTtlExpiry: boolean;
}

const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  defaultTimeoutMs: 30_000,
  maxRoutes: 1000,
  enablePriorityQueuing: true,
  enableTtlExpiry: true,
};

interface PendingMessage {
  message: ACPMessage;
  resolve: (value: ACPMessage) => void;
  reject: (error: RoutingError) => void;
  timeout: ReturnType<typeof setTimeout>;
  startedAt: number;
}

export class MessageRouter {
  private readonly routes: Map<string, RouteRule> = new Map();
  private readonly patternRoutes: RouteRule[] = [];
  private readonly pendingMessages: Map<string, PendingMessage> = new Map();
  private readonly priorityQueue: MessageQueue;
  private readonly config: RouterConfig;

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
    this.priorityQueue = new MessageQueue();
  }

  public addRoute(rule: RouteRule): void {
    if (this.routes.size >= this.config.maxRoutes) {
      throw new RoutingError({
        message: `Route table full (max: ${this.config.maxRoutes})`,
        code: 'ROUTE_NOT_FOUND' as ACPErrorCode,
      });
    }

    const expiresAt = rule.ttl ? Date.now() + rule.ttl : undefined;
    const route: RouteRule = {
      ...rule,
      createdAt: Date.now(),
      expiresAt,
    };

    this.routes.set(rule.ruleId, route);
    this.patternRoutes.push(route);
    this.patternRoutes.sort((a, b) => b.priority - a.priority);
  }

  public removeRoute(ruleId: string): boolean {
    const route = this.routes.get(ruleId);
    if (!route) return false;

    this.routes.delete(ruleId);
    const index = this.patternRoutes.findIndex((r) => r.ruleId === ruleId);
    if (index >= 0) {
      this.patternRoutes.splice(index, 1);
    }

    return true;
  }

  public getRoute(ruleId: string): RouteRule | undefined {
    return this.routes.get(ruleId);
  }

  public getAllRoutes(): RouteRule[] {
    this.evictExpiredRoutes();
    return [...this.patternRoutes];
  }

  public findRoute(message: ACPMessage): RouteRule | null {
    this.evictExpiredRoutes();

    for (const route of this.patternRoutes) {
      if (this.matchesPattern(message, route.matchPattern)) {
        if (route.expiresAt && Date.now() > route.expiresAt) {
          this.removeRoute(route.ruleId);
          continue;
        }
        return route;
      }
    }

    return null;
  }

  public route(message: ACPMessage): RouteResult {
    const startTime = Date.now();

    const route = this.findRoute(message);
    if (!route) {
      return {
        matched: false,
        latencyMs: Date.now() - startTime,
      };
    }

    const priority = message.header.priority ?? route.priority;

    if (this.config.enablePriorityQueuing) {
      this.priorityQueue.enqueue(message, priority);
    }

    return {
      matched: true,
      targetAgent: route.targetAgent,
      rule: route,
      latencyMs: Date.now() - startTime,
    };
  }

  public async sendAndWait(
    message: ACPMessage,
    sendFn: (msg: ACPMessage) => Promise<void>,
    timeoutMs?: number,
  ): Promise<ACPMessage> {
    const timeout = timeoutMs ?? this.config.defaultTimeoutMs;
    const correlationId = message.header.correlationId;

    if (!correlationId) {
      throw new RoutingError({
        message: 'Cannot sendAndWait without a correlationId',
        code: 'MESSAGE_INVALID' as ACPErrorCode,
      });
    }

    return new Promise<ACPMessage>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingMessages.delete(correlationId);
        reject(new RoutingError({
          message: `Message timed out after ${timeout}ms`,
          code: 'TRANSPORT_TIMEOUT' as ACPErrorCode,
        }));
      }, timeout);

      this.pendingMessages.set(correlationId, {
        message,
        resolve,
        reject,
        timeout: timeoutHandle,
        startedAt: Date.now(),
      });

      sendFn(message).catch((error) => {
        clearTimeout(timeoutHandle);
        this.pendingMessages.delete(correlationId);
        reject(new RoutingError({
          message: 'Failed to send message',
          cause: error,
        }));
      });
    });
  }

  public resolvePending(correlationId: string, response: ACPMessage): boolean {
    const pending = this.pendingMessages.get(correlationId);
    if (!pending) return false;

    clearTimeout(pending.timeout);
    this.pendingMessages.delete(correlationId);
    pending.resolve(response);
    return true;
  }

  public rejectPending(correlationId: string, error: RoutingError): boolean {
    const pending = this.pendingMessages.get(correlationId);
    if (!pending) return false;

    clearTimeout(pending.timeout);
    this.pendingMessages.delete(correlationId);
    pending.reject(error);
    return true;
  }

  public getPendingCount(): number {
    return this.pendingMessages.size;
  }

  public getRouteCount(): number {
    this.evictExpiredRoutes();
    return this.routes.size;
  }

  private matchesPattern(message: ACPMessage, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === message.header.source) return true;
    if (pattern === message.header.target) return true;
    if (pattern === message.header.messageType) return true;

    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
      );
      return regex.test(message.header.messageType) ||
        regex.test(message.header.source) ||
        (message.header.target ? regex.test(message.header.target) : false);
    }

    return false;
  }

  private evictExpiredRoutes(): void {
    if (!this.config.enableTtlExpiry) return;

    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [ruleId, route] of this.routes) {
      if (route.expiresAt && now > route.expiresAt) {
        expiredIds.push(ruleId);
      }
    }

    for (const ruleId of expiredIds) {
      this.removeRoute(ruleId);
    }
  }

  public clearRoutes(): void {
    this.routes.clear();
    this.patternRoutes.length = 0;
  }

  public clearPending(): void {
    for (const [, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout);
      pending.reject(new RoutingError({
        message: 'Router is clearing all pending messages',
        code: 'ROUTE_NOT_FOUND' as ACPErrorCode,
      }));
    }
    this.pendingMessages.clear();
  }
}
