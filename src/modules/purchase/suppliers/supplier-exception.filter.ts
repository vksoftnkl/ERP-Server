import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { SupplierErrorDetail, SupplierErrorResponse } from './types/supplier-api.types';

type ValidationExceptionPayload = {
  message?: string | string[];
};

@Catch()
export class SupplierExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const rawResponse = exception.getResponse();

      if (this.isSupplierErrorResponse(rawResponse)) {
        response.status(statusCode).json(rawResponse);
        return;
      }

      if (statusCode === 400 && this.isValidationExceptionPayload(rawResponse)) {
        response.status(statusCode).json(this.mapValidationPayload(rawResponse));
        return;
      }

      response.status(statusCode).json({
        success: false,
        message: this.resolveErrorMessage(rawResponse, exception.message),
        errors: [],
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      errors: [],
    });
  }

  private isSupplierErrorResponse(value: unknown): value is SupplierErrorResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const candidate = value as Partial<SupplierErrorResponse>;
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

  private mapValidationPayload(payload: ValidationExceptionPayload): SupplierErrorResponse {
    const messages = Array.isArray(payload.message)
      ? payload.message
      : payload.message
        ? [payload.message]
        : ['Validation failed'];

    const errors: SupplierErrorDetail[] = messages.map((message) => ({
      field: this.inferFieldName(message),
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
    const fieldMatch = message.match(/\b(sup[A-Za-z0-9]+)\b/);
    if (fieldMatch) {
      return fieldMatch[1];
    }

    return 'request';
  }
}
