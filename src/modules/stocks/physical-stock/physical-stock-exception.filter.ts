import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import {
  PhysicalStockErrorDetail,
  PhysicalStockErrorResponse,
} from './types/physical-stock-response.types';
type ValidationExceptionPayload = {
  message?: string | string[];
};
@Catch()
export class PhysicalStockExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const rawResponse = exception.getResponse();
      if (this.isPhysicalStockErrorResponse(rawResponse)) {
        response.status(statusCode).json(rawResponse);
        return;
      }
      if (statusCode === HttpStatus.BAD_REQUEST && this.isValidationPayload(rawResponse)) {
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
  private isPhysicalStockErrorResponse(value: unknown): value is PhysicalStockErrorResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const candidate = value as Partial<PhysicalStockErrorResponse>;
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
  private mapValidationPayload(payload: ValidationExceptionPayload): PhysicalStockErrorResponse {
    const messages = Array.isArray(payload.message)
      ? payload.message
      : payload.message
        ? [payload.message]
        : ['Validation failed'];
    const errors: PhysicalStockErrorDetail[] = messages.map((message) => ({
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
    const fieldMatch = message.match(/\b(ps(?:c|d|b)?[A-Za-z0-9]+)\b/);
    if (fieldMatch) {
      return fieldMatch[1];
    }
    if (message.includes('details')) {
      return 'details';
    }
    return 'request';
  }
}