/**
 * Kafka Producer Adapter
 *
 * Provides Kafka message publishing functionality for inter-worker communication.
 * Used to dispatch commands to scheduling-worker and other workers.
 */

import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, KafkaConfig } from 'kafkajs';
import { ILogger } from '@application/ports/logger.port';

export interface KafkaMessage {
  topic: string;
  key?: string;
  value: string | object;
  headers?: Record<string, string>;
  partition?: number;
  timestamp?: string;
}

@Injectable()
export class KafkaProducerAdapter implements OnModuleInit, OnModuleDestroy {
  private producer: Producer | null = null;
  private kafka: Kafka | null = null;
  private isConnected = false;

  constructor(@Inject('ILogger') private readonly logger: ILogger) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect to Kafka broker
   */
  private async connect(): Promise<void> {
    try {
      const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

      const kafkaConfig: KafkaConfig = {
        clientId: process.env.KAFKA_CLIENT_ID || 'assistant-worker',
        brokers,
        retry: {
          retries: 3,
          initialRetryTime: 100,
          multiplier: 2,
        },
      };

      this.kafka = new Kafka(kafkaConfig);
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: process.env.KAFKA_AUTO_CREATE_TOPICS === 'true',
      });

      await this.producer.connect();
      this.isConnected = true;
      this.logger.info('Kafka producer connected', { brokers });
    } catch (error) {
      this.logger.error(
        `Failed to connect Kafka producer: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - allow graceful degradation if Kafka is unavailable
      this.isConnected = false;
    }
  }

  /**
   * Disconnect from Kafka broker
   */
  private async disconnect(): Promise<void> {
    if (this.producer && this.isConnected) {
      try {
        await this.producer.disconnect();
        this.isConnected = false;
        this.logger.info('Kafka producer disconnected');
      } catch (error) {
        this.logger.error(
          `Error disconnecting Kafka producer: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Publish a message to a Kafka topic
   */
  async publish(message: KafkaMessage): Promise<void> {
    if (!this.isConnected || !this.producer) {
      this.logger.warn(
        'Kafka producer not connected, message not sent',
        { topic: message.topic },
      );
      return;
    }

    try {
      const value =
        typeof message.value === 'string'
          ? message.value
          : JSON.stringify(message.value);

      await this.producer.send({
        topic: message.topic,
        messages: [
          {
            key: message.key,
            value,
            headers: message.headers,
            partition: message.partition,
            timestamp: message.timestamp,
          },
        ],
      });

      this.logger.debug('Kafka message published', {
        topic: message.topic,
        key: message.key,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish Kafka message: ${error instanceof Error ? error.message : String(error)}`,
        { topic: message.topic, key: message.key },
      );
      throw error;
    }
  }

  /**
   * Publish a command to scheduling-worker
   */
  async publishToSchedulingWorker(
    command: {
      taskId: string;
      taskType: string;
      payload: Record<string, unknown>;
      userId?: string;
      timestamp?: string;
    },
  ): Promise<void> {
    const topic = process.env.KAFKA_SCHEDULING_TOPIC || 'scheduling-commands';

    await this.publish({
      topic,
      key: command.taskId,
      value: {
        ...command,
        timestamp: command.timestamp || new Date().toISOString(),
        source: 'assistant-worker',
      },
      headers: {
        'content-type': 'application/json',
        'task-type': command.taskType,
      },
    });

    this.logger.info('Command published to scheduling-worker', {
      taskId: command.taskId,
      taskType: command.taskType,
      topic,
    });
  }

  /**
   * Check if producer is connected
   */
  isProducerConnected(): boolean {
    return this.isConnected;
  }
}
