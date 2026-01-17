import { Injectable, Logger, Inject } from '@nestjs/common';
import { Command, CommandResult } from '@domain/entities/command.entities';
import { ICommandProcessor, IMessagePublisher } from '../ports/interfaces';

@Injectable()
export class ProcessCommandUseCase {
  private readonly logger = new Logger(ProcessCommandUseCase.name);

  constructor(
    @Inject('ICommandProcessor')
    private readonly commandProcessor: ICommandProcessor,
    @Inject('IMessagePublisher')
    private readonly messagePublisher: IMessagePublisher,
  ) {}

  async execute(command: Command): Promise<CommandResult> {
    this.logger.log(`Processing command: ${command.taskId}`);

    const result = await this.commandProcessor.processCommand(command);

    // Publish the result asynchronously
    this.messagePublisher.publishResult(result).catch((error) => {
      this.logger.error(
        `Failed to publish result for task ${command.taskId}:`,
        error,
      );
    });

    return result;
  }
}
