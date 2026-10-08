import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { PrismaService } from '../../database/prisma/prisma.service';
export const DEFAULT_ACTOR = '00000000-0000-0000-0000-000000000000';
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
export interface ModuleErrorResponse<TErrorDetail extends ModuleErrorDetail = ModuleErrorDetail> {
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
// 403 — the row exists and the request is well formed, but it belongs to someone
// else (e.g. an edit lock held by another device). Distinct from a 409: retrying
// will not help until the holder gives it up.
export function throwForbidden<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>,
>(message: string, errors: TErrorDetail[]): never {
  throw new ForbiddenException(buildErrorResponse<TErrorDetail, TErrorResponse>(message, errors));
}
// 422 — the request is syntactically valid and the row it names exists, but the
// CONTENT cannot be processed: a document whose lines break a rule the database
// would otherwise raise on, one line at a time, from inside a function. Distinct
// from a 400 (which class-validator owns, and which means the shape is wrong)
// because the caller here has a per-line list to render against its own grid
// rather than a field name to highlight.
export function throwUnprocessable<
  TErrorDetail extends ModuleErrorDetail,
  TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>,
>(message: string, errors: TErrorDetail[]): never {
  throw new UnprocessableEntityException(
    buildErrorResponse<TErrorDetail, TErrorResponse>(message, errors),
  );
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
/**
 * What a Prisma write violated, when the error says: `meta.constraint` on a
 * P2003 (e.g. `item_master_item_default_tax_id_fkey`), and on a P2002
 * `meta.target` — the index's COLUMNS as an array (`['item_name_en']`, seen
 * with Prisma 6.19 on a partial unique index), joined with ',', or the index
 * name when Prisma reports a string. Null when neither is present, so a caller
 * can map a KNOWN constraint or column to the field that caused it and fall
 * back to a generic message.
 */
export function violatedConstraintOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('meta' in error)) {
    return null;
  }
  const meta = (error as { meta?: Record<string, unknown> }).meta ?? {};
  for (const value of [meta.constraint, meta.target, meta.field_name]) {
    if (Array.isArray(value) && value.length) {
      return value.map(String).join(',');
    }
    if (typeof value === 'string' && value) {
      return value.replace(/ \(index\)$/, '');
    }
  }
  return null;
}
/**
 * A GiST exclusion constraint violation (SQLSTATE 23P01) — e.g. a weight slab
 * overlapping one that already exists.
 *
 * Prisma has no error code for these: an ORM write that trips one surfaces as a
 * `PrismaClientUnknownRequestError` whose `code` is undefined, with the
 * SQLSTATE readable only inside the driver message. Matching the message is
 * therefore the only way to tell it apart from a genuine internal error and
 * answer 409 instead of 500.
 */
export function isExclusionConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return false;
  }
  const { message } = error as { message?: unknown };
  return typeof message === 'string' && message.includes('23P01');
}
/**
 * The CHECK constraint a write violated (SQLSTATE 23514), or null.
 *
 * The same trap as isExclusionConstraintError, in both of Prisma's shapes: an
 * ORM write surfaces as a `PrismaClientUnknownRequestError` with the SQLSTATE
 * and the constraint name only inside the driver message, and a raw one as a
 * P2010 carrying them in `meta.code` / `meta.message`. The name is read out of
 * whichever text is there, so a caller can map a KNOWN check to a sentence
 * and answer 422 rather than 500.
 */
export function violatedCheckOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const { message, meta } = error as {
    message?: unknown;
    meta?: { code?: unknown; message?: unknown };
  };
  const texts = [meta?.code === '23514' ? meta.message : null, message].filter(
    (text): text is string => typeof text === 'string',
  );
  for (const text of texts) {
    if (!text.includes('23514') && text !== meta?.message) {
      continue;
    }
    const match = /violates check constraint \\?"([A-Za-z0-9_]+)\\?"/.exec(text);
    if (match) {
      return match[1];
    }
  }
  return null;
}
/**
 * A figure too large for its numeric column (SQLSTATE 22003), or null. The
 * result is Postgres' detail — "A field with precision 15, scale 2 must round
 * to an absolute value less than 10^13." — or a bare sentence when the driver
 * gave none. Same two shapes as violatedCheckOf: the SQLSTATE sits only in the
 * message of an ORM write, in `meta.code` of a raw one (P2010).
 */
export function numericOverflowOf(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const { message, meta } = error as { message?: unknown; meta?: { code?: unknown } };
  const text = typeof message === 'string' ? message : '';
  if (meta?.code !== '22003' && !text.includes('"22003"')) {
    return null;
  }
  const detail = /detail: Some\(\\?"(.+?)\\?"\)/.exec(text);
  return detail ? detail[1] : 'numeric field overflow';
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
export function resolveActor(
  value: string | null | undefined,
  userId: string | null | undefined = null,
): string {
  if (value) {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  if (userId) {
    const trimmedUserId = userId.trim();
    if (trimmedUserId) return trimmedUserId;
  }
  return DEFAULT_ACTOR;
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
  private readonly logger = new Logger(ModuleExceptionFilter.name);
  protected constructor(private readonly fieldNamePattern: RegExp) {}
  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();
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
    // A module filter is controller-scoped, so it wins over the global
    // AllExceptionsFilter and nothing else logs what actually failed. Without
    // this the client gets a bare "Internal server error" and the server log
    // shows only the status line — the stack is the whole diagnosis.
    const request = httpContext.getRequest<Request>();
    this.logger.error(
      `${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );
    // A number in the request outgrew its column. Nothing broke server-side,
    // so the client gets a 422 it can show rather than a bare 500.
    const overflow = numericOverflowOf(exception);
    if (overflow) {
      response
        .status(HttpStatus.UNPROCESSABLE_ENTITY)
        .json(
          buildErrorResponse<TErrorDetail, TErrorResponse>(
            `A value is too large to save: ${overflow}`,
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
