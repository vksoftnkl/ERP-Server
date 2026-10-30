import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import {
  OptionalQueryInt,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
import {
  PRICE_CHANGE_ACTIONS,
  PRICE_CHANGE_SOURCES,
  type PriceChangeAction,
  type PriceChangeSource,
} from '../types/price-change-log.types';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** IPM price rows, IQP qty slabs, or both (notes 144 §5 step 4). */
export const PRICE_TABLE_FILTERS = ['IPM', 'IQP', 'BOTH'] as const;
export type PriceTableFilter = (typeof PRICE_TABLE_FILTERS)[number];

/**
 * The report's scope and filters, shared by /list and /days. A company's
 * report also shows its shared (no-company) prices, and a branch's the
 * all-branches ones: a chain price is that branch's price too.
 */
export class ItemPriceLogFilterDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'One branch (with the all-branches prices). Omit for every branch.',
  })
  @OptionalUuid()
  branchId?: string;

  @ApiProperty({ example: '2026-10-01', description: 'First day, by the change date.' })
  @Matches(DAY, { message: 'fromDate must be yyyy-MM-dd' })
  fromDate!: string;

  @ApiProperty({ example: '2026-10-23', description: 'Last day, inclusive.' })
  @Matches(DAY, { message: 'toDate must be yyyy-MM-dd' })
  toDate!: string;

  @ApiPropertyOptional({ enum: PRICE_TABLE_FILTERS, default: 'BOTH' })
  @IsOptional()
  @IsIn(PRICE_TABLE_FILTERS)
  priceTable?: PriceTableFilter;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  itemId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Who made the change.' })
  @OptionalUuid()
  userId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Notes 145 — made on this device.' })
  @OptionalUuid()
  deviceId?: string;

  @ApiPropertyOptional({
    example: 'ipm_sales_price_b',
    description:
      'Notes 145 — only changes that touched this column (a raw column name, as fields[].column ' +
      'and ipcl_changed name it): e.g. only the Price B changes.',
  })
  @IsOptional()
  @Matches(/^(ipm|iqp)_[a-z0-9_]{1,60}$/, {
    message: 'field must be a price column name, such as ipm_sales_price_b',
  })
  field?: string;

  @ApiPropertyOptional({ enum: PRICE_CHANGE_SOURCES })
  @IsOptional()
  @IsIn(PRICE_CHANGE_SOURCES)
  source?: PriceChangeSource;

  @ApiPropertyOptional({ enum: PRICE_CHANGE_ACTIONS })
  @IsOptional()
  @IsIn(PRICE_CHANGE_ACTIONS)
  action?: PriceChangeAction;

  @ApiPropertyOptional({ description: 'Item code or name, as it was at the time.' })
  @OptionalTrimmedString(100)
  search?: string;
}

export class ListItemPriceLogQueryDto extends ItemPriceLogFilterDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 500 })
  @OptionalQueryInt(1, 500)
  limit?: number;
}

export class GetItemPriceLogQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  ipclId!: string;
}

export class ItemPriceHistoryQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  itemId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'With the shared prices. Omit for every company.',
  })
  @OptionalUuid()
  companyId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'With the all-branches prices. Omit for every branch.',
  })
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional({ enum: PRICE_TABLE_FILTERS, default: 'BOTH' })
  @IsOptional()
  @IsIn(PRICE_TABLE_FILTERS)
  priceTable?: PriceTableFilter;

  @ApiPropertyOptional({ default: 200, minimum: 1, maximum: 1000 })
  @OptionalQueryInt(1, 1000)
  limit?: number;
}

export class ItemPriceLogGapsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only this company’s (and shared) price rows.',
  })
  @OptionalUuid()
  companyId?: string;
}
