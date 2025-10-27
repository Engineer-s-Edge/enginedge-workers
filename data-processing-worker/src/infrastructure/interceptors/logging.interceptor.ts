import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ILogger } from '@application/ports/logger.port';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(@Inject('ILogger') private readonly logger: ILogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const correlationId = (request as any).correlationId || request.headers['x-correlation-id'];
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
