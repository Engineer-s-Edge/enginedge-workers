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
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExperienceBankService } from '../../application/services/experience-bank.service';

interface ReviewSession {
  userId: string;
  bulletQueue: string[]; // IDs of bullets to review
  currentBulletId: string | null;
  reviewedCount: number;
}

@WebSocketGateway({
  namespace: '/bullet-review',
  cors: {
    origin: '*',
  },
})
export class BulletReviewGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BulletReviewGateway.name);
  private sessions = new Map<string, ReviewSession>();

  constructor(
    private readonly experienceBankService: ExperienceBankService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.sessions.delete(client.id);
  }

  @SubscribeMessage('start-review')
  async handleStartReview(
    @MessageBody()
    data: {
      userId: string;
      bulletIds?: string[]; // Specific bullets, or null for all unreviewed
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Starting review session for user ${data.userId}`);

    // Get bullets to review
    let bulletIds: string[];
    if (data.bulletIds && data.bulletIds.length > 0) {
      bulletIds = data.bulletIds;
    } else {
      // Get all unreviewed bullets
      const unreviewed = await this.experienceBankService.list(data.userId, {
        reviewed: false,
      });
      bulletIds = unreviewed.map((b: any) => b._id.toString());
    }

    // Create session
    const session: ReviewSession = {
      userId: data.userId,
      bulletQueue: bulletIds,
      currentBulletId: null,
      reviewedCount: 0,
    };

    this.sessions.set(client.id, session);

    // Send first bullet
    await this.sendNextBullet(client.id, client);
  }

  @SubscribeMessage('user-response')
  async handleUserResponse(
    @MessageBody() data: { response: string },
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.sessions.get(client.id);
    if (!session || !session.currentBulletId) {
      client.emit('error', { message: 'No active review session' });
      return;
    }

    this.logger.log(`User response: ${data.response}`);

    try {
      // Send to assistant-worker for verification
      const assistantWorkerUrl =
        this.configService.get<string>('ASSISTANT_WORKER_URL') ||
        'http://localhost:3001';

      const bullet = session.currentBulletId
        ? await this.experienceBankService.getById(session.currentBulletId)
        : null;
      const bulletText = bullet?.bulletText || 'the bullet point';

      const response = await fetch(`${assistantWorkerUrl}/llm/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content:
                'You are a resume verification assistant. Your job is to "grill" users to verify their resume bullet points are authentic and accurate. Ask probing questions to verify metrics, technologies, and achievements. Be thorough but respectful.',
            },
            {
              role: 'user',
              content: `Bullet point to verify: "${bulletText}"\n\nUser's explanation: ${data.response}\n\nAsk a follow-up question to verify the authenticity and get more specific details.`,
            },
          ],
          temperature: 0.7,
          maxTokens: 150,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        client.emit('agent-feedback', {
          feedback: result.content || 'Can you provide more details about the specific metrics you achieved?',
          thinking: false,
        });
      } else {
        // Fallback
        client.emit('agent-feedback', {
          feedback: 'Can you provide more details about the specific metrics you achieved?',
          thinking: false,
        });
      }
    } catch (error) {
      this.logger.error('Error sending to assistant-worker:', error);
      client.emit('agent-feedback', {
        feedback: 'Can you provide more details about that?',
        thinking: false,
      });
    }
  }

  @SubscribeMessage('approve-bullet')
  async handleApproveBullet(
    @MessageBody() data: { bulletId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`Approving bullet: ${data.bulletId}`);

    // Mark as reviewed
    await this.experienceBankService.markAsReviewed(data.bulletId);

    session.reviewedCount++;

    // Send next bullet
    await this.sendNextBullet(client.id, client);
  }

  @SubscribeMessage('reject-bullet')
  async handleRejectBullet(
    @MessageBody() data: { bulletId: string; reason?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`Rejecting bullet: ${data.bulletId}`);

    // TODO: Delete or flag the bullet
    // For now, just skip to next

    // Send next bullet
    await this.sendNextBullet(client.id, client);
  }

  @SubscribeMessage('skip-bullet')
  async handleSkipBullet(@ConnectedSocket() client: Socket) {
    const session = this.sessions.get(client.id);
    if (!session) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log('Skipping bullet');

    // Send next bullet
    await this.sendNextBullet(client.id, client);
  }

  @SubscribeMessage('stop-review')
  handleStopReview(@ConnectedSocket() client: Socket) {
    const session = this.sessions.get(client.id);
    if (session) {
      this.logger.log(`Stopping review session for user ${session.userId}`);
      client.emit('review-summary', {
        reviewedCount: session.reviewedCount,
        remainingCount: session.bulletQueue.length,
      });
      this.sessions.delete(client.id);
    }

    client.emit('review-stopped');
  }

  /**
   * Send next bullet to review.
   */
  private async sendNextBullet(sessionId: string, client: Socket) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (session.bulletQueue.length === 0) {
      // No more bullets
      client.emit('review-complete', {
        reviewedCount: session.reviewedCount,
      });
      this.sessions.delete(sessionId);
      return;
    }

    // Get next bullet
    const bulletId = session.bulletQueue.shift()!;
    session.currentBulletId = bulletId;

    const bullet = await this.experienceBankService.getById(bulletId);
    if (!bullet) {
      // Bullet not found, skip to next
      await this.sendNextBullet(sessionId, client);
      return;
    }

    // Send to client
    client.emit('next-bullet', {
      bulletId: bullet._id.toString(),
      bulletText: bullet.bulletText,
      metadata: bullet.metadata,
      remainingCount: session.bulletQueue.length,
    });

    // Send initial agent question
    client.emit('agent-question', {
      question: `Let's verify this bullet point: "${bullet.bulletText}". Can you walk me through what you actually did here?`,
      thinking: false,
    });
  }
}
