/**
 * Mock LLM Adapter
 *
 * Provides mock LLM responses for testing without external dependencies.
 * Can be swapped with real providers later (OpenAI, Anthropic, etc.)
 */

import { Injectable } from '@nestjs/common';
import { ILLMProvider, LLMRequest, LLMResponse } from '@application/ports';

/**
 * Mock LLM Provider - for testing and development
 */
@Injectable()
export class MockLLMAdapter implements ILLMProvider {
  private modelName = 'mock-gpt-4';

  /**
   * Complete a request with mock response
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Get the last user message
    const userMessage =
      request.messages.find((msg) => msg.role === 'user')?.content || '';
    const content = this.generateMockResponse(userMessage);

    return {
      content,
      finishReason: 'stop',
      usage: {
        promptTokens: userMessage.length / 4,
        completionTokens: content.length / 4,
        totalTokens: (userMessage.length + content.length) / 4,
      },
    };
  }

  /**
   * Stream completion responses
   */
  async *stream(request: LLMRequest): AsyncIterable<string> {
    const response = await this.complete(request);
    const words = response.content.split(' ');

    for (const word of words) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield word + ' ';
    }
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'mock-llm';
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Get model name
   */
  getModelName(): string {
    return this.modelName;
  }

  /**
   * Generate mock response based on input
   */
  private generateMockResponse(input: string): string {
    const lowerInput = input.toLowerCase();

    // Simple pattern matching for common queries
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return 'Hello! I am a mock AI assistant. How can I help you today?';
    }

    if (lowerInput.includes('capital')) {
      return 'I detected you are asking about a capital city. In a real LLM, I would provide accurate geographical information.';
    }

    if (lowerInput.includes('weather')) {
      return 'I am a mock LLM and cannot access real-time weather data. This is where a real LLM with access to external tools would shine.';
    }

    if (lowerInput.includes('compute') || lowerInput.includes('calculate')) {
      return 'I can help with calculations. In this mock version, I would return formatted computational results.';
    }

    if (lowerInput.includes('research') || lowerInput.includes('analyze')) {
      return 'I can conduct research and analysis. The mock version provides placeholder insights that demonstrate the analysis workflow.';
    }

    if (lowerInput.includes('decompose') || lowerInput.includes('break')) {
      return '1. Initial analysis\n2. Task identification\n3. Subtask definition\n4. Resource allocation\n5. Execution planning';
    }

    if (lowerInput.includes('learn') || lowerInput.includes('train')) {
      return 'I can assist with machine learning tasks. Mock training: Model accuracy improved from 0.75 to 0.92 after 10 epochs.';
    }

    if (lowerInput.includes('expert') || lowerInput.includes('research')) {
      return 'Expert research findings: After analyzing multiple sources, the key conclusions are: 1) Supporting point A, 2) Supporting point B, 3) Key insight C.';
    }

    // Default response
    return `Mock LLM processed your input: "${input.substring(0, 50)}...". In production, this would be a real LLM response.`;
  }
}
