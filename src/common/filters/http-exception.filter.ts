import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    const payload =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : null;
    const message =
      payload?.message ?? (typeof body === 'string' ? body : undefined);

    response.status(status).json({
      statusCode: status,
      message:
        status >= 500 && !(exception instanceof HttpException)
          ? 'Ichki server xatoligi.'
          : (message ?? HttpStatus[status]),
      ...(payload?.retryAfter ? { retryAfter: payload.retryAfter } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
