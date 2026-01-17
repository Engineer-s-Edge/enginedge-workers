/**
 * Test Runner Adapter
 *
 * Formats code with test harnesses and executes test cases.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { TestCase } from '../../../domain/entities';
import { TestResult } from '../../../domain/value-objects/test-result.value-object';
import { ICodeExecutor } from '../../../application/ports/code-executor.port';

@Injectable()
export class TestRunnerAdapter {
  private readonly logger = new Logger(TestRunnerAdapter.name);

  constructor(
    @Inject('ICodeExecutor')
    private readonly codeExecutor: ICodeExecutor,
  ) {}

  /**
   * Run test cases against code
   */
  async runTests(
    code: string,
    language: string,
    testCases: TestCase[],
  ): Promise<TestResult[]> {
    // Format code with test harness
    const testCode = this.formatCodeWithTests(code, language, testCases);

    // Execute test code
    return await this.codeExecutor.runTests(testCode, language, testCases);
  }

  /**
   * Format code with test harness based on language
   */
  private formatCodeWithTests(
    code: string,
    language: string,
    testCases: TestCase[],
  ): string {
    const normalized = language.toLowerCase();

    switch (normalized) {
      case 'javascript':
      case 'typescript':
        return this.formatJavaScriptTests(code, testCases);
      case 'python':
        return this.formatPythonTests(code, testCases);
      case 'java':
        return this.formatJavaTests(code, testCases);
      default:
        // Fallback: just return the code
        return code;
    }
  }

  /**
   * Format JavaScript/TypeScript code with test harness
   */
  private formatJavaScriptTests(code: string, testCases: TestCase[]): string {
    const testCode = testCases
      .map((testCase, index) => {
        const inputStr = JSON.stringify(testCase.input);
        const expectedStr = JSON.stringify(testCase.expectedOutput);
        return `
try {
  const result = (${code})(${inputStr});
  const expected = ${expectedStr};
  const passed = JSON.stringify(result) === JSON.stringify(expected);
  console.log(JSON.stringify({
    testCaseId: "${testCase.id}",
    passed: passed,
    actualOutput: result,
    expectedOutput: expected,
    executionTime: 0
  }));
} catch (error) {
  console.log(JSON.stringify({
    testCaseId: "${testCase.id}",
    passed: false,
    error: error.message,
    expectedOutput: ${expectedStr},
    executionTime: 0
  }));
}`;
      })
      .join('\n');

    return `${code}\n\n${testCode}`;
  }

  /**
   * Format Python code with test harness
   */
  private formatPythonTests(code: string, testCases: TestCase[]): string {
    const testCode = testCases
      .map((testCase) => {
        const inputStr = JSON.stringify(testCase.input);
        const expectedStr = JSON.stringify(testCase.expectedOutput);
        return `
import json
try:
    result = solution(${inputStr})
    expected = ${expectedStr}
    passed = json.dumps(result) == json.dumps(expected)
    print(json.dumps({
        "testCaseId": "${testCase.id}",
        "passed": passed,
        "actualOutput": result,
        "expectedOutput": expected,
        "executionTime": 0
    }))
except Exception as e:
    print(json.dumps({
        "testCaseId": "${testCase.id}",
        "passed": False,
        "error": str(e),
        "expectedOutput": ${expectedStr},
        "executionTime": 0
    }))`;
      })
      .join('\n');

    // Replace function name with 'solution' if needed
    const formattedCode = code.replace(/def\s+\w+/, 'def solution');
    return `${formattedCode}\n\n${testCode}`;
  }

  /**
   * Format Java code with test harness
   */
  private formatJavaTests(code: string, testCases: TestCase[]): string {
    // Java requires more complex setup - would need proper class structure
    // For now, return the code as-is and let the executor handle it
    return code;
  }
}
