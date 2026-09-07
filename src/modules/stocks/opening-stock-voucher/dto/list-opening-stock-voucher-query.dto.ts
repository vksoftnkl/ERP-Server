import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import {
  OptionalDateString,
  OptionalQueryInt,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import {
  STOCK_VOUCHER_STATUSES,
  type StockVoucherStatus,
} from '../../stock-voucher/types/stock-voucher.types';

const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

/**
 * The scope every read on this screen carries.
 *
 * Company, branch and year are required on all of them. stock_voucher is
 * PARTITIONED BY LIST (svh_acc_year) and every index on it starts with
 * (company, branch), so a query missing any of the three is a scan across every
 * partition — which on a chain's second year is every branch's documents for
 * every year they have traded.
 */
export class OpeningStockVoucherScopeQueryDto {
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

/**
 * GET /stock/opening — `svhId` present loads one document, absent lists them.
 *
 * One DTO for both because the Qt screen sends the same query object either
 * way; the filters below are simply ignored on the single-document path.
 */
export class GetOpeningStockVoucherQueryDto extends OpeningStockVoucherScopeQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = load this one document. Absent = list.',
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
export class OpeningStockVoucherRefQueryDto extends OpeningStockVoucherScopeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  svhId!: string;
}

/** §10 — both reports can cover a 40,000-row item master, so they page. */
export class OpeningStockReportQueryDto extends OpeningStockVoucherScopeQueryDto {
  @ApiPropertyOptional({ default: 200, maximum: 1000 })
  @OptionalQueryInt(1, 1000)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalQueryInt(0)
  offset?: number;
}
