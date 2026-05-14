import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma/prisma.service';

export const DEFAULT_ACTOR = 'system';
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;

const BAD_REQUEST_STATUS_CODE = 400;

type ValidationExceptionPayload = {
  message?: string | string[];
};

export interface ModuleErrorDetail {
  field: string;
  message: string;
}

export interface ModuleErrorResponse<
  TErrorDetail extends ModuleErrorDetail = ModuleErrorDetail,
> {
  success: false;
  message: string;
  errors: TErrorDetail[];
}

export type ModuleWriteClient = Prisma.TransactionClient | PrismaService;

export function buildErrorResponse<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>,
>(message: string, errors: TErrorDetail[] = []): TErrorResponse {
  return {
    success: false,
    message,
    errors,
  } as TErrorResponse;
}

export function throwBadRequest<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>,
>(message: string, errors: TErrorDetail[]): never {
  throw new BadRequestException(buildErrorResponse<TErrorDetail, TErrorResponse>(message, errors));
}

export function throwConflict<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>,
>(message: string, errors: TErrorDetail[]): never {
  throw new ConflictException(buildErrorResponse<TErrorDetail, TErrorResponse>(message, errors));
}

export function throwNotFound<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>,
>(message: string, field: string, detailMessage: string): never {
  throw new NotFoundException(
    buildErrorResponse<TErrorDetail, TErrorResponse>(message, [
      { field, message: detailMessage } as TErrorDetail,
    ]),
  );
}

export function throwOnUniqueConstraintError<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>,
>(error: unknown, message: string, errors: TErrorDetail[]): void {
  if (isUniqueConstraintError(error)) {
    throwConflict<TErrorDetail, TErrorResponse>(message, errors);
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return isPrismaErrorCode(error, 'P2002');
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  return isPrismaErrorCode(error, 'P2003');
}

export function isPrismaErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return (error as { code?: string }).code === code;
}

export function normalizeRequiredText<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>,
>(value: string, field: string, message = `${field} must not be empty`): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throwBadRequest<TErrorDetail, TErrorResponse>('Validation failed', [
      { field, message } as TErrorDetail,
    ]);
  }

  return trimmed;
}

export function normalizeNullableString(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function resolveActor(value: string | null | undefined, fallback = DEFAULT_ACTOR): string {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

export function toNumber(value: Prisma.Decimal | number): number {
  if (typeof value === 'number') {
    return value;
  }

  return Number(value.toString());
}

export function toNullableNumber(value: Prisma.Decimal | number | null): number | null {
  if (value === null) {
    return null;
  }

  return toNumber(value);
}

export function hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export type PresentFieldTransform = (value: unknown) => unknown;

export function applyPresentFields(
  target: object,
  source: object,
  fields: readonly string[],
  transforms: Partial<Record<string, PresentFieldTransform>> = {},
): void {
  const targetRecord = target as Record<string, unknown>;
  const sourceRecord = source as Record<string, unknown>;

  for (const field of fields) {
    if (!hasOwnProperty(source, field)) {
      continue;
    }

    const value = sourceRecord[field];
    const transform = transforms[field];
    targetRecord[field] = transform ? transform(value) : value;
  }
}

export abstract class ModuleExceptionFilter<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail>,
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
          buildErrorResponse<TErrorDetail, TErrorResponse>(
            this.resolveErrorMessage(rawResponse, exception.message),
          ),
        );
      return;
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(buildErrorResponse<TErrorDetail, TErrorResponse>('Internal server error'));
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

    return buildErrorResponse<TErrorDetail, TErrorResponse>('Validation failed', errors);
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
