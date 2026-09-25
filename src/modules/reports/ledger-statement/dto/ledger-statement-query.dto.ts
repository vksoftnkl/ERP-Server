import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';

/**
 * Plan §5 — the query keys. Own DTOs, shared with no other route (§2): when the
 * voucher / ledger routes change shape, this module does not move.
 */
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `companyId · accYear · branchId?` — the part every route shares. */
export class LedgerStatementYearDto {
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
      "Absent = All branches: every opening set (company-level + every branch's) and every " +
      "branch's legs. A branch = that branch's opening set and legs only.",
  })
  @OptionalUuid()
  branchId?: string;
}

/** `LedgerStatementScopeDto` of the plan — the year scope plus the ledger. `/monthly` takes it as is. */
export class LedgerStatementScopeDto extends LedgerStatementYearDto {
  @ApiProperty({ format: 'uuid', description: 'accounts.acc_ledger_master.led_id' })
  @RequiredUuid()
  ledgerId!: string;
}

/** `/header`, `/daily`: the scope plus the period. */
export class LedgerStatementRangeDto extends LedgerStatementScopeDto {
  @ApiProperty({ example: '2026-08-01', description: 'YYYY-MM-DD, inside the fiscal year.' })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate!: string;

  @ApiProperty({
    example: '2026-09-25',
    description: 'YYYY-MM-DD, inside the fiscal year, ≥ fromDate.',
  })
  @IsString()
  @Matches(DATE_PATTERN, { message: 'toDate must be YYYY-MM-DD' })
  toDate!: string;
}

/** `/export`: the rows of `/vouchers`, unpaged. */
export class LedgerStatementExportDto extends LedgerStatementRangeDto {
  @ApiPropertyOptional({
    default: true,
    description:
      'false hides a cancelled pair — BOTH halves, and only when both fall inside the range. A ' +
      'lone half is shown regardless (pairOutsideRange: true): it moves this period’s balance.',
  })
  @OptionalQueryBoolean()
  includeCancelled?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Fill billRefs[] (§8).' })
  @OptionalQueryBoolean()
  withBillRefs?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'L4 — inline every leg of each row’s voucher (the Contra legs checkbox).',
  })
  @OptionalQueryBoolean()
  withLegs?: boolean;
}

/** `/vouchers`: `/export` plus paging. */
export class LedgerStatementVouchersDto extends LedgerStatementExportDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ default: 200, minimum: 1, maximum: 1000 })
  @OptionalQueryInt(1, 1000)
  pageSize?: number;
}

/** `/ledgers` — the picker. */
export class LedgerStatementLedgersDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    description: 'Matches name, alias, short name, GSTIN or phone (case-insensitive, contains).',
  })
  @OptionalTrimmedString(100)
  search?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'accounts.acc_group_master.acc_group_id — PgUp / PgDn walk one group.',
  })
  @OptionalUuid()
  groupId?: string;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
  @OptionalQueryInt(1, 100)
  limit?: number;
}

/** `/voucher-legs` — Alt+F1 / the ▾ toggle. */
export class LedgerStatementVoucherLegsDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  @MaxLength(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' })
  accYear!: string;

  @ApiProperty({ format: 'uuid', description: 'accounts.acc_voucher_header.avh_voucher_id' })
  @RequiredUuid()
  voucherId!: string;

  @ApiProperty({ format: 'uuid', description: 'The statement’s ledger — marks isThisLedger.' })
  @RequiredUuid()
  ledgerId!: string;
}
