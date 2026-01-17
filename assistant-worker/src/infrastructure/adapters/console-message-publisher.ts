import { Injectable } from '@nestjs/common';
import {
  IMessagePublisher,
  QueueMessage,
} from '@application/ports/message-queue.port';

/**
 * Console Message Publisher (Infrastructure Adapter)
 *
 * Simple implementation that logs messages to console.
 * Useful for development and testing.
 */
@Injectable()
export class ConsoleMessagePublisher implements IMessagePublisher {
  async publish(topic: string, message: QueueMessage): Promise<void> {
    console.log(`[MESSAGE PUBLISHED] Topic: ${topic}`, {
      id: message.id,
      topic: message.topic,
      payload: message.payload,
      timestamp: message.timestamp,
    });
  }

  async publishBatch(topic: string, messages: QueueMessage[]): Promise<void> {
    console.log(
      `[BATCH MESSAGE PUBLISHED] Topic: ${topic}, Count: ${messages.length}`,
    );
    messages.forEach((message) => {
      console.log('  ->', {
        id: message.id,
        topic: message.topic,
        payload: message.payload,
        timestamp: message.timestamp,
      });
    });
  }
}
