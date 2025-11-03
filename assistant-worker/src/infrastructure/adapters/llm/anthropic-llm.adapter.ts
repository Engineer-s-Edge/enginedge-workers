import { Injectable, Inject } from '@nestjs/common';
import {
  ILLMProvider,
  LLMRequest,
  LLMResponse,
  LLMStreamChunk,
} from '@application/ports/llm-provider.port';
import { ILogger } from '@application/ports/logger.port';

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage: AnthropicUsage;
  stop_reason: string;
}

/**
 * Anthropic LLM Adapter
 *
 * Implements ILLMProvider for Anthropic API (Claude models)
 * Supports streaming and token counting
 */
@Injectable()
export class AnthropicLLMAdapter implements ILLMProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly apiVersion: string;

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl =
      process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1';
    this.apiVersion = '2023-06-01';

    if (!this.apiKey) {
      this.logger.warn('AnthropicLLMAdapter: Anthropic API key not configured');
    }
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    this.logger.debug('AnthropicLLMAdapter: Invoking Anthropic LLM', {
      model: request.model,
      messageCount: request.messages.length,
    });

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens || 1024,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = (await response.json()) as AnthropicResponse;

      return this.parseResponse(data);
    } catch (error) {
      this.logger.error(
        'Anthropic LLM invocation failed',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  async *invokeStream(
    request: LLMRequest,
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    this.logger.debug('AnthropicLLMAdapter: Starting Anthropic streaming', {
      model: request.model,
    });

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens || 1024,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
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

            try {
              const event = JSON.parse(data);

              // Handle content block start
              if (event.type === 'content_block_start') {
                continue;
              }

              // Handle content block delta
              if (event.type === 'content_block_delta' && event.delta?.text) {
                yield {
                  content: event.delta.text,
                  done: false,
                };
              }

              // Handle message start (contains usage)
              if (event.type === 'message_start' && event.message?.usage) {
                // Usage tracked but not yielded per chunk
              }

              // Handle message delta (contains usage info)
              if (event.type === 'message_delta' && event.usage) {
                // Usage tracked but not yielded per chunk
              }

              // Handle message stop
              if (event.type === 'message_stop') {
                yield {
                  content: '',
                  done: true,
                  finishReason: 'stop',
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
        'Anthropic streaming failed',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  countTokens(text: string): number {
    // Rough estimation: ~4 characters per token for Claude
    return Math.ceil(text.length / 4);
  }

  getProviderName(): string {
    return 'anthropic';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private parseResponse(data: AnthropicResponse): LLMResponse {
    if (!data.content || data.content.length === 0) {
      throw new Error('No content in Anthropic response');
    }

    const content = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      content,
      finishReason: data.stop_reason,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens:
              (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
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
    // Simplified streaming implementation
    const response = await this.invoke(request);
    yield response.content;
  }

  /**
   * Get model name
   */
  getModelName(): string {
    return 'anthropic';
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
