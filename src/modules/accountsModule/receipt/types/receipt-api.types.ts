import type {
  ModuleApiErrorDetail,
  ModuleApiErrorResponse,
  ModuleApiSuccessResponse,
} from 'src/common/types/module-api.types';
import type {
  BillAdjType,
  BillSettlementMode,
  BillStatus,
  BillType,
  DrCr,
  PdcStatus,
  TcsBasis,
  VoucherStatus,
} from './receipt-enum';

export type ReceiptErrorDetail = ModuleApiErrorDetail;
export type ReceiptErrorResponse = ModuleApiErrorResponse<ReceiptErrorDetail>;
export type ReceiptSuccessResponse<
  T,
  TMeta = Record<string, unknown>,
  TStyles = unknown,
> = ModuleApiSuccessResponse<T, TMeta, TStyles>;

// ═══════════════════════════════════════════════════════════════════════════
//  §4.1  GET /receipts/open-items
// ═══════════════════════════════════════════════════════════════════════════

/** One bill the party owes. */
export interface OpenBill {
  billId: string;
  billAccYear: string;
  billType: BillType;
  docRefno: string;
  docDate: string;
  dueDate: string | null;
  billAmount: number;
  pendingAmount: number;
  status: BillStatus;
  /** 0 when the bill has no due date — it has nothing to be late against. */
  daysOverdue: number;
  /**
   * Post-dated money already promised against this bill, not yet matured.
   *
   * The reason the screen must show it: without it a bill settled entirely by
   * a cheque maturing next week looks exactly like a bill nobody has paid, and
   * the operator collects it twice.
   */
  pdcHeld: number;
  /** R16 — what the slabs suggest at `onDate`. 0 when nothing qualifies. */
  ppdSuggested: number;
  /**
   * §2.13 — TCS under 206C(1H) already charged INSIDE this bill's amount.
   *
   * **0 unless `accounts.tcs_basis` is SALES.** On the RECEIPT basis the
   * invoice carries no TCS at all; the receipt collects it, as a TCS_PAYABLE
   * leg. The two never both apply, and a non-zero figure here is what tells
   * the screen not to expect that leg.
   */
  tcsAmount: number;
  /**
   * How much of `tcsAmount` has not yet been collected — pro-rata of what is
   * still pending on the bill, which is what `accounts.v_bill_tcs` computes.
   *
   * Pro-rata because a part payment pays the WHOLE bill proportionally: the
   * customer does not choose to pay for the goods and withhold the tax. It is
   * the figure that makes bill-wise TCS outstanding answerable, which is the
   * question §2.13 exists for.
   */
  tcsPending: number;
}

/** One credit the party holds. */
export interface OpenCredit {
  billId: string;
  billAccYear: string;
  billType: BillType;
  docRefno: string;
  docDate: string;
  /** Face value. Tooltip only — the panel adjusts against what is LEFT. */
  billAmount: number;
  pendingAmount: number;
  srcModule: string | null;
  srcDocType: string | null;
  srcDocId: string | null;
  srcAccYear: string | null;
  narration: string | null;
  /** OPEN or PARTIAL. CLOSED never reaches a client — nothing left to offer. */
  status: BillStatus;
  /** Which side of the party's account it sits on — CR held, DR paid out. */
  drCr: DrCr;
  /** How it settles — resolved server-side so the client cannot drift. */
  adjType: BillAdjType;
  settlementMode: BillSettlementMode;
}

export interface OpenItemsSummary {
  /** Σ pending on the bills. Receivables only; credits are their own figure. */
  totalPending: number;
  billCount: number;
  overdueCount: number;
  creditsHeld: number;
  /** Σ post-dated money held against this party's bills. */
  pdcHeld: number;
}

/** The party, as the screen's header band shows them. */
export interface OpenItemsParty {
  ledId: string;
  ledName: string;
  groupName: string | null;
  isBillByBill: boolean;
  isTdsApplicable: boolean;
  tdsDeducteeType: string | null;
  isTcsApplicable: boolean;
  /** Echoes `accounts.tcs_basis`, so the client seeds the same line the server would. */
  tcsBasis: TcsBasis;
  tanNo: string | null;
}

export interface OpenItemsPayload {
  bills: OpenBill[];
  credits: OpenCredit[];
  summary: OpenItemsSummary;
  party: OpenItemsParty;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.2  GET /receipts/party-context
// ═══════════════════════════════════════════════════════════════════════════

export interface PartyRecentReceipt {
  voucherId: string;
  accYear: string;
  voucherRefno: string | null;
  voucherDate: string;
  docAmount: number;
  adjustAmount: number;
  /** 'Cash, UPI' — the tender types, de-duplicated. */
  instruments: string | null;
}

export interface PartyPendingCheque {
  pdcId: string;
  accYear: string;
  instrumentNo: string;
  instrumentDate: string;
  amount: number;
  bankName: string | null;
  status: PdcStatus;
  /** The receipt it arrived on, so the panel can open it. */
  voucherId: string | null;
  voucherRefno: string | null;
}

export interface PartyContextPayload {
  partyId: string;
  lastReceipts: PartyRecentReceipt[];
  pendingCheques: PartyPendingCheque[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  §4.3 / §4.5  the receipt itself
// ═══════════════════════════════════════════════════════════════════════════

/** One tender line as the receipt stores it, trimmed to what a receipt needs. */
export interface ReceiptTender {
  tdId: string;
  tdRowNo: number;
  tdTenderId: string;
  tdTenderName: string | null;
  tdTenderTypeId: number;
  tdTenderLedgerId: string;
  tdAmount: number;
  tdSurchargePerc: number;
  tdSurchargeAmt: number;
  tdMdrAmt: number;
  tdReceivedAmt: number;
  tdChangeAmt: number;
  tdRefNo: string | null;
  tdBankName: string | null;
  tdPayerVpa: string | null;
  tdInstrumentDate: string | null;
  tdIsPdc: boolean;
  /** Which voucher carries this instrument's legs. Null until post. */
  tdVoucherId: string | null;
}

/** One other-ledger line — a draft's `avh_draft_lines` entry, or a posted leg. */
export interface ReceiptOtherLine {
  lineNo: number;
  role: string | null;
  ledgerId: string;
  ledgerName: string | null;
  drCr: DrCr;
  amount: number;
  settlesBill: boolean;
  narration: string | null;
}

/** One `acc_vouchers` row. */
export interface ReceiptLeg {
  avId: string;
  avRowNo: number;
  avDrCr: DrCr;
  avLedgerId: string;
  avLedgerName: string | null;
  avAmount: number;
  /** NULL on party and instrument legs; the role on every other-ledger leg. */
  avRole: string | null;
  avRemarks: string | null;
}

/** One `acc_bill_adjustment` row, joined to the bill it names. */
export interface ReceiptAllocation {
  abjId: string;
  billId: string;
  billAccYear: string;
  docRefno: string;
  docDate: string;
  adjType: BillAdjType;
  settlementMode: BillSettlementMode | null;
  drCr: DrCr;
  amount: number;
  adjDate: string;
  isPostDated: boolean;
  /** A post-dated row whose date has arrived — it now counts against the bill. */
  matured: boolean;
  voucherId: string | null;
  chequeId: string | null;
  againstBillId: string | null;
  againstBillRefno: string | null;
  approvedBy: string | null;
  remarks: string | null;
}

/** One `acc_pdc_register` row. */
export interface ReceiptCheque {
  pdcId: string;
  accYear: string;
  tenderRowNo: number | null;
  instrumentType: string;
  instrumentNo: string;
  instrumentDate: string;
  amount: number;
  bankName: string | null;
  bankBranch: string | null;
  ifsc: string | null;
  drawerName: string | null;
  bankLedgerId: string | null;
  status: PdcStatus;
  postingMode: string;
  /** The voucher carrying this cheque's legs. */
  voucherId: string | null;
}

/** A post-dated cheque's own voucher (R2). */
export interface ReceiptPdcVoucher {
  voucherId: string;
  accYear: string;
  voucherRefno: string | null;
  voucherDate: string;
  docAmount: number;
  adjustAmount: number;
  status: VoucherStatus;
  legs: ReceiptLeg[];
}

/** The ADVANCE bill a remainder created (R7). */
export interface ReceiptAdvanceBill {
  billId: string;
  billAccYear: string;
  docRefno: string;
  docDate: string;
  billAmount: number;
  pendingAmount: number;
  /** Which voucher created it — the receipt, or a PDC voucher. */
  voucherId: string | null;
}

export interface ReceiptHeader {
  avhVoucherId: string;
  avhCompanyId: string;
  avhBranchId: string;
  avhTenantId: string | null;
  avhAccYear: string;
  avhVoucherTypeId: number;
  avhVoucherNo: string | null;
  avhVoucherSlno: string | null;
  avhVoucherRefno: string | null;
  avhVoucherDate: string;
  avhPartyId: string;
  avhPartyName: string | null;
  avhEmployeeId: string[];
  avhUsrRefno: string | null;
  avhDocRefno: string | null;
  avhDocDate: string | null;
  avhDocAmount: number;
  avhAdjustAmount: number;
  avhRoundOff: number;
  avhTotalDebit: number;
  avhTotalCredit: number;
  avhRemarks: string | null;
  avhVoucherStatus: VoucherStatus;
  avhStatusOn: string | null;
  avhStatusBy: string | null;
  avhPostedOn: string | null;
  avhCancelReason: string | null;
  /**
   * R20 — how many times this POSTED receipt has been restated in place.
   *
   * 0 is "as first posted". The slip prints "rev n" so a customer holding an
   * older copy can be answered, and a client that intends to amend must hold
   * this value and send it straight back as `baseRevision`: it is the
   * optimistic lock, and an amend carries the WHOLE document, so without it
   * the second of two clients silently undoes the first one's correction — on
   * ledger legs, not on a master record.
   */
  avhRevisionNo: number;
  avhReversalVoucherId: string | null;
  avhAgainstVoucherId: string | null;
  avhPrintCount: number;
  avhDeviceType: string | null;
  avhUserId: string;
  avhCreatedOn: string;
  avhCreatedBy: string | null;
  avhModifiedOn: string | null;
  avhModifiedBy: string | null;
}

/** §4.3 — what a saved DRAFT answers with. */
export interface ReceiptDraftPayload {
  header: ReceiptHeader;
  tenders: ReceiptTender[];
  otherLines: ReceiptOtherLine[];
  /**
   * §5.1 rule 4 — roles the PARTY's own flags imply a line for, that this
   * payload has none of: TDS_RECEIVABLE for a TDS-applicable party,
   * TCS_PAYABLE for a TCS-applicable one under `accounts.tcs_basis = RECEIPT`.
   *
   * Reported rather than seeded because there is no TDS or TCS RATE anywhere in
   * this schema — only the booleans — so the server has no amount to put on the
   * line. The screen prompts; the operator keys what the customer actually
   * withheld, which is the figure that will appear on their 26AS anyway.
   */
  expectedRoles: string[];
}

/*
 * §4.6 — there is NO list payload and no /receipts/list route.
 *
 * The receipt list is a REGISTERED GRID: `fixed.grid_details` holds the SQL,
 * `/configured-grid-sql` runs it, and TxnMainView renders whatever columns the
 * grid declares — which is how every other main list in this system works, and
 * what makes the operator's saved column widths, filters and visibility apply
 * to it. A `findMany` here would be a second definition of the same list with
 * none of that.
 *
 * Migration 20260915120000 registers the grid as 'MAIN LIST - RECEIPTS'.
 */

/** §4.5 — the whole receipt. */
export interface ReceiptPayload {
  header: ReceiptHeader;
  tenders: ReceiptTender[];
  otherLines: ReceiptOtherLine[];
  legs: ReceiptLeg[];
  allocations: ReceiptAllocation[];
  creditsApplied: ReceiptAllocation[];
  cheques: ReceiptCheque[];
  pdcVouchers: ReceiptPdcVoucher[];
  advanceBills: ReceiptAdvanceBill[];
}

/** §4.4 — what a post answers with. */
export interface ReceiptPostPayload extends ReceiptPayload {
  /** The receipt and every PDC voucher, numbered. */
  numberedVouchers: Array<{
    voucherId: string;
    accYear: string;
    voucherRefno: string | null;
    voucherDate: string;
    docAmount: number;
    adjustAmount: number;
    isPdcVoucher: boolean;
  }>;
  /** What the bills came to after the post — the proof the settlement landed. */
  billsAfter: Array<{
    billId: string;
    billAccYear: string;
    docRefno: string;
    billAmount: number;
    pendingAmount: number;
    /** Money promised but not yet matured — pending will fall by this on maturity. */
    postDatedHeld: number;
  }>;
  totalOnAccount: number;
}

/** §4.3a / §4.8 — a status move. */
export interface ReceiptStatusPayload {
  avhVoucherId: string;
  avhAccYear: string;
  avhVoucherRefno: string | null;
  fromStatus: VoucherStatus;
  toStatus: VoucherStatus;
  avhStatusOn: string | null;
  avhStatusBy: string | null;
}

/** §4.8 — cancel says more than a status move. */
export interface ReceiptCancelPayload extends ReceiptStatusPayload {
  /** One reversal per voucher — the receipt and each PDC voucher. */
  reversals: Array<{
    ofVoucherId: string;
    reversalVoucherId: string;
    accYear: string;
    voucherRefno: string | null;
    legCount: number;
    adjustmentCount: number;
  }>;
  billsReopened: Array<{
    billId: string;
    billAccYear: string;
    docRefno: string;
    pendingAmount: number;
  }>;
  chequesCancelled: string[];
  advanceBillsRemoved: string[];
}

/**
 * R20 — `POST /receipts/amend`, a POSTED receipt restated in place.
 *
 * It extends `ReceiptPostPayload` because that is what an amend PRODUCES: the
 * document is posted, by the same fifteen steps, from the new payload. The
 * extra fields are what distinguishes a restatement from a first post —
 * everything the unwind took apart, so a client (and a reviewer) can see that
 * the old money went before the new money arrived.
 *
 * What is deliberately NOT here: a reversal voucher, and a status move. An
 * amended receipt is POSTED before and POSTED after, keeping its
 * `avh_voucher_id`, its `avh_voucher_no` and its `avh_voucher_refno`. The
 * document is not being unmade, it is being restated, and the revision counter
 * is what carries the change.
 */
export interface ReceiptAmendPayload extends ReceiptPostPayload {
  /** What the client sent as `baseRevision`, and what it now is — always +1. */
  fromRevision: number;
  toRevision: number;
  /** Why, as the operator typed it. The trail has to say why (§1). */
  editRemark: string;
  /**
   * What the unwind took apart before the re-apply, counted.
   *
   * Counts rather than rows: the detail is in `audit.audit_log`, which holds
   * the before and the after of every row touched, and duplicating it here
   * would be a second account of the same event that could disagree with it.
   */
  unwound: {
    /** Negative rows written — one per live adjustment the old post made. */
    adjustmentsReversed: number;
    /** Legs soft-deleted, across the receipt and every old PDC voucher. */
    legsRemoved: number;
    /** Old PDC voucher headers retired. Their numbers are not reused. */
    pdcVouchersRemoved: number;
    /** Old `acc_pdc_register` rows retired, freeing their instrument numbers. */
    chequesRemoved: number;
    /** Old ADVANCE bills soft-deleted. Each was proven unspent first. */
    advanceBillsRemoved: number;
    /** Old tender rows soft-deleted. */
    tendersRemoved: number;
  };
}

/** The regularise sweep (§2.1's cron half, as an endpoint). */
export interface RegularisePdcPayload {
  asOf: string;
  billsRegularised: number;
}

/**
 * `POST /receipts/delete` — a DRAFT thrown away.
 *
 * Not a `ReceiptStatusPayload`, because a delete is NOT a status move. The
 * status column is left alone at DRAFT and the row goes out of play through
 * `avh_is_deleted` — which is exactly the distinction `TxnStatusEvent.DELETED`
 * exists to draw against `CANCELLED`. A payload claiming `toStatus: DELETED`
 * would be reporting a status this schema has no value for.
 */
export interface ReceiptDeletePayload {
  avhVoucherId: string;
  avhAccYear: string;
  /** Always null. A draft never took a number — that is what R10 is about. */
  avhVoucherRefno: string | null;
  /** DRAFT, unchanged. The row left play; it did not change its mind. */
  status: VoucherStatus;
  deletedOn: string;
  deletedBy: string;
  /** Tender rows soft-deleted with it. */
  tendersDeleted: number;
  /** Other-ledger lines that were sitting in `avh_draft_lines`. */
  otherLinesDeleted: number;
}
