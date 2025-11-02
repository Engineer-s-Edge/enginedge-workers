import { Injectable, Inject } from '@nestjs/common';
import { ILLMProvider, LLMRequest, LLMResponse, LLMStreamChunk } from '@application/ports/llm-provider.port';
import { ILogger } from '@application/ports/logger.port';

interface GroqMessage {
  role: string;
  content: string;
}

interface GroqUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface GroqChoice {
  message: GroqMessage;
  finish_reason: string;
}

interface GroqResponse {
  choices: GroqChoice[];
  usage: GroqUsage;
}

/**
 * Groq LLM Adapter
 * 
 * Implements ILLMProvider for Groq API
 * Supports high-speed inference with OpenAI-compatible endpoint
 */
@Injectable()
export class GroqLLMAdapter implements ILLMProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    @Inject('ILogger')
    private readonly logger: ILogger,
  ) {
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.baseUrl = process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1';
    
    if (!this.apiKey) {
      this.logger.warn('GroqLLMAdapter: Groq API key not configured');
    }
  }

  async invoke(request: LLMRequest): Promise<LLMResponse> {
    this.logger.debug('GroqLLMAdapter: Invoking Groq LLM', {
      model: request.model,
      messageCount: request.messages.length,
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
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
        throw new Error(`Groq API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as GroqResponse;
      
      return this.parseResponse(data);
    } catch (error) {
      this.logger.error('Groq LLM invocation failed', error as Record<string, unknown>);
      throw error;
    }
  }

  async *invokeStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, void, unknown> {
    this.logger.debug('GroqLLMAdapter: Starting Groq streaming', {
      model: request.model,
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
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
        throw new Error(`Groq API error: ${response.status} - ${error}`);
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
      this.logger.error('Groq streaming failed', error as Record<string, unknown>);
      throw error;
    }
  }

  countTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  getProviderName(): string {
    return 'groq';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private parseResponse(data: GroqResponse): LLMResponse {
    const choice = data.choices[0];
    
    if (!choice) {
      throw new Error('No choices in Groq response');
    }

    const content = choice.message?.content || '';
    const finishReason = choice.finish_reason;

    return {
      content,
      finishReason,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
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
    const response = await this.invoke(request);
    yield response.content;
  }

  /**
   * Get model name
   */
  getModelName(): string {
    return 'groq';
  }

  async speechToText(audioBuffer: Buffer, language?: string): Promise<string> {
    throw new Error('Speech-to-text not implemented. Use a dedicated STT service.');
  }

  async textToSpeech(text: string, voice?: string): Promise<Buffer> {
    throw new Error('Text-to-speech not implemented. Use a dedicated TTS service.');
  }
}
