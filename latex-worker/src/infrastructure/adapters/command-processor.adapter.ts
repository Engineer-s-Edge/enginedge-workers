import { Injectable, Logger } from '@nestjs/common';
import { CommandDto, CommandResultDto } from '@application/dto/command.dto';
import { ICommandProcessor } from '@application/ports/interfaces';

@Injectable()
export class CommandProcessorAdapter implements ICommandProcessor {
  private readonly logger = new Logger(CommandProcessorAdapter.name);

  constructor() {
    this.logger.log('CommandProcessorAdapter initialized');
  }

  async processCommand(command: CommandDto): Promise<CommandResultDto> {
    this.logger.log(`Processing command: ${JSON.stringify(command)}`);

    if (!command || !command.taskType) {
      this.logger.error('Invalid command format: missing taskType');
      return {
        taskId: command.taskId || 'unknown',
        status: 'FAILURE',
        error: 'Invalid command format: missing taskType',
      };
    }

    const { taskId, taskType, payload } = command;

    try {
      let resultPayload: Record<string, unknown>;

      switch (taskType) {
        case 'EXECUTE_ASSISTANT':
          this.logger.log(`Executing assistant task ${taskId}`);
          resultPayload = {
            message: `Executed assistant task ${taskId} with payload: ${JSON.stringify(payload)}`,
          };
          break;

        case 'SCHEDULE_HABITS':
          this.logger.log(`Scheduling habits for task ${taskId}`);
          resultPayload = { message: `Scheduled habits for task ${taskId}` };
          break;

        default:
          throw new Error(`Unknown task type: ${taskType}`);
      }

      return {
        taskId: taskId,
        status: 'SUCCESS',
        result: resultPayload,
      };
    } catch (error) {
      this.logger.error(
        `Error processing task ${taskId}:`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        taskId: taskId,
        status: 'FAILURE',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
