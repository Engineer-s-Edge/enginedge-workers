/**
 * LLM Controller
 * 
 * REST API endpoints for direct LLM calls.
 * Used by other services (e.g., interview-worker) to call LLMs through assistant-worker.
 */

import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LLMApplicationService } from '@application/services/llm-application.service';
import { LLMRequest } from '@application/ports/llm-provider.port';

export class LLMCompletionDto {
  model!: string;
  messages!: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

@Controller('llm')
export class LLMController {
  constructor(
    private readonly llmApplicationService: LLMApplicationService,
  ) {}

  /**
   * POST /llm/complete - Complete LLM request
   * Used by other services for compartmentalized LLM access
   */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async complete(@Body() dto: LLMCompletionDto) {
    const request: LLMRequest = {
      model: dto.model,
      messages: dto.messages,
      temperature: dto.temperature,
      maxTokens: dto.maxTokens,
      tools: dto.tools,
    };

    return await this.llmApplicationService.complete(request);
  }

  /**
   * POST /llm/process - Legacy endpoint for backward compatibility
   */
  @Post('process')
  async processLLMRequest(
    @Body() body: { prompt: string; model: string; parameters?: Record<string, unknown> },
  ) {
    const { prompt, model, parameters } = body;
    return await this.llmApplicationService.processLLMRequest(prompt, model, parameters);
  }
}
