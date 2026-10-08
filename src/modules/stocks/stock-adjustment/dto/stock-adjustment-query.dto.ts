import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches, MinLength } from 'class-validator';
import {
  OptionalInteger,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { STOCK_BUCKETS, type StockBucket } from '../../stock-voucher/types/stock-voucher.types';

const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

export class StockAdjustmentScopeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027', minLength: 9, maxLength: 9 })
  @TrimmedString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' })
  accYear!: string;
}

export class StockAdjustmentRefQueryDto extends StockAdjustmentScopeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  svhId!: string;
}

export class StockAdjustmentRefDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  svhId!: string;

  @ApiProperty({ example: '2026-2027', minLength: 9, maxLength: 9 })
  @TrimmedString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' })
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Falls back to the authenticated user.' })
  @OptionalUuid()
  userId?: string;
}

export class CancelStockAdjustmentDto extends StockAdjustmentRefDto {
  @ApiProperty({ minLength: 3, maxLength: 250, description: 'Why the document is being reversed.' })
  @TrimmedString(250)
  @MinLength(3, { message: 'reason must say something — at least 3 characters.' })
  reason!: string;
}

/** GET /stock/adjustment/pick-stock — the "pick stock from balance" picker. */
export class PickStockQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  godownId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'One item, or every item in the godown.' })
  @OptionalUuid()
  itemId?: string;

  @ApiPropertyOptional({
    enum: STOCK_BUCKETS,
    description:
      'One bucket, or every bucket when absent — each row says its own `bucket`, so one call answers "where is this lot" across SALEABLE, DAMAGED and the rest.',
  })
  @IsOptional()
  @IsIn(STOCK_BUCKETS as readonly string[])
  bucket?: StockBucket;

  @ApiPropertyOptional({ maxLength: 100, description: 'Item name, item code or batch number, contains.' })
  @OptionalTrimmedString(100)
  search?: string;

  @ApiPropertyOptional({ default: 200, maximum: 1000 })
  @OptionalInteger(1, 1000)
  limit?: number;
}
