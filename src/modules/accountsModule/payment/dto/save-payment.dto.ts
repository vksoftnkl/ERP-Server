import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableString,
  OptionalBoolean,
  OptionalNumber,
  OptionalUuid,
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { TenderChequeDetailDto } from '../../tenderDetail/dto/save-tender-detail.dto';
import {
  PostReceiptAllocationDto,
  PostReceiptCreditDto,
  ReceiptKeysDto,
} from '../../receipt/dto/post-receipt.dto';
import { DrCr, VoucherDeviceType } from '../types/payment-enum';

/**
 * §4.3 — `POST /payments/create`, the DRAFT. `SaveDraftReceiptDto`, mirrored:
 * the same `avh*` header, the same `td*` tender rows, the same other-ledger
 * band, the same remembered allocations. What differs is on the instrument:
 *
 *   · a CHEQUE row names a BOOK (`cheque.chequeBookId`), who it is made out to
 *     and whether it is A/c payee. It never carries `tdRefNo`: the leaf is
 *     taken at post, under the book's row lock (notes 55);
 *   · a bank-transfer row may carry the `beneficiary` — the supplier's
 *     account, defaulted from their bank master on /open-items.
 */

/** The cheque detail of a cheque WE issue. */
export class SavePaymentChequeDto extends TenderChequeDetailDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'accounts.acc_cheque_book.acb_id — the book the leaf comes from. The bank the cheque is ' +
      "drawn on is the book's. Required on a cheque row.",
  })
  @RequiredUuid()
  chequeBookId!: string;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 150,
    description: 'Who the cheque is made out to. Defaults to the party name.',
  })
  @NullableString(150)
  favouring?: string | null;

  @ApiPropertyOptional({ default: true, description: 'A/c payee crossing.' })
  @OptionalBoolean()
  acPayee?: boolean;
}

/** Where a transfer goes. */
export class PaymentBeneficiaryDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 150 })
  @NullableString(150)
  name?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @NullableString(50)
  accountNo?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 11 })
  @NullableString(11)
  ifsc?: string | null;
}

export class SavePaymentTenderDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = update that row.' })
  @OptionalUuid()
  tdId?: string;

  @ApiProperty({ minimum: 1, example: 1 })
  @RequiredInteger(1)
  tdRowNo!: number;

  @ApiProperty({ format: 'uuid', description: 'accounts.acc_tender_master.tnd_id.' })
  @RequiredUuid()
  tdTenderId!: string;

  @ApiProperty({
    example: 6,
    description: 'acc_tender_types.ttm_type_id, checked against the master.',
  })
  @RequiredInteger(1)
  tdTenderTypeId!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The ledger the money leaves. A snapshot of the tender master unless tnd_edit_ledger is ' +
      "set. On a CHEQUE row it is always the book's bank and this field is ignored.",
  })
  @OptionalUuid()
  tdTenderLedgerId?: string;

  @ApiProperty({ example: 5000, minimum: 0, description: 'The face value. Must be > 0.' })
  @RequiredNumber(0)
  tdAmount!: number;

  @ApiPropertyOptional({ example: 5000, minimum: 0, description: 'Cash only.' })
  @OptionalNumber(0)
  tdReceivedAmt?: number;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @OptionalNumber(0)
  tdChangeAmt?: number;

  @ApiPropertyOptional({
    example: 10,
    minimum: 0,
    description:
      "The bank's charge on this transfer, INSIDE tdAmount: tdAmount is what leaves our bank " +
      '(the bank leg is credited gross of its charge) and the party receives tdAmount − ' +
      'tdMdrAmt — the mirror of a receipt, where the customer pays tdAmount and the acquirer ' +
      'keeps tdMdrAmt. The server seeds a BANK_CHARGES (DR) other-line from it if the client did ' +
      'not, and refuses one that disagrees. TDS is worked out on what the party receives.',
  })
  @OptionalNumber(0)
  tdMdrAmt?: number;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 100,
    example: 'UTR445123',
    description:
      'The UTR / transaction id on a transfer. NOT accepted on a cheque row — the leaf is taken at post.',
  })
  @NullableString(100)
  tdRefNo?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 150, example: 'KVB' })
  @NullableString(150)
  tdBankName?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  tdPayerVpa?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-09-20',
    description:
      'The date on the cheque. Defaults to the payment date. Later than the payment date makes ' +
      'it post-dated, which gives it a voucher of its own dated this day (R2).',
  })
  @NullableDateString()
  tdInstrumentDate?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @NullableString(250)
  tdNotes?: string | null;

  @ApiPropertyOptional({
    type: () => SavePaymentChequeDto,
    description: 'Cheque detail. Required on a cheque row (the book), ignored on any other.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SavePaymentChequeDto)
  cheque?: SavePaymentChequeDto;

  @ApiPropertyOptional({
    type: () => PaymentBeneficiaryDto,
    description: "The supplier's account a transfer goes to. Ignored on cash and on a cheque.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentBeneficiaryDto)
  beneficiary?: PaymentBeneficiaryDto;
}

/**
 * One other-ledger line. Roles a payment accepts: TDS_PAYABLE (CR, settles),
 * BANK_CHARGES (DR), INTEREST_PAID (DR), BALANCES_WRITTEN_BACK (CR, settles),
 * or a free `ledgerId`. DISCOUNT_RECEIVED / WRITE_OFF / ROUND_OFF are refused
 * here — they ride on `allocations[]`.
 */
export class SavePaymentOtherLineDto {
  @ApiPropertyOptional({
    example: 'INTEREST_PAID',
    description: 'One of TDS_PAYABLE, BANK_CHARGES, INTEREST_PAID, BALANCES_WRITTEN_BACK.',
  })
  @IsOptional()
  @UpperMaxString(30)
  role?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'A ledger chosen by hand, when no role fits. Never the party.',
  })
  @OptionalUuid()
  ledgerId?: string;

  @ApiProperty({
    enum: DrCr,
    description:
      'Checked against the role: an expense on top is DR, a deduction that settles is CR. ' +
      'A line claiming the wrong side is refused.',
  })
  @IsIn(Object.values(DrCr))
  drCr!: DrCr;

  @ApiProperty({ example: 200, minimum: 0 })
  @RequiredNumber(0)
  amount!: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'Does this line REDUCE what we owe on a bill? True for TDS and a balance written back — ' +
      'the bill closes for its full face and the withheld part goes to a ledger. A DR line never ' +
      'settles and the flag is ignored on one.',
  })
  @OptionalBoolean()
  settlesBill?: boolean;

  @ApiPropertyOptional({ nullable: true, maxLength: 250 })
  @NullableString(250)
  narration?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Who authorised a BALANCES_WRITTEN_BACK line above accounts.writeoff_approval_above ' +
      '(whose default of 0 means every one).',
  })
  @OptionalUuid()
  approvedBy?: string | null;
}

export class SavePaymentDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = edit that DRAFT.' })
  @OptionalUuid()
  avhVoucherId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  avhCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  avhBranchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  avhAccYear!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  avhTenantId?: string | null;

  @ApiProperty({ example: '2026-09-28', description: 'Must fall in an OPEN, unlocked year.' })
  @UpperMaxString(10)
  avhVoucherDate!: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The payee — a supplier id, a customer id (a refund) or a ledger id, all the same value. ' +
      'Any live party ledger is accepted (D1). A cash or bank ledger is refused: that is a Contra.',
  })
  @RequiredUuid()
  avhPartyId!: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Paid by. ONE employee; mandatory when accounts.payment_salesman_mandatory is on.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  avhEmployeeId?: string[];

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  avhUsrRefno?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  avhDocRefno?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-09-28' })
  @NullableDateString()
  avhDocDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(2000)
  avhRemarks?: string | null;

  @ApiPropertyOptional({ enum: VoucherDeviceType })
  @IsOptional()
  @IsIn(Object.values(VoucherDeviceType))
  avhDeviceType?: VoucherDeviceType;

  @ApiPropertyOptional({ nullable: true })
  @NullableString(250)
  avhDeviceId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @OptionalUuid()
  avhSessionId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Falls back to the authenticated user.' })
  @OptionalUuid()
  avhUserId?: string;

  @ApiProperty({ type: () => SavePaymentTenderDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SavePaymentTenderDto)
  tenders!: SavePaymentTenderDto[];

  @ApiPropertyOptional({ type: () => SavePaymentOtherLineDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SavePaymentOtherLineDto)
  otherLines?: SavePaymentOtherLineDto[];

  @ApiPropertyOptional({
    default: true,
    description: 'true — the arrays ARE the document. false leaves unmentioned tender rows alone.',
  })
  @OptionalBoolean()
  replace?: boolean;
}

/** What `POST /payments/create` takes: the draft plus the remembered settlement (notes 30). */
export class SaveDraftPaymentDto extends SavePaymentDto {
  @ApiPropertyOptional({
    type: () => PostReceiptAllocationDto,
    isArray: true,
    description:
      'The bill-wise settlement as the operator left it, REMEMBERED, never applied or validated. ' +
      'Omit the key to leave what is remembered alone; send [] to clear it.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptAllocationDto)
  allocations?: PostReceiptAllocationDto[];

  @ApiPropertyOptional({
    type: () => PostReceiptCreditDto,
    isArray: true,
    description: 'The debits we hold that the operator ticked, remembered on the same terms.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PostReceiptCreditDto)
  creditsApplied?: PostReceiptCreditDto[];
}

/** §4.7 — `PUT /payments/update-header`. The four keys and the editable fields, nothing else. */
export class UpdatePaymentHeaderDto extends ReceiptKeysDto {
  @ApiPropertyOptional({ nullable: true })
  @NullableString(2000)
  avhRemarks?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  avhUsrRefno?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @NullableString(100)
  avhDocRefno?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-09-28' })
  @NullableDateString()
  avhDocDate?: string | null;

  @ApiPropertyOptional({ type: [String], format: 'uuid', description: 'Paid by. One id.' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  avhEmployeeId?: string[];

  @ApiProperty({ maxLength: 500, description: 'Why. Appended to the status trail.' })
  @UpperMaxString(500)
  editRemark!: string;
}
