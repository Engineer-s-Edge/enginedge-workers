/**
 * Agent Controller
 *
 * REST API endpoints for interview agent integration
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../../application/services/session.service';
import { InterviewService } from '../../application/services/interview.service';
import { CandidateProfileService } from '../../application/services/candidate-profile.service';
import { MongoCodeExecutionRepository } from '../adapters/database/code-execution.repository';
import { MongoWhiteboardRepository } from '../adapters/database/whiteboard.repository';
import { IInterviewSessionRepository } from '../../application/ports/repositories.port';
import axios from 'axios';

@Controller('sessions/:sessionId/agent')
export class AgentController {
  private readonly assistantWorkerUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly interviewService: InterviewService,
    private readonly profileService: CandidateProfileService,
    private readonly codeExecutionRepository: MongoCodeExecutionRepository,
    private readonly whiteboardRepository: MongoWhiteboardRepository,
    @Inject('IInterviewSessionRepository')
    private readonly sessionRepository: IInterviewSessionRepository,
  ) {
    this.assistantWorkerUrl =
      this.configService.get<string>('ASSISTANT_WORKER_URL') ||
      'http://localhost:3001';
  }

  /**
   * POST /sessions/:sessionId/agent/execute
   * Execute agent with session context
   */
  @Post('execute')
  async executeAgent(
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string; userId?: string },
  ): Promise<{
    response: string;
    toolCalls?: Array<{ name: string; arguments: any }>;
  }> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    const interview = await this.interviewService.getInterview(
      session.interviewId,
    );
    if (!interview) {
      throw new HttpException('Interview not found', HttpStatus.NOT_FOUND);
    }

    const profile = await this.profileService.getProfile(sessionId);
    const context = await this.buildAgentContext(sessionId, session, interview);

    try {
      // Call assistant worker to execute interview agent
      const response = await axios.post(
        `${this.assistantWorkerUrl}/agents/interview/execute`,
        {
          sessionId,
          interviewId: session.interviewId,
          candidateId: session.candidateId,
          message: body.message,
          context,
          profile: profile?.observations,
        },
      );

      return {
        response: response.data.response || response.data.output,
        toolCalls: response.data.toolCalls,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to execute agent: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /sessions/:sessionId/agent/stream
   * Stream agent responses (SSE)
   */
  @Post('stream')
  async streamAgent(
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string },
  ): Promise<{ streamUrl: string }> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    // Return URL for SSE stream
    return {
      streamUrl: `${this.assistantWorkerUrl}/agents/interview/stream?sessionId=${sessionId}&message=${encodeURIComponent(body.message)}`,
    };
  }

  /**
   * GET /sessions/:sessionId/agent/context
   * Get agent context (phase, questions, time)
   */
  @Get('context')
  async getAgentContext(
    @Param('sessionId') sessionId: string,
  ): Promise<{
    sessionId: string;
    currentPhase?: {
      phaseId: string;
      type: string;
      duration: number;
      timeElapsed: number;
      timeRemaining: number;
    };
    currentQuestion?: string;
    totalTimeElapsed: number;
    totalTimeRemaining: number;
    questionsAnswered: number;
    questionsRemaining: number;
  }> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    const interview = await this.interviewService.getInterview(
      session.interviewId,
    );
    if (!interview) {
      throw new HttpException('Interview not found', HttpStatus.NOT_FOUND);
    }

    // Get current phase by index
    const currentPhase = interview.phases[session.currentPhase || 0];

    const phaseTimeElapsed = session.getPhaseTimeElapsed();
    const phaseTimeRemaining = currentPhase
      ? currentPhase.duration * 60 - phaseTimeElapsed
      : 0;

    const totalTimeLimit = interview.getTotalTimeLimit() * 60;
    const totalTimeElapsed = session.getTimeElapsed();
    const totalTimeRemaining = totalTimeLimit - totalTimeElapsed;

    return {
      sessionId,
      currentPhase: currentPhase
        ? {
            phaseId: currentPhase.phaseId,
            type: currentPhase.type,
            duration: currentPhase.duration,
            difficulty: currentPhase.difficulty,
            timeElapsed: phaseTimeElapsed,
            timeRemaining: phaseTimeRemaining,
          }
        : undefined,
      currentQuestion: session.currentQuestion,
      totalTimeElapsed,
      totalTimeRemaining,
      questionsAnswered: session.responses?.length || 0,
      questionsRemaining:
        interview.getTotalQuestionCount() - (session.responses?.length || 0),
    };
  }

  /**
   * Build agent context from session data
   */
  private async buildAgentContext(
    sessionId: string,
    session: any,
    interview: any,
  ): Promise<any> {
    // Get code executions
    const codeExecutions = await this.codeExecutionRepository.findBySessionId(
      sessionId,
    );

    // Get whiteboard states
    const whiteboardStates = await this.whiteboardRepository.findBySession(
      sessionId,
    );

    // Get current phase by index
    const currentPhase = interview.phases[session.currentPhase || 0];

    return {
      sessionId,
      interviewId: session.interviewId,
      candidateId: session.candidateId,
      currentPhase: currentPhase
        ? {
            phaseId: currentPhase.phaseId,
            type: currentPhase.type,
            duration: currentPhase.duration,
            difficulty: currentPhase.difficulty,
            tags: currentPhase.tags,
            questionCount: currentPhase.questionCount,
          }
        : null,
      currentQuestionId: session.currentQuestion,
      currentPhaseIndex: session.currentPhase,
      timeElapsed: session.getTimeElapsed(),
      phaseTimeElapsed: session.getPhaseTimeElapsed(),
      responses: session.responses || [],
      codeExecutions: codeExecutions.map((e) => ({
        questionId: e.questionId,
        status: e.status,
        passedTests: e.passedTests,
        totalTests: e.totalTests,
        language: e.language,
      })),
      whiteboardStates: Array.isArray(whiteboardStates)
        ? whiteboardStates.map((w) => ({
            questionId: w.questionId,
            version: w.metadata.version,
          }))
        : whiteboardStates
        ? [
            {
              questionId: (whiteboardStates as any).questionId,
              version: (whiteboardStates as any).metadata.version,
            },
          ]
        : [],
      interviewConfig: {
        allowPause: interview.config.allowPause,
        allowSkip: interview.config.allowSkip,
        totalTimeLimit: interview.config.totalTimeLimit,
      },
    };
  }
}
