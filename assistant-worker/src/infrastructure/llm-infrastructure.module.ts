import { Module } from '@nestjs/common';
import { LLMController } from './controllers/llm.controller';
import { LLMApplicationService } from '@application/services/llm-application.service';
import { ProcessLLMRequestUseCase } from '@application/use-cases/process-llm-request.use-case';
import { MockLLMService } from './adapters/mock-llm.service';
import { ConsoleMessagePublisher } from './adapters/console-message-publisher';

@Module({
  controllers: [LLMController],
  providers: [
    LLMApplicationService,
    ProcessLLMRequestUseCase,
    {
      provide: 'ILLMService',
      useClass: MockLLMService
    },
    {
      provide: 'IMessagePublisher',
      useClass: ConsoleMessagePublisher
    }
  ],
  exports: [LLMApplicationService]
})
export class LLMInfrastructureModule {}