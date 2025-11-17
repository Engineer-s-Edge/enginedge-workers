/**
 * Code Execution Controller
 *
 * REST API endpoints for code execution and test case management.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  CodeExecutionService,
  ExecuteCodeDto,
} from '../../application/services/code-execution.service';
import { CodeExecution, TestCase } from '../../domain/entities';
import { MongoTestCaseRepository } from '../adapters/database/test-case.repository';
import { MongoUserTestCaseRepository } from '../adapters/database/user-test-case.repository';
import { QuestionService } from '../../application/services/question.service';
import { v4 as uuidv4 } from 'uuid';

@Controller()
export class CodeExecutionController {
  constructor(
    private readonly codeExecutionService: CodeExecutionService,
    private readonly testCaseRepository: MongoTestCaseRepository,
    private readonly userTestCaseRepository: MongoUserTestCaseRepository,
    private readonly questionService: QuestionService,
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

    // Load user-created test cases for this session and question
    const userTestCases = await this.userTestCaseRepository.findBySessionAndQuestion(
      sessionId,
      body.questionId,
    );

    // Get question to access correct working code
    const question = await this.questionService.getQuestion(body.questionId);

    const dto: ExecuteCodeDto = {
      code: body.code,
      language: body.language,
      testCases,
      responseId,
      sessionId,
      questionId: body.questionId,
      correctWorkingCode: question?.correctWorkingCode,
      customTestCases: userTestCases.length > 0 ? userTestCases : undefined,
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
    const visible = testCases.filter((tc) => !tc.isHidden);
    const hiddenCount = testCases.filter((tc) => tc.isHidden).length;

    return {
      testCases: visible,
      hiddenCount,
    };
  }

  /**
   * GET /questions/:questionId/test-cases/admin
   * Get all test cases including hidden (admin view)
   */
  @Get('questions/:questionId/test-cases/admin')
  async getTestCasesAdmin(@Param('questionId') questionId: string) {
    return await this.testCaseRepository.findByQuestionId(questionId);
  }

  /**
   * POST /questions/:questionId/test-cases
   * Create test case
   */
  @Post('questions/:questionId/test-cases')
  @HttpCode(HttpStatus.CREATED)
  async createTestCase(
    @Param('questionId') questionId: string,
    @Body()
    body: {
      input: any;
      expectedOutput: any;
      description?: string;
      isHidden?: boolean;
    },
  ): Promise<TestCase> {
    // Validate that question exists
    const question = await this.questionService.getQuestion(questionId);
    if (!question) {
      throw new HttpException('Question not found', HttpStatus.NOT_FOUND);
    }

    const testCase: TestCase = {
      id: uuidv4(),
      questionId,
      input: body.input,
      expectedOutput: body.expectedOutput,
      isHidden: body.isHidden || false,
      description: body.description,
    };

    return await this.testCaseRepository.save(testCase);
  }

  /**
   * PUT /questions/:questionId/test-cases/:testCaseId
   * Update test case
   */
  @Put('questions/:questionId/test-cases/:testCaseId')
  async updateTestCase(
    @Param('questionId') questionId: string,
    @Param('testCaseId') testCaseId: string,
    @Body()
    body: {
      input?: any;
      expectedOutput?: any;
      description?: string;
      isHidden?: boolean;
    },
  ): Promise<TestCase> {
    const testCase = await this.testCaseRepository.findById(testCaseId);
    if (!testCase || testCase.questionId !== questionId) {
      throw new HttpException('Test case not found', HttpStatus.NOT_FOUND);
    }

    return await this.testCaseRepository.update(testCaseId, body);
  }

  /**
   * DELETE /questions/:questionId/test-cases/:testCaseId
   * Delete test case
   */
  @Delete('questions/:questionId/test-cases/:testCaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTestCase(
    @Param('questionId') questionId: string,
    @Param('testCaseId') testCaseId: string,
  ): Promise<void> {
    const testCase = await this.testCaseRepository.findById(testCaseId);
    if (!testCase || testCase.questionId !== questionId) {
      throw new HttpException('Test case not found', HttpStatus.NOT_FOUND);
    }

    await this.testCaseRepository.delete(testCaseId);
  }

  /**
   * POST /questions/:questionId/test-cases/bulk-import
   * Import multiple test cases
   */
  @Post('questions/:questionId/test-cases/bulk-import')
  @HttpCode(HttpStatus.CREATED)
  async bulkImportTestCases(
    @Param('questionId') questionId: string,
    @Body()
    body: {
      testCases: Array<{
        input: any;
        expectedOutput: any;
        description?: string;
        isHidden?: boolean;
      }>;
    },
  ): Promise<{ success: boolean; imported: number; errors: any[] }> {
    // Validate that question exists
    const question = await this.questionService.getQuestion(questionId);
    if (!question) {
      throw new HttpException('Question not found', HttpStatus.NOT_FOUND);
    }

    const testCases: TestCase[] = body.testCases.map((tc) => ({
      id: uuidv4(),
      questionId,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: tc.isHidden || false,
      description: tc.description,
    }));

    const errors: any[] = [];
    let imported = 0;

    for (const testCase of testCases) {
      try {
        await this.testCaseRepository.save(testCase);
        imported++;
      } catch (error) {
        errors.push({
          testCase: testCase.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { success: errors.length === 0, imported, errors };
  }

  /**
   * POST /questions/:questionId/test-cases/validate
   * Validate test cases against correct working code
   */
  @Post('questions/:questionId/test-cases/validate')
  async validateTestCases(
    @Param('questionId') questionId: string,
    @Body() body: { testCaseIds?: string[] },
  ): Promise<{
    success: boolean;
    results: Array<{
      testCaseId: string;
      passed: boolean;
      actualOutput?: any;
      expectedOutput?: any;
      error?: string;
      executionTime?: number;
    }>;
  }> {
    const question = await this.questionService.getQuestion(questionId);
    if (!question) {
      throw new HttpException('Question not found', HttpStatus.NOT_FOUND);
    }

    if (!question.correctWorkingCode) {
      throw new HttpException(
        'Question does not have correct working code',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Get test cases to validate
    let testCases: TestCase[];
    if (body.testCaseIds && body.testCaseIds.length > 0) {
      testCases = [];
      for (const id of body.testCaseIds) {
        const tc = await this.testCaseRepository.findById(id);
        if (tc && tc.questionId === questionId) {
          testCases.push(tc);
        }
      }
    } else {
      testCases = await this.testCaseRepository.findByQuestionId(questionId);
    }

    // Execute correct working code against each test case
    const results = [];
    for (const testCase of testCases) {
      const startTime = Date.now();
      try {
        const execution = await this.codeExecutionService.executeCode({
          code: question.correctWorkingCode,
          language: 'python', // Default to python, could be made configurable
          testCases: [testCase],
          responseId: '',
          sessionId: '',
          questionId,
        });

        const executionTime = Date.now() - startTime;
        const testResult = execution.testResults[0];
        results.push({
          testCaseId: testCase.id,
          passed: testResult?.passed || false,
          actualOutput: testResult?.actualOutput,
          expectedOutput: testCase.expectedOutput,
          error: testResult?.error,
          executionTime,
        });
      } catch (error) {
        const executionTime = Date.now() - startTime;
        results.push({
          testCaseId: testCase.id,
          passed: false,
          expectedOutput: testCase.expectedOutput,
          error: error instanceof Error ? error.message : String(error),
          executionTime,
        });
      }
    }

    return {
      success: results.every((r) => r.passed),
      results,
    };
  }

  @Get('sessions/:sessionId/code-executions')
  async getCodeExecutions(
    @Param('sessionId') sessionId: string,
  ): Promise<CodeExecution[]> {
    return await this.codeExecutionService.getSessionExecutions(sessionId);
  }
}
