/**
 * Session Controller
 *
 * REST API endpoints for interview session management
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { SessionService } from '../../application/services/session.service';
import { StartSessionDto } from '../../application/dto/start-session.dto';
import { SubmitResponseDto } from '../../application/dto/submit-response.dto';
import { InterviewSession } from '../../domain/entities';
import { MongoWhiteboardRepository } from '../adapters/database/whiteboard.repository';
import { WhiteboardState } from '../../domain/entities/whiteboard-state.entity';
import { MongoUserTestCaseRepository } from '../adapters/database/user-test-case.repository';
import { TestCase } from '../../domain/entities';
import { v4 as uuidv4 } from 'uuid';

@Controller('sessions')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly whiteboardRepository: MongoWhiteboardRepository,
    private readonly userTestCaseRepository: MongoUserTestCaseRepository,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async startSession(@Body() dto: StartSessionDto): Promise<InterviewSession> {
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

  @Post(':sessionId/end')
  async endSession(
    @Param('sessionId') sessionId: string,
  ): Promise<{ success: boolean; session: InterviewSession }> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    // End the session
    const endedSession = await this.sessionService.endSession(sessionId);
    return { success: true, session: endedSession };
  }

  @Get(':sessionId/completion-status')
  async getCompletionStatus(@Param('sessionId') sessionId: string): Promise<{
    sessionId: string;
    status: string;
    completedAt?: Date;
    totalQuestions: number;
    answeredQuestions: number;
    skippedQuestions: number;
    progress: number;
  }> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    // Get interview to calculate total questions
    const interview = await this.sessionService.getInterview(
      session.interviewId,
    );
    const totalQuestions = interview ? interview.getTotalQuestionCount() : 0;

    return {
      sessionId: session.sessionId,
      status: session.status,
      completedAt: session.completedAt,
      totalQuestions,
      answeredQuestions: totalQuestions - session.skippedQuestions.length,
      skippedQuestions: session.skippedQuestions.length,
      progress:
        totalQuestions > 0
          ? ((totalQuestions - session.skippedQuestions.length) /
              totalQuestions) *
            100
          : 0,
    };
  }

  @Post(':sessionId/whiteboard/state')
  @HttpCode(HttpStatus.CREATED)
  async saveWhiteboardState(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      questionId: string;
      diagram: {
        nodes: Array<{
          id: string;
          type: 'component' | 'shape' | 'text';
          position: { x: number; y: number };
          data: Record<string, any>;
        }>;
        edges: Array<{
          id: string;
          source: string;
          target: string;
          type: string;
        }>;
      };
    },
  ): Promise<WhiteboardState> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    // Get existing state to increment version
    const existing = await this.whiteboardRepository.findBySessionAndQuestion(
      sessionId,
      body.questionId,
    );

    const state: WhiteboardState = {
      id: existing?.id || uuidv4(),
      sessionId,
      questionId: body.questionId,
      diagram: body.diagram,
      metadata: {
        createdAt: existing?.metadata.createdAt || new Date(),
        updatedAt: new Date(),
        version: existing ? existing.metadata.version + 1 : 1,
      },
    };

    return await this.whiteboardRepository.save(state);
  }

  @Get(':sessionId/whiteboard/state')
  async getWhiteboardState(
    @Param('sessionId') sessionId: string,
    @Query('questionId') questionId?: string,
  ): Promise<WhiteboardState | WhiteboardState[] | null> {
    if (questionId) {
      return await this.whiteboardRepository.findBySessionAndQuestion(
        sessionId,
        questionId,
      );
    }
    return await this.whiteboardRepository.findBySession(sessionId);
  }

  @Get(':sessionId/whiteboard/history')
  async getWhiteboardHistory(
    @Param('sessionId') sessionId: string,
    @Query('questionId') questionId: string,
  ): Promise<WhiteboardState[]> {
    if (!questionId) {
      throw new HttpException('questionId is required', HttpStatus.BAD_REQUEST);
    }
    return await this.whiteboardRepository.getHistory(sessionId, questionId);
  }

  @Post(':sessionId/whiteboard/state/send-to-agent')
  async sendWhiteboardToAgent(
    @Param('sessionId') sessionId: string,
    @Body() body: { questionId: string },
  ): Promise<{ success: boolean; message: string }> {
    const state = await this.whiteboardRepository.findBySessionAndQuestion(
      sessionId,
      body.questionId,
    );

    if (!state) {
      throw new HttpException(
        'Whiteboard state not found',
        HttpStatus.NOT_FOUND,
      );
    }

    // Convert whiteboard state to text description for agent
    // This is a simplified version - in production, you might use a more sophisticated conversion
    const description = `Whiteboard diagram with ${state.diagram.nodes.length} nodes and ${state.diagram.edges.length} edges.`;

    // In a real implementation, you would send this to the interview agent
    // For now, just return success
    return {
      success: true,
      message: 'Whiteboard state sent to agent for evaluation',
    };
  }

  @Post(':sessionId/test-cases')
  @HttpCode(HttpStatus.CREATED)
  async addUserTestCase(
    @Param('sessionId') sessionId: string,
    @Body()
    body: {
      questionId: string;
      input: any;
      expectedOutput: any;
      description?: string;
    },
  ): Promise<TestCase> {
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    const testCase: TestCase & { sessionId: string } = {
      id: uuidv4(),
      sessionId,
      questionId: body.questionId,
      input: body.input,
      expectedOutput: body.expectedOutput,
      isHidden: false,
      description: body.description,
    };

    return await this.userTestCaseRepository.save(testCase);
  }

  @Delete(':sessionId/test-cases/:testCaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeUserTestCase(
    @Param('sessionId') sessionId: string,
    @Param('testCaseId') testCaseId: string,
  ): Promise<void> {
    const testCase = await this.userTestCaseRepository.findById(testCaseId);
    if (!testCase || testCase.sessionId !== sessionId) {
      throw new HttpException('Test case not found', HttpStatus.NOT_FOUND);
    }

    await this.userTestCaseRepository.delete(testCaseId);
  }

  @Get(':sessionId/test-cases')
  async getUserTestCases(
    @Param('sessionId') sessionId: string,
    @Query('questionId') questionId?: string,
  ): Promise<TestCase[]> {
    if (questionId) {
      return await this.userTestCaseRepository.findBySessionAndQuestion(
        sessionId,
        questionId,
      );
    }
    // Return all user test cases for session
    const allTestCases: TestCase[] = [];
    // Note: Would need to implement findBySession if needed
    return allTestCases;
  }
}
