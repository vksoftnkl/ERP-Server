import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';
import {
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalUuid,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import {
  CHECK_CODES,
  GROUP_LEVELS,
  MONEY_KINDS,
  VOUCHER_NATURES,
  type CheckCode,
  type GroupLevel,
  type MoneyKind,
  type VoucherNature,
} from '../types/day-summary.types';

/**
 * Plan §5 — the query keys. Own DTOs, shared with no other route (§2): when
 * the ledger-statement / voucher routes change shape, this module does not move.
 */
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const upper = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

/** `DaySummaryScopeDto` of the plan — what every route but /voucher-types takes. */
export class DaySummaryScopeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ example: '2026-2027', description: "'YYYY-YYYY', second half = first + 1." })
  @UpperMaxString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' })
  accYear!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "Absent = All branches: every branch's legs and every opening set (company-level + " +
      "every branch's). A branch = that branch's legs and opening set only.",
  })
  @OptionalUuid()
  branchId?: string;

  @ApiProperty({ example: '2026-10-09', description: 'YYYY-MM-DD, inside the fiscal year.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'fromDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'fromDate is not a calendar date' })
  fromDate!: string;

  @ApiPropertyOptional({
    example: '2026-10-09',
    description: 'YYYY-MM-DD, ≥ fromDate, same fiscal year. Absent = fromDate (one day).',
  })
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'toDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'toDate is not a calendar date' })
  toDate?: string;

  @ApiPropertyOptional({
    description:
      'accounts.acc_voucher_types.vchr_type_id. Absent = all types. With a type, money ' +
      'opening / closing are null — a balance has no voucher type.',
  })
  @OptionalQueryInt(1)
  voucherTypeId?: number;

  @ApiPropertyOptional({
    default: true,
    description:
      'Fold CLEARING ledgers into the type grid’s Bank in / Bank out (and the Day-wise bank ' +
      'columns). The money grid always lists clearing ledgers separately.',
  })
  @OptionalQueryBoolean()
  clearingAsBank?: boolean;

  @ApiPropertyOptional({
    enum: GROUP_LEVELS,
    default: 'REPORT',
    description:
      "REPORT = the root's child on the ledger's chain (the root itself for a ledger sitting " +
      "in a root); PRIMARY = the root; LEDGER_GROUP = the ledger's own group.",
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(GROUP_LEVELS)
  groupLevel?: GroupLevel;

  @ApiPropertyOptional({
    default: false,
    description:
      '/summary: every accounting voucher type and every money ledger of the company, even ' +
      'with nothing in the range. /daily: every calendar day of the range.',
  })
  @OptionalQueryBoolean()
  zeroRows?: boolean;
}

/** `/export` — the summary plus every voucher row, unpaged. */
export class DaySummaryExportDto extends DaySummaryScopeDto {
  @ApiPropertyOptional({
    default: true,
    description:
      'List both halves of a cancelled pair that falls wholly inside the range (they are left ' +
      'out of every /summary figure). false hides them. A lone half is always listed.',
  })
  @OptionalQueryBoolean()
  includeCancelledPairs?: boolean;

  @ApiPropertyOptional({
    enum: VOUCHER_NATURES,
    description: 'Only voucher types of this nature (a tile / row drill).',
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(VOUCHER_NATURES)
  natureFilter?: VoucherNature;

  @ApiPropertyOptional({
    enum: MONEY_KINDS,
    description:
      'Only vouchers with a counted leg on a money ledger of this kind. BANK includes ' +
      'CLEARING while clearingAsBank is true.',
  })
  @IsOptional()
  @Transform(upper)
  @IsIn(MONEY_KINDS)
  moneyKind?: MoneyKind;

  @ApiPropertyOptional({
    description: 'Inline every leg of each voucher. Default false on /vouchers, true on /export.',
  })
  @OptionalQueryBoolean()
  withLegs?: boolean;
}

/** `/vouchers` — the Vouchers tab (day book detail), paged. */
export class DaySummaryVouchersDto extends DaySummaryExportDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ default: 200, minimum: 1, maximum: 500 })
  @OptionalQueryInt(1, 500)
  pageSize?: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'Return the DRAFT headers dated in the range instead (no number, no legs; amount = ' +
      'avh_doc_amount).',
  })
  @OptionalQueryBoolean()
  draftsOnly?: boolean;
}

/** `/group-ledgers` — Enter on a group row. */
export class DaySummaryGroupLedgersDto extends DaySummaryScopeDto {
  @ApiProperty({
    format: 'uuid',
    description: 'accounts.acc_group_master.acc_group_id — a row of /summary groups[].',
  })
  @RequiredUuid()
  groupId!: string;
}

/** `/checks/detail` — "show me" on a check. */
export class DaySummaryCheckDetailDto extends DaySummaryScopeDto {
  @ApiProperty({ enum: CHECK_CODES })
  @Transform(upper)
  @IsString()
  code!: CheckCode;
}
