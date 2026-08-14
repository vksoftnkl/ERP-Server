import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
export declare const DEFAULT_ACTOR = "00000000-0000-0000-0000-000000000000";
export declare const DEFAULT_PAGE = 1;
export declare const DEFAULT_LIMIT = 20;
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
export declare function buildErrorResponse<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>>(message: string, errors?: TErrorDetail[]): TErrorResponse;
export declare function throwBadRequest<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>>(message: string, errors: TErrorDetail[]): never;
export declare function throwConflict<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>>(message: string, errors: TErrorDetail[]): never;
export declare function throwForbidden<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>>(message: string, errors: TErrorDetail[]): never;
export declare function throwNotFound<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>>(message: string, field: string, detailMessage: string): never;
export declare function throwOnUniqueConstraintError<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>>(error: unknown, message: string, errors: TErrorDetail[]): void;
export declare function isUniqueConstraintError(error: unknown): boolean;
export declare function isForeignKeyConstraintError(error: unknown): boolean;
export declare function isExclusionConstraintError(error: unknown): boolean;
export declare function isPrismaErrorCode(error: unknown, code: string): boolean;
export declare function normalizeRequiredText<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail> = ModuleErrorResponse<TErrorDetail>>(value: string, field: string, message?: string): string;
export declare function normalizeNullableString(value: string | null | undefined): string | null | undefined;
export declare function resolveActor(value: string | null | undefined, userId?: string | null | undefined): string;
export declare function toNumber(value: Prisma.Decimal | number): number;
export declare function toNullableNumber(value: Prisma.Decimal | number | null): number | null;
export declare function hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean;
export type PresentFieldTransform = (value: unknown) => unknown;
export declare function applyPresentFields(target: object, source: object, fields: readonly string[], transforms?: Partial<Record<string, PresentFieldTransform>>): void;
export declare abstract class ModuleExceptionFilter<TErrorDetail extends ModuleErrorDetail, TErrorResponse extends ModuleErrorResponse<TErrorDetail>> implements ExceptionFilter {
    private readonly fieldNamePattern;
    private readonly logger;
    protected constructor(fieldNamePattern: RegExp);
    catch(exception: unknown, host: ArgumentsHost): void;
    private isErrorResponse;
    private isValidationPayload;
    private mapValidationPayload;
    private resolveErrorMessage;
    private inferFieldName;
}
