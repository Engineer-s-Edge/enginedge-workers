import { Injectable, Inject } from '@nestjs/common';
import {
  ILLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
} from '@application/ports/llm-provider.port';
import { ILogger } from '@application/ports/logger.port';

interface XAIMessage {
  role: string;
  content: string;
}

interface XAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface XAIChoice {
  message: XAIMessage;
  finish_reason: string;
}

interface XAIResponse {
  choices: XAIChoice[];
  usage: XAIUsage;
}

/**
 * xAI (Grok) LLM Adapter
 *
 * Implements ILLMProvider for xAI's API (Grok models)
 * Supports streaming and token counting
 */
@Injectable()
export class XAILLMAdapter implements ILLMProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.apiKey = process.env.XAI_API_KEY || '';
    this.baseUrl = process.env.XAI_API_URL || 'https://api.x.ai/v1';

    if (!this.apiKey) {
      this.logger.warn('XAILLMAdapter: xAI API key not configured');
    }
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    this.logger.debug('XAILLMAdapter: Invoking xAI LLM', {
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
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`xAI API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as XAIResponse;

      return this.parseResponse(data);
    } catch (error) {
      this.logger.error(
        'xAI LLM invocation failed',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  async *invokeStream(
    request: LLMRequest,
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    this.logger.debug('XAILLMAdapter: Starting xAI streaming', {
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
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`xAI API error: ${response.status} - ${error}`);
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
        'xAI streaming failed',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  countTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  getProviderName(): string {
    return 'xai';
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

  private parseResponse(data: XAIResponse): LLMResponse {
    const choice = data.choices[0];

    if (!choice) {
      throw new Error('No choices in xAI response');
    }

    const content = choice.message?.content || '';
    const finishReason = choice.finish_reason;

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
    const response = await this.invoke(request);
    yield response.content;
  }

  /**
   * Get model name
   */
  getModelName(): string {
    return 'xai';
  }

  async speechToText(audioBuffer: Buffer, language?: string): Promise<string> {
    throw new Error(
      'Speech-to-text not implemented. Use a dedicated STT service.',
    );
  }

  async textToSpeech(text: string, voice?: string): Promise<Buffer> {
    throw new Error(
      'Text-to-speech not implemented. Use a dedicated TTS service.',
    );
  }
}
