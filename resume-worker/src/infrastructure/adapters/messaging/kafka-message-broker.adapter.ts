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
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectInterval = 5000; // 5 seconds
  private connectionErrorLogged = false;

  constructor(private readonly configService: ConfigService) {
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
      clientId: 'worker-node',
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

    // Suppress KafkaJS verbose logging to reduce spam when Kafka is unavailable
    const kafkaLogLevel =
      this.configService.get<string>('KAFKA_LOG_LEVEL') || 'NOTHING';
    const logCreator = () => {
      return () => {
        // No-op: suppress all KafkaJS logs by default
      };
    };

    const logLevelMap: Record<string, number> = {
      NOTHING: 0,
      ERROR: 4,
      WARN: 5,
      INFO: 6,
      DEBUG: 7,
    };

    const finalKafkaConfig: KafkaConfig = {
      ...kafkaConfig,
      retry: { initialRetryTime: 300, retries: 3 },
      logLevel: logLevelMap[kafkaLogLevel] ?? 0,
      logCreator: kafkaLogLevel === 'NOTHING' ? logCreator : undefined,
    };

    this.kafka = new Kafka(finalKafkaConfig);
    this.consumer = this.kafka.consumer({ groupId: 'worker-group' });
    this.producer = this.kafka.producer();
  }

  /**
   * Connect to Kafka on module initialization
   * Does not throw errors - allows app to start even if Kafka is unavailable
   */
  async onModuleInit(): Promise<void> {
    // Try to connect, but don't fail if Kafka is unavailable
    await this.connect().catch(() => {
      // Connection failed, will retry in background
      // Don't throw - allow app to start without Kafka
    });
  }

  /**
   * Disconnect from Kafka on module destruction
   */
  async onModuleDestroy(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    await this.disconnect().catch(() => {
      // Ignore disconnect errors during shutdown
    });
  }

  /**
   * Connect to Kafka broker
   * Handles connection failures gracefully with retry logic
   */
  async connect(): Promise<void> {
    try {
      if (!this.connectionErrorLogged) {
        this.logger.log('Connecting to Kafka...');
      }

      await this.consumer.connect();
      await this.producer.connect();

      this.connected = true;
      this.reconnectAttempts = 0;

      // Reset error logged flag and log success if we were previously disconnected
      if (this.connectionErrorLogged) {
        this.logger.log('Successfully reconnected to Kafka');
      } else {
        this.logger.log('Successfully connected to Kafka');
      }
      this.connectionErrorLogged = false;
    } catch (error) {
      this.connected = false;

      // Silently handle connection errors - don't log to prevent spam
      // Only log once to indicate Kafka is unavailable
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        !this.connectionErrorLogged &&
        !errorMessage.includes('ECONNREFUSED') &&
        !errorMessage.includes('Connection')
      ) {
        // Log non-connection errors (but only once)
        this.logger.warn(
          'Failed to connect to Kafka (will retry in background):',
          errorMessage,
        );
        this.connectionErrorLogged = true;
      } else if (!this.connectionErrorLogged) {
        // Log connection refused once
        this.logger.warn(
          'Kafka is not available (will retry in background). Application will continue without Kafka messaging.',
        );
        this.connectionErrorLogged = true;
      }

      // Schedule reconnection attempt
      this.scheduleReconnect();

      // Don't throw - allow app to continue without Kafka
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return; // Stop trying after max attempts
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      await this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Disconnect from Kafka broker
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connected) {
        await this.consumer.disconnect().catch(() => {
          // Ignore disconnect errors
        });
        await this.producer.disconnect().catch(() => {
          // Ignore disconnect errors
        });
      }

      this.connected = false;
    } catch (error) {
      // Ignore disconnect errors during shutdown
      this.connected = false;
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
   * Handles disconnections gracefully - attempts to reconnect if needed
   */
  async sendMessage(topic: string, message: unknown): Promise<void> {
    // Try to reconnect if not connected
    if (!this.connected) {
      await this.connect().catch(() => {
        // Connection failed, will throw error below
      });
    }

    if (!this.connected) {
      throw new Error('Kafka is not available. Message could not be sent.');
    }

    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(message) }],
      });
      this.logger.debug(`Message sent to topic ${topic}`);
    } catch (error) {
      // Mark as disconnected and try to reconnect
      this.connected = false;
      this.scheduleReconnect();

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to send message to topic ${topic}: ${errorMessage}`,
      );
      throw error;
    }
  }

  /**
   * Subscribe to a topic and handle messages
   * Handles disconnections gracefully - attempts to reconnect if needed
   */
  async subscribe(
    topic: string,
    handler: (message: unknown) => Promise<void>,
  ): Promise<void> {
    // Try to reconnect if not connected
    if (!this.connected) {
      await this.connect().catch(() => {
        // Connection failed, will log warning below
      });
    }

    if (!this.connected) {
      this.logger.warn(
        `Cannot subscribe to topic ${topic}: Kafka is not available. Will retry when connection is established.`,
      );
      // Schedule a retry when connection is established
      const originalHandler = handler;
      const checkAndSubscribe = async () => {
        if (this.connected) {
          try {
            await this.subscribe(topic, originalHandler);
          } catch (error) {
            // Already logged in recursive call
          }
        } else {
          // Check again later
          setTimeout(checkAndSubscribe, 5000);
        }
      };
      setTimeout(checkAndSubscribe, 5000);
      return;
    }

    try {
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
      // Mark as disconnected and try to reconnect
      this.connected = false;
      this.scheduleReconnect();

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to subscribe to topic ${topic}: ${errorMessage}. Will retry when connection is established.`,
      );
      // Don't throw - allow app to continue
    }
  }
}
