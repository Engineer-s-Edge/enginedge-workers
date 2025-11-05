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
}

export interface LLMResponse {
  content: string;
}

export interface ILLMProvider {
  complete(request: LLMRequest): Promise<LLMResponse>;
}
