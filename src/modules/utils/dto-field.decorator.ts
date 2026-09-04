import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import {
  BooleanUtil,
  DateUtil,
  NumberUtil,
  StringUtil,
  UuidUtil,
} from './constants';
const UUID_EXAMPLE = '018f6f4e-91c2-7b6a-9e7d-2f8c7f2b1a11';
type EnumLike = Record<string, string | number>;
export function OptionalUuidField(options?: {
  description?: string;
  example?: string;
}) {
  return applyDecorators(
    ApiPropertyOptional({
      type: String,
      format: 'uuid',
      example: options?.example ?? UUID_EXAMPLE,
      description: options?.description,
    }),
    Transform(({ value }) => UuidUtil.toOptional(value)),
    IsOptional(),
    IsUUID('all'),
  );
}

export function RequiredUuidField(options?: {
  description?: string;
  example?: string;
}) {
  return applyDecorators(
    ApiProperty({
      type: String,
      format: 'uuid',
      example: options?.example ?? UUID_EXAMPLE,
      description: options?.description,
    }),
    Transform(({ value }) => UuidUtil.toOptional(value)),
    IsNotEmpty(),
    IsUUID('all'),
  );
}

export function OptionalStringField(options?: {
  maxLength?: number;
  example?: string;
  description?: string;
}) {
  const decorators: PropertyDecorator[] = [
    ApiPropertyOptional({
      type: String,
      maxLength: options?.maxLength,
      example: options?.example,
      description: options?.description,
    }),
    Transform(({ value }) => StringUtil.toNullable(value)),
    IsOptional(),
    IsString(),
  ];

  if (options?.maxLength) {
    decorators.push(MaxLength(options.maxLength));
  }

  return applyDecorators(...decorators);
}

export function RequiredStringField(options?: {
  maxLength?: number;
  example?: string;
  description?: string;
}) {
  const decorators: PropertyDecorator[] = [
    ApiProperty({
      type: String,
      maxLength: options?.maxLength,
      example: options?.example,
      description: options?.description,
    }),
    Transform(({ value }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    IsNotEmpty(),
  ];

  if (options?.maxLength) {
    decorators.push(MaxLength(options.maxLength));
  }

  return applyDecorators(...decorators);
}

export function OptionalDateField(options?: {
  format?: 'date' | 'date-time';
  example?: string;
  default?: string;
  description?: string;
}) {
  return applyDecorators(
    ApiPropertyOptional({
      type: String,
      format: options?.format ?? 'date-time',
      example:
        options?.example ??
        (options?.format === 'date'
          ? '2026-05-07'
          : '2026-05-07T10:30:00.000Z'),
      default: options?.default,
      description: options?.description,
    }),
    Transform(({ value }) => DateUtil.toOptionalDate(value)),
    IsOptional(),
    IsDate(),
  );
}

export function OptionalBooleanField(options?: {
  default?: boolean;
  example?: boolean;
  description?: string;
}) {
  return applyDecorators(
    ApiPropertyOptional({
      type: Boolean,
      default: options?.default ?? false,
      example: options?.example ?? options?.default ?? false,
      description: options?.description,
    }),
    Transform(({ value }) => BooleanUtil.toOptional(value)),
    IsOptional(),
    IsBoolean(),
  );
}

export function OptionalEnumField<T extends EnumLike>(
  enumObject: T,
  options?: {
    default?: T[keyof T];
    example?: T[keyof T];
    description?: string;
  },
) {
  return applyDecorators(
    ApiPropertyOptional({
      enum: enumObject,
      default: options?.default,
      example: options?.example ?? options?.default,
      description: options?.description,
    }),
    IsOptional(),
    IsEnum(enumObject),
  );
}

export function OptionalIntField(options?: {
  default?: number;
  example?: number;
  min?: number;
  description?: string;
}) {
  return applyDecorators(
    ApiPropertyOptional({
      type: Number,
      default: options?.default ?? 0,
      example: options?.example ?? 0,
      description: options?.description,
    }),
    Transform(({ value }) => NumberUtil.toOptional(value)),
    IsOptional(),
    IsInt(),
    Min(options?.min ?? 0),
  );
}

export function OptionalDecimalField(options?: {
  default?: number;
  example?: number;
  min?: number;
  maxDecimalPlaces?: number;
  description?: string;
}) {
  return applyDecorators(
    ApiPropertyOptional({
      type: Number,
      default: options?.default ?? 0,
      example: options?.example ?? 0,
      description: options?.description,
    }),
    Transform(({ value }) => NumberUtil.toOptional(value)),
    IsOptional(),
    IsNumber({
      maxDecimalPlaces: options?.maxDecimalPlaces ?? 2,
    }),
    Min(options?.min ?? 0),
  );
}

export function OptionalSignedDecimalField(options?: {
  default?: number;
  example?: number;
  maxDecimalPlaces?: number;
  description?: string;
}) {
  return applyDecorators(
    ApiPropertyOptional({
      type: Number,
      default: options?.default ?? 0,
      example: options?.example ?? 0,
      description: options?.description,
    }),
    Transform(({ value }) => NumberUtil.toOptional(value)),
    IsOptional(),
    IsNumber({
      maxDecimalPlaces: options?.maxDecimalPlaces ?? 2,
    }),
  );
}