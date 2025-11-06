export type LLMRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMRequest {
  model?: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, any>;
    };
  }>;
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    function: {
      name: string;
      arguments?: string;
    };
  }>;
}

export interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>;
}
