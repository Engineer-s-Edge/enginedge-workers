import { Module } from '@nestjs/common';
import { CommandController } from './controllers/command.controller';
import { CommandProcessorAdapter } from './adapters/command-processor.adapter';
import { ConsoleMessagePublisher } from './adapters/console-message-publisher.adapter';
import { CommandApplicationService } from '@application/services/command-application.service';
import { ProcessCommandUseCase } from '@application/use-cases/process-command.use-case';

@Module({
  controllers: [CommandController],
  providers: [
    // Application services
    CommandApplicationService,

    // Use cases
    ProcessCommandUseCase,

    // Infrastructure adapters
    {
      provide: 'ICommandProcessor',
      useClass: CommandProcessorAdapter,
    },
    {
      provide: 'IMessagePublisher',
      useClass: ConsoleMessagePublisher,
    },
  ],
  exports: [CommandApplicationService],
})
export class CommandInfrastructureModule {}