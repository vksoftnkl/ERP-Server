import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import {
  OptionalNumber,
  OptionalUuid,
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';

/**
 * §4.4 — `POST /receipts/post`, the one-way door.
 *
 * **Everything in this body is a PREVIEW, not an instruction.** The server
 * re-reads every bill under a row lock, re-runs the allocation engine and
 * refuses a mismatch. What the client sends is what it BELIEVES, and the point
 * of sending it is so the two can be compared — a client whose figures have
 * gone stale is told so instead of quietly posting something else.
 */

/**
 * The FOUR KEYS every route that acts on an existing voucher takes.
 *
 * `(avhVoucherId, avhAccYear)` is the primary key — `acc_voucher_header` is
 * partitioned on the year, so an id alone does not name a row. The company and
 * the branch are not redundant with it: a uuid is a bearer token, and without
 * them anyone holding one could read, post or cancel a receipt belonging to a
 * company they have no business in. A mismatch is a 404, not a 403 — a caller
 * scoped elsewhere should not learn that this receipt exists.
 */
export class ReceiptKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  avhVoucherId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  avhCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  avhBranchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  avhAccYear!: string;
}

export class PostReceiptAllocationDto {
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
    example: 48600,
    minimum: 0,
    description:
      "This bill's TOTAL settlement by this receipt, EXCLUDING discount and write-off — money, " +
      'TDS, claims and credits together. The engine splits it into rows; the client does not say ' +
      'which source pays which part.',
  })
  @RequiredNumber(0)
  amount!: number;

  @ApiPropertyOptional({
    default: 0,
    minimum: 0,
    description:
      'The prompt-payment discount AS THE OPERATOR LEFT IT. open-items suggested a figure; if ' +
      'they cleared it, send 0 and 0 is what posts. The server NEVER re-seeds (§12).',
  })
  @OptionalNumber(0)
  discount?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @OptionalNumber(0)
  writeoff?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Who authorised the write-off. Required whenever writeoff > 0 and above ' +
      'accounts.writeoff_approval_above — whose default of 0 means always.',
  })
  @OptionalUuid()
  writeoffApprovedBy?: string | null;
}

export class PostReceiptCreditDto {
  @ApiProperty({ format: 'uuid', description: 'The ADVANCE or SALES_RETURN bill being spent.' })
  @RequiredUuid()
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  billAccYear!: string;

  @ApiProperty({
    example: 4000,
    minimum: 0,
    description:
      'How much of it to apply. It must all land on bills — a credit cannot be held on account ' +
      'again, because moving a number between two rows of the same table changes nothing and ' +
      'produces a trail saying money arrived when none did.',
  })
  @RequiredNumber(0)
  amount!: number;
}

/**
 * Pins one other-ledger line to one bill.
 *
 * Without a pin a deduction spreads pro-rata across the bills being settled,
 * which is right when TDS was withheld on the payment as a whole and wrong when
 * it was withheld on one invoice. Pin all of a line or none of it.
 */
export class PostReceiptOtherLinePinDto {
  @ApiProperty({
    example: 1,
    description: "The other-line's 1-based position in the DRAFT's otherLines array.",
  })
  @RequiredInteger(1)
  lineNo!: number;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  billAccYear!: string;

  @ApiProperty({ example: 700, minimum: 0 })
  @RequiredNumber(0)
  amount!: number;
}

export class PostReceiptDto extends ReceiptKeysDto {
  @ApiProperty({
    type: () => PostReceiptAllocationDto,
    isArray: true,
    description:
      'IN ORDER. The order is the order money fills the bills, and it is the order open-items ' +
      'returned them in — which is what accounts.receipt_bill_sort asked for.',
  })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptAllocationDto)
  allocations!: PostReceiptAllocationDto[];

  @ApiPropertyOptional({ type: () => PostReceiptCreditDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptCreditDto)
  creditsApplied: PostReceiptCreditDto[] = [];

  @ApiPropertyOptional({ type: () => PostReceiptOtherLinePinDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptOtherLinePinDto)
  otherLineBills: PostReceiptOtherLinePinDto[] = [];

  @ApiProperty({
    example: 14450,
    minimum: 0,
    description:
      'What is left over and will be held as an ADVANCE bill (R7). Recomputed server-side and ' +
      'refused if it disagrees — this is the single figure that proves the client and the server ' +
      'read the same receipt.',
  })
  @RequiredNumber(0)
  onAccount!: number;
}

/**
 * §4.8 — cancel.
 *
 * There is no /approve and no /reject: a receipt is DRAFT, then POSTED, then
 * CANCELLED, and /post runs straight from the DRAFT.
 */
export class CancelReceiptDto extends ReceiptKeysDto {
  @ApiProperty({
    maxLength: 250,
    description: 'Why. ck_avh_cancel refuses a CANCELLED voucher without one.',
  })
  @UpperMaxString(250)
  reason!: string;
}

/** §4.5 — get. */
export class GetReceiptQueryDto extends ReceiptKeysDto {}
