/**
 * Message Broker Port
 *
 * Interface for message broker implementations.
 * Allows swapping between different message broker implementations (Kafka, Redis, etc.).
 */

/**
 * Port for message broker implementations
 */
export interface MessageBrokerPort {
  /**
   * Connect to message broker
   */
  connect(): Promise<void>;

  /**
   * Disconnect from message broker
   */
  disconnect(): Promise<void>;

  /**
   * Check if connected to message broker
   */
  isConnected(): boolean;

  /**
   * Send a message to a topic
   */
  sendMessage(topic: string, message: unknown): Promise<void>;

  /**
   * Subscribe to a topic and handle messages
   */
  subscribe(topic: string, handler: (message: unknown) => Promise<void>): Promise<void>;
}
