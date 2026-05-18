import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsDateString,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  toInteger,
  toNullableDate,
  toNullableIdString,
  toNullableInteger,
  toNullableIntegerStrict,
  toNullableNumberStrict,
  toNullableString,
  toNullableStringStrict,
  toNullableUpperString,
  toNullableUuid,
  toOptionalBoolean,
  toOptionalDate,
  toOptionalDateString,
  toOptionalIdString,
  toOptionalInteger,
  toOptionalIntegerArray,
  toOptionalNumber,
  toOptionalTimeString,
  toOptionalUuid,
  toRequiredUuid,
  toTrimmedString,
  toUpperTrimmed,
  TIME_PATTERN,
  UUID_PATTERN,
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
export const NullableUpperString = (exactLength?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableUpperString(value)),
    SkipOnNullish(),
    IsString(),
    ...(exactLength !== undefined ? [Length(exactLength, exactLength)] : []),
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
    Matches(UUID_PATTERN),
  );
export const OptionalUuid = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalUuid(value)),
    Matches(UUID_PATTERN),
  );
export const RequiredUuid = () =>
  applyDecorators(
    Transform(({ value }) => toRequiredUuid(value)),
    Matches(UUID_PATTERN),
  );
export const OptionalDateString = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalDateString(value)),
    IsDateString(),
  );
export const OptionalDate = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalDate(value)),
    IsDate(),
  );
export const NullableDate = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableDate(value)),
    SkipOnNullish(),
    IsDate(),
  );
export const OptionalTimeString = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalTimeString(value)),
    IsString(),
    Matches(TIME_PATTERN),
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
export const RequiredNumber = (min?: number) =>
  applyDecorators(
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
export const OptionalInteger = (min?: number, max?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalInteger(value)),
    IsInt(),
    ...(min !== undefined ? [Min(min)] : []),
    ...(max !== undefined ? [Max(max)] : []),
  );
export const OptionalNumberString = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalIdString(value)),
    IsNumberString({ no_symbols: true }),
  );
export const NullableNumberString = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableIdString(value)),
    SkipOnNullish(),
    IsNumberString({ no_symbols: true }),
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
export const OptionalQueryInt = (min?: number, max?: number) => OptionalInteger(min, max);
export const TrimmedString = (maxLength?: number) =>
  applyDecorators(
    Transform(({ value }) => toTrimmedString(value)),
    IsString(),
    ...(maxLength !== undefined ? [MaxLength(maxLength)] : []),
  );
export const OptionalTrimmedString = (maxLength?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toTrimmedString(value)),
    IsString(),
    ...(maxLength !== undefined ? [MaxLength(maxLength)] : []),
  );
export const UpperString = (exactLength: number) =>
  applyDecorators(
    Transform(({ value }) => toUpperTrimmed(value)),
    IsString(),
    Length(exactLength, exactLength),
  );