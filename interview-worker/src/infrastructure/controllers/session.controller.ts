/**
 * Session Controller
 * 
 * REST API endpoints for interview session management
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SessionService } from '../../application/services/session.service';
import { StartSessionDto } from '../../application/dto/start-session.dto';
import { SubmitResponseDto } from '../../application/dto/submit-response.dto';
import { InterviewSession } from '../../domain/entities';

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async startSession(
    @Body() dto: StartSessionDto,
  ): Promise<InterviewSession> {
    return await this.sessionService.startSession({
      interviewId: dto.interviewId,
      candidateId: dto.candidateId,
      communicationMode: dto.communicationMode,
    });
  }

  @Get(':sessionId')
  async getSession(
    @Param('sessionId') sessionId: string,
  ): Promise<InterviewSession | null> {
    return await this.sessionService.getSession(sessionId);
  }

  @Post(':sessionId/pause')
  async pauseSession(
    @Param('sessionId') sessionId: string,
  ): Promise<InterviewSession> {
    return await this.sessionService.pauseSession(sessionId);
  }

  @Post(':sessionId/resume')
  async resumeSession(
    @Param('sessionId') sessionId: string,
  ): Promise<InterviewSession> {
    return await this.sessionService.resumeSession(sessionId);
  }

  @Post(':sessionId/skip/:questionId')
  async skipQuestion(
    @Param('sessionId') sessionId: string,
    @Param('questionId') questionId: string,
  ): Promise<InterviewSession> {
    return await this.sessionService.skipQuestion(sessionId, questionId);
  }

  @Post(':sessionId/submit-response')
  async submitResponse(
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitResponseDto,
  ): Promise<{ success: boolean }> {
    // Get session to determine communication mode
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    await this.sessionService.submitResponse({
      sessionId,
      questionId: dto.questionId,
      candidateResponse: dto.candidateResponse,
      skipped: dto.skipped,
      communicationMode: session.communicationMode,
    });

    return { success: true };
  }
}

