import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export interface LogContext {
  [key: string]: unknown;
}
export interface LogMessage {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  metadata?: Record<string, unknown>;
  trace?: string;
  error?: { name: string; message: string; stack?: string };
}

function deepRedact(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => deepRedact(v));
  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, v] of Object.entries(value)) {
      const k = key.toLowerCase();
      if (
        [
          'password',
          'pass',
          'pwd',
          'token',
          'access_token',
          'refresh_token',
          'authorization',
          'apikey',
          'apiKey',
          'client_secret',
          'secret',
          'cookie',
          'set-cookie',
          'auth',
          'credentials',
        ].includes(k)
      )
        result[key] = '[REDACTED]';
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
  private reconnectTimer?: NodeJS.Timeout;
  private bufferFilePath: string;
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
      'resume-worker',
    );
    this.enableConsole =
      this.configService.get<string>('LOG_ENABLE_CONSOLE', 'true') === 'true';
    this.kafka = new Kafka({
      clientId: `${clientId}-${this.serviceName}`,
      brokers,
      retry: { initialRetryTime: 300, retries: 3 },
    });
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      maxInFlightRequests: 1,
      idempotent: true,
    });
    const dir = this.configService.get<string>('LOG_BUFFER_DIR', 'logs');
    const absDir = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
    if (!fs.existsSync(absDir)) fs.mkdirSync(absDir, { recursive: true });
    this.bufferFilePath = path.join(absDir, `${this.serviceName}-buffer.log`);
  }

  async onModuleInit() {
    await this.connect();
  }
  async onModuleDestroy() {
    if (this.connected) await this.producer.disconnect();
  }
  private async connect() {
    try {
      await this.producer.connect();
      this.connected = true;
    } catch {
      this.connected = false;
      this.scheduleReconnect();
    }
  }
  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, 5000);
  }
  private async sendToKafka(message: LogMessage) {
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
  private async bufferLog(message: LogMessage) {
    fs.appendFileSync(
      this.bufferFilePath,
      JSON.stringify(message) + '\n',
      'utf-8',
    );
  }

  private build(
    level: LogLevel,
    message: string,
    context?: LogContext,
    metadata?: Record<string, unknown>,
    error?: Error | unknown,
  ): LogMessage {
    const ctx = context ? deepRedact(context) : undefined;
    const meta = metadata ? deepRedact(metadata) : undefined;
    const log: LogMessage = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: ctx,
      metadata: meta,
    };
    if (error) {
      if (error instanceof Error) {
        log.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
        log.trace = error.stack;
      } else {
        log.error = { name: 'Unknown', message: String(error) };
      }
    }
    return log;
  }

  private async write(
    level: LogLevel,
    message: string,
    context?: LogContext,
    metadata?: Record<string, unknown>,
    error?: Error | unknown,
  ) {
    if (!this.shouldLog(level)) return;
    const log = this.build(level, message, context, metadata, error);
    if (this.enableConsole) {
      const line = `[${log.timestamp}] [${level.toUpperCase()}] ${message}`;
      if (level === 'error' || level === 'fatal') console.error(line);
      else if (level === 'warn') console.warn(line);
      else console.log(line);
    }
    try {
      await this.sendToKafka(log);
    } catch {
      await this.bufferLog(log);
      this.scheduleReconnect();
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    return order.indexOf(level) >= order.indexOf(this.currentLevel);
  }
  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }
  getLevel(): string {
    return this.currentLevel;
  }
  debug(m: string, c?: LogContext, md?: Record<string, unknown>) {
    this.write('debug', m, c, md).catch(() => {});
  }
  info(m: string, c?: LogContext, md?: Record<string, unknown>) {
    this.write('info', m, c, md).catch(() => {});
  }
  warn(m: string, c?: LogContext, md?: Record<string, unknown>) {
    this.write('warn', m, c, md).catch(() => {});
  }
  error(
    m: string,
    e?: Error | unknown,
    c?: LogContext,
    md?: Record<string, unknown>,
  ) {
    this.write('error', m, c, md, e).catch(() => {});
  }
  fatal(
    m: string,
    e?: Error | unknown,
    c?: LogContext,
    md?: Record<string, unknown>,
  ) {
    this.write('fatal', m, c, md, e).catch(() => {});
  }
  verbose(m: string, c?: LogContext, md?: Record<string, unknown>) {
    this.write('debug', m, c, md).catch(() => {});
  }
}
