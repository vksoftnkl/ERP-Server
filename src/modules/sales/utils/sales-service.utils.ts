import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';

export const DEFAULT_ACTOR = 'system';
export const DEFAULT_AUDIT_ACTOR = DEFAULT_ACTOR;
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;

export interface SalesErrorDetail {
  field: string;
  message: string;
}

export interface SalesErrorResponse<TErrorDetail extends SalesErrorDetail = SalesErrorDetail> {
  success: false;
  message: string;
  errors: TErrorDetail[];
}

export type SalesWriteClient = Prisma.TransactionClient | PrismaService;

export function buildSalesErrorResponse<
  TErrorDetail extends SalesErrorDetail,
  TErrorResponse extends SalesErrorResponse<TErrorDetail>,
>(message: string, errors: TErrorDetail[] = []): TErrorResponse {
  return {
    success: false,
    message,
    errors,
  } as TErrorResponse;
}

export function throwSalesBadRequest<
  TErrorDetail extends SalesErrorDetail,
  TErrorResponse extends SalesErrorResponse<TErrorDetail>,
>(message: string, errors: TErrorDetail[]): never {
  throw new BadRequestException(
    buildSalesErrorResponse<TErrorDetail, TErrorResponse>(message, errors),
  );
}

export function throwSalesConflict<
  TErrorDetail extends SalesErrorDetail,
  TErrorResponse extends SalesErrorResponse<TErrorDetail>,
>(message: string, errors: TErrorDetail[]): never {
  throw new ConflictException(
    buildSalesErrorResponse<TErrorDetail, TErrorResponse>(message, errors),
  );
}

export function throwSalesNotFound<
  TErrorDetail extends SalesErrorDetail,
  TErrorResponse extends SalesErrorResponse<TErrorDetail>,
>(message: string, field: string, detailMessage: string): never {
  throw new NotFoundException(
    buildSalesErrorResponse<TErrorDetail, TErrorResponse>(message, [
      { field, message: detailMessage } as TErrorDetail,
    ]),
  );
}

export function throwOnUniqueConstraintError<
  TErrorDetail extends SalesErrorDetail,
  TErrorResponse extends SalesErrorResponse<TErrorDetail>,
>(error: unknown, message: string, errors: TErrorDetail[]): void {
  if (isUniqueConstraintError(error)) {
    throwSalesConflict<TErrorDetail, TErrorResponse>(message, errors);
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return (error as { code?: string }).code === 'P2002';
}

export function normalizeRequiredText<
  TErrorDetail extends SalesErrorDetail,
  TErrorResponse extends SalesErrorResponse<TErrorDetail>,
>(value: string, field: string, message = `${field} must not be empty`): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throwSalesBadRequest<TErrorDetail, TErrorResponse>('Validation failed', [
      { field, message } as TErrorDetail,
    ]);
  }
  return trimmed;
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
