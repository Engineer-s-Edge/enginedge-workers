import { Injectable } from '@nestjs/common';
import { CommandDto, CommandResultDto } from '../dto/command.dto';
import { ProcessCommandUseCase } from '../use-cases/process-command.use-case';

@Injectable()
export class CommandApplicationService {
  constructor(private readonly processCommandUseCase: ProcessCommandUseCase) {}

  async processCommand(command: CommandDto): Promise<CommandResultDto> {
    return this.processCommandUseCase.execute(command);
  }
}
