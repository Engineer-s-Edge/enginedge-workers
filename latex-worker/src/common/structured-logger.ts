import { Injectable, LoggerService, LogLevel } from '@nestjs/common';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  jobId?: string;
  documentType?: string;
  duration?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

@Injectable()
export class StructuredLogger implements LoggerService {
  private context: string;

  constructor(context?: string) {
    this.context = context || 'Application';
  }

  /**
   * Write a log entry in structured JSON format
   */
  private writeLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...(context && { ...context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    // In production, send to logging service (e.g., CloudWatch, Datadog)
    // For now, write to stdout as JSON
    const logString = JSON.stringify(logEntry);

    switch (level) {
      case 'error':
      case 'fatal':
        console.error(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'debug':
      case 'verbose':
        if (
          process.env.LOG_LEVEL === 'debug' ||
          process.env.LOG_LEVEL === 'verbose'
        ) {
          console.log(logString);
        }
        break;
      default:
        console.log(logString);
    }
  }

  log(message: string, context?: LogContext) {
    this.writeLog('log', message, context);
  }

  error(message: string, trace?: string, context?: LogContext) {
    const error = trace ? new Error(trace) : undefined;
    this.writeLog('error', message, context, error);
  }

  warn(message: string, context?: LogContext) {
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: LogContext) {
    this.writeLog('debug', message, context);
  }

  verbose(message: string, context?: LogContext) {
    this.writeLog('verbose', message, context);
  }

  fatal(message: string, trace?: string, context?: LogContext) {
    const error = trace ? new Error(trace) : undefined;
    this.writeLog('fatal', message, context, error);
  }

  /**
   * Log compilation start
   */
  logCompilationStart(jobId: string, userId: string, documentType: string) {
    this.log('Compilation started', {
      jobId,
      userId,
      documentType,
      event: 'compilation.started',
    });
  }

  /**
   * Log compilation success
   */
  logCompilationSuccess(
    jobId: string,
    userId: string,
    documentType: string,
    duration: number,
  ) {
    this.log('Compilation completed successfully', {
      jobId,
      userId,
      documentType,
      duration,
      event: 'compilation.success',
    });
  }

  /**
   * Log compilation error
   */
  logCompilationError(
    jobId: string,
    userId: string,
    documentType: string,
    error: Error,
    duration: number,
  ) {
    this.error('Compilation failed', error.stack, {
      jobId,
      userId,
      documentType,
      duration,
      errorType: error.name,
      event: 'compilation.error',
    });
  }

  /**
   * Log package installation
   */
  logPackageInstallation(
    packageName: string,
    success: boolean,
    duration: number,
  ) {
    this.log(
      success
        ? 'Package installed successfully'
        : 'Package installation failed',
      {
        packageName,
        success,
        duration,
        event: 'package.installation',
      },
    );
  }

  /**
   * Log cache event
   */
  logCacheEvent(cacheType: string, hit: boolean, key: string) {
    this.debug(`Cache ${hit ? 'hit' : 'miss'}`, {
      cacheType,
      hit,
      key,
      event: 'cache.access',
    });
  }

  /**
   * Log performance warning
   */
  logPerformanceWarning(
    operation: string,
    duration: number,
    threshold: number,
  ) {
    this.warn(`Operation exceeded performance threshold`, {
      operation,
      duration,
      threshold,
      event: 'performance.warning',
    });
  }
}
