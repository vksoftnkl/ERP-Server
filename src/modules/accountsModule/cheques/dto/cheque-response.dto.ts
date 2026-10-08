import { ApiProperty } from '@nestjs/swagger';
import { PdcPostingMode, PdcStatus } from '../../receipt/types/receipt-enum';
import { ChequeDueBucket } from '../types/cheque-enum';
import type {
  ChequeBillRef,
  ChequeBouncePayload,
  ChequeCascadeReport,
  ChequeClearPayload,
  ChequeDepositPayload,
  ChequeDetailPayload,
  ChequeHistoryEntry,
  ChequeHistoryPayload,
  ChequeListPayload,
  ChequeListSummary,
  ChequeReplacePayload,
  ChequeRepresentPayload,
  ChequeReturnPayload,
  ChequeRow,
  ChequeVoucherLeg,
  ChequeVoucherRef,
  DepositSlipBankAccount,
  DepositSlipLine,
  DepositSlipPayload,
} from '../types/cheque-api.types';

/**
 * The Swagger shapes — every payload this module returns, declared in full.
 *
 * ── Why each class says `implements` ─────────────────────────────────────
 * A decorator file is a SECOND copy of a shape that already exists in
 * `types/cheque-api.types.ts`, and a second copy drifts the first time a field
 * is added to one and not the other. `implements` makes that a compile error:
 * add a field to `ChequeRow` and forget it here, and the build fails naming
 * the class. The types stay the source of truth; these are the rendering.
 *
 * ── Nullable is not optional ─────────────────────────────────────────────
 * Every field of a response payload here is ALWAYS present; some are null. So
 * they are `@ApiProperty({ nullable: true })` and stay in the schema's
 * `required` list. `@ApiPropertyOptional` would say "may be ABSENT", which is
 * a different promise: a generated client would type the field
 * `string | undefined` when what it actually receives is `string | null`, and
 * the `if (x === undefined)` written against that never fires.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  The row
// ═══════════════════════════════════════════════════════════════════════════

export class ChequeRowDto implements ChequeRow {
  @ApiProperty({ format: 'uuid' }) apdId!: string;
  @ApiProperty({ example: '2026-2027' }) apdAccYear!: string;
  @ApiProperty({ format: 'uuid' }) apdCompanyId!: string;
  @ApiProperty({ format: 'uuid' }) apdBranchId!: string;
  @ApiProperty({ example: 'R', description: 'R = received. This screen never shows P.' })
  apdTraType!: string;
  @ApiProperty({ format: 'uuid' }) apdPartyId!: string;
  @ApiProperty({ example: 'Anand Stores' }) partyName!: string;
  @ApiProperty({ example: 'CHEQUE' }) apdInstrumentType!: string;
  @ApiProperty({ example: '221870' }) apdInstrumentNo!: string;
  @ApiProperty({
    example: '2026-09-20',
    description: 'The POST-DATE written on the cheque — the maturity the due list works from.',
  })
  apdInstrumentDate!: string;
  @ApiProperty({ example: 18500 }) apdAmount!: number;
  @ApiProperty({ nullable: true, example: 'Karur Vysya Bank' }) apdBankName!: string | null;
  @ApiProperty({ nullable: true }) apdBankBranch!: string | null;
  @ApiProperty({ nullable: true, example: 'KVBL0001234' }) apdIfsc!: string | null;
  @ApiProperty({ nullable: true }) apdMicr!: string | null;
  @ApiProperty({ nullable: true }) apdDrawerName!: string | null;
  @ApiProperty({ example: '2026-09-04' }) apdReceivedOn!: string;
  @ApiProperty({ nullable: true, format: 'uuid' }) apdBankLedgerId!: string | null;
  @ApiProperty({ nullable: true }) bankLedgerName!: string | null;
  @ApiProperty({ enum: PdcPostingMode }) apdPostingMode!: PdcPostingMode;
  @ApiProperty({ enum: PdcStatus }) apdStatus!: PdcStatus;
  @ApiProperty({
    enum: ChequeDueBucket,
    nullable: true,
    description:
      'Computed from the instrument date and TODAY — never stored (§10). NULL once the cheque ' +
      'has left play: a CLEARED cheque is not "overdue", it is finished.',
  })
  dueBucket!: ChequeDueBucket | null;
  @ApiProperty({ example: 1, description: 'How many times it has gone to the bank.' })
  apdPresentCount!: number;
  @ApiProperty({ nullable: true, example: '2026-09-21' }) apdDepositDate!: string | null;
  @ApiProperty({ nullable: true, example: 'D-121' }) apdDepositSlipNo!: string | null;
  @ApiProperty({ nullable: true }) apdClearDate!: string | null;
  @ApiProperty({ nullable: true }) apdBounceDate!: string | null;
  @ApiProperty({ nullable: true }) apdBounceReason!: string | null;
  @ApiProperty({ example: 0 }) apdBounceCharges!: number;
  @ApiProperty({ nullable: true }) apdRemarks!: string | null;
  @ApiProperty({ nullable: true }) apdStatusOn!: string | null;
  @ApiProperty({ nullable: true }) apdStatusBy!: string | null;
}

export class ChequeVoucherRefDto implements ChequeVoucherRef {
  @ApiProperty({ format: 'uuid' }) voucherId!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiProperty({ nullable: true, example: 'chqclr00004' }) voucherRefno!: string | null;
  @ApiProperty({ example: '2026-09-22' }) voucherDate!: string;
  @ApiProperty({ example: 'POSTED' }) voucherStatus!: string;
  @ApiProperty({ example: 18500 }) totalDebit!: number;
  @ApiProperty({ example: 18500 }) totalCredit!: number;
}

export class ChequeVoucherLegDto implements ChequeVoucherLeg {
  @ApiProperty({ example: 1 }) rowNo!: number;
  @ApiProperty({ example: 'DR' }) drCr!: string;
  @ApiProperty({ format: 'uuid' }) ledgerId!: string;
  @ApiProperty({ example: 'Kvb Current A/c' }) ledgerName!: string;
  @ApiProperty({ example: 18500 }) amount!: number;
  @ApiProperty({
    nullable: true,
    example: 'BANK_CHARGES',
    description: 'The role this posted under, so the answer survives a remap.',
  })
  role!: string | null;
  @ApiProperty({ nullable: true }) remarks!: string | null;
}

export class ChequeBillRefDto implements ChequeBillRef {
  @ApiProperty({ format: 'uuid' }) billId!: string;
  @ApiProperty({ example: '2026-2027' }) billAccYear!: string;
  @ApiProperty({ example: 'SALES' }) billType!: string;
  @ApiProperty({ example: 'bil00022' }) docRefno!: string;
  @ApiProperty({ example: '2026-08-14' }) docDate!: string;
  @ApiProperty({ nullable: true, example: '2026-09-13' }) dueDate!: string | null;
  @ApiProperty({ example: 12500 }) billAmount!: number;
  @ApiProperty({
    example: 12500,
    description: 'Recomputed inside the transaction that changed it — not a cached column.',
  })
  pendingAmount!: number;
  @ApiProperty({
    example: 0,
    description:
      "The NET of this cheque's rows on the bill. A bill settled and then reversed by a bounce " +
      'comes back 0 — "what is it paying now", not "what did it once pay".',
  })
  settledByThisCheque!: number;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.1  list
// ═══════════════════════════════════════════════════════════════════════════

export class ChequeListSummaryDto implements ChequeListSummary {
  @ApiProperty({ example: 14 }) inHandCount!: number;
  @ApiProperty({ example: 218400 }) inHandAmount!: number;
  @ApiProperty({ example: 6 }) withBankCount!: number;
  @ApiProperty({ example: 91000 }) withBankAmount!: number;
  @ApiProperty({ example: 1 }) bouncedCount!: number;
  @ApiProperty({ example: 18500 }) bouncedAmount!: number;
  @ApiProperty({ example: 42 }) clearedCount!: number;
  @ApiProperty({ example: 786500 }) clearedAmount!: number;
}

export class ChequeListPayloadDto implements ChequeListPayload {
  @ApiProperty({ type: ChequeRowDto, isArray: true }) rows!: ChequeRowDto[];
  @ApiProperty({ example: 20 }) total!: number;
  @ApiProperty({
    type: ChequeListSummaryDto,
    description:
      'Over the WHOLE register for the scope, not the filtered page — the strip answers "what is ' +
      'in the drawer". §7: IN HAND + WITH THE BANK equals the Cheques In Hand ledger.',
  })
  summary!: ChequeListSummaryDto;
}

export class ChequeListSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: '20 cheque(s)' }) message!: string;
  @ApiProperty({ type: ChequeListPayloadDto }) data!: ChequeListPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.1  get
// ═══════════════════════════════════════════════════════════════════════════

export class ChequeDetailPayloadDto implements ChequeDetailPayload {
  @ApiProperty({ type: ChequeRowDto }) cheque!: ChequeRowDto;
  @ApiProperty({
    nullable: true,
    format: 'uuid',
    description: "From the cheque's OWN tender row (§5), never from today's tender master.",
  })
  chequesInHandLedgerId!: string | null;
  @ApiProperty({ nullable: true }) chequesInHandLedgerName!: string | null;
  @ApiProperty({ type: ChequeVoucherRefDto, nullable: true })
  receiptVoucher!: ChequeVoucherRefDto | null;
  @ApiProperty({ type: ChequeVoucherRefDto, nullable: true })
  clearVoucher!: ChequeVoucherRefDto | null;
  @ApiProperty({ type: ChequeVoucherRefDto, nullable: true })
  bounceVoucher!: ChequeVoucherRefDto | null;
  @ApiProperty({ type: ChequeVoucherRefDto, nullable: true })
  reissueVoucher!: ChequeVoucherRefDto | null;
  @ApiProperty({ type: ChequeBillRefDto, isArray: true }) bills!: ChequeBillRefDto[];
  @ApiProperty({ type: ChequeBillRefDto, nullable: true }) chargeBill!: ChequeBillRefDto | null;
  @ApiProperty({ type: ChequeRowDto, nullable: true }) replaces!: ChequeRowDto | null;
  @ApiProperty({ type: ChequeRowDto, nullable: true }) replacedBy!: ChequeRowDto | null;
}

export class ChequeDetailSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Cheque 221870 fetched successfully' }) message!: string;
  @ApiProperty({ type: ChequeDetailPayloadDto }) data!: ChequeDetailPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.1  history
// ═══════════════════════════════════════════════════════════════════════════

export class ChequeHistoryEntryDto implements ChequeHistoryEntry {
  @ApiProperty({ example: 3 }) seqNo!: number;
  @ApiProperty({ example: 'STATUS_CHANGED' }) event!: string;
  @ApiProperty({ nullable: true, example: 'DEPOSITED' }) fromStatus!: string | null;
  @ApiProperty({ example: 'BOUNCED' }) toStatus!: string;
  @ApiProperty({ example: '2026-09-14T09:12:03.000Z' }) changedOn!: string;
  @ApiProperty({ format: 'uuid' }) changedBy!: string;
  @ApiProperty({ nullable: true }) remarks!: string | null;
}

export class ChequeHistoryPayloadDto implements ChequeHistoryPayload {
  @ApiProperty({ format: 'uuid' }) apdId!: string;
  @ApiProperty({ example: '2026-2027' }) apdAccYear!: string;
  @ApiProperty({ example: '221870' }) apdInstrumentNo!: string;
  @ApiProperty({ type: ChequeHistoryEntryDto, isArray: true, description: 'Newest first.' })
  entries!: ChequeHistoryEntryDto[];
}

export class ChequeHistorySuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: '4 status step(s)' }) message!: string;
  @ApiProperty({ type: ChequeHistoryPayloadDto }) data!: ChequeHistoryPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.2  deposit
// ═══════════════════════════════════════════════════════════════════════════

export class DepositSlipSummaryDto {
  @ApiProperty({ format: 'uuid' }) bankLedgerId!: string;
  @ApiProperty({ example: 'Kvb Current A/c' }) bankLedgerName!: string;
  @ApiProperty({ example: '2026-09-15' }) depositDate!: string;
  @ApiProperty({ example: 'D-121' }) slipNo!: string;
  @ApiProperty({ example: 2 }) chequeCount!: number;
  @ApiProperty({ example: 31000 }) totalAmount!: number;
}

export class ChequeDepositPayloadDto implements ChequeDepositPayload {
  @ApiProperty({ type: ChequeRowDto, isArray: true }) rows!: ChequeRowDto[];
  @ApiProperty({ type: DepositSlipSummaryDto }) slip!: DepositSlipSummaryDto;
}

export class ChequeDepositSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: '2 cheque(s) deposited on slip D-121' }) message!: string;
  @ApiProperty({ type: ChequeDepositPayloadDto }) data!: ChequeDepositPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.3  clear
// ═══════════════════════════════════════════════════════════════════════════

export class ChequeClearPayloadDto implements ChequeClearPayload {
  @ApiProperty({ type: ChequeRowDto }) cheque!: ChequeRowDto;
  @ApiProperty({ type: ChequeVoucherRefDto }) voucher!: ChequeVoucherRefDto;
  @ApiProperty({ type: ChequeVoucherLegDto, isArray: true }) legs!: ChequeVoucherLegDto[];
  @ApiProperty({
    type: ChequeBillRefDto,
    isArray: true,
    description: 'Empty under ON_RECEIPT — the receipt settled the bills weeks ago.',
  })
  billsSettled!: ChequeBillRefDto[];
}

export class ChequeClearSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Cheque 221870 cleared' }) message!: string;
  @ApiProperty({ type: ChequeClearPayloadDto }) data!: ChequeClearPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.4  bounce
// ═══════════════════════════════════════════════════════════════════════════

export class CascadeBillRefDto {
  @ApiProperty({ format: 'uuid' }) billId!: string;
  @ApiProperty({ example: '2026-2027' }) billAccYear!: string;
  @ApiProperty({ example: 'ADV/221870' }) docRefno!: string;
}

export class ChequeCascadeReportDto implements ChequeCascadeReport {
  @ApiProperty({ type: CascadeBillRefDto, isArray: true })
  advanceBillsRemoved!: CascadeBillRefDto[];
  @ApiProperty({ example: 2 }) advanceApplicationsReversed!: number;
  @ApiProperty({
    type: CascadeBillRefDto,
    isArray: true,
    description:
      'An advance this cheque PART-funded, left alone because the voucher behind it carried ' +
      'other money too. Named rather than silently removed or silently kept — see the README.',
  })
  advancesLeftMixed!: CascadeBillRefDto[];
}

export class ChequeBouncePayloadDto implements ChequeBouncePayload {
  @ApiProperty({ type: ChequeRowDto }) cheque!: ChequeRowDto;
  @ApiProperty({ type: ChequeVoucherRefDto }) voucher!: ChequeVoucherRefDto;
  @ApiProperty({
    type: ChequeVoucherLegDto,
    isArray: true,
    description: 'Five under ON_RECEIPT with both charges; the charge legs only under ON_CLEARING.',
  })
  legs!: ChequeVoucherLegDto[];
  @ApiProperty({ type: ChequeBillRefDto, isArray: true }) billsReopened!: ChequeBillRefDto[];
  @ApiProperty({ type: ChequeCascadeReportDto }) cascade!: ChequeCascadeReportDto;
  @ApiProperty({ type: ChequeBillRefDto, nullable: true }) chargeBill!: ChequeBillRefDto | null;
  @ApiProperty({ example: 250 }) bankCharge!: number;
  @ApiProperty({ example: 300 }) partyCharge!: number;
}

export class ChequeBounceSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Cheque 221870 bounced — Funds insufficient' }) message!: string;
  @ApiProperty({ type: ChequeBouncePayloadDto }) data!: ChequeBouncePayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.5  re-present
// ═══════════════════════════════════════════════════════════════════════════

export class ChequeRepresentPayloadDto implements ChequeRepresentPayload {
  @ApiProperty({ type: ChequeRowDto }) cheque!: ChequeRowDto;
  @ApiProperty({
    type: ChequeVoucherRefDto,
    nullable: true,
    description: 'Null under ON_CLEARING: nothing was posted, so nothing is re-issued.',
  })
  reissueVoucher!: ChequeVoucherRefDto | null;
  @ApiProperty({ type: ChequeVoucherLegDto, isArray: true }) legs!: ChequeVoucherLegDto[];
  @ApiProperty({ type: ChequeBillRefDto, isArray: true }) billsAllocated!: ChequeBillRefDto[];
  @ApiProperty({ type: DepositSlipSummaryDto }) slip!: DepositSlipSummaryDto;
}

export class ChequeRepresentSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Cheque 221870 re-presented (presentation 2)' }) message!: string;
  @ApiProperty({ type: ChequeRepresentPayloadDto }) data!: ChequeRepresentPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.6  replace
// ═══════════════════════════════════════════════════════════════════════════

export class ChequeReplacePayloadDto implements ChequeReplacePayload {
  @ApiProperty({ type: ChequeRowDto, description: 'Now REPLACED, pointing at the new row.' })
  oldCheque!: ChequeRowDto;
  @ApiProperty({ type: ChequeRowDto }) newCheque!: ChequeRowDto;
  @ApiProperty({
    type: ChequeVoucherRefDto,
    nullable: true,
    description: 'Present only when replacing from HELD, which returns the old cheque first.',
  })
  reversalVoucher!: ChequeVoucherRefDto | null;
  @ApiProperty({ type: ChequeVoucherRefDto, nullable: true })
  reissueVoucher!: ChequeVoucherRefDto | null;
  @ApiProperty({ type: ChequeVoucherLegDto, isArray: true }) legs!: ChequeVoucherLegDto[];
  @ApiProperty({ type: ChequeBillRefDto, isArray: true }) billsAllocated!: ChequeBillRefDto[];
  @ApiProperty({ type: ChequeCascadeReportDto }) cascade!: ChequeCascadeReportDto;
}

export class ChequeReplaceSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Cheque 221870 replaced by 221955' }) message!: string;
  @ApiProperty({ type: ChequeReplacePayloadDto }) data!: ChequeReplacePayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.7  return
// ═══════════════════════════════════════════════════════════════════════════

export class ChequeReturnPayloadDto implements ChequeReturnPayload {
  @ApiProperty({ type: ChequeRowDto }) cheque!: ChequeRowDto;
  @ApiProperty({ type: ChequeVoucherRefDto, nullable: true })
  reversalVoucher!: ChequeVoucherRefDto | null;
  @ApiProperty({ type: ChequeVoucherLegDto, isArray: true }) legs!: ChequeVoucherLegDto[];
  @ApiProperty({ type: ChequeBillRefDto, isArray: true }) billsReopened!: ChequeBillRefDto[];
  @ApiProperty({ type: ChequeCascadeReportDto }) cascade!: ChequeCascadeReportDto;
}

export class ChequeReturnSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Cheque 221870 returned to the party' }) message!: string;
  @ApiProperty({ type: ChequeReturnPayloadDto }) data!: ChequeReturnPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.8  the deposit slip
// ═══════════════════════════════════════════════════════════════════════════

export class DepositSlipBankAccountDto implements DepositSlipBankAccount {
  @ApiProperty({ format: 'uuid' }) ledgerId!: string;
  @ApiProperty({ example: 'Kvb Current A/c' }) ledgerName!: string;
  @ApiProperty({ nullable: true }) accountHolder!: string | null;
  @ApiProperty({ nullable: true }) bankName!: string | null;
  @ApiProperty({ nullable: true }) branchName!: string | null;
  @ApiProperty({ nullable: true }) accountNo!: string | null;
  @ApiProperty({ nullable: true }) ifscCode!: string | null;
  @ApiProperty({ nullable: true }) micrCode!: string | null;
}

export class DepositSlipLineDto implements DepositSlipLine {
  @ApiProperty({ example: 1 }) lineNo!: number;
  @ApiProperty({ format: 'uuid' }) apdId!: string;
  @ApiProperty({ example: '2026-2027' }) apdAccYear!: string;
  @ApiProperty({ example: 'CHEQUE' }) instrumentType!: string;
  @ApiProperty({ example: '221870' }) instrumentNo!: string;
  @ApiProperty({ example: '2026-09-20' }) instrumentDate!: string;
  @ApiProperty({ nullable: true }) drawnOnBank!: string | null;
  @ApiProperty({ nullable: true }) drawnOnBranch!: string | null;
  @ApiProperty({ nullable: true }) micr!: string | null;
  @ApiProperty({ nullable: true }) drawerName!: string | null;
  @ApiProperty({ example: 'Anand Stores' }) partyName!: string;
  @ApiProperty({ example: 18500 }) amount!: number;
}

export class DepositSlipPayloadDto implements DepositSlipPayload {
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ example: '2026-09-15' }) depositDate!: string;
  @ApiProperty({ example: 'D-121' }) slipNo!: string;
  @ApiProperty({ type: DepositSlipBankAccountDto }) bankAccount!: DepositSlipBankAccountDto;
  @ApiProperty({ type: DepositSlipLineDto, isArray: true }) lines!: DepositSlipLineDto[];
  @ApiProperty({ example: 2 }) chequeCount!: number;
  @ApiProperty({ example: 31000 }) totalAmount!: number;
}

export class DepositSlipSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'Slip D-121: 2 cheque(s)' }) message!: string;
  @ApiProperty({ type: DepositSlipPayloadDto }) data!: DepositSlipPayloadDto;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Errors
// ═══════════════════════════════════════════════════════════════════════════

export class ChequeErrorDetailDto {
  @ApiProperty({
    example: 'bounceDate',
    description: 'The request field this is about — the box the operator is looking at.',
  })
  field!: string;

  @ApiProperty({ example: 'Bounce 221870 on or after 21-09, the day it was deposited' })
  message!: string;
}

export class ChequeErrorResponseDto {
  @ApiProperty({ example: false }) success!: false;
  @ApiProperty({ example: 'Validation failed' }) message!: string;
  @ApiProperty({ type: ChequeErrorDetailDto, isArray: true }) errors!: ChequeErrorDetailDto[];
}
