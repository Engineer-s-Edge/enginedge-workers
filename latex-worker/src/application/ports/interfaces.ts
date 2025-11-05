import { CommandDto, CommandResultDto } from '../dto/command.dto';

export interface ICommandProcessor {
  processCommand(command: CommandDto): Promise<CommandResultDto>;
}

export interface IMessagePublisher {
  publishResult(result: CommandResultDto): Promise<void>;
}
