import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
export class KafkaMessageBrokerAdapter implements MessageBrokerPort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaMessageBrokerAdapter.name);
  private kafka: Kafka;
  private producer!: Producer;
  private consumer!: Consumer;
  private connected = false;
  private subscriptions = new Map<string, (message: unknown) => Promise<void>>();

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092').split(',');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'latex-worker');
    const groupId = this.configService.get<string>('KAFKA_GROUP_ID', 'latex-worker-group');

    this.kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 10,
      },
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

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.connected) {
      this.logger.warn('Already connected to Kafka');
      return;
    }

    try {
      this.logger.log('Connecting to Kafka...');
      await this.producer.connect();
      await this.consumer.connect();
      this.connected = true;
      this.logger.log('Connected to Kafka successfully');

      // Set up consumer message handler
      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.handleMessage(payload);
        },
      });
    } catch (error) {
      this.logger.error('Failed to connect to Kafka', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      this.logger.warn('Not connected to Kafka');
      return;
    }

    try {
      this.logger.log('Disconnecting from Kafka...');
      await this.consumer.disconnect();
      await this.producer.disconnect();
      this.connected = false;
      this.subscriptions.clear();
      this.logger.log('Disconnected from Kafka successfully');
    } catch (error) {
      this.logger.error('Failed to disconnect from Kafka', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async sendMessage(topic: string, message: unknown): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to Kafka');
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

      this.logger.debug(`Sent message to topic ${topic}: ${messageValue.substring(0, 100)}...`);
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}`, error);
      throw error;
    }
  }

  async subscribe(topic: string, handler: (message: unknown) => Promise<void>): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to Kafka');
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
      this.logger.error(`Failed to subscribe to topic ${topic}`, error);
      throw error;
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

      this.logger.debug(`Received message from topic ${topic} (partition ${partition}): ${messageValue.substring(0, 100)}...`);

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
