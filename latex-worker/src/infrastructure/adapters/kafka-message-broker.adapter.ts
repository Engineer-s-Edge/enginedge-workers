import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer, Producer, EachMessagePayload } from 'kafkajs';
import { MessageBrokerPort } from '../../application/ports/message-broker.port';

/**
 * Kafka Message Broker Adapter
 *
 * Implements MessageBrokerPort using Apache Kafka.
 * Handles async compilation requests/responses.
 */
@Injectable()
export class KafkaMessageBrokerAdapter
  implements MessageBrokerPort, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaMessageBrokerAdapter.name);
  private kafka: Kafka;
  private producer!: Producer;
  private consumer!: Consumer;
  private connected = false;
  private subscriptions = new Map<
    string,
    (message: unknown) => Promise<void>
  >();
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectInterval = 5000; // 5 seconds
  private connectionErrorLogged = false;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService
      .get<string>('KAFKA_BROKERS', 'localhost:9092')
      .split(',');
    const clientId = this.configService.get<string>(
      'KAFKA_CLIENT_ID',
      'latex-worker',
    );
    const groupId = this.configService.get<string>(
      'KAFKA_GROUP_ID',
      'latex-worker-group',
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

    this.kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 3,
      },
      logLevel: logLevelMap[kafkaLogLevel] ?? 0,
      logCreator: kafkaLogLevel === 'NOTHING' ? logCreator : undefined,
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionalId: `${clientId}-producer`,
    });

    this.consumer = this.kafka.consumer({
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
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
    if (this.connected) {
      return;
    }

    try {
      if (!this.connectionErrorLogged) {
        this.logger.log('Connecting to Kafka...');
      }

      await this.producer.connect();
      await this.consumer.connect();
      this.connected = true;
      this.reconnectAttempts = 0;

      // Reset error logged flag and log success if we were previously disconnected
      if (this.connectionErrorLogged) {
        this.logger.log('Successfully reconnected to Kafka');
      } else {
        this.logger.log('Successfully connected to Kafka');
      }
      this.connectionErrorLogged = false;

      // Set up consumer message handler
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });
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
      this.subscriptions.clear();
    } catch (error) {
      // Ignore disconnect errors during shutdown
      this.connected = false;
    }
  }

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
      throw new Error(
        'Kafka is not available. Message could not be sent.',
      );
    }

    try {
      const messageValue = JSON.stringify(message);
      await this.producer.send({
        topic,
        messages: [
          {
            value: messageValue,
            timestamp: Date.now().toString(),
          },
        ],
      });

      this.logger.debug(
        `Sent message to topic ${topic}: ${messageValue.substring(0, 100)}...`,
      );
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
      // Store handler for when connection is established
      this.subscriptions.set(topic, handler);
      // Schedule a retry when connection is established
      const checkAndSubscribe = async () => {
        if (this.connected) {
          try {
            await this.consumer.subscribe({
              topic,
              fromBeginning: false,
            });
            this.logger.log(`Subscribed to topic: ${topic}`);
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
      // Store handler for this topic
      this.subscriptions.set(topic, handler);

      // Subscribe consumer to topic
      await this.consumer.subscribe({
        topic,
        fromBeginning: false,
      });

      this.logger.log(`Subscribed to topic: ${topic}`);
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

  /**
   * Handle incoming Kafka messages
   */
  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      // Parse message value
      const messageValue = message.value?.toString() || '{}';
      const parsedMessage = JSON.parse(messageValue);

      this.logger.debug(
        `Received message from topic ${topic} (partition ${partition}): ${messageValue.substring(0, 100)}...`,
      );

      // Find and execute handler for this topic
      const handler = this.subscriptions.get(topic);
      if (handler) {
        await handler(parsedMessage);
      } else {
        this.logger.warn(`No handler registered for topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error(`Error processing message from topic ${topic}`, error);
      // Don't rethrow - let Kafka continue processing other messages
    }
  }
}
