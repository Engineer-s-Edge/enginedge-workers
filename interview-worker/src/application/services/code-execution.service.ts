/**
 * Code Execution Service
 *
 * Application service for executing code and running test cases.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CodeExecution, TestCase } from '../../domain/entities';
import { TestResult } from '../../domain/value-objects/test-result.value-object';
import { ICodeExecutor } from '../ports/code-executor.port';
import { TestRunnerAdapter } from '../../infrastructure/adapters/code-execution/test-runner.adapter';

export interface ExecuteCodeDto {
  code: string;
  language: string;
  testCases: TestCase[];
  responseId: string;
  sessionId: string;
  questionId: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

@Injectable()
export class CodeExecutionService {
  private readonly logger = new Logger(CodeExecutionService.name);
  private readonly executions = new Map<string, CodeExecution>();

  constructor(
    @Inject('ICodeExecutor')
    private readonly codeExecutor: ICodeExecutor,
    private readonly testRunner: TestRunnerAdapter,
  ) {
    // TestRunnerAdapter will use the codeExecutor internally
  }

  /**
   * Execute code with test cases
   */
  async executeCode(dto: ExecuteCodeDto): Promise<CodeExecution> {
    const executionId = uuidv4();
    const startTime = Date.now();

    // Create execution record
    const execution: CodeExecution = {
      id: executionId,
      responseId: dto.responseId,
      sessionId: dto.sessionId,
      questionId: dto.questionId,
      code: dto.code,
      language: dto.language,
      status: 'running',
      testResults: [],
      output: '',
      passedTests: 0,
      totalTests: dto.testCases.length,
      createdAt: new Date(),
    };

    this.executions.set(executionId, execution);

    try {
      // Run test cases
      const testResults = await this.testRunner.runTests(
        dto.code,
        dto.language,
        dto.testCases,
      );

      const executionTime = Date.now() - startTime;
      const passedTests = testResults.filter((r) => r.passed).length;

      // Update execution record
      const completed: CodeExecution = {
        ...execution,
        status: 'completed',
        testResults,
        passedTests,
        executionTime,
        completedAt: new Date(),
      };

      this.executions.set(executionId, completed);
      return completed;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      const failed: CodeExecution = {
        ...execution,
        status: 'failed',
        error: errorMessage,
        executionTime,
        completedAt: new Date(),
      };

      this.executions.set(executionId, failed);
      this.logger.error(`Code execution failed: ${errorMessage}`, error);
      return failed;
    }
  }

  /**
   * Run test cases
   */
  async runTestCases(
    code: string,
    language: string,
    testCases: TestCase[],
  ): Promise<TestResult[]> {
    return await this.testRunner.runTests(code, language, testCases);
  }

  /**
   * Validate code syntax
   */
  async validateCode(
    code: string,
    language: string,
  ): Promise<ValidationResult> {
    try {
      const valid = await this.codeExecutor.validateSyntax(code, language);
      return { valid };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<CodeExecution | null> {
    return this.executions.get(executionId) || null;
  }

  /**
   * Cancel execution (if running)
   */
  async cancelExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status === 'running') {
      // In a real implementation, we would cancel the Docker container
      // For now, just mark as failed
      execution.status = 'failed';
      execution.error = 'Execution cancelled';
      execution.completedAt = new Date();
      this.executions.set(executionId, execution);
    }
  }
}
