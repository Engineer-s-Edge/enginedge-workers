/**
 * WebSocket Adapter
 * 
 * Provides bidirectional real-time communication for agent interactions.
 * Supports commands, updates, and interactive features.
 */

import { Injectable } from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';

export interface WebSocketMessage {
  type: 'command' | 'update' | 'query' | 'response';
  action?: string;
  data: any;
  timestamp: Date;
}

/**
 * WebSocket Adapter
 */
@Injectable()
export class WebSocketAdapter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private clientMetadata: Map<string, { userId: string; agentId?: string }> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(server: any): void {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'response',
        action: 'connected',
        data: { clientId, message: 'WebSocket connected' },
        timestamp: new Date(),
      });

      // Handle messages
      ws.on('message', (message: string) => {
        this.handleMessage(clientId, message);
      });

      // Handle disconnect
      ws.on('close', () => {
        this.clients.delete(clientId);
        this.clientMetadata.delete(clientId);
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(clientId: string, message: string): void {
    try {
      const parsed: WebSocketMessage = JSON.parse(message);

      switch (parsed.type) {
        case 'command':
          this.handleCommand(clientId, parsed);
          break;
        case 'query':
          this.handleQuery(clientId, parsed);
          break;
        default:
          this.sendError(clientId, `Unknown message type: ${parsed.type}`);
      }
    } catch (error) {
      this.sendError(clientId, 'Invalid message format');
    }
  }

  /**
   * Handle command from client
   */
  private handleCommand(clientId: string, message: WebSocketMessage): void {
    // Commands will be handled by the application layer
    // For now, just acknowledge
    this.sendToClient(clientId, {
      type: 'response',
      action: 'command_received',
      data: { command: message.action, received: true },
      timestamp: new Date(),
    });
  }

  /**
   * Handle query from client
   */
  private handleQuery(clientId: string, message: WebSocketMessage): void {
    // Queries will be handled by the application layer
    this.sendToClient(clientId, {
      type: 'response',
      action: 'query_received',
      data: { query: message.action, received: true },
      timestamp: new Date(),
    });
  }

  /**
   * Send message to a specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);

    if (!client || client.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WebSocketMessage): void {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.readyState === WebSocket.OPEN) {
        this.sendToClient(clientId, message);
      }
    }
  }

  /**
   * Send update to client
   */
  sendUpdate(clientId: string, action: string, data: any): boolean {
    return this.sendToClient(clientId, {
      type: 'update',
      action,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Send error to client
   */
  sendError(clientId: string, error: string): boolean {
    return this.sendToClient(clientId, {
      type: 'response',
      action: 'error',
      data: { error },
      timestamp: new Date(),
    });
  }

  /**
   * Associate client with user and agent
   */
  setClientMetadata(clientId: string, userId: string, agentId?: string): void {
    this.clientMetadata.set(clientId, { userId, agentId });
  }

  /**
   * Get clients for a specific user
   */
  getClientsByUser(userId: string): string[] {
    const clients: string[] = [];

    for (const [clientId, metadata] of this.clientMetadata.entries()) {
      if (metadata.userId === userId) {
        clients.push(clientId);
      }
    }

    return clients;
  }

  /**
   * Get clients for a specific agent
   */
  getClientsByAgent(agentId: string): string[] {
    const clients: string[] = [];

    for (const [clientId, metadata] of this.clientMetadata.entries()) {
      if (metadata.agentId === agentId) {
        clients.push(clientId);
      }
    }

    return clients;
  }

  /**
   * Send update to all clients watching an agent
   */
  sendAgentUpdate(agentId: string, action: string, data: any): void {
    const clients = this.getClientsByAgent(agentId);

    for (const clientId of clients) {
      this.sendUpdate(clientId, action, data);
    }
  }

  /**
   * Disconnect a client
   */
  disconnectClient(clientId: string): void {
    const client = this.clients.get(clientId);

    if (client) {
      client.close();
      this.clients.delete(clientId);
      this.clientMetadata.delete(clientId);
    }
  }

  /**
   * Get active client count
   */
  getActiveClientCount(): number {
    return this.clients.size;
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    if (this.wss) {
      this.wss.close();
      this.clients.clear();
      this.clientMetadata.clear();
    }
  }
}

