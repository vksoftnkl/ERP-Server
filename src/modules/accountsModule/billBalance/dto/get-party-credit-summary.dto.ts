import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import { OptionalUuid, RequiredUuid } from 'src/common/dto/dtoDecorators';

// acc_bill_balance.abl_acc_year and every other acc-year column is char(9) in
// the `YYYY-YYYY` form, which is what ck_abl_acc_year enforces DB-side.
export const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

/**
 * `partyId` is the only required parameter. `companyId` and `branchId` narrow
 * the read — omit one and the position spans every company / every branch.
 * `accYear` narrows nothing (see below).
 *
 * There is no as-on date: overdue is always measured against the database
 * server's CURRENT_DATE, and the date used comes back on the response.
 */
export class GetPartyCreditSummaryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'customers.cus_id — the same id acc_bill_balance.abl_party_id carries.',
  })
  @RequiredUuid()
  partyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "Tenant scope for both the bills and the customer. OMIT AT YOUR OWN RISK: without it the party is resolved and aggregated across every company in the database, so a shared party id returns a position that is not any one tenant's. Entry screens always know their company and should always send it.",
  })
  @OptionalUuid()
  companyId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Branch that RAISED the bill. Omit for the company-wide credit position, which is the usual credit check — outstanding is company-wide (ux_abl_doc_refno carries no branch column for exactly that reason).',
  })
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional({
    example: '2025-2026',
    pattern: ACC_YEAR_PATTERN.source,
    description:
      "The entry screen's accounting year, echoed back on the response. It does NOT scope the outstanding figures: a bill stays open in the partition of the year it was raised in and is never carried forward, so a credit check that filtered on the year would silently ignore real prior-year debt. Validated when supplied purely so a malformed year is caught at the edge rather than echoed back.",
  })
  @IsOptional()
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must be in the YYYY-YYYY form, e.g. 2025-2026' })
  accYear?: string;
}
