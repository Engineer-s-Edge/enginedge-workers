/**
 * Docker Code Executor Adapter
 *
 * Executes code in Docker containers for security and isolation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import { TestCase } from '../../../domain/entities';
import { TestResult } from '../../../domain/value-objects/test-result.value-object';
import {
  ICodeExecutor,
  ExecutionResult,
} from '../../../application/ports/code-executor.port';

@Injectable()
export class DockerCodeExecutorAdapter implements ICodeExecutor {
  private readonly logger = new Logger(DockerCodeExecutorAdapter.name);
  private readonly docker: Docker;
  private readonly timeout: number;
  private readonly memoryLimit: number;

  // Language to Docker image mapping
  private readonly languageImages: Record<string, string> = {
    javascript: 'node:20-alpine',
    typescript: 'node:20-alpine',
    python: 'python:3.11-alpine',
    java: 'openjdk:17-alpine',
    cpp: 'gcc:latest',
  };

  constructor(private readonly configService: ConfigService) {
    const dockerHost = this.configService.get<string>('DOCKER_HOST');
    this.docker = new Docker(
      dockerHost ? { socketPath: dockerHost } : undefined,
    );
    this.timeout =
      this.configService.get<number>('CODE_EXECUTION_TIMEOUT') || 10000;
    this.memoryLimit =
      this.configService.get<number>('CODE_EXECUTION_MEMORY_LIMIT') ||
      134217728; // 128MB
  }

  async execute(
    code: string,
    language: string,
    input?: any,
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const image = this.getImageForLanguage(language);

    if (!image) {
      throw new Error(`Unsupported language: ${language}`);
    }

    try {
      // Create container
      const container = await this.docker.createContainer({
        Image: image,
        Cmd: this.getCommandForLanguage(language, code, input),
        AttachStdout: true,
        AttachStderr: true,
        NetworkDisabled: true, // No network access for security
        HostConfig: {
          Memory: this.memoryLimit,
          MemorySwap: this.memoryLimit,
          CpuPeriod: 100000,
          CpuQuota: 50000, // 50% CPU
          ReadonlyRootfs: true, // Read-only filesystem
          AutoRemove: true,
        },
      });

      // Start container
      await container.start();

      // Wait for container to finish (with timeout)
      const timeoutPromise = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), this.timeout),
      );

      const waitPromise = container.wait();

      await Promise.race([waitPromise, timeoutPromise]);

      // Get logs
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        timestamps: false,
      });

      const output = logs.toString('utf-8').trim();
      const executionTime = Date.now() - startTime;

      // Get container stats for memory usage
      const stats = await container.stats({ stream: false });
      const memoryUsage =
        stats.memory_stats.usage || stats.memory_stats.max_usage || 0;

      return {
        output,
        executionTime,
        memoryUsage,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(`Code execution failed: ${errorMessage}`, error);

      return {
        output: '',
        error: errorMessage,
        executionTime,
      };
    }
  }

  async runTests(
    code: string,
    language: string,
    testCases: TestCase[],
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      const startTime = Date.now();
      try {
        const result = await this.execute(code, language, testCase.input);
        const executionTime = Date.now() - startTime;

        const passed = this.compareOutputs(
          result.output,
          testCase.expectedOutput,
        );

        results.push({
          testCaseId: testCase.id,
          passed,
          actualOutput: result.output,
          expectedOutput: testCase.expectedOutput,
          error: result.error,
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

    return results;
  }

  async validateSyntax(code: string, language: string): Promise<boolean> {
    try {
      // For now, we'll attempt to execute with a syntax check command
      // This is a simplified validation - in production, use language-specific parsers
      const result = await this.execute(
        this.getSyntaxCheckCode(code, language),
        language,
      );
      return !result.error;
    } catch {
      return false;
    }
  }

  private getImageForLanguage(language: string): string | null {
    const normalized = language.toLowerCase();
    return this.languageImages[normalized] || null;
  }

  private getCommandForLanguage(
    language: string,
    code: string,
    input?: any,
  ): string[] {
    const normalized = language.toLowerCase();

    switch (normalized) {
      case 'javascript':
      case 'typescript':
        return ['node', '-e', code];
      case 'python':
        return ['python', '-c', code];
      case 'java':
        // Java requires more complex setup - would need to write to file
        return [
          'sh',
          '-c',
          `echo "${code}" > Main.java && javac Main.java && java Main`,
        ];
      case 'cpp':
        return [
          'sh',
          '-c',
          `echo "${code}" > main.cpp && g++ main.cpp -o main && ./main`,
        ];
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private getSyntaxCheckCode(code: string, language: string): string {
    const normalized = language.toLowerCase();

    switch (normalized) {
      case 'javascript':
      case 'typescript':
        return `try { eval("${code.replace(/"/g, '\\"')}"); } catch(e) { process.exit(1); }`;
      case 'python':
        return `import ast; ast.parse("""${code.replace(/"/g, '\\"')}""")`;
      default:
        return code; // Fallback to regular execution
    }
  }

  private compareOutputs(actual: string, expected: any): boolean {
    // Try to parse as JSON first
    try {
      const actualParsed = JSON.parse(actual);
      const expectedParsed =
        typeof expected === 'string' ? JSON.parse(expected) : expected;
      return JSON.stringify(actualParsed) === JSON.stringify(expectedParsed);
    } catch {
      // Fallback to string comparison
      const expectedStr =
        typeof expected === 'string' ? expected : JSON.stringify(expected);
      return actual.trim() === expectedStr.trim();
    }
  }
}
