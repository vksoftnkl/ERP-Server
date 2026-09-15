import { ApiProperty } from '@nestjs/swagger';
import {
  BillAdjType,
  BillSettlementMode,
  BillStatus,
  BillType,
  DrCr,
  PdcStatus,
  TcsBasis,
  VoucherStatus,
} from '../types/receipt-enum';
import type {
  OpenBill,
  OpenCredit,
  OpenItemsParty,
  OpenItemsPayload,
  OpenItemsSummary,
  PartyContextPayload,
  PartyPendingCheque,
  PartyRecentReceipt,
  ReceiptAdvanceBill,
  ReceiptAllocation,
  ReceiptCancelPayload,
  ReceiptCheque,
  ReceiptDraftPayload,
  ReceiptHeader,
  ReceiptLeg,
  ReceiptOtherLine,
  ReceiptPayload,
  ReceiptPdcVoucher,
  ReceiptPostPayload,
  ReceiptStatusPayload,
  ReceiptTender,
  RegularisePdcPayload,
} from '../types/receipt-api.types';

/**
 * The Swagger shapes — every payload this module returns, declared in full.
 *
 * ── Why each class says `implements` ─────────────────────────────────────
 * A decorator file is a SECOND copy of a shape that already exists in
 * `types/receipt-api.types.ts`, and a second copy drifts the first time a field
 * is added to one and not the other. `implements` makes that a compile error:
 * add `pdcHeld` to `OpenBill` and forget it here, and the build fails naming
 * the class. The types stay the source of truth; these are the rendering of
 * them.
 *
 * ── Nullable is not optional ─────────────────────────────────────────────
 * Every field of a response payload here is ALWAYS present; some are null. So
 * they are `@ApiProperty({ nullable: true })` and stay in the schema's
 * `required` list. `@ApiPropertyOptional` would say "may be ABSENT", which is a
 * different promise: a generated client would type the field
 * `string | undefined` when what it actually receives is `string | null`, and
 * the `if (x === undefined)` written against that is a check that never fires.
 *
 * Request DTOs are the opposite case and use `@ApiPropertyOptional` correctly —
 * there a field really may be left out.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Errors
// ═══════════════════════════════════════════════════════════════════════════

export class ReceiptErrorFieldDto {
  @ApiProperty({
    example: 'allocations.1.amount',
    description:
      'The API field the error belongs to, including its array index, so the screen can put the ' +
      'message beside the box that is wrong.',
  })
  field!: string;

  @ApiProperty({
    example: 'Bill SB/2026/0412 has 12150.00 pending, but this receipt settles 12650.00 against it',
  })
  message!: string;
}

export class ReceiptErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({
    example: 'Validation failed',
    description: 'The envelope. The detail an operator reads is on the field errors below.',
  })
  message!: string;

  @ApiProperty({ type: ReceiptErrorFieldDto, isArray: true })
  errors!: ReceiptErrorFieldDto[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.1  open-items
// ═══════════════════════════════════════════════════════════════════════════

export class OpenBillDto implements OpenBill {
  @ApiProperty({ format: 'uuid' })
  billId!: string;

  @ApiProperty({
    example: '2026-2027',
    description: 'Post it back alongside billId — the table is partitioned on it.',
  })
  billAccYear!: string;

  @ApiProperty({ enum: BillType, example: BillType.SALES })
  billType!: BillType;

  @ApiProperty({ example: 'bil00031' })
  docRefno!: string;

  @ApiProperty({ example: '2026-09-08' })
  docDate!: string;

  @ApiProperty({ nullable: true, example: '2026-10-08' })
  dueDate!: string | null;

  @ApiProperty({ example: 48600 })
  billAmount!: number;

  @ApiProperty({ example: 48600, description: 'GENERATED: bill − alloc − disc − writeoff.' })
  pendingAmount!: number;

  @ApiProperty({ enum: BillStatus, example: BillStatus.OPEN })
  status!: BillStatus;

  @ApiProperty({
    example: 0,
    description: '0 when the bill has no due date — nothing to be late against.',
  })
  daysOverdue!: number;

  @ApiProperty({
    example: 0,
    description:
      'Post-dated money already promised against this bill and not yet matured. Without it, a bill ' +
      'settled by a cheque maturing next week is indistinguishable from an unpaid one, and it ' +
      'gets collected twice.',
  })
  pdcHeld!: number;

  @ApiProperty({
    example: 200,
    description:
      'R16 — what accounts.ppd_slabs suggests for this bill at onDate, based on what is LEFT. ' +
      '0 when nothing qualifies. A SUGGESTION: whatever the operator leaves in the box is what ' +
      'posts, and the server never re-seeds it.',
  })
  ppdSuggested!: number;
}

export class OpenCreditDto implements OpenCredit {
  @ApiProperty({ format: 'uuid' })
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  billAccYear!: string;

  @ApiProperty({ enum: BillType, example: BillType.ADVANCE })
  billType!: BillType;

  @ApiProperty({ example: 'rct00012' })
  docRefno!: string;

  @ApiProperty({ example: '2026-08-02' })
  docDate!: string;

  @ApiProperty({
    example: 4000,
    description: 'Face value. Tooltip only — the panel adjusts against what is left.',
  })
  billAmount!: number;

  @ApiProperty({ example: 4000 })
  pendingAmount!: number;

  @ApiProperty({ nullable: true, example: 'ACCOUNTS' })
  srcModule!: string | null;

  @ApiProperty({ nullable: true, example: 'RECEIPT_ADVANCE' })
  srcDocType!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  srcDocId!: string | null;

  @ApiProperty({ nullable: true, example: '2026-2027' })
  srcAccYear!: string | null;

  @ApiProperty({ nullable: true })
  narration!: string | null;

  @ApiProperty({ enum: BillStatus, example: BillStatus.OPEN })
  status!: BillStatus;

  @ApiProperty({
    enum: DrCr,
    example: DrCr.CR,
    description:
      'CR = the company owes the party. ADVANCE is bidirectional in this schema, so the side is a ' +
      'filter in its own right, not something derivable from billType.',
  })
  drCr!: DrCr;

  @ApiProperty({
    enum: BillAdjType,
    example: BillAdjType.ADVANCE_ADJUST,
    description:
      'How it settles. Decided server-side so a client cannot drift from ck_abj_adj_type.',
  })
  adjType!: BillAdjType;

  @ApiProperty({ enum: BillSettlementMode, example: BillSettlementMode.ADVANCE })
  settlementMode!: BillSettlementMode;
}

export class OpenItemsSummaryDto implements OpenItemsSummary {
  @ApiProperty({ example: 60750, description: 'Receivables only. Credits are their own figure.' })
  totalPending!: number;

  @ApiProperty({ example: 2 })
  billCount!: number;

  @ApiProperty({ example: 1 })
  overdueCount!: number;

  @ApiProperty({ example: 4000 })
  creditsHeld!: number;

  @ApiProperty({ example: 0 })
  pdcHeld!: number;
}

export class OpenItemsPartyDto implements OpenItemsParty {
  @ApiProperty({ format: 'uuid' })
  ledId!: string;

  @ApiProperty({ example: 'Sri Krishna Traders' })
  ledName!: string;

  @ApiProperty({ nullable: true, example: 'Sundry Debtors' })
  groupName!: string | null;

  @ApiProperty({ example: true })
  isBillByBill!: boolean;

  @ApiProperty({ example: false })
  isTdsApplicable!: boolean;

  @ApiProperty({ nullable: true, example: 'Company' })
  tdsDeducteeType!: string | null;

  @ApiProperty({ example: false })
  isTcsApplicable!: boolean;

  @ApiProperty({
    enum: TcsBasis,
    example: TcsBasis.RECEIPT,
    description: 'Echoes accounts.tcs_basis, so the client seeds the same line the server would.',
  })
  tcsBasis!: TcsBasis;

  @ApiProperty({ nullable: true })
  tanNo!: string | null;
}

export class OpenItemsPayloadDto implements OpenItemsPayload {
  @ApiProperty({
    type: OpenBillDto,
    isArray: true,
    description: 'Never paged. A capped list is a wrong collection.',
  })
  bills!: OpenBillDto[];

  @ApiProperty({ type: OpenCreditDto, isArray: true })
  credits!: OpenCreditDto[];

  @ApiProperty({ type: OpenItemsSummaryDto })
  summary!: OpenItemsSummaryDto;

  @ApiProperty({ type: OpenItemsPartyDto })
  party!: OpenItemsPartyDto;
}

export class OpenItemsSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '2 open bill(s) and 1 credit(s) for Sri Krishna Traders' })
  message!: string;

  @ApiProperty({ type: OpenItemsPayloadDto })
  data!: OpenItemsPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.2  party-context
// ═══════════════════════════════════════════════════════════════════════════

export class PartyRecentReceiptDto implements PartyRecentReceipt {
  @ApiProperty({ format: 'uuid' })
  voucherId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ nullable: true, example: 'rct00017' })
  voucherRefno!: string | null;

  @ApiProperty({ example: '2026-09-02' })
  voucherDate!: string;

  @ApiProperty({ example: 20000 })
  docAmount!: number;

  @ApiProperty({ example: 20000 })
  adjustAmount!: number;

  @ApiProperty({ nullable: true, example: 'Cash, UPI' })
  instruments!: string | null;
}

export class PartyPendingChequeDto implements PartyPendingCheque {
  @ApiProperty({ format: 'uuid' })
  pdcId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ example: '445123' })
  instrumentNo!: string;

  @ApiProperty({ example: '2026-09-20' })
  instrumentDate!: string;

  @ApiProperty({ example: 50000 })
  amount!: number;

  @ApiProperty({ nullable: true, example: 'KVB' })
  bankName!: string | null;

  @ApiProperty({
    enum: PdcStatus,
    example: PdcStatus.HELD,
    description: 'HELD or DEPOSITED — money still in flight.',
  })
  status!: PdcStatus;

  @ApiProperty({ nullable: true, format: 'uuid' })
  voucherId!: string | null;

  @ApiProperty({ nullable: true, example: 'rct00018' })
  voucherRefno!: string | null;
}

export class PartyContextPayloadDto implements PartyContextPayload {
  @ApiProperty({ format: 'uuid' })
  partyId!: string;

  @ApiProperty({
    type: PartyRecentReceiptDto,
    isArray: true,
    description: 'The last ten POSTED receipts.',
  })
  lastReceipts!: PartyRecentReceiptDto[];

  @ApiProperty({ type: PartyPendingChequeDto, isArray: true })
  pendingCheques!: PartyPendingChequeDto[];
}

export class PartyContextSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Party context fetched successfully' })
  message!: string;

  @ApiProperty({ type: PartyContextPayloadDto })
  data!: PartyContextPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  The receipt's parts
// ═══════════════════════════════════════════════════════════════════════════

export class ReceiptTenderDto implements ReceiptTender {
  @ApiProperty({ format: 'uuid' })
  tdId!: string;

  @ApiProperty({ example: 1 })
  tdRowNo!: number;

  @ApiProperty({ format: 'uuid' })
  tdTenderId!: string;

  @ApiProperty({ nullable: true, example: 'Cheque' })
  tdTenderName!: string | null;

  @ApiProperty({ example: 5 })
  tdTenderTypeId!: number;

  @ApiProperty({ format: 'uuid' })
  tdTenderLedgerId!: string;

  @ApiProperty({ example: 50000 })
  tdAmount!: number;

  @ApiProperty({ example: 0 })
  tdSurchargePerc!: number;

  @ApiProperty({
    example: 0,
    description: 'What the CUSTOMER was charged for paying this way. Income.',
  })
  tdSurchargeAmt!: number;

  @ApiProperty({
    example: 10,
    description: "The acquirer's cut, which never reaches the bank. Our expense.",
  })
  tdMdrAmt!: number;

  @ApiProperty({ example: 0 })
  tdReceivedAmt!: number;

  @ApiProperty({ example: 0 })
  tdChangeAmt!: number;

  @ApiProperty({ nullable: true, example: '445123' })
  tdRefNo!: string | null;

  @ApiProperty({ nullable: true, example: 'KVB' })
  tdBankName!: string | null;

  @ApiProperty({ nullable: true })
  tdPayerVpa!: string | null;

  @ApiProperty({ nullable: true, example: '2026-09-20' })
  tdInstrumentDate!: string | null;

  @ApiProperty({
    example: true,
    description: 'COMPUTED from tdInstrumentDate against the receipt date. Never sent by a client.',
  })
  tdIsPdc!: boolean;

  @ApiProperty({
    nullable: true,
    format: 'uuid',
    description:
      'The voucher carrying THIS instrument — which for a post-dated cheque is not the receipt. ' +
      'NULL until post.',
  })
  tdVoucherId!: string | null;
}

export class ReceiptOtherLineDto implements ReceiptOtherLine {
  @ApiProperty({
    example: 1,
    description: '1-based and stable — otherLineBills[].lineNo refers to it.',
  })
  lineNo!: number;

  @ApiProperty({
    nullable: true,
    example: 'TDS_RECEIVABLE',
    description: 'NULL on a free-ledger line, which is then invisible to every role-based report.',
  })
  role!: string | null;

  @ApiProperty({ format: 'uuid' })
  ledgerId!: string;

  @ApiProperty({ nullable: true, example: 'TDS Receivable' })
  ledgerName!: string | null;

  @ApiProperty({ enum: DrCr, example: DrCr.DR })
  drCr!: DrCr;

  @ApiProperty({ example: 700 })
  amount!: number;

  @ApiProperty({
    example: true,
    description:
      'Does this line REDUCE what the party owes on a bill? A DR line that settles nothing still ' +
      'credits the party — it simply flows to on account instead.',
  })
  settlesBill!: boolean;

  @ApiProperty({ nullable: true, example: 'damage claim CN-88' })
  narration!: string | null;
}

export class ReceiptLegDto implements ReceiptLeg {
  @ApiProperty({ format: 'uuid' })
  avId!: string;

  @ApiProperty({ example: 1 })
  avRowNo!: number;

  @ApiProperty({ enum: DrCr, example: DrCr.DR })
  avDrCr!: DrCr;

  @ApiProperty({ format: 'uuid' })
  avLedgerId!: string;

  @ApiProperty({ nullable: true, example: 'KVB Current A/c' })
  avLedgerName!: string | null;

  @ApiProperty({ example: 14990 })
  avAmount!: number;

  @ApiProperty({
    nullable: true,
    example: 'BANK_CHARGES',
    description:
      'WHY this leg exists. NULL on the party leg and on every instrument leg; set on every ' +
      'other-ledger leg, so "TDS deducted this quarter" is a WHERE clause.',
  })
  avRole!: string | null;

  @ApiProperty({ nullable: true })
  avRemarks!: string | null;
}

export class ReceiptAllocationDto implements ReceiptAllocation {
  @ApiProperty({ format: 'uuid' })
  abjId!: string;

  @ApiProperty({ format: 'uuid' })
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  billAccYear!: string;

  @ApiProperty({ example: 'bil00031' })
  docRefno!: string;

  @ApiProperty({ example: '2026-09-08' })
  docDate!: string;

  @ApiProperty({ enum: BillAdjType, example: BillAdjType.ALLOCATION })
  adjType!: BillAdjType;

  @ApiProperty({
    nullable: true,
    enum: BillSettlementMode,
    example: BillSettlementMode.MIXED,
  })
  settlementMode!: BillSettlementMode | null;

  @ApiProperty({ enum: DrCr, example: DrCr.CR })
  drCr!: DrCr;

  @ApiProperty({ example: 48600 })
  amount!: number;

  @ApiProperty({
    example: '2026-09-20',
    description:
      "The receipt's date, except on a post-dated cheque's rows, which are dated the CHEQUE.",
  })
  adjDate!: string;

  @ApiProperty({ example: true })
  isPostDated!: boolean;

  @ApiProperty({
    example: false,
    description:
      'A post-dated row whose date has arrived — it now counts against the bill. Until then it is ' +
      'a promise, and the bill stays open.',
  })
  matured!: boolean;

  @ApiProperty({ nullable: true, format: 'uuid' })
  voucherId!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid', description: 'acc_pdc_register.apd_id.' })
  chequeId!: string | null;

  @ApiProperty({
    nullable: true,
    format: 'uuid',
    description: 'Set only on a credit pair — the opposite bill. ck_abj_against demands it.',
  })
  againstBillId!: string | null;

  @ApiProperty({ nullable: true })
  againstBillRefno!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  approvedBy!: string | null;

  @ApiProperty({ nullable: true })
  remarks!: string | null;
}

export class ReceiptChequeDto implements ReceiptCheque {
  @ApiProperty({ format: 'uuid' })
  pdcId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ nullable: true, example: 3 })
  tenderRowNo!: number | null;

  @ApiProperty({ example: 'CHEQUE' })
  instrumentType!: string;

  @ApiProperty({ example: '445123' })
  instrumentNo!: string;

  @ApiProperty({ example: '2026-09-20' })
  instrumentDate!: string;

  @ApiProperty({ example: 50000 })
  amount!: number;

  @ApiProperty({ nullable: true, example: 'KVB' })
  bankName!: string | null;

  @ApiProperty({ nullable: true, example: 'Trichy' })
  bankBranch!: string | null;

  @ApiProperty({ nullable: true, example: 'KVBL0001234' })
  ifsc!: string | null;

  @ApiProperty({ nullable: true, example: 'Sri Krishna Traders' })
  drawerName!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  bankLedgerId!: string | null;

  @ApiProperty({ enum: PdcStatus, example: PdcStatus.HELD })
  status!: PdcStatus;

  @ApiProperty({ example: 'ON_RECEIPT' })
  postingMode!: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  voucherId!: string | null;
}

export class ReceiptPdcVoucherDto implements ReceiptPdcVoucher {
  @ApiProperty({ format: 'uuid' })
  voucherId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ nullable: true, example: 'rct00019' })
  voucherRefno!: string | null;

  @ApiProperty({ example: '2026-09-20', description: 'Dated the CHEQUE, not the receipt (R2).' })
  voucherDate!: string;

  @ApiProperty({ example: 50000 })
  docAmount!: number;

  @ApiProperty({ example: 35550 })
  adjustAmount!: number;

  @ApiProperty({ enum: VoucherStatus, example: VoucherStatus.POSTED })
  status!: VoucherStatus;

  @ApiProperty({ type: ReceiptLegDto, isArray: true })
  legs!: ReceiptLegDto[];
}

export class ReceiptAdvanceBillDto implements ReceiptAdvanceBill {
  @ApiProperty({ format: 'uuid' })
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  billAccYear!: string;

  @ApiProperty({
    example: 'rct00019',
    description: "The voucher's own number — unique by construction.",
  })
  docRefno!: string;

  @ApiProperty({ example: '2026-09-20' })
  docDate!: string;

  @ApiProperty({ example: 14450 })
  billAmount!: number;

  @ApiProperty({ example: 14450 })
  pendingAmount!: number;

  @ApiProperty({ nullable: true, format: 'uuid' })
  voucherId!: string | null;
}

export class ReceiptHeaderDto implements ReceiptHeader {
  @ApiProperty({ format: 'uuid' })
  avhVoucherId!: string;

  @ApiProperty({ format: 'uuid' })
  avhCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  avhBranchId!: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  avhTenantId!: string | null;

  @ApiProperty({ example: '2026-2027' })
  avhAccYear!: string;

  @ApiProperty({
    example: 10,
    description: "Resolved from vchr_type_code 'Rct' — the id is a serial.",
  })
  avhVoucherTypeId!: number;

  @ApiProperty({
    nullable: true,
    example: '18',
    description: 'BigInt, carried as a string — JSON has no 64-bit integer.',
  })
  avhVoucherNo!: string | null;

  @ApiProperty({ nullable: true, example: '412' })
  avhVoucherSlno!: string | null;

  @ApiProperty({
    nullable: true,
    example: 'rct00018',
    description:
      'NULL only on a DRAFT that has never been approved — ck_avh_no permits that, and only that.',
  })
  avhVoucherRefno!: string | null;

  @ApiProperty({ example: '2026-09-14' })
  avhVoucherDate!: string;

  @ApiProperty({ format: 'uuid' })
  avhPartyId!: string;

  @ApiProperty({ nullable: true, example: 'Sri Krishna Traders' })
  avhPartyName!: string | null;

  @ApiProperty({
    type: String,
    isArray: true,
    format: 'uuid',
    description: 'Collected by. One salesman; more is refused.',
  })
  avhEmployeeId!: string[];

  @ApiProperty({ nullable: true })
  avhUsrRefno!: string | null;

  @ApiProperty({ nullable: true })
  avhDocRefno!: string | null;

  @ApiProperty({ nullable: true, example: '2026-09-14' })
  avhDocDate!: string | null;

  @ApiProperty({
    example: 70000,
    description: 'Σ tdAmount. Derived, never accepted from a client.',
  })
  avhDocAmount!: number;

  @ApiProperty({ example: 55550, description: "Σ of this voucher's settling rows. Derived." })
  avhAdjustAmount!: number;

  @ApiProperty({
    example: 0,
    description: 'A receipt collects what the bills say. Nothing to round.',
  })
  avhRoundOff!: number;

  @ApiProperty({
    example: 25550,
    description: 'Derived from the legs before the status moves to POSTED.',
  })
  avhTotalDebit!: number;

  @ApiProperty({ example: 25550 })
  avhTotalCredit!: number;

  @ApiProperty({ nullable: true })
  avhRemarks!: string | null;

  @ApiProperty({ enum: VoucherStatus, example: VoucherStatus.POSTED })
  avhVoucherStatus!: VoucherStatus;

  @ApiProperty({ nullable: true, format: 'date-time' })
  avhStatusOn!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  avhStatusBy!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  avhPostedOn!: string | null;

  @ApiProperty({ nullable: true })
  avhCancelReason!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  avhReversalVoucherId!: string | null;

  @ApiProperty({
    nullable: true,
    format: 'uuid',
    description:
      'Set on a post-dated cheque voucher — it points back at its receipt, and is why it does not list separately.',
  })
  avhAgainstVoucherId!: string | null;

  @ApiProperty({
    example: 0,
    description: 'A cache of COUNT(*) over print_log. Refresh with /sync-print-count.',
  })
  avhPrintCount!: number;

  @ApiProperty({ nullable: true, example: 'DESKTOP' })
  avhDeviceType!: string | null;

  @ApiProperty({ format: 'uuid' })
  avhUserId!: string;

  @ApiProperty({ format: 'date-time' })
  avhCreatedOn!: string;

  @ApiProperty({ nullable: true })
  avhCreatedBy!: string | null;

  @ApiProperty({ nullable: true, format: 'date-time' })
  avhModifiedOn!: string | null;

  @ApiProperty({ nullable: true })
  avhModifiedBy!: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.3  the draft
// ═══════════════════════════════════════════════════════════════════════════

export class ReceiptDraftPayloadDto implements ReceiptDraftPayload {
  @ApiProperty({ type: ReceiptHeaderDto })
  header!: ReceiptHeaderDto;

  @ApiProperty({ type: ReceiptTenderDto, isArray: true })
  tenders!: ReceiptTenderDto[];

  @ApiProperty({
    type: ReceiptOtherLineDto,
    isArray: true,
    description:
      "The server's canonical set — the client's lines plus the BANK_CHARGES / SURCHARGE_RECOVERED " +
      'splits it seeds from the tenders. Held in avh_draft_lines until post.',
  })
  otherLines!: ReceiptOtherLineDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['TDS_RECEIVABLE'],
    description:
      "Roles the PARTY's own flags imply a line for, that this draft has none of. REPORTED rather " +
      'than seeded because there is no TDS or TCS RATE anywhere in this schema — only the ' +
      'booleans — so the server has no amount to put on the line. The screen prompts and the ' +
      'operator keys what the customer actually withheld.',
  })
  expectedRoles!: string[];
}

export class ReceiptDraftSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Receipt draft saved successfully' })
  message!: string;

  @ApiProperty({ type: ReceiptDraftPayloadDto })
  data!: ReceiptDraftPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.5  the whole receipt
// ═══════════════════════════════════════════════════════════════════════════

export class ReceiptPayloadDto implements ReceiptPayload {
  @ApiProperty({ type: ReceiptHeaderDto })
  header!: ReceiptHeaderDto;

  @ApiProperty({ type: ReceiptTenderDto, isArray: true })
  tenders!: ReceiptTenderDto[];

  @ApiProperty({
    type: ReceiptOtherLineDto,
    isArray: true,
    description: 'Empty once posted — the lines are legs now.',
  })
  otherLines!: ReceiptOtherLineDto[];

  @ApiProperty({
    type: ReceiptLegDto,
    isArray: true,
    description: "The RECEIPT voucher's legs. A PDC voucher's are on its own row.",
  })
  legs!: ReceiptLegDto[];

  @ApiProperty({
    type: ReceiptAllocationDto,
    isArray: true,
    description:
      'The rows that settle a bill with money or a deduction — those naming no opposite bill.',
  })
  allocations!: ReceiptAllocationDto[];

  @ApiProperty({
    type: ReceiptAllocationDto,
    isArray: true,
    description:
      'The credit PAIRS — every row naming an opposite bill. Two per credit applied: one on the ' +
      'bill being settled, one on the credit being spent.',
  })
  creditsApplied!: ReceiptAllocationDto[];

  @ApiProperty({
    type: ReceiptChequeDto,
    isArray: true,
    description: 'One acc_pdc_register row per cheque, post-dated or not.',
  })
  cheques!: ReceiptChequeDto[];

  @ApiProperty({ type: ReceiptPdcVoucherDto, isArray: true })
  pdcVouchers!: ReceiptPdcVoucherDto[];

  @ApiProperty({
    type: ReceiptAdvanceBillDto,
    isArray: true,
    description: 'R7 — one per voucher that had a remainder.',
  })
  advanceBills!: ReceiptAdvanceBillDto[];
}

export class ReceiptHeaderSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Receipt header updated successfully' })
  message!: string;

  @ApiProperty({ type: ReceiptHeaderDto })
  data!: ReceiptHeaderDto;
}

export class ReceiptSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Receipt fetched successfully' })
  message!: string;

  @ApiProperty({ type: ReceiptPayloadDto })
  data!: ReceiptPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.4  the post
// ═══════════════════════════════════════════════════════════════════════════

export class ReceiptNumberedVoucherDto {
  @ApiProperty({ format: 'uuid' })
  voucherId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ nullable: true, example: 'rct00018' })
  voucherRefno!: string | null;

  @ApiProperty({ example: '2026-09-14' })
  voucherDate!: string;

  @ApiProperty({ example: 20000 })
  docAmount!: number;

  @ApiProperty({ example: 24700 })
  adjustAmount!: number;

  @ApiProperty({ example: false, description: 'True on a post-dated cheque voucher.' })
  isPdcVoucher!: boolean;
}

export class ReceiptBillAfterDto {
  @ApiProperty({ format: 'uuid' })
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  billAccYear!: string;

  @ApiProperty({ example: 'bil00031' })
  docRefno!: string;

  @ApiProperty({ example: 48600 })
  billAmount!: number;

  @ApiProperty({ example: 23900 })
  pendingAmount!: number;

  @ApiProperty({
    example: 23900,
    description:
      'Promised but not yet matured — pending will fall by this on the day the cheque matures.',
  })
  postDatedHeld!: number;
}

export class ReceiptPostPayloadDto extends ReceiptPayloadDto implements ReceiptPostPayload {
  @ApiProperty({ type: ReceiptNumberedVoucherDto, isArray: true })
  numberedVouchers!: ReceiptNumberedVoucherDto[];

  @ApiProperty({
    type: ReceiptBillAfterDto,
    isArray: true,
    description: 'The proof the settlement landed.',
  })
  billsAfter!: ReceiptBillAfterDto[];

  @ApiProperty({ example: 14450 })
  totalOnAccount!: number;
}

export class ReceiptPostSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Receipt rct00018 posted with 1 post-dated cheque voucher(s)' })
  message!: string;

  @ApiProperty({ type: ReceiptPostPayloadDto })
  data!: ReceiptPostPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.8  the cancel
// ═══════════════════════════════════════════════════════════════════════════

export class ReceiptStatusPayloadDto implements ReceiptStatusPayload {
  @ApiProperty({ format: 'uuid' })
  avhVoucherId!: string;

  @ApiProperty({ example: '2026-2027' })
  avhAccYear!: string;

  @ApiProperty({ nullable: true, example: 'rct00018' })
  avhVoucherRefno!: string | null;

  @ApiProperty({ enum: VoucherStatus, example: VoucherStatus.DRAFT })
  fromStatus!: VoucherStatus;

  @ApiProperty({ enum: VoucherStatus, example: VoucherStatus.APPROVED })
  toStatus!: VoucherStatus;

  @ApiProperty({ nullable: true, format: 'date-time' })
  avhStatusOn!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  avhStatusBy!: string | null;
}

export class ReceiptReversalDto {
  @ApiProperty({ format: 'uuid', description: 'The voucher that was reversed.' })
  ofVoucherId!: string;

  @ApiProperty({ format: 'uuid' })
  reversalVoucherId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ nullable: true, example: 'rct00020' })
  voucherRefno!: string | null;

  @ApiProperty({ example: 8 })
  legCount!: number;

  @ApiProperty({ example: 7 })
  adjustmentCount!: number;
}

export class ReceiptBillReopenedDto {
  @ApiProperty({ format: 'uuid' })
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  billAccYear!: string;

  @ApiProperty({ example: '' })
  docRefno!: string;

  @ApiProperty({ example: 48600 })
  pendingAmount!: number;
}

export class ReceiptCancelPayloadDto
  extends ReceiptStatusPayloadDto
  implements ReceiptCancelPayload
{
  @ApiProperty({
    type: ReceiptReversalDto,
    isArray: true,
    description: 'One per voucher — the receipt AND every post-dated cheque voucher.',
  })
  reversals!: ReceiptReversalDto[];

  @ApiProperty({ type: ReceiptBillReopenedDto, isArray: true })
  billsReopened!: ReceiptBillReopenedDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    format: 'uuid',
    description: 'Register rows moved to CANCELLED.',
  })
  chequesCancelled!: string[];

  @ApiProperty({ type: String, isArray: true, format: 'uuid' })
  advanceBillsRemoved!: string[];
}

export class ReceiptCancelSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Receipt rct00018 cancelled — 2 voucher(s) reversed' })
  message!: string;

  @ApiProperty({ type: ReceiptCancelPayloadDto })
  data!: ReceiptCancelPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Maintenance
//
//  There is no list-descriptor payload and no print-count payload: /list and
//  /sync-print-count are not routes. The list is a registered grid served by
//  /configured-grid-sql, and avh_print_count is a cache public.print_log owns.
// ═══════════════════════════════════════════════════════════════════════════

export class RegularisePdcPayloadDto implements RegularisePdcPayload {
  @ApiProperty({ example: '2026-09-20' })
  asOf!: string;

  @ApiProperty({ example: 3 })
  billsRegularised!: number;
}

export class RegularisePdcSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: '3 bill(s) regularised as at 2026-09-20' })
  message!: string;

  @ApiProperty({ type: RegularisePdcPayloadDto })
  data!: RegularisePdcPayloadDto;
}
