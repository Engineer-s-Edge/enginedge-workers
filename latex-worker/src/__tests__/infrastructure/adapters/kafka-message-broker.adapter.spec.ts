import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaMessageBrokerAdapter } from '../../../infrastructure/adapters/kafka-message-broker.adapter';
import { EachMessagePayload } from 'kafkajs';

// Mock kafkajs
const mockProducer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn(),
};

const mockConsumer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  subscribe: jest.fn(),
  run: jest.fn(),
};

const mockKafka = {
  producer: jest.fn(() => mockProducer),
  consumer: jest.fn(() => mockConsumer),
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn(() => mockKafka),
}));

describe('KafkaMessageBrokerAdapter', () => {
  let adapter: KafkaMessageBrokerAdapter;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    mockProducer.connect.mockResolvedValue(undefined);
    mockProducer.disconnect.mockResolvedValue(undefined);
    mockProducer.send.mockResolvedValue({});
    mockConsumer.connect.mockResolvedValue(undefined);
    mockConsumer.disconnect.mockResolvedValue(undefined);
    mockConsumer.subscribe.mockResolvedValue(undefined);
    mockConsumer.run.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaMessageBrokerAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                KAFKA_BROKERS: 'localhost:9092',
                KAFKA_CLIENT_ID: 'latex-worker',
                KAFKA_GROUP_ID: 'latex-worker-group',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<KafkaMessageBrokerAdapter>(KafkaMessageBrokerAdapter);
  });

  describe('constructor', () => {
    it('should create Kafka instance with correct configuration', () => {
      // Kafka mock is created in constructor
      expect(mockKafka.producer).toHaveBeenCalled();
      expect(mockKafka.consumer).toHaveBeenCalled();
    });

    it('should create producer with transactional ID', () => {
      expect(mockKafka.producer).toHaveBeenCalledWith({
        allowAutoTopicCreation: true,
        transactionalId: 'latex-worker-producer',
      });
    });

    it('should create consumer with correct group ID', () => {
      expect(mockKafka.consumer).toHaveBeenCalledWith({
        groupId: 'latex-worker-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });
    });
  });

  describe('connect', () => {
    it('should connect producer and consumer', async () => {
      await adapter.connect();

      expect(mockProducer.connect).toHaveBeenCalled();
      expect(mockConsumer.connect).toHaveBeenCalled();
      expect(mockConsumer.run).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(true);
    });

    it('should not connect twice', async () => {
      await adapter.connect();
      await adapter.connect();

      expect(mockProducer.connect).toHaveBeenCalledTimes(1);
      expect(mockConsumer.connect).toHaveBeenCalledTimes(1);
    });

    it('should handle connection errors gracefully', async () => {
      const error = new Error('Connection failed');
      mockProducer.connect.mockRejectedValue(error);

      await expect(adapter.connect()).resolves.toBeUndefined();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect producer and consumer', async () => {
      await adapter.connect();
      await adapter.disconnect();

      expect(mockConsumer.disconnect).toHaveBeenCalled();
      expect(mockProducer.disconnect).toHaveBeenCalled();
      expect(adapter.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await adapter.disconnect();

      expect(mockConsumer.disconnect).not.toHaveBeenCalled();
      expect(mockProducer.disconnect).not.toHaveBeenCalled();
    });

    it('should handle error if disconnect fails', async () => {
      await adapter.connect();
      const error = new Error('Disconnect failed');
      mockConsumer.disconnect.mockRejectedValue(error);

      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(adapter.isConnected()).toBe(false);
    });

    it('should return true after connection', async () => {
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
    });

    it('should return false after disconnection', async () => {
      await adapter.connect();
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should send message to topic', async () => {
      const topic = 'latex.compile.response';
      const message = { jobId: 'job-123', success: true };

      await adapter.sendMessage(topic, message);

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic,
        messages: [
          {
            value: JSON.stringify(message),
            timestamp: expect.any(String),
          },
        ],
      });
    });

    it('should throw error if not connected', async () => {
      // Ensure connect fails so it doesn't auto-reconnect
      mockProducer.connect.mockRejectedValue(new Error('Connection failed'));
      await adapter.disconnect();

      await expect(adapter.sendMessage('test-topic', {})).rejects.toThrow(
        'Kafka is not available. Message could not be sent.',
      );
    });

    it('should throw error if send fails', async () => {
      const error = new Error('Send failed');
      mockProducer.send.mockRejectedValue(error);

      await expect(adapter.sendMessage('test-topic', {})).rejects.toThrow(
        'Send failed',
      );
    });

    it('should serialize complex messages', async () => {
      const message = {
        jobId: 'job-456',
        nested: {
          data: {
            array: [1, 2, 3],
          },
        },
      };

      await adapter.sendMessage('test-topic', message);

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'test-topic',
        messages: [
          {
            value: JSON.stringify(message),
            timestamp: expect.any(String),
          },
        ],
      });
    });
  });

  describe('subscribe', () => {
    beforeEach(async () => {
      await adapter.connect();
    });

    it('should subscribe to topic with handler', async () => {
      const topic = 'latex.compile.request';
      const handler = jest.fn();

      await adapter.subscribe(topic, handler);

      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic,
        fromBeginning: false,
      });
    });

    it('should log warning if not connected', async () => {
      // Ensure connect fails so it stays disconnected
      mockProducer.connect.mockRejectedValue(new Error('Connect fail'));
      mockConsumer.connect.mockRejectedValue(new Error('Connect fail'));

      await adapter.disconnect();
      const handler = jest.fn();
      const warnSpy = jest
        .spyOn((adapter as any).logger, 'warn')
        .mockImplementation();

      await adapter.subscribe('test-topic', handler);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot subscribe to topic test-topic'),
      );
    });

    it('should log warning if subscription fails', async () => {
      const error = new Error('Subscription failed');
      mockConsumer.subscribe.mockRejectedValue(error);
      const handler = jest.fn();
      const warnSpy = jest
        .spyOn((adapter as any).logger, 'warn')
        .mockImplementation();

      await adapter.subscribe('test-topic', handler);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to subscribe to topic test-topic'),
      );
    });
  });

  describe('message handling', () => {
    let messageHandler: (payload: unknown) => Promise<void>;

    beforeEach(async () => {
      await adapter.connect();

      // Capture the message handler passed to consumer.run
      const runCall = mockConsumer.run.mock.calls[0];
      messageHandler = runCall[0].eachMessage;
    });

    it('should handle incoming messages', async () => {
      const topic = 'latex.compile.request';
      const handler = jest.fn().mockResolvedValue(undefined);
      await adapter.subscribe(topic, handler);

      const payload = {
        topic,
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify({ jobId: 'job-789' })),
        },
      };

      await messageHandler(payload);

      expect(handler).toHaveBeenCalledWith({ jobId: 'job-789' });
    });

    it('should parse JSON messages correctly', async () => {
      const topic = 'test-topic';
      const handler = jest.fn();
      await adapter.subscribe(topic, handler);

      const message = { data: 'test', nested: { value: 123 } };
      const payload = {
        topic,
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(message)),
        },
      };

      await messageHandler(payload);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should handle messages with no handler gracefully', async () => {
      const payload = {
        topic: 'unknown-topic',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify({ test: 'data' })),
        },
      };

      // Should not throw
      await expect(messageHandler(payload)).resolves.toBeUndefined();
    });

    it('should handle invalid JSON gracefully', async () => {
      const topic = 'test-topic';
      const handler = jest.fn();
      await adapter.subscribe(topic, handler);

      const payload = {
        topic,
        partition: 0,
        message: {
          value: Buffer.from('invalid json{'),
        },
      };

      // Should not throw
      await expect(messageHandler(payload)).resolves.toBeUndefined();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle empty message value', async () => {
      const topic = 'test-topic';
      const handler = jest.fn();
      await adapter.subscribe(topic, handler);

      const payload = {
        topic,
        partition: 0,
        message: {
          value: null,
        },
      };

      await messageHandler(payload);

      expect(handler).toHaveBeenCalledWith({});
    });

    it('should continue processing if handler throws error', async () => {
      const topic = 'test-topic';
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
      await adapter.subscribe(topic, handler);

      const payload = {
        topic,
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify({ test: 'data' })),
        },
      };

      // Should not throw
      await expect(messageHandler(payload)).resolves.toBeUndefined();
    });
  });

  describe('module lifecycle', () => {
    it('should connect on module init', async () => {
      await adapter.onModuleInit();

      expect(mockProducer.connect).toHaveBeenCalled();
      expect(mockConsumer.connect).toHaveBeenCalled();
    });

    it('should disconnect on module destroy', async () => {
      await adapter.onModuleInit();
      await adapter.onModuleDestroy();

      expect(mockConsumer.disconnect).toHaveBeenCalled();
      expect(mockProducer.disconnect).toHaveBeenCalled();
    });
  });
});
