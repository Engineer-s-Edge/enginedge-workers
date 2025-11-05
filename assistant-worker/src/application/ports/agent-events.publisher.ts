import { AgentEvent, EventFilter } from '../services/agent-event.service';

export interface IAgentEventsPublisher {
  publish(event: AgentEvent): Promise<void>;
}

export interface AgentEventSubscriptionHandle {
  unsubscribe(): void;
}

export interface IAgentEventsSubscriber {
  subscribe(
    filter: EventFilter,
    onEvent: (event: AgentEvent) => void,
  ): AgentEventSubscriptionHandle;
}
