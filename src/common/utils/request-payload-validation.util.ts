import { ArgumentMetadata, BadRequestException, Type } from '@nestjs/common';
import {
  createHouseValidationPipe,
  type ValidationErrorDetail,
} from '../validation/house-validation';
import { buildErrorResponse } from './module-shared.utils';
/** The global pipe's options and its house-shaped refusal (notes 119 §4). */
const dtoValidationPipe = createHouseValidationPipe();
type ValidateDtoOptions = {
  optional?: boolean;
  type?: ArgumentMetadata['type'];
};
type OptionalValidateDtoOptions = ValidateDtoOptions & {
  optional: true;
};
type RequiredValidateDtoOptions = ValidateDtoOptions & {
  optional?: false;
};
export const hasRequestPayload = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (typeof value !== 'object') {
    return true;
  }
  return Object.keys(value as Record<string, unknown>).length > 0;
};
export function validateDto<T extends object>(
  value: unknown,
  metatype: Type<T>,
  options: OptionalValidateDtoOptions,
): Promise<T | undefined>;
export function validateDto<T extends object>(
  value: unknown,
  metatype: Type<T>,
  options?: RequiredValidateDtoOptions,
): Promise<T>;
export function validateDto<T extends object>(
  value: unknown,
  metatype: Type<T>,
  options: ValidateDtoOptions,
): Promise<T | undefined>;
export async function validateDto<T extends object>(
  value: unknown,
  metatype: Type<T>,
  options: ValidateDtoOptions = {},
): Promise<T | undefined> {
  if (!hasRequestPayload(value)) {
    if (options.optional) {
      return undefined;
    }
    throw payloadRefusal('VALIDATION_PAYLOAD_REQUIRED', 'Request payload is required');
  }
  return (await dtoValidationPipe.transform(value, {
    type: options.type ?? 'body',
    metatype,
    data: undefined,
  })) as T;
}
export function validateSingleOrArrayDto<T extends object>(
  value: unknown,
  metatype: Type<T>,
  options: OptionalValidateDtoOptions,
): Promise<T | T[] | undefined>;
export function validateSingleOrArrayDto<T extends object>(
  value: unknown,
  metatype: Type<T>,
  options?: RequiredValidateDtoOptions,
): Promise<T | T[]>;
export function validateSingleOrArrayDto<T extends object>(
  value: unknown,
  metatype: Type<T>,
  options: ValidateDtoOptions,
): Promise<T | T[] | undefined>;
export async function validateSingleOrArrayDto<T extends object>(
  value: unknown,
  metatype: Type<T>,
  options: ValidateDtoOptions = {},
): Promise<T | T[] | undefined> {
  if (!hasRequestPayload(value)) {
    if (options.optional) {
      return undefined;
    }
    throw payloadRefusal('VALIDATION_PAYLOAD_REQUIRED', 'Request payload is required');
  }
  if (!Array.isArray(value)) {
    return validateDto(value, metatype, options);
  }
  if (value.length === 0) {
    throw payloadRefusal(
      'VALIDATION_PAYLOAD_EMPTY_ARRAY',
      'Request payload should not be an empty array',
    );
  }
  const validatedItems: T[] = [];
  const details: ValidationErrorDetail[] = [];
  for (const [index, item] of value.entries()) {
    try {
      const validatedItem = await validateDto(item, metatype, options);
      if (validatedItem) {
        validatedItems.push(validatedItem);
      }
    } catch (error: unknown) {
      details.push(
        ...extractValidationDetails(error).map((d) => ({
          field: `items.${index}.${d.field}`,
          code: d.code,
          message: `items[${index}] ${d.message}`,
        })),
      );
    }
  }
  if (details.length > 0) {
    throw new BadRequestException(
      buildErrorResponse<ValidationErrorDetail>('Validation failed', details),
    );
  }
  return validatedItems;
}
/** 400 in the house shape: one error, with its code. */
function payloadRefusal(code: string, message: string): BadRequestException {
  return new BadRequestException(
    buildErrorResponse<ValidationErrorDetail>('Validation failed', [
      { field: 'request', code, message },
    ]),
  );
}
/** One item's refusal as details: the house shape, or a bare message wrapped. */
function extractValidationDetails(error: unknown): ValidationErrorDetail[] {
  if (error instanceof BadRequestException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response !== null && 'errors' in response) {
      const errors = (response as { errors?: unknown }).errors;
      if (Array.isArray(errors)) {
        return errors as ValidationErrorDetail[];
      }
    }
    if (typeof response === 'string') {
      return [{ field: 'request', code: 'VALIDATION_FAILED', message: response }];
    }
  }
  if (error instanceof Error && error.message) {
    return [{ field: 'request', code: 'VALIDATION_FAILED', message: error.message }];
  }
  return [{ field: 'request', code: 'VALIDATION_FAILED', message: 'Request payload is invalid' }];
}
