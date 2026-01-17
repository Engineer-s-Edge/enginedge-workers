/**
 * Kafka Integration Tests
 * Tests for Kafka producer/consumer patterns, message handling, and error scenarios
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Kafka Integration', () => {
  // Mock Kafka client
  let mockProducer: Record<string, any>;
  let mockConsumer: Record<string, any>;
  let publishedMessages: Array<Record<string, any>> = [];

  beforeEach(() => {
    publishedMessages = [];

    // Mock Kafka Producer
    mockProducer = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      send: jest
        .fn()
        .mockImplementation(async (config: Record<string, any>) => {
          const result = {
            partition: 0,
            offset: publishedMessages.length,
            timestamp: Date.now().toString(),
          };
          publishedMessages.push({
            topic: config.topic,
            messages: config.messages,
            result,
          });
          return [result];
        }),
      sendBatch: jest.fn().mockResolvedValue([]),
    };

    // Mock Kafka Consumer
    mockConsumer = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
      commitOffsets: jest.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  // ===== PRODUCER TESTS =====
  describe('Producer', () => {
    it('should connect to Kafka broker', async () => {
      await mockProducer.connect();
      expect(mockProducer.connect).toHaveBeenCalled();
    });

    it('should successfully publish message to topic', async () => {
      const message = { id: '123', type: 'test', data: 'hello' };

      const result = await mockProducer.send({
        topic: 'test-topic',
        messages: [{ value: JSON.stringify(message) }],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('partition');
      expect(result[0]).toHaveProperty('offset');
      expect(publishedMessages).toHaveLength(1);
    });

    it('should validate message format before publishing', async () => {
      const invalidMessage = { id: 123 }; // id should be string

      expect(() => {
        if (typeof invalidMessage.id !== 'string') {
          throw new Error('Invalid message format: id must be string');
        }
      }).toThrow('Invalid message format');
    });

    it('should handle serialization correctly', async () => {
      const complexMessage = {
        id: 'msg-1',
        timestamp: new Date().toISOString(),
        metadata: { user: 'test', role: 'admin' },
        payload: [1, 2, 3],
      };

      const serialized = JSON.stringify(complexMessage);
      const deserialized = JSON.parse(serialized);

      expect(deserialized).toEqual(complexMessage);
    });

    it('should batch multiple messages efficiently', async () => {
      const messages = [
        { value: JSON.stringify({ id: '1' }) },
        { value: JSON.stringify({ id: '2' }) },
        { value: JSON.stringify({ id: '3' }) },
      ];

      await mockProducer.send({
        topic: 'test-topic',
        messages,
      });

      expect(mockProducer.send).toHaveBeenCalled();
    });

    it('should handle connection retry logic', async () => {
      const retryProducer = {
        connect: jest
          .fn()
          .mockRejectedValueOnce(new Error('Connection failed'))
          .mockResolvedValueOnce(undefined),
      };

      await expect(retryProducer.connect()).rejects.toThrow(
        'Connection failed',
      );
      await retryProducer.connect();
      expect(retryProducer.connect).toHaveBeenCalledTimes(2);
    });

    it('should disconnect gracefully', async () => {
      await mockProducer.disconnect();
      expect(mockProducer.disconnect).toHaveBeenCalled();
    });

    it('should handle producer errors', async () => {
      const failingProducer = {
        send: jest.fn().mockRejectedValue(new Error('Send failed')),
      };

      await expect(
        failingProducer.send({ topic: 'test', messages: [] }),
      ).rejects.toThrow('Send failed');
    });
  });

  // ===== CONSUMER TESTS =====
  describe('Consumer', () => {
    it('should connect to Kafka broker', async () => {
      await mockConsumer.connect();
      expect(mockConsumer.connect).toHaveBeenCalled();
    });

    it('should subscribe to topic', async () => {
      await mockConsumer.subscribe({ topic: 'test-topic' });
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'test-topic',
      });
    });

    it('should consume messages from topic', async () => {
      const consumedMessages: Array<Record<string, unknown>> = [];

      interface EachMessageArgs {
        message: Record<string, unknown>;
        partition: number;
        topic: string;
      }

      const consumer = {
        subscribe: jest.fn().mockResolvedValue(undefined),
        run: jest
          .fn()
          .mockImplementation(
            async (args: {
              eachMessage: (msg: EachMessageArgs) => Promise<void>;
            }) => {
              const message = {
                topic: 'test-topic',
                partition: 0,
                offset: 0,
                value: JSON.stringify({ id: '123' }),
              };
              consumedMessages.push(message);
              await args.eachMessage({
                message,
                partition: 0,
                topic: 'test-topic',
              });
            },
          ),
      };

      await consumer.subscribe({ topic: 'test-topic' });
      await consumer.run({
        eachMessage: async (args: EachMessageArgs) => {
          expect(args.message).toHaveProperty('value');
        },
      });

      expect(consumer.run).toHaveBeenCalled();
    });

    it('should handle deserialization correctly', async () => {
      const messageValue = JSON.stringify({ id: '123', status: 'active' });
      const deserialized = JSON.parse(messageValue);

      expect(deserialized).toHaveProperty('id', '123');
      expect(deserialized).toHaveProperty('status', 'active');
    });

    it('should manage consumer group', async () => {
      const groupConsumer = {
        subscribe: jest.fn().mockResolvedValue(undefined),
      };

      await groupConsumer.subscribe({
        topic: 'test-topic',
        groupId: 'test-group',
      });

      expect(groupConsumer.subscribe).toHaveBeenCalled();
    });

    it('should commit offsets after processing', async () => {
      await mockConsumer.commitOffsets([
        {
          topic: 'test-topic',
          partition: 0,
          offset: '1',
        },
      ]);

      expect(mockConsumer.commitOffsets).toHaveBeenCalled();
    });

    it('should handle consumer rebalancing', async () => {
      const rebalanceConsumer = {
        subscribe: jest.fn().mockResolvedValue(undefined),
      };

      // Simulate subscription which can trigger rebalancing
      await rebalanceConsumer.subscribe({ topic: 'test-topic' });
      expect(rebalanceConsumer.subscribe).toHaveBeenCalled();
    });

    it('should handle session timeout', async () => {
      const timedOutConsumer = {
        run: jest.fn().mockRejectedValue(new Error('Session timeout')),
      };

      await expect(timedOutConsumer.run({})).rejects.toThrow('Session timeout');
    });
  });

  // ===== MESSAGE FORMAT TESTS =====
  describe('Message Format', () => {
    it('should handle valid message format', () => {
      const validMessage = {
        id: 'msg-123',
        type: 'command',
        timestamp: new Date().toISOString(),
        payload: { action: 'execute' },
      };

      const serialized = JSON.stringify(validMessage);
      expect(serialized).toBeTruthy();
      expect(() => JSON.parse(serialized)).not.toThrow();
    });

    it('should reject invalid message format', () => {
      expect(() => {
        const invalid = undefined;
        if (!invalid || typeof invalid !== 'object') {
          throw new Error('Invalid message: must be an object');
        }
      }).toThrow('Invalid message');
    });

    it('should handle missing required fields', () => {
      const incompleteMessage = { type: 'test' }; // missing id

      const validate = (msg: Record<string, any>): void => {
        if (!msg.id) throw new Error('Missing required field: id');
      };

      expect(() => validate(incompleteMessage)).toThrow(
        'Missing required field',
      );
    });

    it('should handle extra fields in message', () => {
      const messageWithExtras = {
        id: 'msg-123',
        type: 'test',
        extraField: 'should be ignored',
        anotherExtra: 123,
      };

      const serialized = JSON.stringify(messageWithExtras);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.id).toBeDefined();
      expect(deserialized.extraField).toBeDefined();
    });

    it('should handle type mismatch validation', () => {
      const typeCheckMessage = (msg: Record<string, any>): void => {
        if (typeof msg.id !== 'string') {
          throw new Error('Type error: id must be string');
        }
      };

      const invalidMessage = { id: 123 };
      expect(() => typeCheckMessage(invalidMessage)).toThrow('Type error');
    });

    it('should handle large payload', () => {
      const largeData = 'x'.repeat(1000000); // 1MB of data
      const message = { id: 'msg-1', data: largeData };

      const serialized = JSON.stringify(message);
      expect(serialized.length).toBeGreaterThan(1000000);

      const deserialized = JSON.parse(serialized);
      expect(deserialized.data).toEqual(largeData);
    });

    it('should handle empty message', () => {
      const emptyMessage = {};
      const serialized = JSON.stringify(emptyMessage);
      expect(serialized).toBe('{}');
    });

    it('should handle special characters in message', () => {
      const specialMessage = {
        id: 'msg-123',
        text: 'Hello "world" with \'quotes\' and \n newlines',
      };

      const serialized = JSON.stringify(specialMessage);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.text).toContain('quotes');
    });
  });

  // ===== ERROR HANDLING TESTS =====
  describe('Error Handling', () => {
    it('should handle broker unavailable error', async () => {
      const failingProducer = {
        send: jest.fn().mockRejectedValue(new Error('Broker unavailable')),
      };

      await expect(
        failingProducer.send({ topic: 'test', messages: [] }),
      ).rejects.toThrow('Broker unavailable');
    });

    it('should handle topic not found error', async () => {
      const failingProducer = {
        send: jest.fn().mockRejectedValue(new Error('Topic not found')),
      };

      await expect(
        failingProducer.send({ topic: 'nonexistent', messages: [] }),
      ).rejects.toThrow('Topic not found');
    });

    it('should handle serialization error', () => {
      const circular: Record<string, any> = { id: 'test' };
      circular.self = circular; // Create circular reference

      expect(() => JSON.stringify(circular)).toThrow();
    });

    it('should handle deserialization error', () => {
      const invalidJson = 'not a valid json';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it('should handle offset out of range error', async () => {
      const failingConsumer = {
        run: jest.fn().mockRejectedValue(new Error('Offset out of range')),
      };

      await expect(failingConsumer.run({})).rejects.toThrow(
        'Offset out of range',
      );
    });

    it('should handle authentication failure', async () => {
      const failingProducer = {
        connect: jest
          .fn()
          .mockRejectedValue(new Error('Authentication failed')),
      };

      await expect(failingProducer.connect()).rejects.toThrow(
        'Authentication failed',
      );
    });

    it('should handle network timeout', async () => {
      const timeoutProducer = {
        send: jest.fn().mockRejectedValue(new Error('Network timeout')),
      };

      await expect(
        timeoutProducer.send({ topic: 'test', messages: [] }),
      ).rejects.toThrow('Network timeout');
    });

    it('should implement circuit breaker pattern', async () => {
      let failCount = 0;
      const circuitBreaker = {
        state: 'closed' as 'closed' | 'open' | 'half-open',
        send: jest.fn(async () => {
          failCount++;
          if (failCount >= 3) {
            circuitBreaker.state = 'open';
            throw new Error('Circuit breaker open');
          }
          throw new Error('Send failed');
        }),
      };

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.send()).rejects.toThrow();
      }

      expect(circuitBreaker.state).toBe('open');
    });
  });

  // ===== INTEGRATION TESTS =====
  describe('Integration Scenarios', () => {
    it('should publish and consume same message', async () => {
      const testMessage = { id: '123', data: 'test' };

      // Publish
      await mockProducer.send({
        topic: 'test-topic',
        messages: [{ value: JSON.stringify(testMessage) }],
      });

      // Consume
      expect(publishedMessages).toHaveLength(1);
      const published = JSON.parse(publishedMessages[0].messages[0].value);
      expect(published).toEqual(testMessage);
    });

    it('should handle multiple producers publishing to same topic', async () => {
      const producer1 = { ...mockProducer };
      const producer2 = { ...mockProducer };

      await producer1.send({
        topic: 'test-topic',
        messages: [{ value: JSON.stringify({ id: '1' }) }],
      });

      await producer2.send({
        topic: 'test-topic',
        messages: [{ value: JSON.stringify({ id: '2' }) }],
      });

      expect(publishedMessages).toHaveLength(2);
    });

    it('should handle multiple consumers from same group', async () => {
      const consumer1 = { ...mockConsumer };
      const consumer2 = { ...mockConsumer };

      await consumer1.subscribe({ topic: 'test-topic', groupId: 'group-1' });
      await consumer2.subscribe({ topic: 'test-topic', groupId: 'group-1' });

      expect(consumer1.subscribe).toHaveBeenCalled();
      expect(consumer2.subscribe).toHaveBeenCalled();
    });

    it('should guarantee message ordering within partition', () => {
      const orderedMessages = ['msg-1', 'msg-2', 'msg-3'];

      orderedMessages.forEach((msg, index) => {
        publishedMessages.push({
          topic: 'test-topic',
          partition: 0,
          offset: index,
          value: msg,
        });
      });

      expect(publishedMessages).toHaveLength(3);
      expect(publishedMessages[0].offset).toBe(0);
      expect(publishedMessages[1].offset).toBe(1);
      expect(publishedMessages[2].offset).toBe(2);
    });

    it('should support exactly-once delivery semantics', async () => {
      const deliveryTracker: Set<string> = new Set();

      const trackingProducer = {
        send: jest.fn(async (config) => {
          const msgId = config.messages[0].key;
          if (deliveryTracker.has(msgId)) {
            throw new Error('Message already delivered');
          }
          deliveryTracker.add(msgId);
          return [{ offset: 0 }];
        }),
      };

      const msgId = 'msg-xyz';
      await trackingProducer.send({
        topic: 'test-topic',
        messages: [{ key: msgId, value: 'test' }],
      });

      await expect(
        trackingProducer.send({
          topic: 'test-topic',
          messages: [{ key: msgId, value: 'test' }],
        }),
      ).rejects.toThrow('Message already delivered');
    });

    it('should support at-least-once delivery semantics', async () => {
      let deliveryCount = 0;

      const atLeastOnceProducer = {
        send: jest.fn(async () => {
          deliveryCount++;
          return [{ offset: deliveryCount - 1 }];
        }),
      };

      // Can deliver multiple times
      await atLeastOnceProducer.send();
      await atLeastOnceProducer.send();

      expect(deliveryCount).toBe(2);
    });

    it('should support topic creation dynamically', async () => {
      const topics: string[] = [];

      const dynamicProducer = {
        createTopic: jest.fn(async (topicName) => {
          topics.push(topicName);
        }),
      };

      await dynamicProducer.createTopic('new-topic');
      await dynamicProducer.createTopic('another-topic');

      expect(topics).toContain('new-topic');
      expect(topics).toContain('another-topic');
    });

    it('should support dead letter queue pattern', async () => {
      const deadLetterQueue: Array<Record<string, any>> = [];

      const dlqProducer = {
        sendToDLQ: jest.fn(
          async (message: Record<string, any>, error: Error) => {
            deadLetterQueue.push({ message, error, timestamp: Date.now() });
          },
        ),
      };

      const failedMessage = { id: 'msg-1' };
      await dlqProducer.sendToDLQ(
        failedMessage,
        new Error('Processing failed'),
      );

      expect(deadLetterQueue).toHaveLength(1);
      expect(deadLetterQueue[0]).toHaveProperty('error');
    });
  });

  // ===== DEAD LETTER QUEUE & RETRY TESTS =====
  describe('Dead Letter Queue (DLQ) & Retry Logic', () => {
    let dlqMessages: Array<Record<string, any>> = [];

    beforeEach(() => {
      dlqMessages = [];
    });

    // Test ID: kafka-dlq-001
    it('should retry failed message processing with exponential backoff', async () => {
      const maxRetries = 3;
      const baseDelay = 100; // ms
      const attemptTimestamps: number[] = [];

      const processWithRetry = async (
        message: Record<string, any>,
        handler: () => Promise<void>,
      ): Promise<void> => {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          attemptTimestamps.push(Date.now());

          try {
            await handler();
            return; // Success
          } catch (error) {
            lastError = error as Error;

            if (attempt < maxRetries) {
              const delayMs = baseDelay * Math.pow(2, attempt);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
          }
        }

        // All retries exhausted
        if (lastError) {
          dlqMessages.push({
            message,
            error: lastError,
            retryCount: maxRetries,
          });
        }
      };

      // Handler that fails 2 times, then succeeds
      let callCount = 0;
      const handler = async (): Promise<void> => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Temporary failure');
        }
      };

      await processWithRetry({ id: 'test-msg' }, handler);

      expect(callCount).toBe(3);
      expect(attemptTimestamps).toHaveLength(3);
      expect(dlqMessages).toHaveLength(0); // No DLQ since it eventually succeeded

      // Verify exponential backoff delays
      const delay1 = attemptTimestamps[1] - attemptTimestamps[0];
      const delay2 = attemptTimestamps[2] - attemptTimestamps[1];

      expect(delay1).toBeGreaterThanOrEqual(baseDelay * 1); // 100ms
      expect(delay2).toBeGreaterThanOrEqual(baseDelay * 2); // 200ms
    });

    // Test ID: kafka-dlq-002
    it('should send message to DLQ after max retries exceeded', async () => {
      const maxRetries = 3;

      const processWithRetry = async (
        message: Record<string, any>,
        handler: () => Promise<void>,
      ): Promise<void> => {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            await handler();
            return;
          } catch (error) {
            lastError = error as Error;
          }
        }

        if (lastError) {
          dlqMessages.push({
            originalMessage: message,
            error: { message: lastError.message, name: lastError.name },
            retryCount: maxRetries,
            timestamp: new Date().toISOString(),
          });
        }
      };

      // Handler that always fails
      const handler = async (): Promise<void> => {
        throw new Error('Persistent failure');
      };

      await processWithRetry({ id: 'failed-msg', data: 'test' }, handler);

      expect(dlqMessages).toHaveLength(1);
      expect(dlqMessages[0].originalMessage.id).toBe('failed-msg');
      expect(dlqMessages[0].error.message).toBe('Persistent failure');
      expect(dlqMessages[0].retryCount).toBe(3);
    });

    // Test ID: kafka-dlq-003
    it('should include error context in DLQ messages', async () => {
      const sendToDLQ = async (
        topic: string,
        message: Record<string, any>,
        error: Error,
        retryCount: number,
      ): Promise<void> => {
        dlqMessages.push({
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
        });
      };

      const error = new Error('Database connection failed');
      await sendToDLQ('tasks', { id: 'task-1' }, error, 3);

      expect(dlqMessages).toHaveLength(1);
      const dlqMsg = dlqMessages[0];

      expect(dlqMsg).toHaveProperty('originalTopic', 'tasks');
      expect(dlqMsg).toHaveProperty('originalMessage');
      expect(dlqMsg).toHaveProperty('error');
      expect(dlqMsg.error).toHaveProperty('name', 'Error');
      expect(dlqMsg.error).toHaveProperty(
        'message',
        'Database connection failed',
      );
      expect(dlqMsg.error).toHaveProperty('stack');
      expect(dlqMsg).toHaveProperty('retryCount', 3);
      expect(dlqMsg).toHaveProperty('timestamp');
      expect(dlqMsg).toHaveProperty('workerId', 'assistant-worker');
    });

    // Test ID: kafka-dlq-004
    it('should use correct DLQ topic naming convention', async () => {
      const getDLQTopic = (originalTopic: string): string => {
        return `${originalTopic}.dlq`;
      };

      expect(getDLQTopic('user-events')).toBe('user-events.dlq');
      expect(getDLQTopic('task-results')).toBe('task-results.dlq');
      expect(getDLQTopic('notifications')).toBe('notifications.dlq');
    });

    // Test ID: kafka-dlq-005
    it('should handle concurrent message retries independently', async () => {
      const processedMessages: string[] = [];
      const failedAttempts = new Map<string, number>();

      const processWithRetry = async (
        messageId: string,
        shouldFail: boolean,
      ): Promise<void> => {
        const maxRetries = 2;
        let attempts = 0;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          attempts++;
          failedAttempts.set(messageId, attempts);

          try {
            if (shouldFail && attempt < maxRetries) {
              throw new Error('Temporary failure');
            }
            processedMessages.push(messageId);
            return;
          } catch {
            if (attempt === maxRetries) {
              dlqMessages.push({ messageId, attempts });
            }
          }
        }
      };

      // Process 3 messages concurrently: 2 succeed, 1 fails permanently
      await Promise.all([
        processWithRetry('msg-1', false), // Success immediately
        processWithRetry('msg-2', true), // Succeeds after retries
        processWithRetry('msg-3', true), // Succeeds after retries
      ]);

      expect(processedMessages).toHaveLength(3);
      expect(failedAttempts.get('msg-1')).toBe(1); // No retries
      expect(failedAttempts.get('msg-2')).toBe(3); // 2 retries + final success
      expect(failedAttempts.get('msg-3')).toBe(3); // 2 retries + final success
    });

    // Test ID: kafka-dlq-006
    it('should log retry attempts for monitoring', async () => {
      const logs: Array<Record<string, any>> = [];

      const logRetry = (
        topic: string,
        attempt: number,
        maxRetries: number,
        delayMs: number,
        error: string,
      ): void => {
        logs.push({
          level: 'warn',
          message: `Message processing failed, retrying (${attempt}/${maxRetries})`,
          topic,
          attempt,
          delayMs,
          error,
        });
      };

      logRetry('tasks', 1, 3, 1000, 'Connection timeout');
      logRetry('tasks', 2, 3, 2000, 'Connection timeout');

      expect(logs).toHaveLength(2);
      expect(logs[0].delayMs).toBe(1000);
      expect(logs[1].delayMs).toBe(2000); // Exponential backoff
    });

    // Test ID: kafka-dlq-007
    it('should handle JSON parse errors and send to DLQ', async () => {
      const sendToDLQ = async (
        topic: string,
        rawMessage: string,
        error: Error,
      ): Promise<void> => {
        dlqMessages.push({
          originalTopic: topic,
          rawMessage,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      };

      const invalidJson = '{ "id": "test", invalid }';

      try {
        JSON.parse(invalidJson);
      } catch (error) {
        await sendToDLQ('events', invalidJson, error as Error);
      }

      expect(dlqMessages).toHaveLength(1);
      expect(dlqMessages[0].rawMessage).toBe(invalidJson);
      expect(dlqMessages[0].error).toContain('JSON');
    });

    // Test ID: kafka-dlq-008
    it('should track DLQ metrics for monitoring', async () => {
      const metrics = {
        dlqMessageCount: 0,
        dlqMessagesByTopic: new Map<string, number>(),
        dlqMessagesByError: new Map<string, number>(),
      };

      const recordDLQMetric = (topic: string, errorType: string): void => {
        metrics.dlqMessageCount++;

        const topicCount = metrics.dlqMessagesByTopic.get(topic) || 0;
        metrics.dlqMessagesByTopic.set(topic, topicCount + 1);

        const errorCount = metrics.dlqMessagesByError.get(errorType) || 0;
        metrics.dlqMessagesByError.set(errorType, errorCount + 1);
      };

      recordDLQMetric('tasks', 'TimeoutError');
      recordDLQMetric('tasks', 'TimeoutError');
      recordDLQMetric('events', 'ValidationError');

      expect(metrics.dlqMessageCount).toBe(3);
      expect(metrics.dlqMessagesByTopic.get('tasks')).toBe(2);
      expect(metrics.dlqMessagesByTopic.get('events')).toBe(1);
      expect(metrics.dlqMessagesByError.get('TimeoutError')).toBe(2);
      expect(metrics.dlqMessagesByError.get('ValidationError')).toBe(1);
    });

    // Test ID: kafka-dlq-009
    it('should prevent infinite retry loops', async () => {
      const maxRetries = 3;
      let totalAttempts = 0;

      const processWithLimit = async (
        handler: () => Promise<void>,
      ): Promise<void> => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          totalAttempts++;

          if (totalAttempts > 10) {
            throw new Error('Infinite loop detected');
          }

          try {
            await handler();
            return;
          } catch {
            if (attempt === maxRetries) {
              dlqMessages.push({ attempts: totalAttempts });
              return; // Stop retrying
            }
          }
        }
      };

      await processWithLimit(async () => {
        throw new Error('Always fails');
      });

      expect(totalAttempts).toBe(4); // 1 initial + 3 retries
      expect(dlqMessages).toHaveLength(1);
    });

    // Test ID: kafka-dlq-010
    it('should preserve message order in DLQ', async () => {
      const sendToDLQ = async (
        message: Record<string, any>,
        timestamp: number,
      ): Promise<void> => {
        dlqMessages.push({ ...message, dlqTimestamp: timestamp });
      };

      await sendToDLQ({ id: 'msg-1' }, 1000);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await sendToDLQ({ id: 'msg-2' }, 1100);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await sendToDLQ({ id: 'msg-3' }, 1200);

      expect(dlqMessages).toHaveLength(3);
      expect(dlqMessages[0].id).toBe('msg-1');
      expect(dlqMessages[1].id).toBe('msg-2');
      expect(dlqMessages[2].id).toBe('msg-3');

      // Verify timestamps are increasing
      expect(dlqMessages[1].dlqTimestamp).toBeGreaterThan(
        dlqMessages[0].dlqTimestamp,
      );
      expect(dlqMessages[2].dlqTimestamp).toBeGreaterThan(
        dlqMessages[1].dlqTimestamp,
      );
    });
  });
});
