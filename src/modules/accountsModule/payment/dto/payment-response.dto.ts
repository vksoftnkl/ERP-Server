import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TillApprovalNeedDto } from '../../../till/dto/till-response.dto';
import {
  AdjacentVoucherSuccessDto,
  DuplicateCheckSuccessDto,
  OpenCreditDto,
  ReceiptAdvanceBillDto,
  ReceiptAllocationDto,
  ReceiptBillAfterDto,
  ReceiptBillReopenedDto,
  ReceiptErrorResponseDto,
  ReceiptHeaderDto,
  ReceiptLegDto,
  ReceiptNumberedVoucherDto,
  ReceiptOtherLineDto,
  ReceiptPdcVoucherDto,
  ReceiptReversalDto,
  ReceiptStatusPayloadDto,
  ReceiptTenderDto,
} from '../../receipt/dto/receipt-response.dto';
import { BillStatus, BillType, PdcStatus, VoucherStatus } from '../types/payment-enum';
import type {
  PayableBill,
  PartyChequeOut,
  PartyRecentPayment,
  PaymentAmendPayload,
  PaymentBeneficiary,
  PaymentCancelPayload,
  PaymentCheque,
  PaymentDeletePayload,
  PaymentDraftPayload,
  PaymentOpenItemsParty,
  PaymentOpenItemsPayload,
  PaymentOpenItemsSummary,
  PaymentOtherLine,
  PaymentPartyContextPayload,
  PaymentPartyContextSummary,
  PaymentPayload,
  PaymentPostPayload,
  PaymentTender,
  PaymentTenderCheque,
} from '../types/payment-api.types';

/**
 * The Swagger shapes. Whatever is the receipt's shape verbatim is the receipt's
 * DTO class; each class here `implements` its payload type so a field added
 * to one and not the other is a compile error.
 */

export {
  AdjacentVoucherSuccessDto,
  DuplicateCheckSuccessDto,
  ReceiptErrorResponseDto as PaymentErrorResponseDto,
  ReceiptHeaderDto as PaymentHeaderDto,
};

// ═══════════════════════════════════════════════════════════════════════════
//  §4.1  open-items
// ═══════════════════════════════════════════════════════════════════════════

export class PayableBillDto implements PayableBill {
  @ApiProperty({ format: 'uuid' })
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  billAccYear!: string;

  @ApiProperty({ enum: BillType, example: BillType.PURCHASE })
  billType!: BillType;

  @ApiProperty({ example: 'pur00031', description: 'OUR reference — the purchase voucher.' })
  docRefno!: string;

  @ApiProperty({
    nullable: true,
    example: 'INV/2026/1187',
    description: "The SUPPLIER's bill number.",
  })
  usrRefno!: string | null;

  @ApiProperty({ example: '2026-09-08' })
  docDate!: string;

  @ApiProperty({ nullable: true, example: '2026-10-08' })
  dueDate!: string | null;

  @ApiProperty({ example: 48600 })
  billAmount!: number;

  @ApiProperty({ example: 48600 })
  pendingAmount!: number;

  @ApiProperty({ enum: BillStatus, example: BillStatus.OPEN })
  status!: BillStatus;

  @ApiProperty({ example: 0 })
  daysOverdue!: number;

  @ApiProperty({
    example: 0,
    description: 'Our post-dated cheques already promised against this bill.',
  })
  pdcHeld!: number;

  @ApiProperty({ example: 0, description: 'R16 — what accounts.ppd_slabs suggests. A suggestion.' })
  ppdSuggested!: number;
}

export class PaymentBankDto {
  @ApiProperty({ example: 'KVB' })
  name!: string;

  @ApiProperty({ example: '1234567890' })
  accountNo!: string;

  @ApiProperty({ nullable: true, example: 'KVBL0001234' })
  ifsc!: string | null;
}

export class PaymentOpenItemsPartyDto implements PaymentOpenItemsParty {
  @ApiProperty({ format: 'uuid' })
  ledId!: string;

  @ApiProperty({ example: 'Sundaram Facility Services' })
  ledName!: string;

  @ApiProperty({ nullable: true, example: 'Sundry Creditors' })
  groupName!: string | null;

  @ApiProperty({ example: true })
  isBillByBill!: boolean;

  @ApiProperty({
    example: false,
    description: 'notes (56): a payment to a cash / bank ledger is a Contra, and is refused.',
  })
  isMoneyLedger!: boolean;

  @ApiProperty({ example: true })
  isTdsApplicable!: boolean;

  @ApiProperty({ nullable: true, example: '194C' })
  tdsSection!: string | null;

  @ApiProperty({ nullable: true, example: 'FIRM' })
  tdsDeducteeType!: string | null;

  @ApiProperty({
    nullable: true,
    example: 2,
    description: 'The rate in force today. Null when none is configured.',
  })
  tdsRate!: number | null;

  @ApiProperty({ nullable: true, enum: ['MASTER', 'NO_PAN'], example: 'MASTER' })
  tdsRateSource!: 'MASTER' | 'NO_PAN' | null;

  @ApiProperty({ nullable: true, example: 30000 })
  tdsThresholdSingle!: number | null;

  @ApiProperty({ nullable: true, example: 100000 })
  tdsThresholdAnnual!: number | null;

  @ApiProperty({ example: 0, description: 'Σ base already deducted this year under the section.' })
  tdsPaidThisYear!: number;

  @ApiProperty({ example: true })
  panPresent!: boolean;

  @ApiProperty({
    type: PaymentBankDto,
    nullable: true,
    description: "The party's default bank account.",
  })
  bank!: PaymentBankDto | null;

  @ApiProperty({
    example: 'Sundaram Facility Services',
    description: 'Who a cheque is made out to.',
  })
  favouringName!: string;
}

export class PaymentOpenItemsSummaryDto implements PaymentOpenItemsSummary {
  @ApiProperty({ example: 60750 })
  totalPending!: number;

  @ApiProperty({ example: 2 })
  billCount!: number;

  @ApiProperty({ example: 1 })
  overdueCount!: number;

  @ApiProperty({
    example: 4000,
    description:
      'Σ pending on the debits we hold — advances paid, debit notes. Named as on /receipts: ' +
      'on a payment the held items are the DR side.',
  })
  creditsHeld!: number;

  @ApiProperty({ example: 0 })
  pdcHeld!: number;
}

export class PaymentOpenItemsPayloadDto implements PaymentOpenItemsPayload {
  @ApiProperty({ type: PayableBillDto, isArray: true, description: 'Never paged.' })
  bills!: PayableBillDto[];

  @ApiProperty({
    type: OpenCreditDto,
    isArray: true,
    description: 'The debits we hold. drCr is DR on every row.',
  })
  credits!: OpenCreditDto[];

  @ApiProperty({ type: PaymentOpenItemsSummaryDto })
  summary!: PaymentOpenItemsSummaryDto;

  @ApiProperty({ type: PaymentOpenItemsPartyDto })
  party!: PaymentOpenItemsPartyDto;
}

export class PaymentOpenItemsSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '2 open bill(s) and 1 debit(s) held for Sundaram Facility Services' })
  message!: string;

  @ApiProperty({ type: PaymentOpenItemsPayloadDto })
  data!: PaymentOpenItemsPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.2  party-context
// ═══════════════════════════════════════════════════════════════════════════

export class PartyRecentPaymentDto implements PartyRecentPayment {
  @ApiProperty({ format: 'uuid' })
  voucherId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ nullable: true, example: 'pmt00017' })
  voucherRefno!: string | null;

  @ApiProperty({ example: '2026-09-02' })
  voucherDate!: string;

  @ApiProperty({ example: 20000 })
  docAmount!: number;

  @ApiProperty({ example: 20000 })
  adjustAmount!: number;

  @ApiProperty({ nullable: true, example: 'Cheque, NEFT' })
  instruments!: string | null;
}

export class PartyChequeOutDto implements PartyChequeOut {
  @ApiProperty({ format: 'uuid' })
  pdcId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ example: '000123', description: 'The leaf.' })
  instrumentNo!: string;

  @ApiProperty({ example: '2026-09-20' })
  instrumentDate!: string;

  @ApiProperty({ example: 50000 })
  amount!: number;

  @ApiProperty({ nullable: true, example: 'KVB' })
  bankName!: string | null;

  @ApiProperty({ nullable: true, example: 'KVB-2026-A' })
  bookNo!: string | null;

  @ApiProperty({ enum: PdcStatus, example: PdcStatus.HELD })
  status!: PdcStatus;

  @ApiProperty({ nullable: true, format: 'uuid' })
  voucherId!: string | null;

  @ApiProperty({ nullable: true, example: 'pmt00018' })
  voucherRefno!: string | null;
}

export class PaymentPartyContextSummaryDto implements PaymentPartyContextSummary {
  @ApiProperty({
    example: 56750,
    description: 'What we owe NET: payables less the debits we hold.',
  })
  totalBalance!: number;

  @ApiProperty({ example: 60750 })
  totalOutstanding!: number;

  @ApiProperty({
    example: 4000,
    description: 'Σ pending on the debits we hold against them (DR). Named as on /receipts.',
  })
  totalCredits!: number;

  @ApiProperty({
    example: 50000,
    description: 'Our post-dated cheques to this party, not yet matured.',
  })
  chequesOutstanding!: number;
}

export class PaymentPartyContextPayloadDto implements PaymentPartyContextPayload {
  @ApiProperty({ format: 'uuid' })
  partyId!: string;

  @ApiProperty({ example: 'Sundaram Facility Services' })
  partyName!: string;

  @ApiProperty({ type: PaymentPartyContextSummaryDto })
  summary!: PaymentPartyContextSummaryDto;

  @ApiProperty({
    type: PartyRecentPaymentDto,
    isArray: true,
    description: 'The last ten POSTED payments.',
  })
  lastPayments!: PartyRecentPaymentDto[];

  @ApiProperty({
    type: PartyChequeOutDto,
    isArray: true,
    description: 'Our cheques to them still HELD.',
  })
  ourChequesOut!: PartyChequeOutDto[];
}

export class PaymentPartyContextSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Party context fetched successfully' })
  message!: string;

  @ApiProperty({ type: PaymentPartyContextPayloadDto })
  data!: PaymentPartyContextPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  The payment's parts
// ═══════════════════════════════════════════════════════════════════════════

export class PaymentBeneficiaryResponseDto implements PaymentBeneficiary {
  @ApiProperty({ nullable: true, example: 'Sundaram Facility Services' })
  name!: string | null;

  @ApiProperty({ nullable: true, example: '1234567890' })
  accountNo!: string | null;

  @ApiProperty({ nullable: true, example: 'KVBL0001234' })
  ifsc!: string | null;
}

export class PaymentTenderChequeDto implements PaymentTenderCheque {
  @ApiProperty({ format: 'uuid', description: 'The book the leaf comes from (or came from).' })
  chequeBookId!: string;

  @ApiProperty({ nullable: true, example: 'CB-0007' })
  bookNo!: string | null;

  @ApiProperty({ nullable: true, example: 'Sundaram Facility Services' })
  favouring!: string | null;

  @ApiProperty({ example: true })
  acPayee!: boolean;

  @ApiProperty({ nullable: true })
  bankBranch!: string | null;

  @ApiProperty({ nullable: true })
  ifsc!: string | null;

  @ApiProperty({ nullable: true })
  micr!: string | null;

  @ApiProperty({ nullable: true })
  drawerName!: string | null;
}

export class PaymentTenderDto extends ReceiptTenderDto implements PaymentTender {
  @ApiProperty({
    type: PaymentBeneficiaryResponseDto,
    nullable: true,
    description: 'On a transfer row: who the money went to. Null on cash and on a cheque.',
  })
  beneficiary!: PaymentBeneficiaryResponseDto | null;

  @ApiProperty({
    type: PaymentTenderChequeDto,
    nullable: true,
    description:
      "On a cheque row: the book and how the cheque is made out — the save's own `cheque {}`, " +
      'sent back so a reopened draft can be saved without picking the book again. From the ' +
      "draft's stored detail, or once posted from the register row. Null on every other row.",
  })
  cheque!: PaymentTenderChequeDto | null;
}

export class PaymentOtherLineDto extends ReceiptOtherLineDto implements PaymentOtherLine {
  @ApiProperty({
    nullable: true,
    format: 'uuid',
    description: 'Who authorised a BALANCES_WRITTEN_BACK line.',
  })
  approvedBy!: string | null;
}

export class PaymentChequeDto implements PaymentCheque {
  @ApiProperty({ format: 'uuid' })
  pdcId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ nullable: true, example: 1 })
  tenderRowNo!: number | null;

  @ApiProperty({ example: 'CHEQUE' })
  instrumentType!: string;

  @ApiProperty({ example: '000123', description: 'The leaf the book handed out at post.' })
  instrumentNo!: string;

  @ApiProperty({ example: '2026-09-28' })
  instrumentDate!: string;

  @ApiProperty({ example: 50000 })
  amount!: number;

  @ApiProperty({ nullable: true, example: 'KVB' })
  bankName!: string | null;

  @ApiProperty({
    nullable: true,
    format: 'uuid',
    description: 'The account the cheque is drawn on.',
  })
  bankLedgerId!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  chequeBookId!: string | null;

  @ApiProperty({ nullable: true, example: 'KVB-2026-A' })
  bookNo!: string | null;

  @ApiProperty({ nullable: true, example: 'Sundaram Facility Services' })
  favouring!: string | null;

  @ApiProperty({ example: true })
  acPayee!: boolean;

  @ApiProperty({ example: false })
  printed!: boolean;

  @ApiProperty({ example: 0 })
  printCount!: number;

  @ApiProperty({ enum: PdcStatus, example: PdcStatus.HELD })
  status!: PdcStatus;

  @ApiProperty({ nullable: true, format: 'uuid' })
  voucherId!: string | null;
}

export class PaymentDraftPayloadDto implements PaymentDraftPayload {
  @ApiProperty({ type: ReceiptHeaderDto })
  header!: ReceiptHeaderDto;

  @ApiProperty({ type: PaymentTenderDto, isArray: true })
  tenders!: PaymentTenderDto[];

  @ApiProperty({
    type: PaymentOtherLineDto,
    isArray: true,
    description:
      "The server's canonical set — the client's lines plus BANK_CHARGES and TDS_PAYABLE it seeded.",
  })
  otherLines!: PaymentOtherLineDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: [],
    description: 'Always empty on a payment: TDS is seeded, not reported.',
  })
  expectedRoles!: string[];
}

export class PaymentDraftSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Payment draft saved successfully' })
  message!: string;

  @ApiProperty({ type: PaymentDraftPayloadDto })
  data!: PaymentDraftPayloadDto;
}

export class PaymentPayloadDto implements PaymentPayload {
  @ApiProperty({ type: ReceiptHeaderDto })
  header!: ReceiptHeaderDto;

  @ApiProperty({ type: PaymentTenderDto, isArray: true })
  tenders!: PaymentTenderDto[];

  @ApiProperty({
    type: PaymentOtherLineDto,
    isArray: true,
    description: 'Empty once posted — the lines are legs now.',
  })
  otherLines!: PaymentOtherLineDto[];

  @ApiProperty({ type: ReceiptLegDto, isArray: true })
  legs!: ReceiptLegDto[];

  @ApiProperty({
    type: ReceiptAllocationDto,
    isArray: true,
    description: 'Rows that settle a bill with money or a deduction.',
  })
  allocations!: ReceiptAllocationDto[];

  @ApiProperty({
    type: ReceiptAllocationDto,
    isArray: true,
    description: 'The debit PAIRS — two per debit applied.',
  })
  creditsApplied!: ReceiptAllocationDto[];

  @ApiProperty({
    type: PaymentChequeDto,
    isArray: true,
    description: 'One register row per cheque issued.',
  })
  chequesIssued!: PaymentChequeDto[];

  @ApiProperty({ type: ReceiptPdcVoucherDto, isArray: true })
  pdcVouchers!: ReceiptPdcVoucherDto[];

  @ApiProperty({
    type: ReceiptAdvanceBillDto,
    isArray: true,
    description: 'One ADVANCE (DR) bill per voucher with a remainder.',
  })
  advanceBills!: ReceiptAdvanceBillDto[];
}

export class PaymentSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Payment fetched successfully' })
  message!: string;

  @ApiProperty({ type: PaymentPayloadDto })
  data!: PaymentPayloadDto;
}

export class PaymentHeaderSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Payment header updated successfully' })
  message!: string;

  @ApiProperty({ type: ReceiptHeaderDto })
  data!: ReceiptHeaderDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.4  the post
// ═══════════════════════════════════════════════════════════════════════════

export class PaymentIssuedLeafDto {
  @ApiProperty({ example: 1 })
  tdRowNo!: number;

  @ApiProperty({ format: 'uuid' })
  apdId!: string;

  @ApiProperty({ example: '2026-2027' })
  apdAccYear!: string;

  @ApiProperty({ example: '000123' })
  leaf!: string;

  @ApiProperty({ example: 'KVB-2026-A' })
  bookNo!: string;
}

/** A never-blocking finding of the post (VoucherWarning). */
export class PaymentPostWarningDto {
  @ApiProperty({
    example: 'STATUTORY_40A3',
    description: 'STATUTORY_40A3 · TILL_APPROVAL_REQUIRED',
  })
  code!: string;

  @ApiProperty({ example: 'WARN', enum: ['INFO', 'WARN'] })
  level!: 'INFO' | 'WARN';

  @ApiProperty({
    example:
      'Cash paid to Ravi Traders on 2026-10-08 comes to 12000.00, above the 40A(3) limit of 10000.00 …',
  })
  message!: string;

  @ApiPropertyOptional({ example: 'tenders' })
  field?: string;

  @ApiProperty({ example: false })
  overridable!: boolean;
}

export class PaymentPostPayloadDto extends PaymentPayloadDto implements PaymentPostPayload {
  @ApiProperty({ type: ReceiptNumberedVoucherDto, isArray: true })
  numberedVouchers!: ReceiptNumberedVoucherDto[];

  @ApiProperty({ type: ReceiptBillAfterDto, isArray: true })
  billsAfter!: ReceiptBillAfterDto[];

  @ApiProperty({ example: 0 })
  totalOnAccount!: number;

  @ApiProperty({
    type: PaymentPostWarningDto,
    isArray: true,
    description:
      'STATUTORY_40A3 (cash to one payee in a day above the 40A(3) limit; a company REFUSE row ' +
      'answers 422 instead) and TILL_APPROVAL_REQUIRED (INFO, the CASH_PAYMENT rule).',
  })
  warnings!: PaymentPostWarningDto[];

  @ApiPropertyOptional({
    type: TillApprovalNeedDto,
    nullable: true,
    description: 'In a till session: what the CASH_PAYMENT rule would ask. Reported until phase 3.',
  })
  approval!: TillApprovalNeedDto | null;

  @ApiProperty({
    type: PaymentIssuedLeafDto,
    isArray: true,
    description: 'The leaf each cheque row got.',
  })
  cheques!: PaymentIssuedLeafDto[];
}

export class PaymentPostSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Payment pmt00018 posted' })
  message!: string;

  @ApiProperty({ type: PaymentPostPayloadDto })
  data!: PaymentPostPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  R20  the amend
// ═══════════════════════════════════════════════════════════════════════════

export class PaymentAmendUnwoundDto {
  @ApiProperty({ example: 3 })
  adjustmentsReversed!: number;

  @ApiProperty({ example: 4 })
  legsRemoved!: number;

  @ApiProperty({ example: 1 })
  pdcVouchersRemoved!: number;

  @ApiProperty({
    example: 1,
    description:
      'Leaves of the old post now CANCELLED ("Amended into revision N"). They stay on the ' +
      'register and in the book — a leaf once out is never handed out again. Each carries ' +
      'apd_amended_into_revision = N, so it does not block a later cancel or amend (notes 63).',
  })
  chequesRemoved!: number;

  @ApiProperty({ example: 1 })
  advanceBillsRemoved!: number;

  @ApiProperty({ example: 2 })
  tendersRemoved!: number;

  @ApiProperty({ example: 1, description: 'TDS register rows reversed.' })
  tdsReversed!: number;
}

export class PaymentAmendPayloadDto extends PaymentPostPayloadDto implements PaymentAmendPayload {
  @ApiProperty({ example: 0 })
  fromRevision!: number;

  @ApiProperty({ example: 1 })
  toRevision!: number;

  @ApiProperty({ example: 'paid to the wrong bank account' })
  editRemark!: string;

  @ApiProperty({ type: PaymentAmendUnwoundDto })
  unwound!: PaymentAmendUnwoundDto;
}

export class PaymentAmendSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Payment pmt00018 amended — now revision 1' })
  message!: string;

  @ApiProperty({ type: PaymentAmendPayloadDto })
  data!: PaymentAmendPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.8  the cancel
// ═══════════════════════════════════════════════════════════════════════════

export class PaymentCancelPayloadDto
  extends ReceiptStatusPayloadDto
  implements PaymentCancelPayload
{
  @ApiProperty({ type: ReceiptReversalDto, isArray: true })
  reversals!: ReceiptReversalDto[];

  @ApiProperty({ type: ReceiptBillReopenedDto, isArray: true })
  billsReopened!: ReceiptBillReopenedDto[];

  @ApiProperty({ type: String, isArray: true, format: 'uuid' })
  chequesCancelled!: string[];

  @ApiProperty({ type: String, isArray: true, format: 'uuid' })
  advanceBillsRemoved!: string[];

  @ApiProperty({ example: 1 })
  tdsReversed!: number;
}

export class PaymentCancelSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Payment pmt00018 cancelled — 1 voucher(s) reversed' })
  message!: string;

  @ApiProperty({ type: PaymentCancelPayloadDto })
  data!: PaymentCancelPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Delete — a DRAFT thrown away
// ═══════════════════════════════════════════════════════════════════════════

export class PaymentDeletePayloadDto implements PaymentDeletePayload {
  @ApiProperty({ format: 'uuid' })
  avhVoucherId!: string;

  @ApiProperty({ example: '2026-2027' })
  avhAccYear!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avhVoucherRefno!: string | null;

  @ApiProperty({ enum: VoucherStatus, example: VoucherStatus.DRAFT })
  status!: VoucherStatus;

  @ApiProperty({ example: '2026-09-28T13:40:02.000Z' })
  deletedOn!: string;

  @ApiProperty({ format: 'uuid' })
  deletedBy!: string;

  @ApiProperty({ example: 2 })
  tendersDeleted!: number;

  @ApiProperty({ example: 1 })
  otherLinesDeleted!: number;
}

export class PaymentDeleteSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Draft payment deleted — 2 tender row(s) removed' })
  message!: string;

  @ApiProperty({ type: PaymentDeletePayloadDto })
  data!: PaymentDeletePayloadDto;
}
