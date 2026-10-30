import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { BatchPrefixErrorDetail, BatchPrefixErrorResponse } from './types/batch-prefix-api.types';
import { wordedResponse } from '../../../common/error-wording/error-wording';
import { frameworkValidationCode } from '../../../common/validation/house-validation';

type ValidationExceptionPayload = {
  message?: string | string[];
};

const KNOWN_FIELDS = ['id', 'prefixUsed', 'syncDate', 'search', 'page', 'limit'];

@Catch()
export class BatchPrefixExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    // Notes 120: every coded error goes out with its plain words (`user`).
    const response = wordedResponse(
      host.switchToHttp().getResponse<Response>(),
      host.switchToHttp().getRequest<unknown>(),
    );

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const rawResponse = exception.getResponse();

      if (this.isBatchPrefixErrorResponse(rawResponse)) {
        response.status(statusCode).json(rawResponse);
        return;
      }

      if (statusCode === 400 && this.isValidationExceptionPayload(rawResponse)) {
        response.status(statusCode).json(this.mapValidationPayload(rawResponse));
        return;
      }

      // Notes 127 §5: a plain Nest exception still goes out coded, by its status.
      const message = this.resolveErrorMessage(rawResponse, exception.message);
      response.status(statusCode).json({
        success: false,
        message,
        errors: [{ field: 'request', code: `HTTP_${statusCode}`, message }],
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      errors: [{ field: 'request', code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  }

  private isBatchPrefixErrorResponse(value: unknown): value is BatchPrefixErrorResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<BatchPrefixErrorResponse>;
    return (
      candidate.success === false &&
      typeof candidate.message === 'string' &&
      Array.isArray(candidate.errors)
    );
  }

  private isValidationExceptionPayload(value: unknown): value is ValidationExceptionPayload {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as ValidationExceptionPayload;
    return typeof candidate.message === 'string' || Array.isArray(candidate.message);
  }

  private mapValidationPayload(payload: ValidationExceptionPayload): BatchPrefixErrorResponse {
    const messages = Array.isArray(payload.message)
      ? payload.message
      : payload.message
        ? [payload.message]
        : ['Validation failed'];

    const errors: BatchPrefixErrorDetail[] = messages.map((message) => ({
      field: this.inferFieldName(message),
      // Notes 119: an old `{ message: [...] }` 400 still gets the nearest VALIDATION_* code.
      code: frameworkValidationCode(message),
      message,
    }));

    return {
      success: false,
      message: 'Validation failed',
      errors,
    };
  }

  private resolveErrorMessage(rawResponse: unknown, fallback: string): string {
    if (typeof rawResponse === 'string') {
      return rawResponse;
    }

    if (typeof rawResponse === 'object' && rawResponse !== null && 'message' in rawResponse) {
      const message = (rawResponse as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return fallback || 'Request failed';
  }

  private inferFieldName(message: string): string {
    for (const field of KNOWN_FIELDS) {
      if (message.includes(field)) {
        return field;
      }
    }

    return 'request';
  }
}
