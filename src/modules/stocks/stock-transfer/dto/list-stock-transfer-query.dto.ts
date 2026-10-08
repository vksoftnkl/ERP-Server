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
 * Company, branch and year on every read. stock_voucher is PARTITIONED BY LIST
 * (svh_acc_year) and every index on it starts with (company, branch), so a
 * query missing any of the three scans every branch's documents for every year.
 */
export class StockTransferScopeQueryDto {
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
 * GET /stock/transfer — `svhId` present loads one, absent lists.
 *
 * THE STATUS FILTER MUST OFFER ALL FIVE. An inter-branch TRANSFER_OUT is NEVER
 * POSTED — it goes DRAFT → IN_TRANSIT → RECEIVED — so a screen that offers only
 * DRAFT and POSTED silently loses every transfer in flight, which is precisely
 * the set a despatching branch most needs to see. `status` is left as the full
 * STOCK_VOUCHER_STATUSES enum for that reason, and the absence of a filter
 * means all of them.
 */
export class GetStockTransferQueryDto extends StockTransferScopeQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = load this one document (with its transit rows). Absent = list.',
  })
  @OptionalUuid()
  svhId?: string;

  @ApiPropertyOptional({
    enum: STOCK_VOUCHER_STATUSES,
    description:
      'Omit for all. An inter-branch despatch is IN_TRANSIT, never POSTED — filtering to POSTED hides every transfer on a lorry.',
  })
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

/** The routes addressing exactly one document: validate, despatch-ref, delete. */
export class StockTransferRefQueryDto extends StockTransferScopeQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  svhId!: string;
}

/**
 * §6 — the receipt prefill. Keyed by the DESPATCH, and the despatch's own year,
 * which is not necessarily the receiving branch's current one.
 */
export class StockTransferPrefillQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description: "The RECEIVING branch — must be the OUT's destination.",
  })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ format: 'uuid', description: 'The TRANSFER_OUT being received against.' })
  @RequiredUuid()
  outVoucherId!: string;

  @ApiProperty({
    example: '2026-2027',
    minLength: 9,
    maxLength: 9,
    description: "The DESPATCH's accounting year, which may not be the receipt's.",
  })
  @TrimmedString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must be YYYY-YYYY, e.g. 2026-2027' })
  accYear!: string;
}

/**
 * §5.2 — the inbound worklist. Scoped by the RECEIVING branch, which is
 * `svh_to_branch_id` on somebody else's document, so it takes no accYear:
 * a transfer despatched in March is received in April and must not fall off
 * the list at the year end.
 */
export class StockTransferInboundQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: 'Me — the branch stock is coming to.' })
  @RequiredUuid()
  branchId!: string;

  @ApiPropertyOptional({ default: 100, maximum: 500 })
  @OptionalQueryInt(1, 500)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @OptionalQueryInt(0)
  offset?: number;
}
