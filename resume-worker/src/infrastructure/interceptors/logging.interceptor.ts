import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

// Logger interface for infrastructure use (matches ILogger from application ports)
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject('ILogger') private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { correlationId?: string }>();
    const { method, url } = request;
    const correlationId = (request as any).correlationId;
    const startTime = Date.now();

    this.logger.info('LoggingInterceptor: Incoming request', {
      method,
      url,
      correlationId,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.info('LoggingInterceptor: Request completed', {
            method,
            url,
            correlationId,
            duration,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error('LoggingInterceptor: Request failed', {
            method,
            url,
            correlationId,
            duration,
            error: error.message,
          });
        },
      }),
    );
  }
}
