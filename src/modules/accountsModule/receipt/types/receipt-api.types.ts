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
  /**
   * R-B8 — the CUSTOMER's own reference for this bill, as they printed it on
   * their purchase order or their remittance advice.
   *
   * `docRefno` is OUR number. This is theirs, and it is how an operator holding
   * a customer's advice finds the bill it names — matching on our number means
   * reading it off their paperwork, which is the thing they did not send.
   *
   * Null whenever the bill has no source document to read it from: an OPENING
   * balance, a JOURNAL reference, an ADVANCE. `acc_bill_balance` carries no
   * reference of its own, so this is fetched from the document that raised the
   * bill (`abl_src_doc_id` → `sales.sale_bill.sb_usr_refno`) rather than
   * duplicated onto the balance row, where it would go stale the first time the
   * invoice was corrected.
   */
  usrRefno: string | null;
  docDate: string;
  dueDate: string | null;
  billAmount: number;
  pendingAmount: number;
  status: BillStatus;
  /** 0 when the bill has no due date — it has nothing to be late against. */
  daysOverdue: number;
  /**
   * R-B7 — the margin earned on this bill, tax inclusive, so the operator can
   * see whether the settlement discount they are about to type costs it.
   *
   * ── Read this before using it ────────────────────────────────────────────
   * **Nothing stores a profit per bill.** `sales.sale_bill_item` stores
   * `sbi_item_profit` PER UNIT per line — verified against the data: two lines
   * with the same rate and quantities of 3 and 10 both carry 25.23 — so this is
   * `Σ (sbi_item_profit × sbi_net_qty)` over the source bill's live lines, and
   * it is a DERIVED figure, not a stored one.
   *
   * **The server never computes the per-unit figure either.** It arrives on
   * `/bills/create` from the client and is stored as sent, so this is only as
   * good as what the billing screen put there.
   *
   * `null` means "not answerable", and the client must show it as blank rather
   * than as zero:
   *
   *   · the bill has no sale bill behind it (OPENING, JOURNAL, ADVANCE, a
   *     return), so there are no lines to sum; or
   *   · at least one live line carries no profit figure. A partial sum is worse
   *     than no sum here — it UNDERSTATES the margin, and the one decision this
   *     field exists to inform is whether a discount can be afforded.
   */
  billProfit: number | null;
  /**
   * The same figure PRE-TAX — `Σ (sbi_profit_pre_tax × sbi_net_qty)`, null on
   * exactly the same terms as `billProfit`.
   *
   * Both are given because the two answer different questions and the schema
   * holds both: a settlement discount comes off the gross the customer pays, so
   * `billProfit` is what it eats into, while `billProfitPreTax` is what a
   * margin report means by profit. Picking one server-side would be guessing
   * which of the two the screen is for.
   */
  billProfitPreTax: number | null;
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

/**
 * R-B9 — the figures the party band shows that cannot be added up from
 * anything else in this payload.
 */
export interface PartyContextSummary {
  /**
   * What the party owes, NET, across everything — every open receivable less
   * every credit of theirs the company is holding, whatever year each was
   * raised in.
   *
   * Positive: they owe us. Negative: we are holding more of their money than
   * they owe, which is a real and common state after an advance.
   *
   * Not derivable on the client from `/receipts/open-items`, which answers a
   * narrower question: it lists the RECEIVABLE types a receipt may settle and
   * the CREDIT types it may spend, and a party's balance includes rows that are
   * neither.
   */
  totalBalance: number;
  /** Σ pending on the party's open receivables. The positive half of the net. */
  totalOutstanding: number;
  /** Σ pending on the credits the company holds for them. The negative half. */
  totalCredits: number;
  /**
   * Money promised to this party's bills by post-dated instruments that have
   * NOT yet matured — the total the bill-wise `pdcHeld` column adds up to.
   *
   * Given here rather than left to the client because it is counted from the
   * party's adjustment rows directly, so it stays right no matter which bills
   * the open-items list happens to contain.
   */
  chequesOutstanding: number;
}

export interface PartyContextPayload {
  partyId: string;
  /** The party's name, so the band has something to label itself with. */
  partyName: string;
  summary: PartyContextSummary;
  lastReceipts: PartyRecentReceipt[];
  pendingCheques: PartyPendingCheque[];
}

// ═══════════════════════════════════════════════════════════════════════════
//  R-B4  GET /receipts/adjacent
// ═══════════════════════════════════════════════════════════════════════════

/** One neighbour in the register, with enough on it to label a button. */
export interface AdjacentVoucher {
  voucherId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  voucherRefno: string | null;
  voucherDate: string;
  partyId: string;
  partyName: string | null;
  docAmount: number;
  status: VoucherStatus;
}

/**
 * R-B4 — the receipt before or after this one, in the register's own order.
 *
 * ── What "before" and "after" mean here ──────────────────────────────────
 * The register orders on `(avh_voucher_date, avh_voucher_slno)` and RENDERS it
 * descending, newest at the top. This route talks about the ORDERING KEY, not
 * about the rendered list, because "the row above" reverses meaning the moment
 * somebody adds an ascending sort:
 *
 *   · `prev` — the greatest key strictly BELOW this voucher's: the receipt
 *     entered just before it. Further DOWN the register as it is drawn today.
 *   · `next` — the least key strictly ABOVE it: the receipt entered just after.
 *     Further UP the register as it is drawn today.
 *
 * `voucher` is null at the end of the walk, and that null is the signal to grey
 * the key out — there is no separate `hasNext`, because a second flag saying
 * the same thing is a second thing to keep true.
 */
export interface AdjacentVoucherPayload {
  direction: 'prev' | 'next';
  /** The voucher the caller walked from, echoed so a stale reply is obvious. */
  fromVoucherId: string;
  /** Null at the end of the register under the filters that were applied. */
  voucher: AdjacentVoucher | null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  R-B6  GET /receipts/duplicate-check
// ═══════════════════════════════════════════════════════════════════════════

/** One receipt that looks like the one being keyed. */
export interface DuplicateReceipt {
  voucherId: string;
  accYear: string;
  branchId: string;
  voucherRefno: string | null;
  voucherDate: string;
  docAmount: number;
  status: VoucherStatus;
  /** So the operator can see it was keyed on another beat, or by someone else. */
  createdBy: string | null;
  createdOn: string;
}

/**
 * R-B6 — "has this party already paid this much today?"
 *
 * **A WARNING, never a refusal.** A customer settling two invoices with two
 * equal cheques on one day is ordinary, and a server that refused the second
 * would be wrong about the business. The route answers 200 with whatever it
 * found and the operator decides; it has no opinion and writes nothing.
 */
export interface DuplicateCheckPayload {
  /** True when `matches` is non-empty — the one thing the client branches on. */
  isDuplicate: boolean;
  matches: DuplicateReceipt[];
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

/**
 * One `acc_bill_adjustment` row, joined to the bill it names — **or, on a
 * DRAFT, one settlement the operator arranged and the draft merely remembers.**
 *
 * ── Which one you are holding ────────────────────────────────────────────
 * `header.avhVoucherStatus` says, and so does `abjId`: a remembered row has
 * **`abjId: null`**, because no `acc_bill_adjustment` row exists for it and
 * none ever will until the receipt is posted. Never send that null back
 * anywhere.
 *
 * The rows are otherwise shaped exactly as a posted one — same `adjType`, same
 * `drCr`, discount and write-off expanded into their own DISCOUNT and WRITEOFF
 * rows — so a screen that can paint a posted receipt paints a reopened draft
 * with the same code.
 *
 * ── One difference that cannot be smoothed over ──────────────────────────
 * On a POSTED receipt a `creditsApplied` row names the INVOICE it settled in
 * `billId` and the credit it spent in `againstBillId`. On a DRAFT, `billId` is
 * the CREDIT and `againstBillId` is null — because that is genuinely all the
 * operator has chosen. Which invoices a credit ends up settling is decided by
 * the allocation engine at post, and a draft has not run it.
 *
 * ── A remembered row is a SUGGESTION ─────────────────────────────────────
 * It is handed back exactly as it was stored and is never re-checked, so its
 * amount may exceed what the bill can now take, or name a bill somebody else
 * has since closed. Re-read `/receipts/open-items` on reopen and clamp. See
 * `receipt-draft-lines.ts` for why refusing it here would be the wrong trade.
 */
export interface ReceiptAllocation {
  /** **Null on a DRAFT** — nothing is written until the receipt posts. */
  abjId: string | null;
  billId: string;
  billAccYear: string;
  docRefno: string;
  /** Null when the bill behind a remembered row can no longer be read. */
  docDate: string | null;
  /*
   * ── The bill's own figures ──────────────────────────────────────────────
   *
   * Read straight off `acc_bill_balance` at the moment of the read, and NOT a
   * snapshot of what the bill looked like when this row was written.
   *
   * They are here because a POSTED receipt is painted from this payload alone:
   * the screen deliberately does not call `/receipts/open-items` for one, since
   * what a receipt shows is what it DID, not what the party owes today. Without
   * them the grid has no bill amount and no pending figure to put an
   * "after settlement" column against, and every line reads minus its own
   * settlement.
   *
   * All five are null only when the bill cannot be read, which on a POSTED row
   * cannot happen — `fk_abj_bill` guarantees it — and on a remembered DRAFT row
   * means the bill has since been deleted.
   */
  billType: BillType | null;
  billAmount: number | null;
  /**
   * Pending **as it stands now**, after this receipt. The client derives what
   * it was before by adding this receipt's own settlement back; deriving it the
   * other way round is impossible, which is why this is the figure sent.
   */
  pendingAmount: number | null;
  dueDate: string | null;
  status: BillStatus | null;
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
  /**
   * `abj_reversal_of_id` — the row this one RETRACTS, when it is a reversal.
   *
   * `acc_bill_adjustment` never rewrites a row and never soft-deletes one: an
   * amend or a cancel retracts by inserting the exact negative of it
   * (`ck_abj_reversal_sign` makes that the only legal shape). So an amended
   * receipt answers with the original row, its negative, AND the replacement,
   * and netting per bill is the reader's job.
   *
   * Null on every ordinary row. It is not needed for that netting — a reversal
   * is by constraint the precise negative of its target — but it is the only
   * thing that lets a history view SHOW which correction undid which line.
   */
  reversalOfId: string | null;
  /**
   * This row has been retracted by a later one. Asked of the database, not
   * inferred from the rows in hand: an AMEND files its negatives on the receipt
   * itself, but a CANCEL files them on the reversal voucher, which is not in
   * this payload at all.
   *
   * Always false on a remembered DRAFT row — nothing is written, so nothing can
   * have been reversed.
   */
  isReversed: boolean;
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
  /**
   * R-B1 — bills whose stored figures actually MOVED, which is 0 on a second
   * run over the same data. It used to be the size of the batch, so a no-op
   * sweep reported work it had not done and an operator could not tell a real
   * run from a repeat.
   */
  billsRegularised: number;
  /** Bills examined, so a 0 above reads as "nothing left to do", not "nothing ran". */
  billsExamined: number;
  /** The company the sweep was scoped to. Echoed because the scope is the point. */
  companyId: string;
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
