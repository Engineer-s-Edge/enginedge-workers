import { Injectable, Logger } from '@nestjs/common';
import { CommandResult } from '@domain/entities/command.entities';
import { IMessagePublisher } from '@application/ports/interfaces';

@Injectable()
export class ConsoleMessagePublisher implements IMessagePublisher {
  private readonly logger = new Logger(ConsoleMessagePublisher.name);

  constructor() {
    this.logger.log('ConsoleMessagePublisher initialized');
  }

  async publishResult(result: CommandResult): Promise<void> {
    this.logger.log(`Publishing result: ${JSON.stringify(result)}`);
    // In a real implementation, this would publish to Kafka, Redis, etc.
    // For now, just log to console
  }
}
