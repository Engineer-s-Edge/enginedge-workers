/**
 * Code Execution Entity
 *
 * Represents a code execution instance with test results.
 */

import { TestResult } from '../value-objects/test-result.value-object';

export interface CodeExecution {
  id: string;
  responseId: string;
  sessionId: string;
  questionId: string;
  code: string;
  language: string; // javascript, python, java, etc.
  status: 'pending' | 'running' | 'completed' | 'failed';
  testResults: TestResult[];
  output: string;
  error?: string;
  executionTime?: number; // milliseconds
  memoryUsage?: number; // bytes
  passedTests: number;
  totalTests: number;
  createdAt: Date;
  completedAt?: Date;
}
