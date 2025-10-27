/**
 * Message Queue Message
 */
export interface QueueMessage {
  id: string;
  topic: string;
  key?: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  correlationId?: string;
}

/**
 * Message Publisher Port - Interface for publishing messages
 */
export interface IMessagePublisher {
  /**
   * Publish message to topic
   */
  publish(topic: string, message: QueueMessage): Promise<void>;

  /**
   * Publish batch of messages
   */
  publishBatch(topic: string, messages: QueueMessage[]): Promise<void>;
}

/**
 * Message Subscriber Port - Interface for subscribing to messages
 */
export interface IMessageSubscriber {
  /**
   * Subscribe to topic with handler
   */
  subscribe(
    topic: string,
    handler: (message: QueueMessage) => Promise<void>,
  ): Promise<void>;

  /**
   * Unsubscribe from topic
   */
  unsubscribe(topic: string): Promise<void>;
}
