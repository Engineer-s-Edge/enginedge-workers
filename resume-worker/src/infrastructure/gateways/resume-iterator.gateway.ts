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
import { ResumeEvaluatorService } from '../../application/services/resume-evaluator.service';
import { ResumeVersioningService } from '../../application/services/resume-versioning.service';

interface IteratorSession {
  userId: string;
  resumeId: string;
  mode: 'auto' | 'manual';
  targetScore: number;
  currentScore: number;
  iteration: number;
}

@WebSocketGateway({
  namespace: '/resume-iterator',
  cors: {
    origin: '*',
  },
})
export class ResumeIteratorGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ResumeIteratorGateway.name);
  private sessions = new Map<string, IteratorSession>();

  constructor(
    private readonly evaluatorService: ResumeEvaluatorService,
    private readonly versioningService: ResumeVersioningService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.sessions.delete(client.id);
  }

  @SubscribeMessage('start-iteration')
  async handleStartIteration(
    @MessageBody()
    data: {
      userId: string;
      resumeId: string;
      mode: 'auto' | 'manual';
      targetScore?: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Starting iteration session for resume ${data.resumeId}`);

    // Create session
    const session: IteratorSession = {
      userId: data.userId,
      resumeId: data.resumeId,
      mode: data.mode,
      targetScore: data.targetScore || 95,
      currentScore: 0,
      iteration: 0,
    };

    this.sessions.set(client.id, session);

    // Perform initial evaluation
    const report = await this.evaluatorService.evaluateResume(data.resumeId, {
      mode: 'standalone',
      useLlm: false,
      generateAutoFixes: true,
    });

    session.currentScore = report.scores.overall;

    // Send initial report
    client.emit('evaluation-report', {
      iteration: 0,
      score: report.scores.overall,
      report,
      mode: session.mode,
    });

    // If auto mode, start iterating
    if (session.mode === 'auto') {
      this.autoIterate(client.id, client);
    }
  }

  @SubscribeMessage('user-message')
  async handleUserMessage(
    @MessageBody() data: { message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`User message: ${data.message}`);

    // TODO: Send message to assistant-worker agent
    // For now, echo back
    client.emit('agent-message', {
      message: `Received: ${data.message}`,
      thinking: false,
    });
  }

  @SubscribeMessage('apply-fix')
  async handleApplyFix(
    @MessageBody() data: { fixId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`Applying fix: ${data.fixId}`);

    // TODO: Apply the fix
    // For now, just re-evaluate

    session.iteration++;

    const report = await this.evaluatorService.evaluateResume(
      session.resumeId,
      {
        mode: 'standalone',
        useLlm: false,
        generateAutoFixes: true,
      },
    );

    session.currentScore = report.scores.overall;

    client.emit('evaluation-report', {
      iteration: session.iteration,
      score: report.scores.overall,
      report,
    });
  }

  @SubscribeMessage('toggle-mode')
  async handleToggleMode(
    @MessageBody() data: { mode: 'auto' | 'manual' },
    @ConnectedSocket() client: Socket,
  ) {
    const session = this.sessions.get(client.id);
    if (!session) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`Toggling mode to: ${data.mode}`);
    session.mode = data.mode;

    if (data.mode === 'auto') {
      this.autoIterate(client.id, client);
    }

    client.emit('mode-changed', { mode: data.mode });
  }

  @SubscribeMessage('stop-iteration')
  handleStopIteration(@ConnectedSocket() client: Socket) {
    const session = this.sessions.get(client.id);
    if (session) {
      this.logger.log(`Stopping iteration for resume ${session.resumeId}`);
      this.sessions.delete(client.id);
    }

    client.emit('iteration-stopped');
  }

  /**
   * Auto-iterate to improve resume.
   */
  private async autoIterate(sessionId: string, client: Socket) {
    const session = this.sessions.get(sessionId);
    if (!session || session.mode !== 'auto') {
      return;
    }

    const maxIterations = 10;

    for (let i = 0; i < maxIterations; i++) {
      // Check if session still exists and is in auto mode
      const currentSession = this.sessions.get(sessionId);
      if (!currentSession || currentSession.mode !== 'auto') {
        break;
      }

      session.iteration++;

      // Emit thinking status
      client.emit('agent-thinking', { iteration: session.iteration });

      // TODO: Apply improvements
      // For now, just simulate

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Re-evaluate
      const report = await this.evaluatorService.evaluateResume(
        session.resumeId,
        {
          mode: 'standalone',
          useLlm: false,
          generateAutoFixes: true,
        },
      );

      session.currentScore = report.scores.overall;

      // Send report
      client.emit('evaluation-report', {
        iteration: session.iteration,
        score: report.scores.overall,
        report,
      });

      // Check if target reached
      if (session.currentScore >= session.targetScore) {
        client.emit('target-reached', {
          finalScore: session.currentScore,
          iterations: session.iteration,
        });
        break;
      }

      // Check for critical gates
      if (!report.gates.atsCompatible || !report.gates.spellcheckPassed) {
        client.emit('critical-issue', {
          message: 'Critical issue detected, stopping iteration',
          gates: report.gates,
        });
        break;
      }
    }

    client.emit('iteration-complete', {
      finalScore: session.currentScore,
      iterations: session.iteration,
    });
  }
}
