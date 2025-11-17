import {
  Controller,
  Post,
  Body,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { LLMTaskAssistService } from '../../application/services/llm-task-assist.service';

/**
 * Task Assist Controller
 *
 * REST API endpoints for LLM task assist
 *
 * Infrastructure Layer - HTTP adapter
 */
@ApiTags('Task Assist')
@Controller('assistant/agents')
export class TaskAssistController {
  private readonly logger = new Logger(TaskAssistController.name);

  constructor(private readonly llmTaskAssistService: LLMTaskAssistService) {
    this.logger.log('TaskAssistController initialized');
  }

  /**
   * Extract structured task data from natural language
   */
  @Post('task-assist')
  @ApiOperation({ summary: 'Extract structured task data from natural language' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['description'],
      properties: {
        description: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Task data extracted' })
  async taskAssist(@Body() body: { description: string }) {
    this.logger.log(`Extracting task data from description`);
    const result = await this.llmTaskAssistService.extractTaskData(body.description);
    return result;
  }
}
