import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  SkipOnNullish,
  toNullableStringStrict,
  toUpperTrimmed,
} from 'src/common/dto/dtoDecorators';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ONLY_MESSAGE = { message: '$property must be a date as YYYY-MM-DD' };

const oneOf = (values: readonly string[]) => ({
  message: `$property must be one of: ${values.join(', ')}`,
});

/** A vocabulary value, upper-cased and trimmed first ('sandbox' → 'SANDBOX'). */
export const UpperEnum = (values: readonly string[]) =>
  applyDecorators(
    Transform(({ value }) => toUpperTrimmed(value)),
    IsIn(values, oneOf(values)),
  );

export const OptionalUpperEnum = (values: readonly string[]) =>
  applyDecorators(IsOptional(), UpperEnum(values));

/** null / "" = NULL (for gpaService / gccService / gemService: "every service"). */
export const NullableUpperEnum = (values: readonly string[]) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => {
      const text = toNullableStringStrict(value);
      return typeof text === 'string' ? text.toUpperCase() : text;
    }),
    SkipOnNullish(),
    IsIn(values, oneOf(values)),
  );

export const DateOnly = () =>
  applyDecorators(
    Transform(({ value }) => toNullableStringStrict(value)),
    IsString(),
    Matches(DATE_ONLY, DATE_ONLY_MESSAGE),
    IsDateString(),
  );

export const NullableDateOnly = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => toNullableStringStrict(value)),
    SkipOnNullish(),
    IsString(),
    Matches(DATE_ONLY, DATE_ONLY_MESSAGE),
    IsDateString(),
  );

/**
 * A write-only secret (notes 79 §3): plain text, never trimmed — a password
 * may well end in a space. Absent or "" keeps the stored value.
 */
export const WriteOnlySecret = (maxLength = 500) =>
  applyDecorators(IsOptional(), IsString(), MaxLength(maxLength));
