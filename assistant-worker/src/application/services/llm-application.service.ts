import { Injectable } from '@nestjs/common';
import { LLMRequest } from '@domain/entities/llm.entities';
import { ProcessLLMRequestUseCase } from '@application/use-cases/process-llm-request.use-case';

@Injectable()
export class LLMApplicationService {
  constructor(
    private readonly processLLMRequestUseCase: ProcessLLMRequestUseCase
  ) {}

  async processLLMRequest(prompt: string, model: string, parameters?: Record<string, unknown>) {
    const request = LLMRequest.create(prompt, model, parameters);
    return await this.processLLMRequestUseCase.execute(request);
  }
}