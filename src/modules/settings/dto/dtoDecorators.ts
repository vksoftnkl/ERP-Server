import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEmail,
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
  toNullableDate,
  toNullableString,
  toNullableUuid,
  toOptionalBoolean,
  toOptionalNumber,
  toOptionalTrimmedString,
  toUpper,
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

export const NullableUpperString = (maxLength?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableString(toUpper(value))),
    SkipOnNullish(),
    IsString(),
    ...(maxLength !== undefined ? [MaxLength(maxLength)] : []),
  );

export const NullableEmail = (maxLength?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableString(value)),
    SkipOnNullish(),
    IsEmail(),
    ...(maxLength !== undefined ? [MaxLength(maxLength)] : []),
  );

export const NullableUuid = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableUuid(value)),
    SkipOnNullish(),
    IsUUID('all'),
  );

export const NullableDate = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableDate(value)),
    SkipOnNullish(),
    Type(() => Date),
    IsDate(),
  );

export const NullableNumber = () =>
  applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsNumber({ allowNaN: false, allowInfinity: false }),
  );

export const UpperString = (exactLength: number) =>
  applyDecorators(
    Transform(({ value }) => toUpper(value)),
    IsString(),
    Length(exactLength, exactLength),
  );

export const UpperMaxString = (maxLength?: number) =>
  applyDecorators(
    Transform(({ value }) => toUpper(value)),
    IsString(),
    ...(maxLength !== undefined ? [MaxLength(maxLength)] : []),
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
    Transform(({ value }) => toOptionalNumber(value)),
    IsInt(),
    ...(min !== undefined ? [Min(min)] : []),
    ...(max !== undefined ? [Max(max)] : []),
  );

export const OptionalTrimmedString = (maxLength?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toOptionalTrimmedString(value)),
    IsString(),
    ...(maxLength !== undefined ? [MaxLength(maxLength)] : []),
  );

export const OptionalUpperString = (exactLength: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toUpper(value)),
    IsString(),
    Length(exactLength, exactLength),
  );

export const OptionalUpperMaxString = (maxLength?: number) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toUpper(value)),
    IsString(),
    ...(maxLength !== undefined ? [MaxLength(maxLength)] : []),
  );
