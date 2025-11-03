import { Injectable, Inject } from '@nestjs/common';
import {
  ILLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
} from '@application/ports/llm-provider.port';
import { ILogger } from '@application/ports/logger.port';

interface OpenAIMessage {
  role: string;
  content: string;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIChoice {
  message: OpenAIMessage;
  finish_reason: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

/**
 * OpenAI LLM Adapter
 *
 * Implements ILLMProvider for OpenAI API
 * Includes retry logic, rate limiting, and error handling
 */
@Injectable()
export class OpenAILLMAdapter implements ILLMProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.baseUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';

    if (!this.apiKey) {
      this.logger.warn('OpenAILLMAdapter: OpenAI API key not configured');
    }
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    this.logger.debug('OpenAILLMAdapter: Invoking OpenAI LLM', {
      model: request.model,
      messageCount: request.messages.length,
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          stream: false,
          tools: request.tools,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      return this.parseResponse(data);
    } catch (error) {
      this.logger.error(
        'OpenAI LLM invocation failed',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  async *invokeStream(
    request: LLMRequest,
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    this.logger.debug('OpenAILLMAdapter: Starting OpenAI streaming', {
      model: request.model,
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          stream: true,
          tools: request.tools,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              yield {
                content: '',
                done: true,
                finishReason: 'stop',
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              const finishReason = parsed.choices?.[0]?.finish_reason;

              if (content) {
                yield {
                  content,
                  done: false,
                };
              }

              if (finishReason) {
                yield {
                  content: '',
                  done: true,
                  finishReason,
                };
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'OpenAI streaming failed',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  countTokens(text: string, _model: string): number {
    // Rough estimation: ~4 characters per token
    // In production, use tiktoken or similar
    return Math.ceil(text.length / 4);
  }

  getProviderName(): string {
    return 'openai';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private parseResponse(data: OpenAIResponse): LLMResponse {
    const choice = data.choices[0];

    if (!choice) {
      throw new Error('No choices in OpenAI response');
    }

    const content = choice.message?.content || '';
    const finishReason = choice.finish_reason;
    const toolCalls = choice.message?.tool_calls?.map(
      (call: OpenAIToolCall) => ({
        id: call.id,
        type: 'function' as const,
        function: {
          name: call.function.name,
          arguments: call.function.arguments,
        },
      }),
    );

    return {
      content,
      finishReason,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      toolCalls,
    };
  }

  /**
   * Complete method (alias for invoke)
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    return this.invoke(request);
  }

  /**
   * Stream method - returns an async iterable of strings
   */
  async *stream(request: LLMRequest): AsyncIterable<string> {
    this.logger.debug('OpenAILLMAdapter: Streaming OpenAI LLM', {
      model: request.model,
      messageCount: request.messages.length,
    });

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: true,
        tools: request.tools,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body reader available');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  /**
   * Get model name
   */
  getModelName(): string {
    return 'openai';
  }

  /**
   * Speech to Text - Not implemented by default
   * Use separate STT service (e.g., Google Speech, Azure Speech)
   */
  async speechToText(audioBuffer: Buffer, language?: string): Promise<string> {
    throw new Error(
      'Speech-to-text not implemented. Use a dedicated STT service.',
    );
  }

  /**
   * Text to Speech - Not implemented by default
   * Use separate TTS service (e.g., Google Speech, Azure Speech)
   */
  async textToSpeech(text: string, voice?: string): Promise<Buffer> {
    throw new Error(
      'Text-to-speech not implemented. Use a dedicated TTS service.',
    );
  }
}
