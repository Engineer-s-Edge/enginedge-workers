import { Controller, Post, Body } from '@nestjs/common';
import { LLMApplicationService } from '@application/services/llm-application.service';

@Controller('llm')
export class LLMController {
  constructor(
    private readonly llmApplicationService: LLMApplicationService
  ) {}

  @Post('process')
  async processLLMRequest(
    @Body() body: { prompt: string; model: string; parameters?: Record<string, unknown> }
  ) {
    const { prompt, model, parameters } = body;
    return await this.llmApplicationService.processLLMRequest(prompt, model, parameters);
  }
}