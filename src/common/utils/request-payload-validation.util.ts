import { ArgumentMetadata, BadRequestException, Type, ValidationPipe } from '@nestjs/common';
const dtoValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
});
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
    throw new BadRequestException({
      message: ['Request payload is required'],
    });
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
    throw new BadRequestException({
      message: ['Request payload is required'],
    });
  }
  if (!Array.isArray(value)) {
    return validateDto(value, metatype, options);
  }
  if (value.length === 0) {
    throw new BadRequestException({
      message: ['Request payload should not be an empty array'],
    });
  }
  const validatedItems: T[] = [];
  const validationMessages: string[] = [];
  for (const [index, item] of value.entries()) {
    try {
      const validatedItem = await validateDto(item, metatype, options);
      if (validatedItem) {
        validatedItems.push(validatedItem);
      }
    } catch (error: unknown) {
      const messages = extractValidationMessages(error);
      validationMessages.push(...messages.map((message) => `items[${index}] ${message}`));
    }
  }
  if (validationMessages.length > 0) {
    throw new BadRequestException({
      message: validationMessages,
    });
  }
  return validatedItems;
}
function extractValidationMessages(error: unknown): string[] {
  if (error instanceof BadRequestException) {
    const response = error.getResponse();
    if (typeof response === 'string') {
      return [response];
    }
    if (typeof response === 'object' && response !== null && 'message' in response) {
      const message = (response as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message.filter((entry): entry is string => typeof entry === 'string');
      }
      if (typeof message === 'string') {
        return [message];
      }
    }
  }
  if (error instanceof Error && error.message) {
    return [error.message];
  }
  return ['Request payload is invalid'];
}