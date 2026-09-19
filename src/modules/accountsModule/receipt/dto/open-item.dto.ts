import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  OptionalDateString,
  OptionalUuid,
  RequiredNumber,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { VoucherStatus } from '../types/receipt-enum';

/**
 * §4.1 — `GET /receipts/open-items`.
 *
 * ── ONE partyId ──────────────────────────────────────────────────────────
 * A customer id, a supplier id and a ledger id are the SAME VALUE in this
 * database. A customer is created by copying the new ledger's `led_id` into
 * `cus_id` — CustomerService.create says so in as many words, "reuse its
 * led_id as the customer's cus_id so the two masters share one identity" — and
 * `purchase.suppliers` does the same. So there is nothing to resolve, no
 * bridge column, and no 404 for a party whose bridge was never filled in: a
 * partyId that names no live ledger simply is not a party, and `loadParty`
 * says exactly that.
 *
 * ── No branch and no accounting year ─────────────────────────────────────
 * Both omissions are deliberate and both are the same reason:
 * `acc_bill_balance` is partitioned by the year a bill ORIGINATED in and is
 * never carried forward, so filtering on this year's partition would hide
 * every bill raised before it — which, given that clients run year-end
 * generation on 1 April and then key the March receipts they missed, is
 * guaranteed to be most of what the operator is looking for. The branch is
 * left out for the matching reason: a customer pays one cheque for bills
 * raised at three branches.
 */
export class ListOpenItemsQueryDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The party. A customer id, a supplier id and an accounts.acc_ledger_master led_id are the ' +
      'same value — pass whichever one the screen is holding.',
  })
  @RequiredUuid()
  partyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    example: '2026-09-14',
    description:
      "The RECEIPT's date, not today. It is what ppdSuggested is aged against and what " +
      'daysOverdue is measured to, so a receipt being keyed for last Friday must send last ' +
      'Friday or it will be offered a discount the customer has lost. Defaults to today.',
  })
  @OptionalDateString()
  onDate?: string;
}

/** §4.2 — `GET /receipts/party-context`. Read-only; no paging needed. */
export class PartyContextQueryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The party — the same id as the customer or supplier.',
  })
  @RequiredUuid()
  partyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;
}

/**
 * R-B4 — `GET /receipts/adjacent`.
 *
 * The four keys of the voucher being walked FROM, plus a direction, plus the
 * register's own optional filters. It returns a key, not a receipt: the client
 * already has `/receipts/get` and calling it is what it was going to do next
 * anyway.
 *
 * ── Why the filters are here at all ──────────────────────────────────────
 * Because the walk has to agree with the list the operator is looking at. A
 * register filtered to POSTED that skipped from one posted receipt over three
 * drafts to the next is correct; one that landed on a draft the list does not
 * show is a bug the operator cannot explain. So the same `status`, `fromDate`
 * and `toDate` the grid was run with are sent back here, and the neighbour is
 * found under them.
 */
export class AdjacentVoucherQueryDto {
  @ApiProperty({ format: 'uuid', description: 'The receipt currently open.' })
  @RequiredUuid()
  voucherId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({
    enum: ['prev', 'next'],
    example: 'prev',
    description:
      'prev = the receipt entered just BEFORE this one; next = the one entered just after. ' +
      'Named for the ordering key, not for the direction the register happens to be drawn in.',
  })
  @IsIn(['prev', 'next'])
  direction!: 'prev' | 'next';

  @ApiPropertyOptional({
    enum: VoucherStatus,
    description: "The register's status filter, when it has one. Omit to walk every status.",
  })
  @IsOptional()
  @IsIn(Object.values(VoucherStatus))
  status?: VoucherStatus;

  @ApiPropertyOptional({ example: '2026-09-01', description: "The register's from-date, if set." })
  @OptionalDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: "The register's to-date, if set." })
  @OptionalDateString()
  toDate?: string;
}

/**
 * R-B6 — `GET /receipts/duplicate-check`.
 *
 * ── Why the branch is optional here and required on `/adjacent` ──────────
 * They are different questions. `/adjacent` walks a LIST, and that list is a
 * branch's register, so a walk that wandered into another branch's receipts
 * would not match what is on screen.
 *
 * This asks whether the company has already taken this money, and the answer
 * does not stop being yes because the first receipt was keyed on another beat —
 * a re-key at the wrong branch is a duplicate the operator most needs telling
 * about. So the default is the whole company, and `branchId` narrows it for a
 * caller that means to.
 */
export class DuplicateCheckQueryDto {
  @ApiProperty({ format: 'uuid', description: 'The party the money is coming from.' })
  @RequiredUuid()
  partyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  accYear!: string;

  @ApiProperty({
    example: '2026-09-18',
    description: "The receipt's date — the date being checked, not today.",
  })
  @UpperMaxString(10)
  voucherDate!: string;

  @ApiProperty({
    example: 5000,
    minimum: 0,
    description:
      'The total being received — Σ of the tender rows, the same figure that becomes ' +
      'avh_doc_amount. Matched EXACTLY: a near-miss is a different receipt, and a tolerance ' +
      'would warn on every second collection on a beat where most amounts are round.',
  })
  @RequiredNumber(0)
  amount!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The draft being keyed, so it does not report itself. Send it as soon as /create has ' +
      'returned an avhVoucherId — without it, every re-check after the first save warns.',
  })
  @OptionalUuid()
  excludeVoucherId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Narrow to one branch. Omit — the default — to ask the whole company.',
  })
  @OptionalUuid()
  branchId?: string;
}
