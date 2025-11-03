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
import { ResumeBuilderService, BuilderSession } from '../../application/services/resume-builder.service';

@WebSocketGateway({
  namespace: '/resume-builder',
  cors: {
    origin: '*',
  },
})
export class ResumeBuilderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ResumeBuilderGateway.name);
  private clientSessions = new Map<string, string>(); // clientId -> sessionId

  constructor(private readonly builderService: ResumeBuilderService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.clientSessions.delete(client.id);
  }

  @SubscribeMessage('start-session')
  async handleStartSession(
    @MessageBody() data: {
      userId: string;
      mode: 'interview' | 'codebase' | 'manual';
    },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.log(`Starting builder session for user ${data.userId} in ${data.mode} mode`);

    const session = await this.builderService.startSession(data.userId, data.mode);
    this.clientSessions.set(client.id, session.sessionId);

    client.emit('session-started', {
      sessionId: session.sessionId,
      mode: session.mode,
    });

    // Start interview if in interview mode
    if (data.mode === 'interview') {
      this.startInterview(client);
    }
  }

  @SubscribeMessage('user-response')
  async handleUserResponse(
    @MessageBody() data: { response: string },
    @ConnectedSocket() client: Socket
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`User response in session ${sessionId}: ${data.response}`);

    // TODO: Send to assistant-worker agent for processing
    // Agent will analyze response and ask follow-up questions

    // For now, simulate agent response
    client.emit('agent-question', {
      question: 'Can you tell me more about the technologies you used?',
      thinking: false,
    });
  }

  @SubscribeMessage('add-experience')
  async handleAddExperience(
    @MessageBody() data: {
      company: string;
      role: string;
      dateRange: string;
      rawDescription: string;
    },
    @ConnectedSocket() client: Socket
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`Adding experience to session ${sessionId}: ${data.company}`);

    const session = await this.builderService.addExperience(sessionId, data);

    // Extract bullets from description
    const bullets = await this.builderService.extractBulletsFromDescription(
      sessionId,
      session.collectedData.experiences.length - 1,
      data.rawDescription
    );

    client.emit('experience-added', {
      experience: {
        company: data.company,
        role: data.role,
        bullets,
      },
    });

    client.emit('agent-message', {
      message: `Great! I've extracted ${bullets.length} bullet points from your description. Would you like to review them or add another experience?`,
      thinking: false,
    });
  }

  @SubscribeMessage('add-bullet')
  async handleAddBullet(
    @MessageBody() data: {
      experienceIndex: number;
      bulletText: string;
    },
    @ConnectedSocket() client: Socket
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`Adding bullet to session ${sessionId}`);

    await this.builderService.addBulletToExperience(
      sessionId,
      data.experienceIndex,
      data.bulletText
    );

    client.emit('bullet-added', {
      experienceIndex: data.experienceIndex,
      bulletText: data.bulletText,
    });
  }

  @SubscribeMessage('analyze-codebase')
  async handleAnalyzeCodebase(
    @MessageBody() data: { githubUrl: string },
    @ConnectedSocket() client: Socket
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`Analyzing codebase for session ${sessionId}: ${data.githubUrl}`);

    client.emit('agent-thinking', { message: 'Analyzing your GitHub repository...' });

    const analysis = await this.builderService.analyzeCodebase(sessionId, data.githubUrl);

    client.emit('codebase-analyzed', {
      commits: analysis.commits,
      contributions: analysis.contributions,
      suggestedBullets: analysis.suggestedBullets,
    });

    client.emit('agent-message', {
      message: `I found ${analysis.commits} commits and identified ${analysis.suggestedBullets.length} potential bullet points. Would you like to review them?`,
      thinking: false,
    });
  }

  @SubscribeMessage('add-education')
  async handleAddEducation(
    @MessageBody() data: {
      school: string;
      degree: string;
      graduationDate: string;
    },
    @ConnectedSocket() client: Socket
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`Adding education to session ${sessionId}`);

    this.builderService.addEducation(sessionId, data);

    client.emit('education-added', data);
  }

  @SubscribeMessage('add-skills')
  async handleAddSkills(
    @MessageBody() data: { skills: string[] },
    @ConnectedSocket() client: Socket
  ) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`Adding skills to session ${sessionId}`);

    this.builderService.addSkills(sessionId, data.skills);

    client.emit('skills-added', { skills: data.skills });
  }

  @SubscribeMessage('finalize-session')
  async handleFinalizeSession(@ConnectedSocket() client: Socket) {
    const sessionId = this.clientSessions.get(client.id);
    if (!sessionId) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    this.logger.log(`Finalizing session ${sessionId}`);

    const result = await this.builderService.finalizeSession(sessionId);

    client.emit('session-finalized', {
      storedBullets: result.storedBullets,
      summary: {
        experiences: result.session.collectedData.experiences.length,
        education: result.session.collectedData.education.length,
        skills: result.session.collectedData.skills.length,
        projects: result.session.collectedData.projects.length,
      },
    });

    client.emit('agent-message', {
      message: `Excellent! I've stored ${result.storedBullets} bullet points in your experience bank. You can now use them to build tailored resumes.`,
      thinking: false,
    });

    this.clientSessions.delete(client.id);
  }

  @SubscribeMessage('cancel-session')
  handleCancelSession(@ConnectedSocket() client: Socket) {
    const sessionId = this.clientSessions.get(client.id);
    if (sessionId) {
      this.builderService.cancelSession(sessionId);
      this.clientSessions.delete(client.id);
    }

    client.emit('session-cancelled');
  }

  /**
   * Start interview process.
   */
  private startInterview(client: Socket) {
    client.emit('agent-message', {
      message: "Hi! I'm here to help you build your resume. Let's start by talking about your work experience. Can you tell me about your most recent position?",
      thinking: false,
    });

    client.emit('agent-question', {
      question: 'What was your job title and company name?',
      thinking: false,
    });
  }
}

