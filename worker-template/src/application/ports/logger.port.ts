/**
 * Logger Port
 *
 * Interface for logging service adapters.
 * Allows swapping between different logging implementations.
 */

/**
 * Port for logger implementations
 */
export interface ILogger {
  /**
   * Log debug level message
   */
  debug(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log info level message
   */
  info(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log warning level message
   */
  warn(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log error level message
   */
  error(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Log critical error
   */
  fatal(message: string, metadata?: Record<string, unknown>): void;

  /**
   * Set log level
   */
  setLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'): void;

  /**
   * Get current log level
   */
  getLevel(): string;
}
