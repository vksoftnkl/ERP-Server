import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import {
  WidgetMasterErrorDetail,
  WidgetMasterErrorResponse,
} from './types/widget-master-api.types';
import { wordedResponse } from '../../../common/error-wording/error-wording';
import { frameworkValidationCode } from '../../../common/validation/house-validation';
type ValidationExceptionPayload = {
  message?: string | string[];
};
@Catch()
export class WidgetMasterExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    // Notes 120: every coded error goes out with its plain words (`user`).
    const response = wordedResponse(
      host.switchToHttp().getResponse<Response>(),
      host.switchToHttp().getRequest<unknown>(),
    );
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const rawResponse = exception.getResponse();
      if (this.isWidgetMasterErrorResponse(rawResponse)) {
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
  private isWidgetMasterErrorResponse(value: unknown): value is WidgetMasterErrorResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as Partial<WidgetMasterErrorResponse>;
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
  private mapValidationPayload(payload: ValidationExceptionPayload): WidgetMasterErrorResponse {
    const messages = Array.isArray(payload.message)
      ? payload.message
      : payload.message
        ? [payload.message]
        : ['Validation failed'];

    const errors: WidgetMasterErrorDetail[] = messages.map((message) => ({
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
    const fieldMatch = message.match(/\b((?:section|field|widget)[A-Za-z0-9]+)\b/);
    if (fieldMatch) {
      return fieldMatch[1];
    }

    return 'request';
  }
}
