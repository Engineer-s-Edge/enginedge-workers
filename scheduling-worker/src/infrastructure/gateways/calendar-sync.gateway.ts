import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { CalendarEvent } from '../../domain/entities/calendar-event.entity';

export interface ConflictResolutionRequest {
  conflictId: string;
  eventId: string;
  localEvent: CalendarEvent;
  remoteEvent: CalendarEvent;
  userId: string;
  calendarId: string;
}

export interface ConflictResolutionResponse {
  conflictId: string;
  choice: 'local' | 'remote' | 'merge';
  mergedEvent?: Partial<CalendarEvent>;
}

/**
 * WebSocket Gateway for Calendar Sync
 *
 * Handles real-time communication for calendar synchronization conflicts
 * and user resolution prompts.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/calendar-sync',
  cors: {
    origin: '*',
  },
})
export class CalendarSyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CalendarSyncGateway.name);
  private readonly pendingConflicts = new Map<
    string,
    ConflictResolutionRequest
  >(); // conflictId -> request
  private readonly userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Extract userId from handshake auth or query
    const userId = (client.handshake.auth?.userId ||
      client.handshake.query?.userId) as string;

    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      this.logger.log(`User ${userId} connected (socket ${client.id})`);
    } else {
      this.logger.warn(`Client ${client.id} connected without userId`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove from userSockets
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        this.logger.log(`User ${userId} disconnected (socket ${client.id})`);
        break;
      }
    }
  }

  /**
   * Emit conflict resolution request to user
   */
  async requestConflictResolution(
    request: ConflictResolutionRequest,
  ): Promise<ConflictResolutionResponse> {
    this.logger.log(
      `Requesting conflict resolution for event ${request.eventId} (conflict ${request.conflictId})`,
    );

    // Store pending conflict
    this.pendingConflicts.set(request.conflictId, request);

    // Get user's sockets
    const userSockets = this.userSockets.get(request.userId);
    if (!userSockets || userSockets.size === 0) {
      this.logger.warn(
        `No active sockets for user ${request.userId}, cannot request conflict resolution`,
      );
      // Fallback to LAST_WRITE_WINS
      return {
        conflictId: request.conflictId,
        choice:
          request.localEvent.updatedAt > request.remoteEvent.updatedAt
            ? 'local'
            : 'remote',
      };
    }

    // Emit to all user's sockets
    const socketIds = Array.from(userSockets);
    for (const socketId of socketIds) {
      this.server.to(socketId).emit('conflict-resolution-request', {
        conflictId: request.conflictId,
        eventId: request.eventId,
        localEvent: {
          id: request.localEvent.id,
          title: request.localEvent.title,
          description: request.localEvent.description,
          startTime: request.localEvent.startTime,
          endTime: request.localEvent.endTime,
          location: request.localEvent.location,
          updatedAt: request.localEvent.updatedAt,
        },
        remoteEvent: {
          id: request.remoteEvent.id,
          title: request.remoteEvent.title,
          description: request.remoteEvent.description,
          startTime: request.remoteEvent.startTime,
          endTime: request.remoteEvent.endTime,
          location: request.remoteEvent.location,
          updatedAt: request.remoteEvent.updatedAt,
        },
        calendarId: request.calendarId,
      });
    }

    // Wait for user response (with timeout)
    return new Promise<ConflictResolutionResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingConflicts.delete(request.conflictId);
        this.logger.warn(
          `Conflict resolution timeout for ${request.conflictId}, using LAST_WRITE_WINS`,
        );
        resolve({
          conflictId: request.conflictId,
          choice:
            request.localEvent.updatedAt > request.remoteEvent.updatedAt
              ? 'local'
              : 'remote',
        });
      }, 30000); // 30 second timeout

      // Store resolver for this conflict
      (request as any).resolve = (response: ConflictResolutionResponse) => {
        clearTimeout(timeout);
        this.pendingConflicts.delete(request.conflictId);
        resolve(response);
      };
    });
  }

  @SubscribeMessage('resolve-conflict')
  async handleConflictResolution(
    @MessageBody()
    response: ConflictResolutionResponse,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `Received conflict resolution for ${response.conflictId}: ${response.choice}`,
    );

    const request = this.pendingConflicts.get(response.conflictId);
    if (!request) {
      this.logger.warn(
        `Received resolution for unknown conflict ${response.conflictId}`,
      );
      client.emit('error', {
        message: 'Conflict not found or already resolved',
        conflictId: response.conflictId,
      });
      return;
    }

    // Verify user owns this conflict
    const userId = (client.handshake.auth?.userId ||
      client.handshake.query?.userId) as string;
    if (userId !== request.userId) {
      this.logger.warn(
        `User ${userId} attempted to resolve conflict for user ${request.userId}`,
      );
      client.emit('error', {
        message: 'Unauthorized: You do not own this conflict',
        conflictId: response.conflictId,
      });
      return;
    }

    // Resolve the conflict
    if ((request as any).resolve) {
      (request as any).resolve(response);
    }

    // Acknowledge to client
    client.emit('conflict-resolved', {
      conflictId: response.conflictId,
      choice: response.choice,
    });
  }

  /**
   * Emit sync status update to user
   */
  emitSyncStatus(
    userId: string,
    status: {
      calendarId: string;
      status: 'syncing' | 'idle' | 'error';
      progress?: number;
      message?: string;
    },
  ) {
    const userSockets = this.userSockets.get(userId);
    if (!userSockets || userSockets.size === 0) {
      return; // User not connected
    }

    const socketIds = Array.from(userSockets);
    for (const socketId of socketIds) {
      this.server.to(socketId).emit('sync-status', status);
    }
  }

  /**
   * Emit sync completion notification
   */
  emitSyncComplete(
    userId: string,
    result: {
      calendarId: string;
      eventsAdded: number;
      eventsUpdated: number;
      eventsDeleted: number;
      conflictsResolved: number;
    },
  ) {
    const userSockets = this.userSockets.get(userId);
    if (!userSockets || userSockets.size === 0) {
      return; // User not connected
    }

    const socketIds = Array.from(userSockets);
    for (const socketId of socketIds) {
      this.server.to(socketId).emit('sync-complete', result);
    }
  }
}
