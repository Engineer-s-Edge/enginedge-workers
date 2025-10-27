import { Injectable } from '@nestjs/common';
import { ILogger } from '@application/ports/logger.port';

/**
 * Structured Logger Implementation
 * 
 * Logs in JSON format with correlation IDs for distributed tracing
 */
@Injectable()
export class StructuredLogger implements ILogger {
  private contextData: Record<string, unknown> = {};
  private currentLevel: string = 'info';

  constructor(private readonly serviceName: string = 'worker-node') {}

  log(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('LOG', message, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('DEBUG', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('INFO', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('WARN', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('ERROR', message, metadata);
  }

  fatal(message: string, metadata?: Record<string, unknown>): void {
    this.writeLog('FATAL', message, metadata);
  }

  setLevel(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'): void {
    this.currentLevel = level;
  }

  getLevel(): string {
    return this.currentLevel;
  }

  setContext(context: Record<string, unknown>): void {
    this.contextData = { ...this.contextData, ...context };
  }

  clearContext(): void {
    this.contextData = {};
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal'];
    const messageIndex = levels.indexOf(level.toLowerCase());
    const currentIndex = levels.indexOf(this.currentLevel.toLowerCase());

    return messageIndex >= currentIndex;
  }

  private writeLog(
    level: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...this.contextData,
      ...metadata,
    };

    const output = JSON.stringify(logEntry);
    
    switch (level) {
      case 'ERROR':
      case 'FATAL':
        console.error(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }
}
