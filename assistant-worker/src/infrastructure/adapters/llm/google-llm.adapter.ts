import { Injectable, Inject } from '@nestjs/common';
import { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from '@application/ports/llm-provider.port';
import { ILogger } from '@application/ports/logger.port';

interface GoogleMessage {
  role: string;
  parts: Array<{ text: string }>;
}

interface GoogleUsageMetadata {
  prompt_token_count: number;
  candidates_token_count: number;
  total_token_count: number;
}

interface GoogleResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  usageMetadata: GoogleUsageMetadata;
}

interface GoogleStreamResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  usageMetadata?: GoogleUsageMetadata;
}

/**
 * Google Generative AI LLM Adapter
 * 
 * Implements ILLMProvider for Google's Generative AI API (Gemini models)
 * Supports streaming and token counting
 */
@Injectable()
export class GoogleLLMAdapter implements ILLMProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    
    if (!this.apiKey) {
      this.logger.warn('GoogleLLMAdapter: Gemini API key not configured');
    }
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    this.logger.debug('GoogleLLMAdapter: Invoking Google Generative AI', {
      model: request.model,
      messageCount: request.messages.length,
    });

    try {
      const messages = this.convertMessages(request.messages);
      
      const response = await fetch(
        `${this.baseUrl}/${request.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: messages,
            generationConfig: {
              temperature: request.temperature ?? 0.7,
              maxOutputTokens: request.maxTokens,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as GoogleResponse;
      
      return this.parseResponse(data);
    } catch (error) {
      this.logger.error('Google LLM invocation failed', error as Record<string, unknown>);
      throw error;
    }
  }

  async *invokeStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, void, unknown> {
    this.logger.debug('GoogleLLMAdapter: Starting Google streaming', {
      model: request.model,
    });

    try {
      const messages = this.convertMessages(request.messages);

      const response = await fetch(
        `${this.baseUrl}/${request.model}:streamGenerateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: messages,
            generationConfig: {
              temperature: request.temperature ?? 0.7,
              maxOutputTokens: request.maxTokens,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Google API error: ${response.status} - ${error}`);
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
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line) as GoogleStreamResponse;
              
              if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
                yield {
                  content: chunk.candidates[0].content.parts[0].text,
                  done: false,
                };
              }

              if (chunk.usageMetadata) {
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
      this.logger.error('Google streaming failed', error as Record<string, unknown>);
      throw error;
    }
  }

  countTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  getProviderName(): string {
    return 'google-genai';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  private convertMessages(messages: Array<{ role: string; content: string }>): GoogleMessage[] {
    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }],
    }));
  }

  private parseResponse(data: GoogleResponse): LLMResponse {
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No candidates in Google response');
    }

    const content = data.candidates[0].content?.parts?.[0]?.text || '';

    return {
      content,
      finishReason: 'stop',
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.prompt_token_count,
        completionTokens: data.usageMetadata.candidates_token_count || 0,
        totalTokens: data.usageMetadata.total_token_count,
      } : undefined,
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
    return 'google';
  }
}
