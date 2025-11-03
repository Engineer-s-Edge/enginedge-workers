import { Injectable, Logger } from '@nestjs/common';
import { CommandDto, CommandResultDto } from '../dto/command.dto';

/**
 * Use Case: Process Command
 *
 * Orchestrates the processing of commands received from the message queue.
 * This is application layer logic that coordinates domain services and entities.
 */
@Injectable()
export class ProcessCommandUseCase {
  private readonly logger = new Logger(ProcessCommandUseCase.name);

  constructor() {
    this.logger.log('ProcessCommandUseCase initialized');
  }

  /**
   * Execute the command processing use case
   */
  async execute(command: CommandDto): Promise<CommandResultDto> {
    this.logger.log(`Processing command: ${JSON.stringify(command)}`);

    if (!command || !command.taskType) {
      this.logger.error('Invalid command format: missing taskType');
      return {
        taskId: command?.taskId || 'unknown',
        status: 'FAILURE',
        error: 'Invalid command format: missing taskType',
      };
    }

    const { taskId, taskType, payload } = command;

    try {
      let resultPayload: Record<string, unknown>;

      switch (taskType) {
        case 'EXECUTE_ASSISTANT':
          resultPayload = await this.executeAssistantTask(taskId, payload);
          break;
        case 'SCHEDULE_HABITS':
          resultPayload = await this.scheduleHabitsTask(taskId, payload);
          break;
        default:
          throw new Error(`Unknown task type: ${taskType}`);
      }

      return {
        taskId,
        status: 'SUCCESS',
        result: resultPayload,
      };
    } catch (error) {
      this.logger.error(
        `Error processing task ${taskId}:`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        taskId,
        status: 'FAILURE',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute assistant task
   * TODO: Connect to actual agent execution use case
   */
  private async executeAssistantTask(
    taskId: string,
    payload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`Executing assistant task ${taskId}`);
    // Placeholder for actual assistant execution logic
    // This should call the ExecuteAgentUseCase
    return {
      message: `Executed assistant task ${taskId} with payload: ${JSON.stringify(payload)}`,
    };
  }

  /**
   * Schedule habits task
   * TODO: Implement habits scheduling logic
   */
  private async scheduleHabitsTask(
    taskId: string,
    payload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`Scheduling habits for task ${taskId}`);
    // Placeholder for scheduling logic
    return {
      message: `Scheduled habits for task ${taskId}`,
    };
  }
}
