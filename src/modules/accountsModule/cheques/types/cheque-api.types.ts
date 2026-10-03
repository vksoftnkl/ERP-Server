import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
import type { PdcPostingMode, PdcStatus } from '../../receipt/types/receipt-enum';
import type { ChequeDueBucket } from './cheque-enum';

/**
 * Every shape this module answers with.
 *
 * Interfaces here, classes in `dto/cheque-response.dto.ts` — and each class
 * `implements` its interface, so a field added to one and missed in the other
 * is a compile error rather than a Swagger document that quietly lies. Same
 * arrangement as the receipt module.
 *
 * Money crosses the wire as a `number`, not a Decimal and not a string: every
 * figure here is `Decimal(18, 2)` and JSON's double holds those exactly to far
 * beyond any amount a cheque carries. The arithmetic is Decimal end to end on
 * the server; only the answer is a number.
 */

export type ChequeErrorDetail = ModuleApiErrorDetail;
export type ChequeErrorResponse = ModuleApiErrorResponse;

export type ChequeSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;

// ─── The row ─────────────────────────────────────────────────────────────────

/** One register row, as every endpoint returns it. */
export interface ChequeRow {
  apdId: string;
  apdAccYear: string;
  apdCompanyId: string;
  apdBranchId: string;
  apdTraType: string;
  apdPartyId: string;
  partyName: string;
  apdInstrumentType: string;
  apdInstrumentNo: string;
  /** The POST-DATE written on the cheque — the maturity the due list works from. */
  apdInstrumentDate: string;
  apdAmount: number;
  apdBankName: string | null;
  apdBankBranch: string | null;
  apdIfsc: string | null;
  apdMicr: string | null;
  apdDrawerName: string | null;
  apdReceivedOn: string;
  apdBankLedgerId: string | null;
  bankLedgerName: string | null;
  apdPostingMode: PdcPostingMode;
  apdStatus: PdcStatus;
  /** §10 — computed from the date, never stored. NULL once the cheque is settled. */
  dueBucket: ChequeDueBucket | null;
  apdPresentCount: number;
  apdDepositDate: string | null;
  apdDepositSlipNo: string | null;
  apdClearDate: string | null;
  apdBounceDate: string | null;
  apdBounceReason: string | null;
  apdBounceCharges: number;
  apdRemarks: string | null;
  apdStatusOn: string | null;
  apdStatusBy: string | null;
}

/** A voucher this cheque points at, named so a screen can show it. */
export interface ChequeVoucherRef {
  voucherId: string;
  accYear: string;
  voucherRefno: string | null;
  voucherDate: string;
  voucherStatus: string;
  totalDebit: number;
  totalCredit: number;
}

/** One leg of a voucher this module wrote, for the drill-down on `/get`. */
export interface ChequeVoucherLeg {
  rowNo: number;
  drCr: string;
  ledgerId: string;
  ledgerName: string;
  amount: number;
  role: string | null;
  remarks: string | null;
}

/** A bill the cheque touched, with what it owes NOW. */
export interface ChequeBillRef {
  billId: string;
  billAccYear: string;
  billType: string;
  docRefno: string;
  docDate: string;
  dueDate: string | null;
  billAmount: number;
  /** Recomputed inside the transaction that changed it — not a cached column. */
  pendingAmount: number;
  /** What this cheque settled on it. Negative on a row that was reversed. */
  settledByThisCheque: number;
}

// ─── The reads ───────────────────────────────────────────────────────────────

export interface ChequeListSummary {
  /** HELD — the drawer. */
  inHandCount: number;
  inHandAmount: number;
  /** DEPOSITED — gone to the bank, no answer yet. */
  withBankCount: number;
  withBankAmount: number;
  bouncedCount: number;
  bouncedAmount: number;
  clearedCount: number;
  clearedAmount: number;
}

export interface ChequeListPayload {
  rows: ChequeRow[];
  total: number;
  /** §7's last check: IN HAND + WITH THE BANK equals the Cheques In Hand ledger. */
  summary: ChequeListSummary;
}

export interface ChequeDetailPayload {
  cheque: ChequeRow;
  chequesInHandLedgerId: string | null;
  chequesInHandLedgerName: string | null;
  /** The receipt (or the cheque's own PDC voucher) that took it in. */
  receiptVoucher: ChequeVoucherRef | null;
  clearVoucher: ChequeVoucherRef | null;
  bounceVoucher: ChequeVoucherRef | null;
  /** The re-issue voucher of a re-present or a replacement, when there is one. */
  reissueVoucher: ChequeVoucherRef | null;
  /** Every bill this cheque's adjustment rows name, with its pending amount now. */
  bills: ChequeBillRef[];
  /** The JOURNAL bill a party bounce charge raised, if any. */
  chargeBill: ChequeBillRef | null;
  /** The cheque this one replaced, and the one that replaced it. */
  replaces: ChequeRow | null;
  replacedBy: ChequeRow | null;
}

export interface ChequeHistoryEntry {
  seqNo: number;
  event: string;
  fromStatus: string | null;
  toStatus: string;
  changedOn: string;
  changedBy: string;
  remarks: string | null;
}

export interface ChequeHistoryPayload {
  apdId: string;
  apdAccYear: string;
  apdInstrumentNo: string;
  entries: ChequeHistoryEntry[];
}

// ─── Deposit (§4.2) ──────────────────────────────────────────────────────────

export interface ChequeDepositPayload {
  rows: ChequeRow[];
  /** What `/cheques/deposit-slip` is then asked for. */
  slip: {
    bankLedgerId: string;
    bankLedgerName: string;
    depositDate: string;
    slipNo: string;
    chequeCount: number;
    totalAmount: number;
  };
}

// ─── Clear (§4.3) ────────────────────────────────────────────────────────────

export interface ChequeClearPayload {
  cheque: ChequeRow;
  voucher: ChequeVoucherRef;
  legs: ChequeVoucherLeg[];
  /** Empty under ON_RECEIPT: the receipt already settled the bills. */
  billsSettled: ChequeBillRef[];
}

// ─── Bounce (§4.4) ───────────────────────────────────────────────────────────

/** §4.4 step 6 — what the cascade actually did, reported rather than implied. */
export interface ChequeCascadeReport {
  /** ADVANCE bills soft-deleted because the money behind them bounced. */
  advanceBillsRemoved: Array<{ billId: string; billAccYear: string; docRefno: string }>;
  /** ADVANCE_ADJUST pairs unwound, so an invoice that advance had settled reopens. */
  advanceApplicationsReversed: number;
  /**
   * An ADVANCE this cheque part-funded that was LEFT ALONE because the voucher
   * behind it carried other money too. Named, not silent — see the README.
   */
  advancesLeftMixed: Array<{ billId: string; billAccYear: string; docRefno: string }>;
}

export interface ChequeBouncePayload {
  cheque: ChequeRow;
  voucher: ChequeVoucherRef;
  legs: ChequeVoucherLeg[];
  /** The bills that came back open, with what they owe now. */
  billsReopened: ChequeBillRef[];
  cascade: ChequeCascadeReport;
  /** The JOURNAL DR bill for the party charge. Null when it was 0. */
  chargeBill: ChequeBillRef | null;
  bankCharge: number;
  partyCharge: number;
}

// ─── Re-present (§4.5) ───────────────────────────────────────────────────────

export interface ChequeRepresentPayload {
  cheque: ChequeRow;
  /** Null under ON_CLEARING: nothing was posted, so nothing is re-issued. */
  reissueVoucher: ChequeVoucherRef | null;
  legs: ChequeVoucherLeg[];
  billsAllocated: ChequeBillRef[];
  slip: ChequeDepositPayload['slip'];
}

// ─── Replace (§4.6) ──────────────────────────────────────────────────────────

export interface ChequeReplacePayload {
  /** The old row, now REPLACED and pointing at the new one. */
  oldCheque: ChequeRow;
  newCheque: ChequeRow;
  /** The return reversal, present only when replacing from HELD. */
  reversalVoucher: ChequeVoucherRef | null;
  reissueVoucher: ChequeVoucherRef | null;
  legs: ChequeVoucherLeg[];
  billsAllocated: ChequeBillRef[];
  cascade: ChequeCascadeReport;
}

// ─── Return (§4.7) ───────────────────────────────────────────────────────────

export interface ChequeReturnPayload {
  cheque: ChequeRow;
  reversalVoucher: ChequeVoucherRef | null;
  legs: ChequeVoucherLeg[];
  billsReopened: ChequeBillRef[];
  cascade: ChequeCascadeReport;
}

// ─── Deposit slip (§4.8) ─────────────────────────────────────────────────────

export interface DepositSlipBankAccount {
  ledgerId: string;
  ledgerName: string;
  accountHolder: string | null;
  bankName: string | null;
  branchName: string | null;
  accountNo: string | null;
  ifscCode: string | null;
  micrCode: string | null;
}

export interface DepositSlipLine {
  lineNo: number;
  apdId: string;
  apdAccYear: string;
  instrumentType: string;
  instrumentNo: string;
  instrumentDate: string;
  drawnOnBank: string | null;
  drawnOnBranch: string | null;
  micr: string | null;
  drawerName: string | null;
  partyName: string;
  amount: number;
}

export interface DepositSlipPayload {
  companyId: string;
  branchId: string;
  depositDate: string;
  slipNo: string;
  bankAccount: DepositSlipBankAccount;
  lines: DepositSlipLine[];
  chequeCount: number;
  totalAmount: number;
}
