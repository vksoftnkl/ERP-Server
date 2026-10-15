import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { frameworkValidationCode } from '../validation/house-validation';
import { wordedResponse } from '../error-wording/error-wording';
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    // Notes 120: every coded error goes out with its plain words (`user`).
    const response = wordedResponse(context.getResponse<Response>(), request);
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    }
    // Notes 119: a refusal already in the house shape ({ success, message,
    // errors[] }) goes out as it is, so `errors[0].code` stays where the client
    // reads it — not nested under `message`, as a module without its own filter
    // used to answer.
    if (isHouseErrorBody(message)) {
      response.status(statusCode).json({
        ...message,
        statusCode,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      // Notes 119: an unexpected failure, and a 400 a framework pipe raised,
      // carry a code the client can word.
      ...(statusCode >= 500
        ? {
            errors: [
              { field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' },
            ],
          }
        : statusCode === 400
          ? { errors: frameworkErrors(message) }
          : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
function isHouseErrorBody(
  value: unknown,
): value is { success: false; message: string; errors: unknown[] } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const body = value as { success?: unknown; message?: unknown; errors?: unknown };
  return body.success === false && typeof body.message === 'string' && Array.isArray(body.errors);
}
/** Nest's own 400 bodies ({ message: string | string[] } or a string), as coded errors. */
function frameworkErrors(body: unknown): { field: string; code: string; message: string }[] {
  const raw =
    typeof body === 'string'
      ? body
      : typeof body === 'object' && body !== null
        ? (body as { message?: unknown }).message
        : undefined;
  const messages = (Array.isArray(raw) ? raw : [raw]).filter(
    (m): m is string => typeof m === 'string' && m.length > 0,
  );
  return messages.map((message) => ({
    field: 'request',
    code: frameworkValidationCode(message),
    message,
  }));
}
