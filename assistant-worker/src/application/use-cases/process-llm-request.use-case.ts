import { Injectable, Inject } from '@nestjs/common';
import { LLMRequest, LLMResponse } from '@domain/entities/llm.entities';
import { ILLMService } from '@application/ports/interfaces';
import {
  IMessagePublisher,
  QueueMessage,
} from '@application/ports/message-queue.port';

@Injectable()
export class ProcessLLMRequestUseCase {
  constructor(
    @Inject('ILLMService') private readonly llmService: ILLMService,
    @Inject('IMessagePublisher')
    private readonly messagePublisher: IMessagePublisher,
  ) {}

  async execute(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.llmService.processRequest(request);

      // Publish success message
      const message: QueueMessage = {
        id: crypto.randomUUID(),
        topic: 'llm.responses',
        payload: {
          type: 'llm.response.success',
          requestId: request.id,
          responseId: response.id,
          content: response.content,
          model: response.model,
          usage: response.usage,
        },
        timestamp: new Date(),
      };

      await this.messagePublisher.publish('llm.responses', message);

      return response;
    } catch (error) {
      // Publish error message
      const errorMessage: QueueMessage = {
        id: crypto.randomUUID(),
        topic: 'llm.responses',
        payload: {
          type: 'llm.response.error',
          requestId: request.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: new Date(),
      };

      await this.messagePublisher.publish('llm.responses', errorMessage);

      return LLMResponse.error(
        request.id,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
