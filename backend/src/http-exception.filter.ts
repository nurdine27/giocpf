import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

@Catch()
export class SafeHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SafeHttpExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const incidentId = randomUUID();
    const known = exception instanceof HttpException;
    const status = known ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!known || status >= 500) this.logger.error(`incident=${incidentId} ${exception instanceof Error ? exception.stack ?? exception.message : String(exception)}`);
    const message = known && status < 500 ? exception.getResponse() : 'Ocorreu um erro inesperado. Tente novamente.';
    response.status(status).json({ statusCode: status, message, path: request.url, incidentId, timestamp: new Date().toISOString() });
  }
}
