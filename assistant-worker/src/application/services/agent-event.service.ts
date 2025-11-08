/**
 * Agent Event Service
 *
 * Manages agent event emission, filtering, and subscriptions.
 */

import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ILogger } from '@application/ports/logger.port';

export type AgentEventType =
  | 'agent.created'
  | 'agent.started'
  | 'agent.completed'
  | 'agent.failed'
  | 'agent.aborted'
  | 'agent.state_changed'
  | 'agent.message'
  | 'agent.tool_call'
  | 'agent.tool_result'
  | 'component.merged';

export interface AgentEvent {
  type: AgentEventType;
  agentId: string;
  userId: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface ComponentMergeEvent {
  type: 'component.merged';
  componentId1: string;
  componentId2: string;
  mergedInto: string;
  timestamp: Date;
  data: {
    nodeCount: number;
    edgeCount: number;
    categories: string[];
  };
}

export interface EventFilter {
  agentId?: string;
  userId?: string;
  types?: AgentEventType[];
}

/**
 * Service for managing agent events
 */
@Injectable()
export class AgentEventService {
  private eventEmitter: EventEmitter;
  private subscriptions: Map<string, EventFilter>;

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100); // Support many concurrent agents
    this.subscriptions = new Map();
  }

  /**
   * Emit an agent event
   */
  emitEvent(event: AgentEvent): void {
    this.logger.debug('Agent event emitted', {
      type: event.type,
      agentId: event.agentId,
    });

    // Emit to general channel
    this.eventEmitter.emit('agent.event', event);

    // Emit to specific type channel
    this.eventEmitter.emit(event.type, event);

    // Emit to agent-specific channel
    this.eventEmitter.emit(`agent.${event.agentId}`, event);
  }

  /**
   * Subscribe to agent events with optional filtering
   */
  subscribeToAgentEvents(
    subscriptionId: string,
    filter: EventFilter,
    callback: (event: AgentEvent) => void,
  ): void {
    this.subscriptions.set(subscriptionId, filter);

    const listener = (event: AgentEvent) => {
      if (this.matchesFilter(event, filter)) {
        callback(event);
      }
    };

    this.eventEmitter.on('agent.event', listener);

    this.logger.info('Event subscription created', {
      subscriptionId,
      filter,
    });
  }

  /**
   * Subscribe to specific agent instance
   */
  subscribeToAgentInstance(
    subscriptionId: string,
    agentId: string,
    callback: (event: AgentEvent) => void,
  ): void {
    this.subscriptions.set(subscriptionId, { agentId });

    this.eventEmitter.on(`agent.${agentId}`, callback);

    this.logger.info('Agent instance subscription created', {
      subscriptionId,
      agentId,
    });
  }

  /**
   * Subscribe to specific event type
   */
  subscribeToEventType(
    subscriptionId: string,
    eventType: AgentEventType,
    callback: (event: AgentEvent) => void,
  ): void {
    this.subscriptions.set(subscriptionId, { types: [eventType] });

    this.eventEmitter.on(eventType, callback);

    this.logger.info('Event type subscription created', {
      subscriptionId,
      eventType,
    });
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): void {
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.delete(subscriptionId);
      this.logger.info('Subscription removed', { subscriptionId });
    }
  }

  /**
   * Get activity stream for agent
   */
  async *getAgentActivityStream(agentId: string): AsyncGenerator<AgentEvent> {
    const queue: AgentEvent[] = [];
    let resolver: ((value: AgentEvent) => void) | null = null;

    const listener = (event: AgentEvent) => {
      if (resolver) {
        resolver(event);
        resolver = null;
      } else {
        queue.push(event);
      }
    };

    this.eventEmitter.on(`agent.${agentId}`, listener);

    try {
      while (true) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          yield await new Promise<AgentEvent>((resolve) => {
            resolver = resolve;
          });
        }
      }
    } finally {
      this.eventEmitter.off(`agent.${agentId}`, listener);
    }
  }

  /**
   * Set event filtering for subscription
   */
  setEventFiltering(subscriptionId: string, filter: EventFilter): void {
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.set(subscriptionId, filter);
      this.logger.info('Event filter updated', { subscriptionId, filter });
    }
  }

  /**
   * Get event forwarding options (for Kafka, etc.)
   */
  getEventForwardingOptions(): {
    enabled: boolean;
    targets: string[];
  } {
    return {
      enabled: true,
      targets: ['kafka', 'websocket'],
    };
  }

  /**
   * Remove all listeners for an agent
   */
  removeAgentListeners(agentId: string): void {
    this.eventEmitter.removeAllListeners(`agent.${agentId}`);
    this.logger.info('Agent listeners removed', { agentId });
  }

  // Private helper methods

  private matchesFilter(event: AgentEvent, filter: EventFilter): boolean {
    if (filter.agentId && event.agentId !== filter.agentId) {
      return false;
    }

    if (filter.userId && event.userId !== filter.userId) {
      return false;
    }

    if (filter.types && !filter.types.includes(event.type)) {
      return false;
    }

    return true;
  }
}
