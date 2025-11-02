import { Injectable, Inject } from '@nestjs/common';
import { LLMRequest, LLMResponse } from '@application/ports/llm-provider.port';
import { ILLMProvider } from '@application/ports/llm-provider.port';
import { ProcessLLMRequestUseCase } from '@application/use-cases/process-llm-request.use-case';

@Injectable()
export class LLMApplicationService {
  constructor(
    @Inject('ILLMProvider')
    private readonly llmProvider: ILLMProvider,
    private readonly processLLMRequestUseCase: ProcessLLMRequestUseCase,
  ) {}

  /**
   * Complete LLM request - Direct call to LLM provider
   * Used by other services for compartmentalized LLM access
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    return await this.llmProvider.complete(request);
  }

  /**
   * Legacy method for backward compatibility
   */
  async processLLMRequest(prompt: string, model: string, parameters?: Record<string, unknown>) {
    const request: LLMRequest = {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: parameters?.temperature as number,
      maxTokens: parameters?.maxTokens as number,
    };
    return await this.complete(request);
  }
}