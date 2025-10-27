/**
 * CompilationJob Entity
 * 
 * Represents a LaTeX compilation job with its status, logs, and results.
 */

export enum CompilationStatus {
  PENDING = 'pending',
  COMPILING = 'compiling',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

export interface CompilationError {
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  file?: string;
}

export interface CompilationWarning {
  line?: number;
  message: string;
  file?: string;
}

export interface CompilationLog {
  stdout: string;
  stderr: string;
  rawLog: string;
}

export interface CompilationResult {
  pdfPath?: string;
  pdfId?: string; // GridFS ID for PDF storage
  success: boolean;
  compilationTime: number; // in milliseconds
  passes: number; // number of compilation passes
  errors: CompilationError[];
  warnings: CompilationWarning[];
  logs: CompilationLog;
}

export class CompilationJob {
  constructor(
    public readonly jobId: string,
    public readonly documentId: string,
    public readonly status: CompilationStatus,
    public readonly result: CompilationResult | null,
    public readonly createdAt: Date,
    public readonly startedAt: Date | null,
    public readonly completedAt: Date | null,
    public readonly userId?: string,
  ) {}

  /**
   * Create a new pending compilation job
   */
  static create(
    jobId: string,
    documentId: string,
    userId?: string,
  ): CompilationJob {
    return new CompilationJob(
      jobId,
      documentId,
      CompilationStatus.PENDING,
      null,
      new Date(),
      null,
      null,
      userId,
    );
  }

  /**
   * Mark job as started
   */
  start(): CompilationJob {
    return new CompilationJob(
      this.jobId,
      this.documentId,
      CompilationStatus.COMPILING,
      this.result,
      this.createdAt,
      new Date(),
      this.completedAt,
      this.userId,
    );
  }

  /**
   * Mark job as completed
   */
  complete(result: CompilationResult): CompilationJob {
    return new CompilationJob(
      this.jobId,
      this.documentId,
      result.success ? CompilationStatus.COMPLETED : CompilationStatus.FAILED,
      result,
      this.createdAt,
      this.startedAt,
      new Date(),
      this.userId,
    );
  }

  /**
   * Mark job as failed
   */
  fail(errors: CompilationError[], logs: CompilationLog): CompilationJob {
    const result: CompilationResult = {
      success: false,
      compilationTime: this.startedAt
        ? Date.now() - this.startedAt.getTime()
        : 0,
      passes: 0,
      errors,
      warnings: [],
      logs,
    };

    return new CompilationJob(
      this.jobId,
      this.documentId,
      CompilationStatus.FAILED,
      result,
      this.createdAt,
      this.startedAt,
      new Date(),
      this.userId,
    );
  }

  /**
   * Mark job as timeout
   */
  timeout(logs: CompilationLog): CompilationJob {
    const result: CompilationResult = {
      success: false,
      compilationTime: this.startedAt
        ? Date.now() - this.startedAt.getTime()
        : 0,
      passes: 0,
      errors: [
        {
          message: 'Compilation timed out',
          severity: 'error',
        },
      ],
      warnings: [],
      logs,
    };

    return new CompilationJob(
      this.jobId,
      this.documentId,
      CompilationStatus.TIMEOUT,
      result,
      this.createdAt,
      this.startedAt,
      new Date(),
      this.userId,
    );
  }

  /**
   * Cancel the job
   */
  cancel(): CompilationJob {
    return new CompilationJob(
      this.jobId,
      this.documentId,
      CompilationStatus.CANCELLED,
      this.result,
      this.createdAt,
      this.startedAt,
      new Date(),
      this.userId,
    );
  }

  /**
   * Check if job is in progress
   */
  isInProgress(): boolean {
    return (
      this.status === CompilationStatus.PENDING ||
      this.status === CompilationStatus.COMPILING
    );
  }

  /**
   * Check if job is complete (success or failed)
   */
  isComplete(): boolean {
    return (
      this.status === CompilationStatus.COMPLETED ||
      this.status === CompilationStatus.FAILED ||
      this.status === CompilationStatus.TIMEOUT ||
      this.status === CompilationStatus.CANCELLED
    );
  }

  /**
   * Get compilation duration in milliseconds
   */
  getDuration(): number | null {
    if (!this.startedAt) return null;
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
  }

  /**
   * Get error summary
   */
  getErrorSummary(): string {
    if (!this.result || !this.result.errors.length) {
      return 'No errors';
    }

    return this.result.errors
      .map((err) => {
        const location = err.line ? ` (line ${err.line})` : '';
        return `${err.severity.toUpperCase()}${location}: ${err.message}`;
      })
      .join('\n');
  }
}
