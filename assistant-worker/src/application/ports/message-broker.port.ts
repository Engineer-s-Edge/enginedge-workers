/**
 * Port (Interface) for Message Broker
 * 
 * This port defines the contract for message broker operations.
 * Infrastructure adapters will implement this interface.
 */

export interface MessageBrokerPort {
  /**
   * Send a message to a topic
   */
  sendMessage(topic: string, message: unknown): Promise<void>;

  /**
   * Subscribe to a topic and handle messages
   */
  subscribe(topic: string, handler: (message: unknown) => Promise<void>): Promise<void>;

  /**
   * Connect to the message broker
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the message broker
   */
  disconnect(): Promise<void>;

  /**
   * Check if broker is connected
   */
  isConnected(): boolean;
}

export const MESSAGE_BROKER_PORT = Symbol('MESSAGE_BROKER_PORT');

