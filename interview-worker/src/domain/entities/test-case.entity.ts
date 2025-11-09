/**
 * Test Case Entity
 *
 * Represents a test case for code evaluation.
 */

export interface TestCase {
  id: string;
  questionId: string;
  input: any; // JSON serializable
  expectedOutput: any;
  isHidden: boolean; // Hidden test cases (not shown to candidate)
  description?: string;
}
