import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  toInteger,
  toNullableInteger,
  toNullableIntegerStrict,
  toNullableNumberStrict,
  toNullableString,
  toNullableStringStrict,
  toNullableUuid,
  toOptionalBoolean,
  toOptionalInteger,
  toOptionalIntegerArray,
  toOptionalNumber,
  toUpperTrimmed,
} from './DtoTransforms';

export const SkipOnNullish = () => ValidateIf((_, value) => value !== null && value !== undefined);

export const NullableString = (maxLength?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableString(value)),
    SkipOnNullish(),
    IsString(),
    ...(maxLength !== undefined ? [MaxLength(maxLength)] : []),
  );

export const NullableStringStrict = (maxLength?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableStringStrict(value)),
    SkipOnNullish(),
    IsString(),
    ...(maxLength !== undefined ? [MaxLength(maxLength)] : []),
  );

export const NullableDateString = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableStringStrict(value)),
    SkipOnNullish(),
    IsDateString(),
  );

export const NullableUuid = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableUuid(value)),
    SkipOnNullish(),
    IsUUID('all'),
  );

export const NullableInteger = (min?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableIntegerStrict(value)),
    SkipOnNullish(),
    IsInt(),
    ...(min !== undefined ? [Min(min)] : []),
  );

export const NullableIntegerNaN = (min?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableInteger(value)),
    SkipOnNullish(),
    IsInt(),
    ...(min !== undefined ? [Min(min)] : []),
  );

export const NullableNumber = (min?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableNumberStrict(value)),
    SkipOnNullish(),
    IsNumber(),
    ...(min !== undefined ? [Min(min)] : []),
  );

export const OptionalNumber = (min?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalNumber(value)),
    IsNumber(),
    ...(min !== undefined ? [Min(min)] : []),
  );

export const RequiredInteger = (min?: number) =>
  applyDecorators(
    Transform(({ value }) => toInteger(value)),
    IsInt(),
    ...(min !== undefined ? [Min(min)] : []),
  );

export const OptionalIntegerArray = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalIntegerArray(value)),
    IsArray(),
    IsInt({ each: true }),
  );

export const OptionalBoolean = () => applyDecorators(IsOptional(), IsBoolean());

export const OptionalQueryBoolean = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalBoolean(value)),
    IsBoolean(),
  );

export const OptionalQueryInt = (min?: number, max?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalInteger(value)),
    IsInt(),
    ...(min !== undefined ? [Min(min)] : []),
    ...(max !== undefined ? [Max(max)] : []),
  );

export const UpperString = (exactLength: number) =>
  applyDecorators(
    Transform(({ value }) => toUpperTrimmed(value)),
    IsString(),
    Length(exactLength, exactLength),
  );
