import { Injectable, Inject } from '@nestjs/common';
import { Response } from 'express';
import { SSEStreamAdapter } from './sse-stream.adapter';
import {
  AgentEventService,
  AgentEvent,
  EventFilter,
} from '@application/services/agent-event.service';

@Injectable()
export class AgentSSEPublisher {
  constructor(
    private readonly sse: SSEStreamAdapter,
    private readonly events: AgentEventService,
    @Inject('ILogger') private readonly logger: any,
  ) {}

  start(res: Response, filter?: EventFilter): string {
    const streamId = `agents-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.sse.initializeStream(streamId, res);

    const subscriptionId = `sub-${streamId}`;
    this.events.subscribeToAgentEvents(
      subscriptionId,
      filter || {},
      (event: AgentEvent) => {
        this.sse.sendToStream(streamId, {
          type: 'progress',
          data: event,
          timestamp: new Date(),
        });
      },
    );

    // Send initial heartbeat
    this.sse.sendToStream(streamId, {
      type: 'start',
      data: { streamId, message: 'Agent events stream started' },
      timestamp: new Date(),
    });

    // Attach cleanup on connection close via SSEStreamAdapter
    return streamId;
  }

  stop(streamId: string): void {
    try {
      this.sse.closeStream(streamId);
    } catch (e) {
      this.logger?.warn?.('Failed to close SSE stream', { streamId, error: e });
    }
  }
}
