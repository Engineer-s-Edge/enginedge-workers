import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaMessageBrokerAdapter } from './kafka-message-broker.adapter';
import { ProcessCommandUseCase } from '../../../application/use-cases/process-command.use-case';
import { CommandDto, CommandResultDto, WorkerStatusDto } from '../../../application/dto/command.dto';
import * as os from 'os';

/**
 * Worker Kafka Service (Infrastructure Layer)
 * 
 * This service coordinates Kafka messaging for the worker node.
 * It acts as a bridge between the infrastructure adapter and application use cases.
 */
@Injectable()
export class WorkerKafkaService implements OnModuleInit {
  private readonly logger = new Logger(WorkerKafkaService.name);

  constructor(
    private readonly kafkaAdapter: KafkaMessageBrokerAdapter,
    private readonly processCommandUseCase: ProcessCommandUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing Worker Kafka Service...');

      // Subscribe to commands topic
      await this.kafkaAdapter.subscribe('commands', async (message: unknown) => {
        await this.handleCommand(message as CommandDto);
      });

      // Notify that worker is connected
      await this.notifyWorkerConnected();

      this.logger.log('Worker Kafka Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Worker Kafka Service:', error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Handle incoming command
   */
  private async handleCommand(command: CommandDto): Promise<void> {
    try {
      const result = await this.processCommandUseCase.execute(command);
      await this.sendResult(result);
    } catch (error) {
      this.logger.error('Failed to handle command:', error as Record<string, unknown>);
      // Send failure result
      await this.sendResult({
        taskId: command?.taskId || 'unknown',
        status: 'FAILURE',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send command result to results topic
   */
  private async sendResult(result: CommandResultDto): Promise<void> {
    await this.kafkaAdapter.sendMessage('results', result);
  }

  /**
   * Notify that worker has connected
   */
  private async notifyWorkerConnected(): Promise<void> {
    const workerInfo: WorkerStatusDto = {
      nodeType: process.env.NODE_TYPE || 'assistant-worker',
      workerId: os.hostname(),
      timestamp: new Date().toISOString(),
      status: 'CONNECTED',
    };

    await this.kafkaAdapter.sendMessage('worker-status', workerInfo);
    this.logger.log(`Worker connected notification sent: ${JSON.stringify(workerInfo)}`);
  }
}

