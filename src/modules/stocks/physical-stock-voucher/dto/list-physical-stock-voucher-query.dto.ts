import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import {
  OptionalDateString,
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import {
  STOCK_BUCKETS,
  STOCK_VOUCHER_STATUSES,
  type StockBucket,
  type StockVoucherStatus,
} from '../../stock-voucher/types/stock-voucher.types';

const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

/**
 * The scope every read on this screen carries.
 *
 * Company, branch and year are required on all of them. stock_voucher is
 * PARTITIONED BY LIST (svh_acc_year) and every index on it starts with
 * (company, branch), so a query missing any of the three scans every partition.
 */
export class PhysicalStockVoucherScopeQueryDto {
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

/** GET /stock/physical — `svhId` present loads one document, absent lists them. */
export class GetPhysicalStockVoucherQueryDto extends PhysicalStockVoucherScopeQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = load this one count. Absent = list.',
  })
  @OptionalUuid()
  svhId?: string;

  @ApiPropertyOptional({ enum: STOCK_VOUCHER_STATUSES })
  @IsOptional()
  @IsIn(STOCK_VOUCHER_STATUSES as unknown as string[], {
    message: `status must be one of ${STOCK_VOUCHER_STATUSES.join(', ')}`,
  })
  status?: StockVoucherStatus;

  @ApiPropertyOptional({ type: 'string', format: 'date' })
  @OptionalDateString()
  fromDate?: string;

  @ApiPropertyOptional({ type: 'string', format: 'date' })
  @OptionalDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Matches refno or the user reference' })
  @OptionalTrimmedString(100)
  search?: string;

  @ApiPropertyOptional({ default: 50, maximum: 500 })
  @OptionalQueryInt(1, 500)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalQueryInt(0)
  offset?: number;
}

/** The routes that address exactly one document: validate and delete. */
export class PhysicalStockVoucherRefQueryDto extends PhysicalStockVoucherScopeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  svhId!: string;
}

/** §12 — the variance report, paged like every other ledger-side read. */
export class PhysicalStockVarianceQueryDto extends PhysicalStockVoucherRefQueryDto {
  @ApiPropertyOptional({ default: 200, maximum: 1000 })
  @OptionalQueryInt(1, 1000)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalQueryInt(0)
  offset?: number;
}

/**
 * §4 — what the count sheet is generated for.
 *
 * `godownId` is required and singular: a count is per godown, because
 * stock_balance is keyed per godown and the freeze (§11) is applied to one.
 */
export class GenerateCountSheetQueryDto extends PhysicalStockVoucherScopeQueryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'inventory.godown_locations.gdl_id — the shelf being counted.',
  })
  @RequiredUuid()
  godownId!: string;

  @ApiPropertyOptional({
    enum: STOCK_BUCKETS,
    description: 'Count one bucket at a time. All of them when omitted.',
  })
  @IsOptional()
  @IsIn(STOCK_BUCKETS as unknown as string[], {
    message: `bucket must be one of ${STOCK_BUCKETS.join(', ')}`,
  })
  bucket?: StockBucket;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'inventory.item_group_master.item_group_id — count one aisle rather than the warehouse.',
  })
  @OptionalUuid()
  itemGroupId?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Holdings the book says are empty are INCLUDED by default: a holding the book says is empty is exactly where a count finds something. Set false for the operator who does not want them.',
  })
  @OptionalQueryBoolean()
  includeZero?: boolean;

  @ApiPropertyOptional({
    default: 200,
    maximum: 1000,
    description:
      'A main warehouse is tens of thousands of holdings, so the sheet is paged. lineNo continues across pages — page 2 is lines 201-400 of one sheet, not a second sheet numbered from 1.',
  })
  @OptionalQueryInt(1, 1000)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalQueryInt(0)
  offset?: number;
}
