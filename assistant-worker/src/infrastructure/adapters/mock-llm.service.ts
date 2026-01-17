import { Injectable } from '@nestjs/common';
import { LLMRequest, LLMResponse } from '@domain/entities/llm.entities';
import { ILLMService } from '@application/ports/interfaces';

@Injectable()
export class MockLLMService implements ILLMService {
  async processRequest(request: LLMRequest): Promise<LLMResponse> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Mock response based on the prompt
    const mockContent = `Mock LLM response for prompt: "${request.prompt.substring(0, 50)}..."`;

    return LLMResponse.success(request.id, mockContent, request.model, {
      promptTokens: Math.floor(request.prompt.length / 4),
      completionTokens: Math.floor(mockContent.length / 4),
      totalTokens: Math.floor((request.prompt.length + mockContent.length) / 4),
    });
  }
}
