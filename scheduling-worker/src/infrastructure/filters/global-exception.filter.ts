import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorMonitoringAdapter } from '../adapters/monitoring/error-monitoring.adapter';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Optional()
    private readonly errorMonitoring?: ErrorMonitoringAdapter,
  ) {}

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

    // Capture exception in error monitoring service
    if (this.errorMonitoring) {
      this.errorMonitoring.captureException(exception, {
        request: {
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
          query: request.query,
          params: request.params,
        },
        response: {
          statusCode: status,
        },
      });
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    });
  }
}
