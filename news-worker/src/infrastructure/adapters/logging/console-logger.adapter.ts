import { Injectable } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * Console Logger - for development and testing
 */
@Injectable()
export class ConsoleLoggerAdapter implements ILogger {
  private currentLevel: LogLevel = 'info';

  /**
   * Log debug level message
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (LOG_LEVELS[this.currentLevel] <= LOG_LEVELS.debug) {
      console.debug(`[DEBUG] ${message}`, metadata || {});
    }
  }

  /**
   * Log info level message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    if (LOG_LEVELS[this.currentLevel] <= LOG_LEVELS.info) {
      console.info(`[INFO] ${message}`, metadata || {});
    }
  }

  /**
   * Log warning level message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    if (LOG_LEVELS[this.currentLevel] <= LOG_LEVELS.warn) {
      console.warn(`[WARN] ${message}`, metadata || {});
    }
  }

  /**
   * Log error level message
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    if (LOG_LEVELS[this.currentLevel] <= LOG_LEVELS.error) {
      console.error(`[ERROR] ${message}`, metadata || {});
    }
  }

  /**
   * Log critical error
   */
  fatal(message: string, metadata?: Record<string, unknown>): void {
    if (LOG_LEVELS[this.currentLevel] <= LOG_LEVELS.fatal) {
      console.error(`[FATAL] ${message}`, metadata || {});
    }
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    if (LOG_LEVELS[level] !== undefined) {
      this.currentLevel = level;
    }
  }

  /**
   * Get current log level
   */
  getLevel(): string {
    return this.currentLevel;
  }
}
