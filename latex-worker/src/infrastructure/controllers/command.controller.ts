import { Controller, Post, Body } from '@nestjs/common';
import { CommandDto, CommandResultDto } from '@application/dto/command.dto';
import { CommandApplicationService } from '@application/services/command-application.service';

@Controller('command')
export class CommandController {
  constructor(
    private readonly commandApplicationService: CommandApplicationService,
  ) {}

  @Post('process')
  async processCommand(@Body() command: CommandDto): Promise<CommandResultDto> {
    return this.commandApplicationService.processCommand(command);
  }
}
