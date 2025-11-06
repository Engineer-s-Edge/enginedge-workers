import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, Producer, KafkaConfig } from 'kafkajs';
import { MessageBrokerPort } from '@application/ports/message-broker.port';

/**
 * Kafka Message Broker Adapter (Infrastructure Layer)
 *
 * Implements the MessageBrokerPort interface for Kafka.
 * This adapter handles all Kafka-specific implementation details.
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
  private lastErrorLogAt = 0;
  private errorLogIntervalMs = 60000;
  private suppressErrorLogs = true;
  private loggedFirstError = false;

  constructor(private readonly configService: ConfigService) {
    // Error logging controls
    this.errorLogIntervalMs = parseInt(
      this.configService.get<string>('KAFKA_ERROR_LOG_INTERVAL_MS') || '60000',
      10,
    );
    this.suppressErrorLogs =
      (this.configService.get<string>('KAFKA_SUPPRESS_ERRORS') || 'true') ===
      'true';

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

    // Suppress KafkaJS internal logs by default to avoid console spam
    const kafkaLogLevel =
      this.configService.get<string>('KAFKA_LOG_LEVEL') || 'NOTHING';
    const logLevelMap: Record<string, number> = {
      NOTHING: 0,
      ERROR: 4,
      WARN: 5,
      INFO: 6,
      DEBUG: 7,
    };
    const logCreator = () => {
      return () => {
        // no-op (silence KafkaJS internal logs)
      };
    };

    const kafkaConfig: KafkaConfig = {
      clientId: 'worker-node',
      brokers: brokers.split(',').map((broker) => broker.trim()),
      logLevel: logLevelMap[kafkaLogLevel] ?? 0,
      logCreator: kafkaLogLevel === 'NOTHING' ? logCreator : undefined,
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
    this.consumer = this.kafka.consumer({ groupId: 'worker-group' });
    this.producer = this.kafka.producer();
  }

  /**
   * Connect to Kafka on module initialization
   * Non-blocking: app can start even if Kafka is unavailable
   */
  async onModuleInit(): Promise<void> {
    // Connect in background, don't block app startup (silent mode)
    // Errors are handled silently to avoid log spam
    this.connect(true).catch(() => {
      this.connected = false;
      // Connection errors are suppressed during startup
      // Will retry automatically when sendMessage/subscribe are called
    });
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
  async connect(silent = false): Promise<void> {
    try {
      if (!silent) {
        this.logger.log('Connecting to Kafka...');
      }

      await this.consumer.connect();
      if (!silent) {
        this.logger.log('Kafka consumer connected');
      }

      await this.producer.connect();
      if (!silent) {
        this.logger.log('Kafka producer connected');
      }

      this.connected = true;
      if (!silent) {
        this.logger.log('Successfully connected to Kafka');
      }
    } catch (error) {
      // Only log errors if not in silent mode and suppression allows it
      if (!silent) {
        const now = Date.now();
        const shouldLog =
          !this.suppressErrorLogs ||
          !this.loggedFirstError ||
          now - this.lastErrorLogAt >= this.errorLogIntervalMs;

        if (shouldLog) {
          this.loggedFirstError = true;
          this.lastErrorLogAt = now;
          const logLevel = this.suppressErrorLogs ? 'warn' : 'error';
          this.logger[logLevel](
            this.suppressErrorLogs
              ? 'Failed to connect to Kafka (suppressed)'
              : 'Failed to connect to Kafka',
            { error: (error as Error).message },
          );
        }
      }
      // Always throw error to allow retry logic, but don't log in silent mode
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
      // Auto-connect if not connected
      if (!this.connected) {
        await this.connect();
      }

      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(message) }],
      });
      this.logger.debug(`Message sent to topic ${topic}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to topic ${topic}:`,
        error as Record<string, unknown>,
      );
      this.connected = false; // Mark as disconnected on error
      throw error;
    }
  }

  /**
   * Subscribe to a topic and handle messages
   */
  async subscribe(
    topic: string,
    handler: (message: unknown) => Promise<void>,
  ): Promise<void> {
    try {
      // Auto-connect if not connected
      if (!this.connected) {
        await this.connect();
      }

      await this.consumer.subscribe({ topic, fromBeginning: false });
      this.logger.log(`Subscribed to topic: ${topic}`);

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
            await handler(parsedMessage);
          } catch (error) {
            this.logger.error(
              'Failed to process message:',
              error as Record<string, unknown>,
            );
            // Depending on requirements, you might want to send to a dead-letter queue
          }
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to subscribe to topic ${topic}:`,
        error as Record<string, unknown>,
      );
      this.connected = false; // Mark as disconnected on error
      throw error;
    }
  }
}
