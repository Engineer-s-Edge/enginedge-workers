import { Command, CommandResult } from '@domain/entities/command.entities';

export interface ICommandProcessor {
  processCommand(command: Command): Promise<CommandResult>;
}

export interface IMessagePublisher {
  publishResult(result: CommandResult): Promise<void>;
}
