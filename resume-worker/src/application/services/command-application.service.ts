import { Injectable } from '@nestjs/common';
import { Command, CommandResult } from '@domain/entities/command.entities';
import { ProcessCommandUseCase } from '../use-cases/process-command.use-case';

@Injectable()
export class CommandApplicationService {
  constructor(private readonly processCommandUseCase: ProcessCommandUseCase) {}

  async processCommand(command: Command): Promise<CommandResult> {
    return this.processCommandUseCase.execute(command);
  }
}