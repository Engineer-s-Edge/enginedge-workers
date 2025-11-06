import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Partitioners } from 'kafkajs';
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  workerType?: string;
  serviceName?: string;
  [key: string]: unknown;
}

export interface LogMessage {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  metadata?: Record<string, unknown>;
  source?: {
    file?: string;
    line?: number;
    column?: number;
    function?: string;
  };
  trace?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const REDACT_KEYS = new Set([
  'password',
  'pass',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'apiKey',
  'apikey',
  'client_secret',
  'secret',
  'cookie',
  'set-cookie',
  'auth',
  'credentials',
]);

function deepRedact(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => deepRedact(v));
  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, v] of Object.entries(value)) {
      if (REDACT_KEYS.has(key.toLowerCase())) result[key] = '[REDACTED]';
      else result[key] = deepRedact(v);
    }
    return result;
  }
  return value;
}

@Injectable()
export class KafkaLoggerAdapter implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private connected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 5000;
  private reconnectTimer?: NodeJS.Timeout;

  private logBuffer: LogMessage[] = [];
  private bufferFilePath: string;
  private maxBufferSize = 1000;
  private flushing = false;

  private currentLevel: LogLevel = 'info';
  private serviceName: string;
  private enableConsole: boolean;

  constructor(private readonly configService: ConfigService) {
    const brokers = (
      this.configService.get<string>('KAFKA_BROKERS') || 'localhost:9092'
    ).split(',');
    const clientId = this.configService.get<string>(
      'KAFKA_CLIENT_ID',
      'enginedge-worker',
    );
    this.serviceName = this.configService.get<string>(
      'SERVICE_NAME',
      'assistant-worker',
    );
    this.enableConsole =
      this.configService.get<string>('LOG_ENABLE_CONSOLE', 'true') === 'true';

    // Suppress KafkaJS verbose logging to reduce spam when Kafka is unavailable
    const kafkaLogLevel =
      this.configService.get<string>('KAFKA_LOG_LEVEL') || 'NOTHING';
    const logCreator = () => {
      return () => {
        // No-op: suppress all KafkaJS logs by default
      };
    };

    const logLevelMap: Record<string, number> = {
      NOTHING: 0,
      ERROR: 4,
      WARN: 5,
      INFO: 6,
      DEBUG: 7,
    };

    this.kafka = new Kafka({
      clientId: `${clientId}-${this.serviceName}`,
      brokers,
      retry: { initialRetryTime: 300, retries: 3 },
      logLevel: logLevelMap[kafkaLogLevel] ?? 0,
      logCreator: kafkaLogLevel === 'NOTHING' ? logCreator : undefined,
    });

    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
      allowAutoTopicCreation: true,
      maxInFlightRequests: 1,
      idempotent: true,
    });

    const logDir = this.configService.get<string>('LOG_BUFFER_DIR', 'logs');
    const absDir = path.isAbsolute(logDir)
      ? logDir
      : path.join(process.cwd(), logDir);
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
    this.bufferFilePath = path.join(absDir, `${this.serviceName}-buffer.log`);

    this.loadBufferFile();

    const logLevel = this.configService.get<string>(
      'LOG_LEVEL',
      'info',
    ) as LogLevel;
    this.setLevel(logLevel);
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.connected) await this.producer.disconnect();
    await this.flushBuffer();
  }

  private async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.connected = true;
      this.reconnectAttempts = 0;
      await this.flushBuffer();
    } catch (error) {
      this.connected = false;
      // Silently handle connection errors - don't log to prevent spam
      // Only log if it's not a connection refused error
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        !errorMessage.includes('ECONNREFUSED') &&
        !errorMessage.includes('Connection')
      ) {
        // Log non-connection errors (but only once to prevent spam)
        if (this.reconnectAttempts === 0) {
          console.warn(
            '[KafkaLoggerAdapter] Failed to connect to Kafka:',
            errorMessage,
          );
        }
      }
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      await this.connect();
    }, this.reconnectInterval);
  }

  private async sendToKafka(message: LogMessage): Promise<void> {
    if (!this.connected) throw new Error('Kafka not connected');
    const topic = `enginedge.logs.worker.${this.serviceName}`;
    await this.producer.send({
      topic,
      messages: [
        {
          key: this.serviceName,
          value: JSON.stringify(message),
          timestamp: Date.now().toString(),
        },
      ],
    });
  }

  private async bufferLog(message: LogMessage): Promise<void> {
    this.logBuffer.push(message);
    if (this.logBuffer.length > this.maxBufferSize) {
      await this.writeBufferToFile();
      this.logBuffer = [];
    }
    await this.appendToBufferFile(message);
  }

  private async flushBuffer(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const fileLogs = this.loadBufferFile();
      const allLogs = [...this.logBuffer, ...fileLogs];
      if (allLogs.length === 0) return;
      const failed: LogMessage[] = [];
      for (const log of allLogs) {
        try {
          await this.sendToKafka(log);
        } catch {
          failed.push(log);
        }
      }
      this.logBuffer = failed;
      if (failed.length === 0) this.clearBufferFile();
      else await this.writeBufferToFile(failed);
    } finally {
      this.flushing = false;
    }
  }

  private loadBufferFile(): LogMessage[] {
    try {
      if (!fs.existsSync(this.bufferFilePath)) return [];
      const content = fs.readFileSync(this.bufferFilePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      return lines.map((line) => JSON.parse(line) as LogMessage);
    } catch {
      return [];
    }
  }

  private async appendToBufferFile(message: LogMessage): Promise<void> {
    try {
      fs.appendFileSync(
        this.bufferFilePath,
        JSON.stringify(message) + '\n',
        'utf-8',
      );
    } catch {}
  }

  private async writeBufferToFile(logs?: LogMessage[]): Promise<void> {
    try {
      const logsToWrite = logs || this.logBuffer;
      if (logsToWrite.length === 0) return;
      const content =
        logsToWrite.map((log) => JSON.stringify(log)).join('\n') + '\n';
      fs.appendFileSync(this.bufferFilePath, content, 'utf-8');
    } catch {}
  }

  private clearBufferFile(): void {
    try {
      if (fs.existsSync(this.bufferFilePath))
        fs.unlinkSync(this.bufferFilePath);
    } catch {}
  }

  private buildLogMessage(
    level: LogLevel,
    message: string,
    context?: string | LogContext,
    metadata?: Record<string, unknown>,
    error?: Error | unknown,
  ): LogMessage {
    const ctx: LogContext =
      typeof context === 'string' ? ({ context } as any) : context || {};
    const redactedContext = deepRedact(ctx);
    const redactedMetadata = metadata ? deepRedact(metadata) : undefined;

    const logMessage: LogMessage = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: Object.keys(redactedContext).length
        ? redactedContext
        : undefined,
      metadata: redactedMetadata,
    };

    if (error) {
      if (error instanceof Error) {
        logMessage.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
        logMessage.trace = error.stack;
      } else {
        logMessage.error = { name: 'Unknown', message: String(error) };
      }
    }

    return logMessage;
  }

  private async write(
    level: LogLevel,
    message: string,
    context?: string | LogContext,
    metadata?: Record<string, unknown>,
    error?: Error | unknown,
  ): Promise<void> {
    if (!this.shouldLog(level)) return;
    const logMessage = this.buildLogMessage(
      level,
      message,
      context,
      metadata,
      error,
    );
    if (this.enableConsole) {
      const output = `[${logMessage.timestamp}] [${level.toUpperCase()}] ${message}`;
      switch (level) {
        case 'error':
        case 'fatal':
          console.error(output);
          break;
        case 'warn':
          console.warn(output);
          break;
        default:
          console.log(output);
      }
    }
    try {
      if (this.connected) await this.sendToKafka(logMessage);
      else throw new Error('Kafka not connected');
    } catch {
      await this.bufferLog(logMessage);
      if (!this.reconnectTimer) this.scheduleReconnect();
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    const currentIndex = levels.indexOf(this.currentLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }
  getLevel(): string {
    return this.currentLevel;
  }

  debug(
    message: string,
    context?: string | LogContext,
    metadata?: Record<string, unknown>,
  ): void {
    this.write('debug', message, context, metadata).catch(() => {});
  }
  info(
    message: string,
    context?: string | LogContext,
    metadata?: Record<string, unknown>,
  ): void {
    this.write('info', message, context, metadata).catch(() => {});
  }
  warn(
    message: string,
    context?: string | LogContext,
    metadata?: Record<string, unknown>,
  ): void {
    this.write('warn', message, context, metadata).catch(() => {});
  }
  error(
    message: string,
    error?: Error | unknown,
    context?: string | LogContext,
    metadata?: Record<string, unknown>,
  ): void {
    this.write('error', message, context, metadata, error).catch(() => {});
  }
  fatal(
    message: string,
    error?: Error | unknown,
    context?: string | LogContext,
    metadata?: Record<string, unknown>,
  ): void {
    this.write('fatal', message, context, metadata, error).catch(() => {});
  }
  verbose(
    message: string,
    context?: string | LogContext,
    metadata?: Record<string, unknown>,
  ): void {
    this.write('debug', message, context, metadata).catch(() => {});
  }
}
