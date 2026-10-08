import { ApiProperty } from '@nestjs/swagger';
import {
  OptionalNumber,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredNumber,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';

/**
 * §6.1 — `apdId + apdAccYear` on every row reference, plus the company and
 * branch that make a uuid more than a bearer token.
 *
 * `(apd_id, apd_acc_year)` is the primary key because `acc_pdc_register` is
 * LIST-partitioned on the year, so an id alone does not name a row. The
 * company and the branch are not redundant with that: without them anyone
 * holding a uuid could deposit, clear or bounce a cheque belonging to a
 * company they have no business in, and the database would see nothing wrong
 * with it. A mismatch is a **404, not a 403** — a caller scoped elsewhere
 * should not learn that this cheque exists.
 *
 * The year is the year the cheque was RECEIVED in, and it never changes. A
 * cheque received in March and cleared in May stays in the 2025-2026
 * partition; the clearing voucher carries its own year in its own columns.
 */
export class ChequeKeysDto {
  @ApiProperty({ format: 'uuid', description: 'accounts.acc_pdc_register.apd_id.' })
  @RequiredUuid()
  apdId!: string;

  @ApiProperty({
    example: '2026-2027',
    description:
      'The year the cheque was RECEIVED in — the partition key, not the year it clears in.',
  })
  @UpperMaxString(9)
  apdAccYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  apdCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  apdBranchId!: string;
}

/** One row of a batch — the keys without the scope, which the batch carries once. */
export class ChequeRefDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  apdId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  apdAccYear!: string;
}

/**
 * An allocation the caller previews.
 *
 * ON_CLEARING only, on `/clear` and on the two re-issue paths. Under
 * ON_RECEIPT the receipt has already settled the bills and there is nothing
 * left to allocate — sending allocations there is refused rather than ignored,
 * because silently discarding them would let a screen believe it had moved
 * money it had not.
 *
 * An EMPTY array is never "allocate nothing" — money that arrives always goes
 * somewhere, and the remainder becomes an ADVANCE. What it DOES mean depends on
 * whether this money has been placed before:
 *
 *   · on `/clear`, auto-FIFO — the same rule `open-items` lists bills under,
 *     because an ON_CLEARING cheque is landing for the first time;
 *   · on `/re-present`, the bills the bounce reversed, with the amounts it
 *     reversed. The same money for the same debt; see `RepresentChequeDto`;
 *   · on `/replace`, auto-FIFO again, because the new cheque may be for a
 *     different amount and there is nothing to restore it to exactly.
 */
export class ChequeAllocationDto {
  @ApiProperty({ format: 'uuid', description: 'accounts.acc_bill_balance.abl_id.' })
  @RequiredUuid()
  billId!: string;

  @ApiProperty({
    example: '2026-2027',
    description: 'The bill is keyed on (id, year) — the table is partitioned, so both travel.',
  })
  @UpperMaxString(9)
  billAccYear!: string;

  @ApiProperty({
    example: 12500,
    minimum: 0,
    description: "This bill's settlement by this cheque, EXCLUDING discount and write-off.",
  })
  @RequiredNumber(0)
  amount!: number;

  @ApiProperty({ required: false, default: 0, minimum: 0 })
  @OptionalNumber(0)
  discount?: number;

  @ApiProperty({ required: false, default: 0, minimum: 0 })
  @OptionalNumber(0)
  writeoff?: number;

  @ApiProperty({
    required: false,
    format: 'uuid',
    nullable: true,
    description:
      'Who authorised the write-off. Required whenever writeoff > 0 and above ' +
      'accounts.writeoff_approval_above — whose default of 0 means always.',
  })
  @OptionalUuid()
  writeoffApprovedBy?: string | null;
}

/** The free-text fields several endpoints share, with the widths their columns have. */
export class ChequeRemarksDto {
  @ApiProperty({ required: false, nullable: true, maxLength: 500 })
  @OptionalTrimmedString(500)
  remarks?: string | null;
}

/** `apd_deposit_slip_no` is VarChar(50). */
export class DepositSlipKeyDto {
  @ApiProperty({ maxLength: 50, example: 'D-121' })
  @TrimmedString(50)
  slipNo!: string;
}
