import type { ACPAgentId, ACPMessage } from './types.js';
import type { TransportError } from './errors.js';

export enum ProtocolEventType {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_SENT = 'message_sent',
  ERROR = 'error',
  HEALTH_CHECK = 'health_check',
  AGENT_REGISTERED = 'agent_registered',
  AGENT_UNREGISTERED = 'agent_unregistered',
  HANDSHAKE_COMPLETE = 'handshake_complete',
  STREAM_EVENT = 'stream_event',
}

export interface ProtocolEvent<T = unknown> {
  type: ProtocolEventType;
  timestamp: number;
  source: ACPAgentId;
  data: T;
  metadata?: Record<string, unknown>;
}

export interface ConnectedEventData {
  agentId: ACPAgentId;
  sessionId: string;
  transportType: string;
}

export interface DisconnectedEventData {
  agentId: ACPAgentId;
  sessionId: string;
  code: number;
  reason: string;
}

export interface MessageReceivedEventData {
  message: ACPMessage;
  latencyMs: number;
}

export interface MessageSentEventData {
  message: ACPMessage;
  durationMs: number;
}

export interface ErrorEventData {
  error: TransportError;
  context?: string;
}

export interface HealthCheckEventData {
  agentId: ACPAgentId;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number;
  details?: Record<string, unknown>;
}

export interface AgentRegisteredEventData {
  agentId: ACPAgentId;
  capabilities: string[];
  registeredAt: number;
}

export interface AgentUnregisteredEventData {
  agentId: ACPAgentId;
  reason: string;
  unregisteredAt: number;
}

export type ProtocolEventHandler<T = unknown> = (event: ProtocolEvent<T>) => void;

export interface EventSubscription {
  id: string;
  type: ProtocolEventType;
  handler: ProtocolEventHandler;
  filter?: EventFilter;
}

export interface EventFilter {
  source?: ACPAgentId;
  types?: ProtocolEventType[];
  metadata?: Record<string, unknown>;
}

export class EventBus {
  private readonly subscriptions: Map<string, EventSubscription> = new Map();
  private readonly handlersByType: Map<ProtocolEventType, Set<string>> = new Map();
  private readonly history: ProtocolEvent[] = [];
  private readonly maxHistorySize: number;

  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  public subscribe<T>(
    type: ProtocolEventType,
    handler: ProtocolEventHandler<T>,
    filter?: EventFilter,
  ): () => void {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    const subscription: EventSubscription = {
      id,
      type,
      handler: handler as ProtocolEventHandler,
      filter,
    };

    this.subscriptions.set(id, subscription);

    if (!this.handlersByType.has(type)) {
      this.handlersByType.set(type, new Set());
    }
    this.handlersByType.get(type)!.add(id);

    return () => {
      this.subscriptions.delete(id);
      this.handlersByType.get(type)?.delete(id);
    };
  }

  public subscribeToAll<T>(
    handler: ProtocolEventHandler<T>,
    filter?: EventFilter,
  ): () => void {
    const id = `sub-all-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    const subscription: EventSubscription = {
      id,
      type: ProtocolEventType.CONNECTED,
      handler: handler as ProtocolEventHandler,
      filter,
    };

    this.subscriptions.set(id, subscription);

    return () => {
      this.subscriptions.delete(id);
    };
  }

  public publish<T>(event: ProtocolEvent<T>): void {
    this.addToHistory(event);

    const subscriptionIds = this.handlersByType.get(event.type);
    if (subscriptionIds) {
      for (const id of subscriptionIds) {
        const subscription = this.subscriptions.get(id);
        if (subscription && this.passesFilter(event, subscription.filter)) {
          try {
            subscription.handler(event);
          } catch {
            // Silently ignore handler errors
          }
        }
      }
    }

    if (this.subscriptions.has('sub-all')) {
      const allSub = this.subscriptions.get('sub-all');
      for (const [, sub] of this.subscriptions) {
        if (sub.id.startsWith('sub-all-') && this.passesFilter(event, sub.filter)) {
          try {
            sub.handler(event);
          } catch {
            // Silently ignore
          }
        }
      }
    }
  }

  public getHistory(type?: ProtocolEventType): ProtocolEvent[] {
    if (type) {
      return this.history.filter((e) => e.type === type);
    }
    return [...this.history];
  }

  public getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  public getSubscriptionsForType(type: ProtocolEventType): number {
    return this.handlersByType.get(type)?.size ?? 0;
  }

  public clearHistory(): void {
    this.history.length = 0;
  }

  public clearAll(): void {
    this.subscriptions.clear();
    this.handlersByType.clear();
    this.history.length = 0;
  }

  private addToHistory(event: ProtocolEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  private passesFilter(event: ProtocolEvent, filter?: EventFilter): boolean {
    if (!filter) return true;

    if (filter.source && event.source !== filter.source) return false;
    if (filter.types && !filter.types.includes(event.type)) return false;

    if (filter.metadata && event.metadata) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (event.metadata[key] !== value) return false;
      }
    }

    return true;
  }
}

export function createConnectedEvent(agentId: ACPAgentId, data: ConnectedEventData): ProtocolEvent<ConnectedEventData> {
  return {
    type: ProtocolEventType.CONNECTED,
    timestamp: Date.now(),
    source: agentId,
    data,
  };
}

export function createDisconnectedEvent(agentId: ACPAgentId, data: DisconnectedEventData): ProtocolEvent<DisconnectedEventData> {
  return {
    type: ProtocolEventType.DISCONNECTED,
    timestamp: Date.now(),
    source: agentId,
    data,
  };
}

export function createMessageReceivedEvent(agentId: ACPAgentId, data: MessageReceivedEventData): ProtocolEvent<MessageReceivedEventData> {
  return {
    type: ProtocolEventType.MESSAGE_RECEIVED,
    timestamp: Date.now(),
    source: agentId,
    data,
  };
}

export function createMessageSentEvent(agentId: ACPAgentId, data: MessageSentEventData): ProtocolEvent<MessageSentEventData> {
  return {
    type: ProtocolEventType.MESSAGE_SENT,
    timestamp: Date.now(),
    source: agentId,
    data,
  };
}

export function createErrorEvent(agentId: ACPAgentId, data: ErrorEventData): ProtocolEvent<ErrorEventData> {
  return {
    type: ProtocolEventType.ERROR,
    timestamp: Date.now(),
    source: agentId,
    data,
  };
}

export function createHealthCheckEvent(agentId: ACPAgentId, data: HealthCheckEventData): ProtocolEvent<HealthCheckEventData> {
  return {
    type: ProtocolEventType.HEALTH_CHECK,
    timestamp: Date.now(),
    source: agentId,
    data,
  };
}

export function createAgentRegisteredEvent(agentId: ACPAgentId, data: AgentRegisteredEventData): ProtocolEvent<AgentRegisteredEventData> {
  return {
    type: ProtocolEventType.AGENT_REGISTERED,
    timestamp: Date.now(),
    source: agentId,
    data,
  };
}

export function createAgentUnregisteredEvent(agentId: ACPAgentId, data: AgentUnregisteredEventData): ProtocolEvent<AgentUnregisteredEventData> {
  return {
    type: ProtocolEventType.AGENT_UNREGISTERED,
    timestamp: Date.now(),
    source: agentId,
    data,
  };
}
