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
import { MongoCodeExecutionRepository } from '../../infrastructure/adapters/database/code-execution.repository';

export interface ExecuteCodeDto {
  code: string;
  language: string;
  testCases: TestCase[];
  responseId: string;
  sessionId: string;
  questionId: string;
  correctWorkingCode?: string; // Optional: correct working code for validation
  customTestCases?: TestCase[]; // Optional: user-created test cases
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
    private readonly codeExecutionRepository: MongoCodeExecutionRepository,
  ) {
    // TestRunnerAdapter will use the codeExecutor internally
  }

  /**
   * Execute code with test cases
   */
  async executeCode(dto: ExecuteCodeDto): Promise<CodeExecution> {
    const executionId = uuidv4();
    const startTime = Date.now();

    // Combine regular test cases and custom test cases
    const allTestCases = [...dto.testCases];
    if (dto.customTestCases) {
      allTestCases.push(...dto.customTestCases);
    }

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
      totalTests: allTestCases.length,
      createdAt: new Date(),
    };

    this.executions.set(executionId, execution);

    try {
      // Run test cases with user code
      const userTestResults = await this.testRunner.runTests(
        dto.code,
        dto.language,
        allTestCases,
      );

      // If custom test cases and correct working code are provided,
      // also run correct working code against custom test cases
      let correctCodeResults: TestResult[] = [];
      if (dto.customTestCases && dto.customTestCases.length > 0 && dto.correctWorkingCode) {
        correctCodeResults = await this.testRunner.runTests(
          dto.correctWorkingCode,
          dto.language,
          dto.customTestCases,
        );
      }

      // Merge results: for regular test cases, use user code results
      // For custom test cases, we'll include both user code and correct code results
      // The frontend can distinguish custom test cases by checking if correctCodeResults exist
      const testResults: TestResult[] = [];

      // Add results for regular test cases
      for (let i = 0; i < dto.testCases.length; i++) {
        testResults.push(userTestResults[i]);
      }

      // Add results for custom test cases
      // Note: The correct code results are stored separately and can be accessed
      // by matching testCaseId. The frontend should call a separate endpoint or
      // the execution result should include both sets of results.
      const customStartIndex = dto.testCases.length;
      for (let i = 0; i < (dto.customTestCases?.length || 0); i++) {
        testResults.push(userTestResults[customStartIndex + i]);
      }

      // Store correct code results in execution for later retrieval
      // This allows frontend to display both "Your code" and "Expected (correct solution)" results
      if (dto.customTestCases && dto.customTestCases.length > 0 && dto.correctWorkingCode) {
        // We'll store this information in the execution object
        // The frontend can query for both results
        (execution as any).customTestCasesResults = {
          userCodeResults: userTestResults.slice(customStartIndex),
          correctCodeResults: correctCodeResults,
        };
      }

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
      // Persist to database
      await this.codeExecutionRepository.save(completed);
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
      // Persist to database
      await this.codeExecutionRepository.save(failed);
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
    // Try in-memory first, then database
    const inMemory = this.executions.get(executionId);
    if (inMemory) {
      return inMemory;
    }
    return await this.codeExecutionRepository.findById(executionId);
  }

  /**
   * Get all code executions for a session
   */
  async getSessionExecutions(sessionId: string): Promise<CodeExecution[]> {
    return await this.codeExecutionRepository.findBySessionId(sessionId);
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
