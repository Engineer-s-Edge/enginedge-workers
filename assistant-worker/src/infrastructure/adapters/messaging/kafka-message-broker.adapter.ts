import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, Producer, KafkaConfig } from 'kafkajs';
import { MessageBrokerPort } from '../../../application/ports/message-broker.port';
import { MetricsAdapter } from '../monitoring/metrics.adapter';

/**
 * Kafka Message Broker Adapter (Infrastructure Layer)
 *
 * Implements the MessageBrokerPort interface for Kafka.
 * This adapter handles all Kafka-specific implementation details including:
 * - Message publishing and consumption
 * - Retry logic with exponential backoff
 * - Dead Letter Queue (DLQ) for failed messages
 */
@Injectable()
export class KafkaMessageBrokerAdapter
  implements MessageBrokerPort, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaMessageBrokerAdapter.name);
  private kafka!: Kafka;
  private consumer!: Consumer;
  private producer!: Producer;
  private connected = false;

  // DLQ configuration
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly dlqSuffix = '.dlq';

  constructor(
    private readonly configService: ConfigService,
    private readonly metrics: MetricsAdapter,
  ) {
    this.maxRetries = this.configService.get<number>('KAFKA_MAX_RETRIES', 3);
    this.retryDelayMs = this.configService.get<number>(
      'KAFKA_RETRY_DELAY_MS',
      1000,
    );
    this.initializeKafka();
  }

  /**
   * Initialize Kafka client with configuration
   */
  private initializeKafka(): void {
    const brokers = this.configService.get<string>(
      'KAFKA_BROKERS',
      'localhost:9092',
    );
    const securityProtocol = this.configService.get<string>(
      'KAFKA_SECURITY_PROTOCOL',
      'PLAINTEXT',
    );
    const saslMechanism = this.configService.get<string>(
      'KAFKA_SASL_MECHANISM',
    );
    const saslUsername = this.configService.get<string>('KAFKA_SASL_USERNAME');
    const saslPassword = this.configService.get<string>('KAFKA_SASL_PASSWORD');

    const kafkaConfig: KafkaConfig = {
      clientId: 'assistant-worker',
      brokers: brokers.split(',').map((broker) => broker.trim()),
    };

    // Add SASL configuration if security protocol requires it
    if (
      securityProtocol === 'SASL_PLAINTEXT' &&
      saslMechanism &&
      saslUsername &&
      saslPassword
    ) {
      if (saslMechanism === 'plain') {
        kafkaConfig.sasl = {
          mechanism: 'plain' as const,
          username: saslUsername,
          password: saslPassword,
        };
      } else if (saslMechanism === 'scram-sha-256') {
        kafkaConfig.sasl = {
          mechanism: 'scram-sha-256' as const,
          username: saslUsername,
          password: saslPassword,
        };
      } else if (saslMechanism === 'scram-sha-512') {
        kafkaConfig.sasl = {
          mechanism: 'scram-sha-512' as const,
          username: saslUsername,
          password: saslPassword,
        };
      }
    }

    this.logger.log(
      `Initializing Kafka with brokers: ${brokers}, security: ${securityProtocol}`,
    );

    this.kafka = new Kafka(kafkaConfig);
    this.consumer = this.kafka.consumer({ groupId: 'assistant-worker-group' });
    this.producer = this.kafka.producer();
  }

  /**
   * Connect to Kafka on module initialization
   */
  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  /**
   * Disconnect from Kafka on module destruction
   */
  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Connect to Kafka broker
   */
  async connect(): Promise<void> {
    try {
      this.logger.log('Connecting to Kafka...');

      await this.consumer.connect();
      this.logger.log('Kafka consumer connected');

      await this.producer.connect();
      this.logger.log('Kafka producer connected');

      this.connected = true;
      this.logger.log('Successfully connected to Kafka');
    } catch (error) {
      this.logger.error(
        'Failed to connect to Kafka:',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Disconnect from Kafka broker
   */
  async disconnect(): Promise<void> {
    try {
      this.logger.log('Disconnecting from Kafka...');

      await this.consumer.disconnect();
      await this.producer.disconnect();

      this.connected = false;
      this.logger.log('Successfully disconnected from Kafka');
    } catch (error) {
      this.logger.error(
        'Failed to disconnect from Kafka:',
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Check if connected to Kafka
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send a message to a topic
   */
  async sendMessage(topic: string, message: unknown): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(message) }],
      });

      // Record metrics
      this.metrics.recordKafkaMessageProduced(topic);

      this.logger.debug(`Message sent to topic ${topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to topic ${topic}:`,
        error as Record<string, unknown>,
      );
      throw error;
    }
  }

  /**
   * Send a message to the Dead Letter Queue
   */
  private async sendToDLQ(
    topic: string,
    message: unknown,
    error: Error,
    retryCount: number,
  ): Promise<void> {
    const dlqTopic = `${topic}${this.dlqSuffix}`;

    const dlqMessage = {
      originalTopic: topic,
      originalMessage: message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      retryCount,
      timestamp: new Date().toISOString(),
      workerId: 'assistant-worker',
    };

    try {
      await this.producer.send({
        topic: dlqTopic,
        messages: [{ value: JSON.stringify(dlqMessage) }],
      });

      // Record DLQ metrics
      this.metrics.recordDLQMessage(topic, error.name);
      this.metrics.recordKafkaMessageProduced(dlqTopic);

      this.logger.warn(
        `Message sent to DLQ topic ${dlqTopic} after ${retryCount} retries`,
        {
          originalTopic: topic,
          errorMessage: error.message,
        },
      );
    } catch (dlqError) {
      this.logger.error('Failed to send message to DLQ:', {
        dlqTopic,
        error: dlqError as Record<string, unknown>,
      });
      // Log the original message for manual recovery
      this.logger.error('Lost message (DLQ send failed):', {
        topic,
        message,
        error: error.message,
      });
    }
  }

  /**
   * Sleep for exponential backoff
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Process a message with retry logic
   */
  private async processMessageWithRetry(
    topic: string,
    message: unknown,
    handler: (message: unknown) => Promise<void>,
  ): Promise<void> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await handler(message);

        const durationSeconds = (Date.now() - startTime) / 1000;

        // Record success metrics
        this.metrics.recordKafkaMessageConsumed(topic, 'success');
        this.metrics.recordKafkaMessageProcessingDuration(
          topic,
          durationSeconds,
        );

        // Success - log if retried
        if (attempt > 0) {
          this.logger.log(
            `Message processed successfully after ${attempt} retries`,
            {
              topic,
              attempt,
              durationSeconds,
            },
          );
        }

        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Record retry metrics
        if (attempt > 0) {
          this.metrics.recordMessageRetry(topic, attempt);
        }

        if (attempt < this.maxRetries) {
          // Calculate exponential backoff delay
          const delayMs = this.retryDelayMs * Math.pow(2, attempt);

          // Record retry attempt
          this.metrics.recordKafkaMessageConsumed(topic, 'retry');

          this.logger.warn(
            `Message processing failed, retrying (${attempt + 1}/${this.maxRetries})`,
            {
              topic,
              attempt: attempt + 1,
              delayMs,
              error: lastError.message,
            },
          );

          await this.sleep(delayMs);
        } else {
          // Max retries exceeded - record error
          const durationSeconds = (Date.now() - startTime) / 1000;
          this.metrics.recordKafkaMessageConsumed(topic, 'error');
          this.metrics.recordKafkaMessageProcessingDuration(
            topic,
            durationSeconds,
          );

          // Max retries exceeded - send to DLQ
          this.logger.error(
            `Message processing failed after ${this.maxRetries} retries, sending to DLQ`,
            {
              topic,
              error: lastError.message,
              durationSeconds,
            },
          );
        }
      }
    }

    // All retries exhausted - send to DLQ
    if (lastError) {
      await this.sendToDLQ(topic, message, lastError, this.maxRetries);
    }
  }

  /**
   * Subscribe to a topic and handle messages with retry logic and DLQ
   */
  async subscribe(
    topic: string,
    handler: (message: unknown) => Promise<void>,
  ): Promise<void> {
    try {
      await this.consumer.subscribe({ topic, fromBeginning: false });
      this.logger.log(
        `Subscribed to topic: ${topic} (max retries: ${this.maxRetries})`,
      );

      await this.consumer.run({
        eachMessage: async ({ topic: receivedTopic, partition, message }) => {
          this.logger.debug({
            message: `Received message from topic: ${receivedTopic}`,
            partition,
            offset: message.offset,
          });

          if (!message.value) {
            this.logger.warn('Received message with null value, skipping');
            return;
          }

          try {
            const parsedMessage = JSON.parse(message.value.toString());

            // Process with retry logic and DLQ
            await this.processMessageWithRetry(
              receivedTopic,
              parsedMessage,
              handler,
            );
          } catch (parseError) {
            this.logger.error('Failed to parse message JSON:', {
              error: parseError as Record<string, unknown>,
              rawMessage: message.value.toString(),
            });

            // Send unparseable message to DLQ
            await this.sendToDLQ(
              receivedTopic,
              message.value.toString(),
              parseError instanceof Error
                ? parseError
                : new Error('JSON parse error'),
              0,
            );
          }
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to topic ${topic}:`,
        error as Record<string, unknown>,
      );
      throw error;
    }
  }
}
