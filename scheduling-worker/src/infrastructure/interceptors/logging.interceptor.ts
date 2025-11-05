import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          // eslint-disable-next-line no-console
          console.info('Request completed', { method, url, duration });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          // eslint-disable-next-line no-console
          console.error('Request failed', { method, url, duration, error });
        },
      }),
    );
  }
}
