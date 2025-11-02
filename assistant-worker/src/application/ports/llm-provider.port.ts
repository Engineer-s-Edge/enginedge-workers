/**
 * LLM Provider Port
 *
 * Interface for LLM service adapters.
 * Allows swapping between different LLM providers (OpenAI, Anthropic, etc.)
 */

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  /** @deprecated Use messages array with system role instead */
  systemPrompt?: string;
  /** @deprecated Use messages array with user role instead */
  userMessage?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  metadata?: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  finishReason?: string;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface LLMStreamChunk {
  content: string;
  finishReason?: string;
  done?: boolean;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  metadata?: Record<string, unknown>;
}

/**
 * Port for LLM provider implementations
 */
export interface ILLMProvider {
  /**
   * Complete a single request
   */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Stream completion responses
   */
  stream(request: LLMRequest): AsyncIterable<string>;

  /**
   * Get provider name
   */
  getProviderName(): string;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get model name
   */
  getModelName(): string;

  /**
   * Convert speech to text (STT)
   * @param audioBuffer Audio buffer to transcribe
   * @param language Optional language code (e.g., 'en-US')
   * @returns Transcribed text
   */
  speechToText?(audioBuffer: Buffer, language?: string): Promise<string>;

  /**
   * Convert text to speech (TTS)
   * @param text Text to convert to speech
   * @param voice Optional voice identifier
   * @returns Audio buffer
   */
  textToSpeech?(text: string, voice?: string): Promise<Buffer>;
}
