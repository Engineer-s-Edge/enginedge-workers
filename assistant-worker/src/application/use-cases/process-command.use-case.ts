import { Injectable, Logger, Inject } from '@nestjs/common';
import { CommandDto, CommandResultDto } from '../dto/command.dto';
import { ExecuteAgentUseCase } from './execute-agent.use-case';
import { AssistantExecutorService } from '../services/assistant-executor.service';
import { ILogger } from '../ports/logger.port';

/**
 * Use Case: Process Command
 *
 * Orchestrates the processing of commands received from the message queue.
 * This is application layer logic that coordinates domain services and entities.
 */
@Injectable()
export class ProcessCommandUseCase {
  private readonly logger = new Logger(ProcessCommandUseCase.name);

  constructor(
    private readonly executeAgentUseCase: ExecuteAgentUseCase,
    private readonly assistantExecutorService: AssistantExecutorService,
    @Inject('ILogger')
    private readonly appLogger: ILogger,
  ) {
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
   * Connects to actual agent execution use case
   */
  private async executeAssistantTask(
    taskId: string,
    payload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`Executing assistant task ${taskId}`);

    try {
      const assistantName = payload?.assistantName as string;
      const userId = payload?.userId as string;
      const input = payload?.input as string;
      const conversationId = payload?.conversationId as string | undefined;

      if (!assistantName || !userId || !input) {
        throw new Error(
          'Missing required fields: assistantName, userId, and input are required',
        );
      }

      // Execute assistant using AssistantExecutorService
      const result = await this.assistantExecutorService.execute(
        assistantName,
        {
          userId,
          input,
          conversationId,
          options: payload?.options as any,
        },
      );

      return {
        taskId,
        success: result.success,
        result: result.result,
        assistant: result.assistant,
        type: result.type,
        sessionId: result.sessionId,
        executionTime: result.executionTime,
      };
    } catch (error) {
      this.logger.error(
        `Failed to execute assistant task ${taskId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Schedule habits task
   * Implements habits scheduling logic via message broker or scheduling worker
   */
  private async scheduleHabitsTask(
    taskId: string,
    payload?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`Scheduling habits for task ${taskId}`);

    try {
      const userId = payload?.userId as string;
      const habits = payload?.habits as Array<{
        name: string;
        frequency: string;
        time?: string;
        days?: string[];
      }>;

      if (!userId || !habits || !Array.isArray(habits)) {
        throw new Error(
          'Missing required fields: userId and habits array are required',
        );
      }

      // TODO: In production, publish to scheduling-worker via Kafka message broker
      // For now, log the scheduling request
      this.appLogger.info('Scheduling habits', {
        taskId,
        userId,
        habitsCount: habits.length,
        habits: habits.map((h) => ({
          name: h.name,
          frequency: h.frequency,
          time: h.time,
          days: h.days,
        })),
      });

      // Simulate scheduling (in production, this would call scheduling-worker)
      const scheduledHabits = habits.map((habit) => ({
        habitId: `habit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: habit.name,
        frequency: habit.frequency,
        time: habit.time,
        days: habit.days,
        status: 'scheduled',
        scheduledAt: new Date().toISOString(),
      }));

      return {
        taskId,
        userId,
        scheduledHabits,
        count: scheduledHabits.length,
        message: `Successfully scheduled ${scheduledHabits.length} habits`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to schedule habits for task ${taskId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
