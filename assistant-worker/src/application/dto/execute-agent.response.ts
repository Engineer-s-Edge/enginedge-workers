/**
 * Execute Agent Response DTO
 */
export class ExecuteAgentResponse {
  constructor(
    public readonly content: string,
    public readonly agentId: string,
    public readonly finishReason?: string,
    public readonly usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    },
    public readonly metadata?: Record<string, unknown>,
  ) {}

  static create(data: {
    content: string;
    agentId: string;
    finishReason?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    metadata?: Record<string, unknown>;
  }): ExecuteAgentResponse {
    return new ExecuteAgentResponse(
      data.content,
      data.agentId,
      data.finishReason,
      data.usage,
      data.metadata,
    );
  }

  toPlainObject(): Record<string, unknown> {
    return {
      content: this.content,
      agentId: this.agentId,
      finishReason: this.finishReason,
      usage: this.usage,
      metadata: this.metadata,
    };
  }
}
