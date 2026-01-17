import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
export class KafkaMessageBrokerAdapter implements MessageBrokerPort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaMessageBrokerAdapter.name);
  private kafka!: Kafka;
  private consumer!: Consumer;
  private producer!: Producer;
  private connected = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeKafka();
  }

  /**
   * Initialize Kafka client with configuration
   */
  private initializeKafka(): void {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:9092');
    const securityProtocol = this.configService.get<string>('KAFKA_SECURITY_PROTOCOL', 'PLAINTEXT');
    const saslMechanism = this.configService.get<string>('KAFKA_SASL_MECHANISM');
    const saslUsername = this.configService.get<string>('KAFKA_SASL_USERNAME');
    const saslPassword = this.configService.get<string>('KAFKA_SASL_PASSWORD');

    const kafkaConfig: KafkaConfig = {
      clientId: 'worker-node',
      brokers: brokers.split(',').map(broker => broker.trim()),
    };

    // Add SASL configuration if security protocol requires it
    if (securityProtocol === 'SASL_PLAINTEXT' && saslMechanism && saslUsername && saslPassword) {
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

    this.logger.log(`Initializing Kafka with brokers: ${brokers}, security: ${securityProtocol}`);

    this.kafka = new Kafka(kafkaConfig);
    this.consumer = this.kafka.consumer({ groupId: 'worker-group' });
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
      this.logger.error('Failed to connect to Kafka:', error as Record<string, unknown>);
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
      this.logger.error('Failed to disconnect from Kafka:', error as Record<string, unknown>);
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
      this.logger.debug(`Message sent to topic ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}:`, error as Record<string, unknown>);
      throw error;
    }
  }

  /**
   * Subscribe to a topic and handle messages
   */
  async subscribe(topic: string, handler: (message: unknown) => Promise<void>): Promise<void> {
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
            this.logger.error('Failed to process message:', error as Record<string, unknown>);
            // Depending on requirements, you might want to send to a dead-letter queue
          }
        },
      });
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic ${topic}:`, error as Record<string, unknown>);
      throw error;
    }
  }
}
