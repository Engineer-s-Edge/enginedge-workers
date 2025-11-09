/**
 * Code Execution Controller
 *
 * REST API endpoints for code execution and test case management.
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
import {
  CodeExecutionService,
  ExecuteCodeDto,
} from '../../application/services/code-execution.service';
import { CodeExecution } from '../../domain/entities';
import { MongoTestCaseRepository } from '../adapters/database/test-case.repository';

@Controller()
export class CodeExecutionController {
  constructor(
    private readonly codeExecutionService: CodeExecutionService,
    private readonly testCaseRepository: MongoTestCaseRepository,
  ) {}

  /**
   * POST /sessions/:sessionId/responses/:responseId/execute
   * Execute code with test cases
   */
  @Post('sessions/:sessionId/responses/:responseId/execute')
  @HttpCode(HttpStatus.CREATED)
  async executeCode(
    @Param('sessionId') sessionId: string,
    @Param('responseId') responseId: string,
    @Body() body: { code: string; language: string; questionId: string },
  ): Promise<CodeExecution> {
    // Load test cases for the question
    const testCases = await this.testCaseRepository.findByQuestionId(
      body.questionId,
    );

    const dto: ExecuteCodeDto = {
      code: body.code,
      language: body.language,
      testCases,
      responseId,
      sessionId,
      questionId: body.questionId,
    };

    return await this.codeExecutionService.executeCode(dto);
  }

  /**
   * GET /executions/:id
   * Get execution status and results
   */
  @Get('executions/:id')
  async getExecution(@Param('id') id: string): Promise<CodeExecution | null> {
    return await this.codeExecutionService.getExecutionStatus(id);
  }

  /**
   * POST /executions/:id/cancel
   * Cancel execution
   */
  @Post('executions/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelExecution(
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.codeExecutionService.cancelExecution(id);
    return { success: true };
  }

  /**
   * GET /questions/:questionId/test-cases
   * Get test cases for a question (filtered for candidate - no hidden tests)
   */
  @Get('questions/:questionId/test-cases')
  async getTestCases(@Param('questionId') questionId: string) {
    const testCases =
      await this.testCaseRepository.findByQuestionId(questionId);
    // Filter out hidden test cases for candidates
    return testCases.filter((tc) => !tc.isHidden);
  }
}
