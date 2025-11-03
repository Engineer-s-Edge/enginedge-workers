/**
 * Logging Interceptor
 *
 * Logs all HTTP requests and responses.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;
    const now = Date.now();

    this.logger.log(`Incoming ${method} ${url}`, {
      body: this.sanitizeBody(body),
      query,
      params,
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - now;
          this.logger.log(`Outgoing ${method} ${url} - ${duration}ms`, {
            statusCode: context.switchToHttp().getResponse().statusCode,
          });
        },
        error: (error) => {
          const duration = Date.now() - now;
          this.logger.error(`Error ${method} ${url} - ${duration}ms`, {
            error: error.message,
            stack: error.stack,
          });
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    const sanitized = { ...body };
    // Remove sensitive fields
    if (sanitized.password) sanitized.password = '[REDACTED]';
    if (sanitized.apiKey) sanitized.apiKey = '[REDACTED]';
    return sanitized;
  }
}
