import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
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
    if (!known || status >= 500)
      this.logger.error(
        `incident=${incidentId} ${exception instanceof Error ? (exception.stack ?? exception.message) : String(exception)}`,
      );
    const message =
      known && status < 500
        ? readableMessage(exception.getResponse(), status)
        : 'Ocorreu um erro inesperado. Tente novamente.';
    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      incidentId,
      timestamp: new Date().toISOString(),
    });
  }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Pedido inválido. Verifique os dados.',
  401: 'Sessão expirada. Inicie sessão novamente.',
  403: 'Não tem permissão para esta acção.',
  404: 'Recurso não encontrado.',
  413: 'O ficheiro é demasiado grande.',
  429: 'Demasiados pedidos. Aguarde um momento e tente novamente.',
};

/** Flattens Nest/validation responses into a single sentence suitable for the UI. */
function readableMessage(body: unknown, status: number): string {
  const raw = typeof body === 'string' ? body : (body as { message?: unknown })?.message;
  const text = Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : '';
  if (!text || /^(Unauthorized|Forbidden|Not Found|Bad Request|ThrottlerException)/i.test(text))
    return DEFAULT_MESSAGES[status] ?? 'Não foi possível concluir o pedido.';
  return text;
}
