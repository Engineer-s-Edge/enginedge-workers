/**
 * Code Executor Port
 *
 * Interface for code execution adapters (Domain Layer Port)
 */

import { TestCase } from '../../domain/entities';
import { TestResult } from '../../domain/value-objects/test-result.value-object';

export interface ExecutionResult {
  output: string;
  error?: string;
  executionTime: number; // milliseconds
  memoryUsage?: number; // bytes
}

export interface ICodeExecutor {
  /**
   * Execute code with optional input
   */
  execute(
    code: string,
    language: string,
    input?: any,
  ): Promise<ExecutionResult>;

  /**
   * Run test cases against code
   */
  runTests(
    code: string,
    language: string,
    testCases: TestCase[],
  ): Promise<TestResult[]>;

  /**
   * Validate code syntax
   */
  validateSyntax(code: string, language: string): Promise<boolean>;
}
