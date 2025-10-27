/**
 * Stream Chunk DTO
 */
export class StreamChunk {
  constructor(
    public readonly content: string,
    public readonly agentId: string,
    public readonly done: boolean,
    public readonly finishReason?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {}

  static create(data: {
    content: string;
    agentId: string;
    done: boolean;
    finishReason?: string;
    metadata?: Record<string, unknown>;
  }): StreamChunk {
    return new StreamChunk(
      data.content,
      data.agentId,
      data.done,
      data.finishReason,
      data.metadata,
    );
  }

  toPlainObject(): Record<string, unknown> {
    return {
      content: this.content,
      agentId: this.agentId,
      done: this.done,
      finishReason: this.finishReason,
      metadata: this.metadata,
    };
  }

  toJSON(): string {
    return JSON.stringify(this.toPlainObject());
  }
}
