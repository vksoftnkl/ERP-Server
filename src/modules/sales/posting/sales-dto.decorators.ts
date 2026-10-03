import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, ValidateIf } from 'class-validator';
import { STOCK_BUCKETS } from '../../stocks/stock-voucher/types/stock-voucher.types';

/**
 * A sales line's stock bucket (sbi_ / sdi_ / sri_ / sdri_bucket).
 *
 * Omit it for SALEABLE — the column's own default. The column is NOT NULL, so
 * an explicit null used to override that default and surface as a bare 500
 * from the insert; it is now a 400 naming the field, as is any value outside
 * the CHECK constraint's five.
 */
export const OptionalStockBucket = () =>
  applyDecorators(
    ApiPropertyOptional({
      enum: STOCK_BUCKETS,
      default: 'SALEABLE',
      description: 'Omit for SALEABLE. The column is NOT NULL: null is refused.',
    }),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toUpperCase() : value,
    ),
    ValidateIf((_: unknown, value: unknown) => value !== undefined),
    IsIn(STOCK_BUCKETS, {
      message: `$property must be one of ${STOCK_BUCKETS.join(', ')} — omit it for SALEABLE`,
    }),
  );
