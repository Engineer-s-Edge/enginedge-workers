import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ILogger } from '@application/ports/logger.port';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject('ILogger') private readonly logger: ILogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      correlationId: request.correlationId,
    };

    // Log error with context
    this.logger.error('Unhandled exception', {
      ...errorResponse,
      stack: exception instanceof Error ? exception.stack : undefined,
      exception:
        exception instanceof Error ? exception.message : String(exception),
    });

    response.status(status).json(errorResponse);
  }
}
