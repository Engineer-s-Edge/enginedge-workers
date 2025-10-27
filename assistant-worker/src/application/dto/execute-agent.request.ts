import { Message } from '../../domain/value-objects/message.vo';

/**
 * Execute Agent Request DTO
 */
export class ExecuteAgentRequest {
  constructor(
    public readonly agentId: string,
    public readonly messages: Message[],
    public readonly userId?: string,
    public readonly sessionId?: string,
    public readonly stream?: boolean,
    public readonly metadata?: Record<string, unknown>,
  ) {}

  static create(data: {
    agentId: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    userId?: string;
    sessionId?: string;
    stream?: boolean;
    metadata?: Record<string, unknown>;
  }): ExecuteAgentRequest {
    const messages = data.messages.map(msg =>
      Message.create(msg.role, msg.content),
    );

    return new ExecuteAgentRequest(
      data.agentId,
      messages,
      data.userId,
      data.sessionId,
      data.stream,
      data.metadata,
    );
  }
}
