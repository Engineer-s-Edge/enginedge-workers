/**
 * Unit Tests for CompilationJob Entity
 */

import {
  CompilationJob,
  CompilationStatus,
  CompilationError,
  CompilationLog,
} from '../../../domain/entities';

describe('CompilationJob Entity', () => {
  const mockLog: CompilationLog = {
    stdout: 'Compilation output',
    stderr: '',
    rawLog: 'Raw compilation log',
  };

  describe('create', () => {
    it('job-001: should create a new pending job', () => {
      const job = CompilationJob.create('job-001', 'doc-001', 'user-001');

      expect(job.jobId).toBe('job-001');
      expect(job.documentId).toBe('doc-001');
      expect(job.userId).toBe('user-001');
      expect(job.status).toBe(CompilationStatus.PENDING);
      expect(job.result).toBeNull();
      expect(job.startedAt).toBeNull();
      expect(job.completedAt).toBeNull();
    });

    it('job-002: should create job without userId', () => {
      const job = CompilationJob.create('job-002', 'doc-002');

      expect(job.userId).toBeUndefined();
    });

    it('job-003: should set createdAt timestamp', () => {
      const before = new Date();
      const job = CompilationJob.create('job-003', 'doc-003');
      const after = new Date();

      expect(job.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(job.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('start', () => {
    it('job-004: should mark job as started', () => {
      const job = CompilationJob.create('job-004', 'doc-004');
      const started = job.start();

      expect(started.status).toBe(CompilationStatus.COMPILING);
      expect(started.startedAt).not.toBeNull();
      expect(started.startedAt?.getTime()).toBeGreaterThan(0);
    });

    it('job-005: should preserve job ID and document ID', () => {
      const job = CompilationJob.create('job-005', 'doc-005', 'user-005');
      const started = job.start();

      expect(started.jobId).toBe('job-005');
      expect(started.documentId).toBe('doc-005');
      expect(started.userId).toBe('user-005');
    });
  });

  describe('complete', () => {
    it('job-006: should mark successful compilation', () => {
      const job = CompilationJob.create('job-006', 'doc-006').start();
      const result = {
        success: true,
        pdfId: 'pdf-001',
        compilationTime: 5000,
        passes: 2,
        errors: [],
        warnings: [],
        logs: mockLog,
      };

      const completed = job.complete(result);

      expect(completed.status).toBe(CompilationStatus.COMPLETED);
      expect(completed.result).toEqual(result);
      expect(completed.completedAt).not.toBeNull();
    });

    it('job-007: should mark failed compilation', () => {
      const job = CompilationJob.create('job-007', 'doc-007').start();
      const errors: CompilationError[] = [
        { message: 'Undefined control sequence', severity: 'error', line: 10 },
      ];
      const result = {
        success: false,
        compilationTime: 3000,
        passes: 1,
        errors,
        warnings: [],
        logs: mockLog,
      };

      const completed = job.complete(result);

      expect(completed.status).toBe(CompilationStatus.FAILED);
      expect(completed.result?.success).toBe(false);
      expect(completed.result?.errors).toHaveLength(1);
    });

    it('job-008: should record completion time', () => {
      const job = CompilationJob.create('job-008', 'doc-008').start();
      const before = new Date();
      
      const completed = job.complete({
        success: true,
        compilationTime: 2000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: mockLog,
      });
      
      const after = new Date();

      expect(completed.completedAt).not.toBeNull();
      expect(completed.completedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(completed.completedAt!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('fail', () => {
    it('job-009: should mark job as failed with errors', () => {
      const job = CompilationJob.create('job-009', 'doc-009').start();
      const errors: CompilationError[] = [
        { message: 'Missing } inserted', severity: 'error', line: 15 },
        { message: 'Undefined control sequence', severity: 'error', line: 20 },
      ];

      const failed = job.fail(errors, mockLog);

      expect(failed.status).toBe(CompilationStatus.FAILED);
      expect(failed.result?.success).toBe(false);
      expect(failed.result?.errors).toEqual(errors);
    });

    it('job-010: should calculate compilation time on failure', async () => {
      const job = CompilationJob.create('job-010', 'doc-010').start();
      
      // Wait 10ms to ensure measurable time
      await new Promise(resolve => setTimeout(resolve, 10));
      const failed = job.fail([], mockLog);

      expect(failed.result?.compilationTime).toBeGreaterThan(0);
    });
  });

  describe('timeout', () => {
    it('job-011: should mark job as timeout', () => {
      const job = CompilationJob.create('job-011', 'doc-011').start();
      const timedOut = job.timeout(mockLog);

      expect(timedOut.status).toBe(CompilationStatus.TIMEOUT);
      expect(timedOut.result?.success).toBe(false);
      expect(timedOut.result?.errors).toHaveLength(1);
      expect(timedOut.result?.errors[0].message).toContain('timed out');
    });
  });

  describe('cancel', () => {
    it('job-012: should cancel a job', () => {
      const job = CompilationJob.create('job-012', 'doc-012').start();
      const cancelled = job.cancel();

      expect(cancelled.status).toBe(CompilationStatus.CANCELLED);
      expect(cancelled.completedAt).not.toBeNull();
    });
  });

  describe('isInProgress', () => {
    it('job-013: should return true for pending job', () => {
      const job = CompilationJob.create('job-013', 'doc-013');
      expect(job.isInProgress()).toBe(true);
    });

    it('job-014: should return true for compiling job', () => {
      const job = CompilationJob.create('job-014', 'doc-014').start();
      expect(job.isInProgress()).toBe(true);
    });

    it('job-015: should return false for completed job', () => {
      const job = CompilationJob.create('job-015', 'doc-015').start();
      const completed = job.complete({
        success: true,
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: mockLog,
      });

      expect(completed.isInProgress()).toBe(false);
    });

    it('job-016: should return false for failed job', () => {
      const job = CompilationJob.create('job-016', 'doc-016').start();
      const failed = job.fail([], mockLog);

      expect(failed.isInProgress()).toBe(false);
    });
  });

  describe('isComplete', () => {
    it('job-017: should return false for pending job', () => {
      const job = CompilationJob.create('job-017', 'doc-017');
      expect(job.isComplete()).toBe(false);
    });

    it('job-018: should return true for completed job', () => {
      const job = CompilationJob.create('job-018', 'doc-018').start();
      const completed = job.complete({
        success: true,
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: mockLog,
      });

      expect(completed.isComplete()).toBe(true);
    });

    it('job-019: should return true for cancelled job', () => {
      const job = CompilationJob.create('job-019', 'doc-019').start();
      const cancelled = job.cancel();

      expect(cancelled.isComplete()).toBe(true);
    });
  });

  describe('getDuration', () => {
    it('job-020: should return null for job not started', () => {
      const job = CompilationJob.create('job-020', 'doc-020');
      expect(job.getDuration()).toBeNull();
    });

    it('job-021: should calculate duration for in-progress job', () => {
      const job = CompilationJob.create('job-021', 'doc-021').start();
      const duration = job.getDuration();

      expect(duration).not.toBeNull();
      expect(duration!).toBeGreaterThanOrEqual(0);
    });

    it('job-022: should calculate duration for completed job', async () => {
      const job = CompilationJob.create('job-022', 'doc-022').start();
      
      // Wait 10ms to ensure measurable duration
      await new Promise(resolve => setTimeout(resolve, 10));
      const completed = job.complete({
        success: true,
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: mockLog,
      });

      const duration = completed.getDuration();
      expect(duration).not.toBeNull();
      expect(duration!).toBeGreaterThan(0);
    });
  });

  describe('getErrorSummary', () => {
    it('job-023: should return no errors message', () => {
      const job = CompilationJob.create('job-023', 'doc-023').start();
      const completed = job.complete({
        success: true,
        compilationTime: 1000,
        passes: 1,
        errors: [],
        warnings: [],
        logs: mockLog,
      });

      expect(completed.getErrorSummary()).toBe('No errors');
    });

    it('job-024: should format error summary with line numbers', () => {
      const job = CompilationJob.create('job-024', 'doc-024').start();
      const errors: CompilationError[] = [
        { message: 'Undefined control sequence', severity: 'error', line: 10 },
        { message: 'Missing } inserted', severity: 'warning', line: 15 },
      ];

      const failed = job.fail(errors, mockLog);
      const summary = failed.getErrorSummary();

      expect(summary).toContain('ERROR (line 10): Undefined control sequence');
      expect(summary).toContain('WARNING (line 15): Missing } inserted');
    });

    it('job-025: should handle errors without line numbers', () => {
      const job = CompilationJob.create('job-025', 'doc-025').start();
      const errors: CompilationError[] = [
        { message: 'General error', severity: 'error' },
      ];

      const failed = job.fail(errors, mockLog);
      const summary = failed.getErrorSummary();

      expect(summary).toContain('ERROR: General error');
      expect(summary).not.toContain('(line');
    });
  });
});
