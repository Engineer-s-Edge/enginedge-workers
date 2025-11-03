import { Controller, Post, Body } from '@nestjs/common';
import { Command, CommandResult } from '@domain/entities/command.entities';
import { CommandApplicationService } from '@application/services/command-application.service';

@Controller('command')
export class CommandController {
  constructor(
    private readonly commandApplicationService: CommandApplicationService,
  ) {}

  @Post('process')
  async processCommand(@Body() command: Command): Promise<CommandResult> {
    return this.commandApplicationService.processCommand(command);
  }
}
