/**
 * Test Result Value Object
 *
 * Represents the result of executing a single test case.
 */

export interface TestResult {
  testCaseId: string;
  passed: boolean;
  actualOutput?: any;
  expectedOutput: any;
  error?: string;
  executionTime: number; // milliseconds
}
