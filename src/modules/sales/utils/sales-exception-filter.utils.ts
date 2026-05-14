import { ArgumentsHost, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import {
  SalesErrorDetail,
  SalesErrorResponse,
  buildSalesErrorResponse,
} from './sales-service.utils';
type ValidationExceptionPayload = {
  message?: string | string[];
};
const BAD_REQUEST_STATUS_CODE = 400;
export abstract class SalesExceptionFilter<
  TErrorDetail extends SalesErrorDetail,
  TErrorResponse extends SalesErrorResponse<TErrorDetail>,
> implements ExceptionFilter {
  protected constructor(private readonly fieldNamePattern: RegExp) {}
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const rawResponse = exception.getResponse();

      if (this.isErrorResponse(rawResponse)) {
        response.status(statusCode).json(rawResponse);
        return;
      }

      if (statusCode === BAD_REQUEST_STATUS_CODE && this.isValidationPayload(rawResponse)) {
        response.status(statusCode).json(this.mapValidationPayload(rawResponse));
        return;
      }

      response
        .status(statusCode)
        .json(
          buildSalesErrorResponse<TErrorDetail, TErrorResponse>(
            this.resolveErrorMessage(rawResponse, exception.message),
          ),
        );
      return;
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(buildSalesErrorResponse<TErrorDetail, TErrorResponse>('Internal server error'));
  }

  private isErrorResponse(value: unknown): value is TErrorResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<TErrorResponse>;
    return (
      candidate.success === false &&
      typeof candidate.message === 'string' &&
      Array.isArray(candidate.errors)
    );
  }

  private isValidationPayload(value: unknown): value is ValidationExceptionPayload {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as ValidationExceptionPayload;
    return typeof candidate.message === 'string' || Array.isArray(candidate.message);
  }

  private mapValidationPayload(payload: ValidationExceptionPayload): TErrorResponse {
    const messages = Array.isArray(payload.message)
      ? payload.message
      : payload.message
        ? [payload.message]
        : ['Validation failed'];

    const errors = messages.map((message) => ({
      field: this.inferFieldName(message),
      message,
    })) as TErrorDetail[];

    return buildSalesErrorResponse<TErrorDetail, TErrorResponse>('Validation failed', errors);
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
    const fieldMatch = message.match(this.fieldNamePattern);
    if (fieldMatch) {
      return fieldMatch[1];
    }

    return 'request';
  }
}
