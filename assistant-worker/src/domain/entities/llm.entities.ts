export class LLMRequest {
  constructor(
    public readonly id: string,
    public readonly prompt: string,
    public readonly model: string,
    public readonly parameters?: Record<string, any>
  ) {}

  static create(prompt: string, model: string, parameters?: Record<string, any>): LLMRequest {
    return new LLMRequest(
      crypto.randomUUID(),
      prompt,
      model,
      parameters
    );
  }
}

export class LLMResponse {
  constructor(
    public readonly id: string,
    public readonly requestId: string,
    public readonly content: string,
    public readonly model: string,
    public readonly usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }
  ) {}

  static success(requestId: string, content: string, model: string, usage?: LLMResponse['usage']): LLMResponse {
    return new LLMResponse(
      crypto.randomUUID(),
      requestId,
      content,
      model,
      usage
    );
  }

  static error(requestId: string, error: string): LLMResponse {
    return new LLMResponse(
      crypto.randomUUID(),
      requestId,
      error,
      'error'
    );
  }
}